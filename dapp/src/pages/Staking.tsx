import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { stakingABI, erc20ABI, getAddress } from '@/contracts';
import { useTheme } from '@/contexts/ThemeContext';
import { PageContainer } from '@/components/PageContainer';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Row } from '@/components/Row';
import { TxStatus } from '@/components/TxStatus';

function fmt18(raw: bigint | undefined, decimals = 2): string {
  if (raw === undefined) return '—';
  return Number(formatUnits(raw, 18)).toLocaleString(undefined, {
    maximumFractionDigits: decimals,
  });
}

export default function Staking() {
  const { address, chainId } = useAccount();
  const { theme } = useTheme();

  const stakingAddress = getAddress(chainId, 'Staking');
  const wlfAddress = getAddress(chainId, 'WerewolfToken');

  const [stakeAmount, setStakeAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  // ── Reads ──────────────────────────────────────────────────────────────────

  const { data: apy } = useReadContract({
    address: stakingAddress,
    abi: stakingABI,
    functionName: 'calculateApy',
    query: { enabled: !!stakingAddress },
  });

  const { data: stakedTokens } = useReadContract({
    address: stakingAddress,
    abi: stakingABI,
    functionName: 'getStakedTokens',
    args: [address!],
    query: { enabled: !!address && !!stakingAddress },
  });

  const { data: shares } = useReadContract({
    address: stakingAddress,
    abi: stakingABI,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address && !!stakingAddress },
  });

  const { data: totalAssets } = useReadContract({
    address: stakingAddress,
    abi: stakingABI,
    functionName: 'totalAssets',
    query: { enabled: !!stakingAddress },
  });

  const { data: endStakeTime } = useReadContract({
    address: stakingAddress,
    abi: stakingABI,
    functionName: 'getEndStakeTime',
    args: [address!],
    query: { enabled: !!address && !!stakingAddress },
  });

  const { data: wlfAllowance, refetch: refetchAllowance } = useReadContract({
    address: wlfAddress,
    abi: erc20ABI,
    functionName: 'allowance',
    args: [address!, stakingAddress!],
    query: { enabled: !!address && !!wlfAddress && !!stakingAddress },
  });

  // ── Writes ─────────────────────────────────────────────────────────────────

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });
  const [lastAction, setLastAction] = useState('');

  useEffect(() => {
    if (isConfirmed && lastAction === 'approve') void refetchAllowance();
  }, [isConfirmed, lastAction, refetchAllowance]);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const stakeAmountBig = (() => {
    try { return stakeAmount ? parseUnits(stakeAmount, 18) : 0n; } catch { return 0n; }
  })();

  const needsApproval = wlfAllowance !== undefined && stakeAmountBig > 0n && wlfAllowance < stakeAmountBig;

  const apyDisplay = apy !== undefined
    ? `${(Number(apy) / 100).toFixed(2)}%`
    : '—';

  const lockDisplay = endStakeTime && endStakeTime > 0n
    ? new Date(Number(endStakeTime) * 1000).toLocaleDateString()
    : 'No lock';

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleApprove = () => {
    if (!wlfAddress || !stakingAddress) return;
    setLastAction('approve');
    writeContract({
      address: wlfAddress,
      abi: erc20ABI,
      functionName: 'approve',
      args: [stakingAddress, stakeAmountBig],
    });
  };

  const handleStakeFixed = () => {
    if (!stakingAddress || !address || stakeAmountBig <= 0n) return;
    setLastAction('stake-fixed');
    writeContract({
      address: stakingAddress,
      abi: stakingABI,
      functionName: 'stakeFixedDuration',
      args: [address, stakeAmountBig],
    });
  };

  const handleStakeFlexible = () => {
    if (!stakingAddress || !address || stakeAmountBig <= 0n) return;
    setLastAction('stake-flexible');
    writeContract({
      address: stakingAddress,
      abi: stakingABI,
      functionName: 'stakeFlexibleDuration',
      args: [address, stakeAmountBig],
    });
  };

  const handleWithdraw = () => {
    if (!stakingAddress || !address || !withdrawAmount) return;
    setLastAction('withdraw');
    const amt = parseUnits(withdrawAmount, 18);
    writeContract({
      address: stakingAddress,
      abi: stakingABI,
      functionName: 'withdraw',
      args: [amt, address, address],
    });
  };

  const handleWithdrawAll = () => {
    if (!stakingAddress) return;
    setLastAction('withdraw-all');
    writeContract({
      address: stakingAddress,
      abi: stakingABI,
      functionName: 'withdrawAll',
      args: [],
    });
  };

  // ── Guards ─────────────────────────────────────────────────────────────────

  if (!address) {
    return (
      <PageContainer centered maxWidth="sm">
        <p className={theme.textMuted}>Connect your wallet to access staking.</p>
      </PageContainer>
    );
  }

  if (!stakingAddress) {
    return (
      <PageContainer centered maxWidth="sm">
        <p className={theme.textMuted}>Staking not deployed on chain {chainId}.</p>
      </PageContainer>
    );
  }

  const isLoading = isPending || isConfirming;

  return (
    <PageContainer maxWidth="md">
      <h1 className="text-3xl font-bold mb-6">Staking</h1>

      <div className="space-y-4">
        {/* Info card */}
        <Card title="Overview">
          <div className="space-y-0.5">
            <Row label="Current APY" value={apyDisplay} />
            <Row label="Your staked WLF" value={fmt18(stakedTokens)} />
            <Row label="Your shares (sWLF)" value={fmt18(shares)} />
            <Row label="Total staked in protocol" value={fmt18(totalAssets)} />
            <Row label="Fixed stake unlock" value={lockDisplay} />
            <Row label="WLF approved for staking" value={fmt18(wlfAllowance)} />
          </div>
        </Card>

        <TxStatus isPending={isPending} isConfirming={isConfirming} isConfirmed={isConfirmed} txHash={txHash} label={lastAction} />

        {/* Stake card */}
        <Card title="Stake WLF">
          <Input
            label="Amount"
            type="number"
            value={stakeAmount}
            onChange={(e) => setStakeAmount(e.target.value)}
            placeholder="Amount in WLF"
            disabled={isLoading}
          />
          <div className="mt-3">
            {needsApproval ? (
              <Button
                variant="info"
                fullWidth
                onClick={handleApprove}
                loading={isLoading && lastAction === 'approve'}
                disabled={isLoading}
              >
                Approve WLF
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  onClick={handleStakeFixed}
                  loading={isLoading && lastAction === 'stake-fixed'}
                  disabled={isLoading || stakeAmountBig <= 0n}
                >
                  Fixed (30d lock, +5% APY)
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleStakeFlexible}
                  loading={isLoading && lastAction === 'stake-flexible'}
                  disabled={isLoading || stakeAmountBig <= 0n}
                >
                  Flexible
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Withdraw card */}
        <Card title="Withdraw WLF">
          <Input
            label="Amount"
            type="number"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder="Amount in WLF"
            disabled={isLoading}
          />
          <div className="flex gap-2 mt-3">
            <Button
              variant="danger"
              onClick={handleWithdraw}
              loading={isLoading && lastAction === 'withdraw'}
              disabled={isLoading || !withdrawAmount}
            >
              Withdraw
            </Button>
            <Button
              variant="secondary"
              onClick={handleWithdrawAll}
              loading={isLoading && lastAction === 'withdraw-all'}
              disabled={isLoading}
            >
              Withdraw All
            </Button>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
