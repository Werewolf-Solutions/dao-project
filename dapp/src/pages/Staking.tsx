import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { stakingABI, lpStakingABI, tokenSaleABI, erc20ABI, getAddress } from '@/contracts';
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

// ── LPSaleCard ──────────────────────────────────────────────────────────────
// Shows one sale's LP pool status + stake button if user has an unclaimed purchase.

interface LPSaleCardProps {
  saleId: bigint;
  userAddress: `0x${string}`;
  lpStakingAddress: `0x${string}`;
  tokenSaleAddress: `0x${string}`;
}

function LPSaleCard({ saleId, userAddress, lpStakingAddress, tokenSaleAddress }: LPSaleCardProps) {
  const { theme } = useTheme();

  const { data: usdtLPCreated, refetch: refetchUsdtLPCreated } = useReadContract({
    address: tokenSaleAddress,
    abi: tokenSaleABI,
    functionName: 'saleLPCreated',
    args: [saleId],
  });

  const { data: ethLPCreated } = useReadContract({
    address: tokenSaleAddress,
    abi: tokenSaleABI,
    functionName: 'saleLPETHCreated',
    args: [saleId],
  });

  const { data: purchaseAmount, refetch: refetchPurchase } = useReadContract({
    address: tokenSaleAddress,
    abi: tokenSaleABI,
    functionName: 'purchases',
    args: [saleId, userAddress],
  });

  const { data: usdtLP } = useReadContract({
    address: lpStakingAddress,
    abi: lpStakingABI,
    functionName: 'lpPositions',
    args: [saleId],
  });

  const { data: ethLP } = useReadContract({
    address: lpStakingAddress,
    abi: lpStakingABI,
    functionName: 'ethLPPositions',
    args: [saleId],
  });

  const { writeContract: writeClaim, data: claimTxHash, isPending: isClaimPending } = useWriteContract();
  const { isLoading: isClaimConfirming, isSuccess: isClaimConfirmed } = useWaitForTransactionReceipt({ hash: claimTxHash });

  const { writeContract: writeEndSale, data: endSaleTxHash, isPending: isEndSalePending } = useWriteContract();
  const { isLoading: isEndSaleConfirming, isSuccess: isEndSaleConfirmed } = useWaitForTransactionReceipt({ hash: endSaleTxHash });

  useEffect(() => {
    if (isClaimConfirmed) void refetchPurchase();
  }, [isClaimConfirmed, refetchPurchase]);

  useEffect(() => {
    if (isEndSaleConfirmed) void refetchUsdtLPCreated();
  }, [isEndSaleConfirmed, refetchUsdtLPCreated]);

  const canClaim = purchaseAmount !== undefined && purchaseAmount > 0n && (usdtLPCreated || ethLPCreated);
  const isLoading = isClaimPending || isClaimConfirming;
  const isEndSaleLoading = isEndSalePending || isEndSaleConfirming;
  const anyLPExists = usdtLPCreated || ethLPCreated;

  // Hide card if this sale has no LP activity and user has no purchase
  if (!anyLPExists && (!purchaseAmount || purchaseAmount === 0n)) return null;

  // Pool status chip helpers — ABI returns indexed tuple: [tokenId, totalWLF, totalUSDT, liquidity, initialized]
  const usdtActive  = !!usdtLP?.[4];
  const usdtPending = !!usdtLPCreated && usdtLP !== undefined && !usdtLP[4];
  const showUsdtRow = usdtLPCreated || usdtActive;

  const ethActive   = !!ethLP?.[4];
  const ethPending  = !!ethLPCreated && ethLP !== undefined && !ethLP[4];
  const showEthRow  = ethLPCreated || ethActive;

  const statusChip = (active: boolean, pending: boolean, nftId?: bigint) => {
    if (active)  return <span className="text-sm font-semibold" style={{ color: '#52b788' }}>● Active · NFT #{nftId?.toString()}</span>;
    if (pending) return <span className="text-sm font-semibold" style={{ color: '#e9c46a' }}>● Initializing…</span>;
    return <span className="text-sm" style={{ color: theme.textMuted }}>○ Not created</span>;
  };

  return (
    <Card title={`Sale #${saleId.toString()}`}>
      <div className="space-y-0.5">
        {showUsdtRow && (
          <Row label="WLF/USDT LP" value={statusChip(usdtActive, usdtPending, usdtLP?.[0])} />
        )}
        {showEthRow && (
          <Row label="WLF/ETH LP" value={statusChip(ethActive, ethPending, ethLP?.[0])} />
        )}
        {purchaseAmount !== undefined && purchaseAmount > 0n && (
          <Row label="Your purchase" value={`${fmt18(purchaseAmount)} WLF`} />
        )}
      </div>

      {!anyLPExists && purchaseAmount !== undefined && purchaseAmount > 0n && (
        <div className="mt-4">
          <p className="text-xs mb-3" style={{ color: theme.textMuted }}>
            The Uniswap LP position for this sale has not been created yet.
            Anyone can trigger this step — it only needs to happen once.
          </p>
          <Button
            variant="success"
            fullWidth
            onClick={() =>
              writeEndSale({
                address: tokenSaleAddress,
                abi: tokenSaleABI,
                functionName: 'endSale',
                args: [],
              })
            }
            loading={isEndSaleLoading}
            disabled={isEndSaleLoading}
          >
            Create LP Position
          </Button>
        </div>
      )}

      {canClaim && (
        <div className="mt-4">
          <p className="text-xs mb-3" style={{ color: theme.textMuted }}>
            Your purchase ({fmt18(purchaseAmount)} WLF) was paired with your payment to create a
            Uniswap LP position. Staking it gives you{' '}
            <strong className="text-white">LP shares</strong> that earn WLF rewards continuously.
            Shares are locked for 5 years.
          </p>
          <Button
            variant="primary"
            onClick={() =>
              writeClaim({
                address: tokenSaleAddress,
                abi: tokenSaleABI,
                functionName: 'claimLPShares',
                args: [saleId, true],
              })
            }
            loading={isLoading}
            disabled={isLoading}
            fullWidth
          >
            Stake LP Position (5-yr lock)
          </Button>
          {isClaimConfirmed && (
            <p className="text-sm mt-2" style={{ color: theme.textMuted }}>
              Staked. Your LP shares balance is now updated above.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function Staking() {
  const { address, chainId } = useAccount();
  const { theme } = useTheme();

  const stakingAddress = getAddress(chainId, 'Staking');
  const wlfAddress = getAddress(chainId, 'WerewolfToken');
  const lpStakingAddress = getAddress(chainId, 'LPStaking');
  const tokenSaleAddress = getAddress(chainId, 'TokenSale');

  const [stakeAmount, setStakeAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [activeTab, setActiveTab] = useState<'wlf' | 'lp'>('wlf');
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'lp' || tab === 'wlf') setActiveTab(tab);
  }, [searchParams]);

  // ── WLF Staking reads ───────────────────────────────────────────────────

  const { data: apy } = useReadContract({
    address: stakingAddress,
    abi: stakingABI,
    functionName: 'calculateApy',
    query: { enabled: !!stakingAddress },
  });

  useReadContract({
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

  const { data: wlfWalletBalance } = useReadContract({
    address: wlfAddress,
    abi: erc20ABI,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address && !!wlfAddress, refetchInterval: 10_000 },
  });

  const { data: stakedWlf } = useReadContract({
    address: stakingAddress,
    abi: stakingABI,
    functionName: 'convertToAssets',
    args: [shares ?? 0n],
    query: { enabled: !!stakingAddress && shares !== undefined },
  });

  // ── LP Staking reads ────────────────────────────────────────────────────

  const { data: lpApy } = useReadContract({
    address: lpStakingAddress,
    abi: lpStakingABI,
    functionName: 'calculateAPY',
    query: { enabled: !!lpStakingAddress, refetchInterval: 10_000 },
  });

  const { data: lpShares, refetch: refetchLpShares } = useReadContract({
    address: lpStakingAddress,
    abi: lpStakingABI,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address && !!lpStakingAddress },
  });

  const { data: lpEarned, refetch: refetchLpEarned } = useReadContract({
    address: lpStakingAddress,
    abi: lpStakingABI,
    functionName: 'earned',
    args: [address!],
    query: { enabled: !!address && !!lpStakingAddress, refetchInterval: 5_000 },
  });

  const { data: lockTime } = useReadContract({
    address: lpStakingAddress,
    abi: lpStakingABI,
    functionName: 'fixedLockUnlockTime',
    args: [address!],
    query: { enabled: !!address && !!lpStakingAddress },
  });

  const { data: saleIdCounter } = useReadContract({
    address: tokenSaleAddress,
    abi: tokenSaleABI,
    functionName: 'saleIdCounter',
    query: { enabled: !!tokenSaleAddress, refetchInterval: 10_000 },
  });

  // ── Growing reward counter ──────────────────────────────────────────────

  const [displayReward, setDisplayReward] = useState<bigint>(0n);

  // Sync to chain value on each poll
  useEffect(() => {
    if (lpEarned !== undefined) setDisplayReward(lpEarned);
  }, [lpEarned]);

  // Tick forward each second between polls using estimated per-second yield
  useEffect(() => {
    if (!lpShares || !lpApy || lpShares === 0n || lpApy === 0n) return;
    const YEAR_SECONDS = 31_536_000n;
    const PERCENTAGE_SCALE = 100_000n;
    const perSecond = (lpShares * lpApy) / (YEAR_SECONDS * PERCENTAGE_SCALE);
    if (perSecond === 0n) return;
    const id = setInterval(() => setDisplayReward((prev) => prev + perSecond), 1_000);
    return () => clearInterval(id);
  }, [lpShares, lpApy]);

  // ── WLF Staking writes ──────────────────────────────────────────────────

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });
  const [lastAction, setLastAction] = useState('');

  useEffect(() => {
    if (isConfirmed && lastAction === 'approve') void refetchAllowance();
  }, [isConfirmed, lastAction, refetchAllowance]);

  // ── LP Staking writes ───────────────────────────────────────────────────

  const { writeContract: writeLp, data: lpTxHash, isPending: isLpPending } = useWriteContract();
  const { isLoading: isLpConfirming, isSuccess: isLpConfirmed } = useWaitForTransactionReceipt({ hash: lpTxHash });
  const [lastLpAction, setLastLpAction] = useState('');

  useEffect(() => {
    if (isLpConfirmed) {
      void refetchLpEarned();
      void refetchLpShares();
    }
  }, [isLpConfirmed, refetchLpEarned, refetchLpShares]);

  // ── Derived ─────────────────────────────────────────────────────────────

  const stakeAmountBig = (() => {
    try { return stakeAmount ? parseUnits(stakeAmount, 18) : 0n; } catch { return 0n; }
  })();

  const needsApproval = wlfAllowance !== undefined && stakeAmountBig > 0n && wlfAllowance < stakeAmountBig;
  // Both contracts use PERCENTAGE_SCALE = 100_000, so 80% → 80_000. Divide by 1_000 to get %.
  const apyDisplay = apy !== undefined ? `${(Number(apy) / 1_000).toFixed(2)}%` : '—';
  const lpApyDisplay = lpApy !== undefined ? `${(Number(lpApy) / 1_000).toFixed(2)}%` : '—';

  const lockDisplay = endStakeTime && endStakeTime > 0n
    ? new Date(Number(endStakeTime) * 1000).toLocaleDateString()
    : 'No lock';

  const now = BigInt(Math.floor(Date.now() / 1000));
  const isLpLocked = lockTime !== undefined && lockTime > 0n && now < lockTime;
  const lpLockDisplay = lockTime && lockTime > 0n
    ? new Date(Number(lockTime) * 1000).toLocaleDateString()
    : 'No lock';

  // Build saleId array [0 .. saleIdCounter]
  const saleIds: bigint[] = [];
  if (saleIdCounter !== undefined) {
    for (let i = 0n; i <= saleIdCounter; i++) saleIds.push(i);
  }

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleApprove = () => {
    if (!wlfAddress || !stakingAddress) return;
    setLastAction('approve');
    writeContract({ address: wlfAddress, abi: erc20ABI, functionName: 'approve', args: [stakingAddress, stakeAmountBig] });
  };

  const handleStakeFixed = () => {
    if (!stakingAddress || !address || stakeAmountBig <= 0n) return;
    setLastAction('stake-fixed');
    writeContract({ address: stakingAddress, abi: stakingABI, functionName: 'stakeFixedDuration', args: [address, stakeAmountBig] });
  };

  const handleStakeFlexible = () => {
    if (!stakingAddress || !address || stakeAmountBig <= 0n) return;
    setLastAction('stake-flexible');
    writeContract({ address: stakingAddress, abi: stakingABI, functionName: 'stakeFlexibleDuration', args: [address, stakeAmountBig] });
  };

  const handleWithdraw = () => {
    if (!stakingAddress || !address || !withdrawAmount) return;
    setLastAction('withdraw');
    writeContract({ address: stakingAddress, abi: stakingABI, functionName: 'withdraw', args: [parseUnits(withdrawAmount, 18), address, address] });
  };

  const handleWithdrawAll = () => {
    if (!stakingAddress) return;
    setLastAction('withdraw-all');
    writeContract({ address: stakingAddress, abi: stakingABI, functionName: 'withdrawAll', args: [] });
  };

  const handleLpClaimRewards = () => {
    if (!lpStakingAddress) return;
    setLastLpAction('claim-rewards');
    writeLp({ address: lpStakingAddress, abi: lpStakingABI, functionName: 'claimRewards', args: [] });
  };

  const handleLpWithdraw = () => {
    if (!lpStakingAddress || !lpShares || lpShares === 0n) return;
    setLastLpAction('lp-withdraw');
    writeLp({ address: lpStakingAddress, abi: lpStakingABI, functionName: 'withdraw', args: [lpShares] });
  };

  // ── Guards ──────────────────────────────────────────────────────────────

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
  const isLpLoading = isLpPending || isLpConfirming;

  return (
    <PageContainer maxWidth="md">
      <h1 className="text-3xl font-bold mb-4">Staking</h1>

      {/* ── Tab bar ── */}
      <div className="flex gap-2 mb-6">
        {(['wlf', 'lp'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-[#8e2421] text-white'
                : `bg-[#0f1117] ${theme.textMuted} hover:text-white`
            }`}
          >
            {tab === 'wlf' ? 'WLF Staking' : 'LP Staking'}
          </button>
        ))}
      </div>

      <div className="space-y-4">

        {/* ── Your Balances (tab-scoped) ── */}
        {activeTab === 'wlf' ? (
          <Card title="Your Balances">
            <div className="space-y-0.5">
              <Row label="WLF in wallet"             value={`${fmt18(wlfWalletBalance)} WLF`} />
              <Row label="WLF staked"                value={`${fmt18(stakedWlf)} WLF`} />
              <Row label="WLF staking shares (sWLF)" value={fmt18(shares)} />
            </div>
          </Card>
        ) : (
          <Card title="Your Balances">
            <div className="space-y-0.5">
              <Row label="LP staking shares (sWLP)" value={fmt18(lpShares)} />
              <Row label="Unclaimed LP rewards"      value={`${fmt18(displayReward, 6)} WLF`} />
            </div>
          </Card>
        )}

        {/* ── WLF Staking section ── */}
        {activeTab === 'wlf' && (
          <>
            <h2 className="text-xl font-semibold">WLF Staking</h2>

            <Card title="Overview">
              <div className="space-y-0.5">
                <Row label="Current APY" value={apyDisplay} />
                <Row label="Total staked in protocol" value={fmt18(totalAssets)} />
                <Row label="Fixed stake unlock" value={lockDisplay} />
                <Row label="WLF approved for staking" value={fmt18(wlfAllowance)} />
              </div>
            </Card>

            <TxStatus isPending={isPending} isConfirming={isConfirming} isConfirmed={isConfirmed} txHash={txHash} label={lastAction} />

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
                  <Button variant="info" fullWidth onClick={handleApprove} loading={isLoading && lastAction === 'approve'} disabled={isLoading}>
                    Approve WLF
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="primary" onClick={handleStakeFixed} loading={isLoading && lastAction === 'stake-fixed'} disabled={isLoading || stakeAmountBig <= 0n}>
                      Fixed (30d lock, +5% APY)
                    </Button>
                    <Button variant="secondary" onClick={handleStakeFlexible} loading={isLoading && lastAction === 'stake-flexible'} disabled={isLoading || stakeAmountBig <= 0n}>
                      Flexible
                    </Button>
                  </div>
                )}
              </div>
            </Card>

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
                <Button variant="danger" onClick={handleWithdraw} loading={isLoading && lastAction === 'withdraw'} disabled={isLoading || !withdrawAmount}>
                  Withdraw
                </Button>
                <Button variant="secondary" onClick={handleWithdrawAll} loading={isLoading && lastAction === 'withdraw-all'} disabled={isLoading}>
                  Withdraw All
                </Button>
              </div>
            </Card>
          </>
        )}

        {/* ── LP Staking section ── */}
        {activeTab === 'lp' && lpStakingAddress && (
          <>
            <h2 className="text-xl font-semibold">LP Staking</h2>

            <Card title="LP Staking Overview">
              <div className="space-y-0.5">
                <Row label="Current APY" value={lpApyDisplay} />
                <Row label="5-year lock expires" value={lpLockDisplay} />
              </div>
            </Card>

            {/* Per-sale LP position cards */}
            {tokenSaleAddress &&
              saleIds.map((saleId) => (
                <LPSaleCard
                  key={saleId.toString()}
                  saleId={saleId}
                  userAddress={address}
                  lpStakingAddress={lpStakingAddress}
                  tokenSaleAddress={tokenSaleAddress}
                />
              ))}

            <TxStatus isPending={isLpPending} isConfirming={isLpConfirming} isConfirmed={isLpConfirmed} txHash={lpTxHash} label={lastLpAction} />

            <Card title="LP Staking Actions">
              <div className="space-y-3">
                <div>
                  <p className={`text-sm mb-2 ${theme.textMuted}`}>
                    Accrued: <span className="font-mono">{fmt18(displayReward, 6)} WLF</span>
                  </p>
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={handleLpClaimRewards}
                    loading={isLpLoading && lastLpAction === 'claim-rewards'}
                    disabled={isLpLoading || !displayReward || displayReward === 0n}
                  >
                    Claim WLF Rewards
                  </Button>
                </div>

                <div>
                  <p className={`text-sm mb-2 ${theme.textMuted}`}>
                    {isLpLocked
                      ? `Locked until ${lpLockDisplay} — shares cannot be withdrawn yet`
                      : lpShares && lpShares > 0n
                      ? `${fmt18(lpShares)} LP shares available to withdraw`
                      : 'No LP shares to withdraw'}
                  </p>
                  <Button
                    variant="danger"
                    fullWidth
                    onClick={handleLpWithdraw}
                    loading={isLpLoading && lastLpAction === 'lp-withdraw'}
                    disabled={isLpLoading || isLpLocked || !lpShares || lpShares === 0n}
                  >
                    {isLpLocked ? `Locked until ${lpLockDisplay}` : 'Withdraw All LP Shares'}
                  </Button>
                </div>
              </div>

              <p className={`text-xs mt-4 ${theme.textMuted}`}>
                Rewards accrue continuously. Use <strong>Claim WLF Rewards</strong> to receive them.
                Withdrawing shares does <strong>not</strong> auto-claim rewards — always claim first.
                LP shares are locked for 5 years from your first claim.
              </p>
            </Card>
          </>
        )}

      </div>
    </PageContainer>
  );
}
