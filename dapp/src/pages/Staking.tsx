import { useState, useEffect, useRef } from 'react';
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

// ── Duration config ──────────────────────────────────────────────────────────

const DURATIONS = [
  { label: 'Flexible',  seconds: 0,                multiplier: 1.00, multiplierLabel: '1x'    },
  { label: '30 days',   seconds: 30  * 24 * 3600,  multiplier: 1.05, multiplierLabel: '1.05x' },
  { label: '3 months',  seconds: 90  * 24 * 3600,  multiplier: 1.1,  multiplierLabel: '1.1x'  },
  { label: '6 months',  seconds: 180 * 24 * 3600,  multiplier: 1.2,  multiplierLabel: '1.2x'  },
  { label: '1 year',    seconds: 365 * 24 * 3600,  multiplier: 1.5,  multiplierLabel: '1.5x'  },
  { label: '2 years',   seconds: 730 * 24 * 3600,  multiplier: 2.0,  multiplierLabel: '2x'    },
  { label: '5 years',   seconds: 1825 * 24 * 3600, multiplier: 2.5,  multiplierLabel: '2.5x'  },
  { label: '10 years',  seconds: 3650 * 24 * 3600, multiplier: 3.0,  multiplierLabel: '3x'    },
] as const;

// Map bonusApy (PERCENTAGE_SCALE) stored in position struct to a multiplier label
function bonusApyToMultiplierLabel(bonusApy: bigint): string {
  const n = Number(bonusApy);
  if (n === 0)       return '1x APY';
  if (n <= 5_000)    return '1.05x APY';
  if (n <= 10_000)   return '1.1x APY';
  if (n <= 15_000)   return '1.2x APY';
  if (n <= 25_000)   return '1.5x APY';
  if (n <= 40_000)   return '2x APY';
  if (n <= 60_000)   return '2.5x APY';
  return '3x APY';
}

function durationSecondsToBonus(seconds: number): bigint {
  const map: Record<number, bigint> = {
    [30   * 24 * 3600]:  5_000n,
    [90   * 24 * 3600]: 10_000n,
    [180  * 24 * 3600]: 15_000n,
    [365  * 24 * 3600]: 25_000n,
    [730  * 24 * 3600]: 40_000n,
    [1825 * 24 * 3600]: 60_000n,
    [3650 * 24 * 3600]: 80_000n,
  };
  return map[seconds] ?? 0n;
}

function durationLabel(stakedAt: bigint, unlockAt: bigint): string {
  if (unlockAt === 0n) return 'Flexible';
  const days = Math.round(Number(unlockAt - stakedAt) / 86400);
  if (days <= 30)   return '30 days';
  if (days <= 90)   return '3 months';
  if (days <= 180)  return '6 months';
  if (days <= 366)  return '1 year';
  if (days <= 731)  return '2 years';
  if (days <= 1826) return '5 years';
  return '10 years';
}

type StakePosition = {
  shares:   bigint;
  assets:   bigint;
  stakedAt: bigint;
  unlockAt: bigint;
  bonusApy: bigint;
  active:   boolean;
};

// ── WLF Position Card ────────────────────────────────────────────────────────

interface WlfPositionCardProps {
  index:                    number;
  pos:                      StakePosition;
  apy:                      bigint | undefined;
  totalAssets:              bigint | undefined;
  totalShares:              bigint | undefined;
  positionTick:             number;
  withdrawInput:            string;
  stakeMoreInput:           string;
  onWithdrawInputChange:    (val: string) => void;
  onStakeMoreInputChange:   (val: string) => void;
  onWithdrawAll:            () => void;
  onWithdrawAmount:         () => void;
  onWithdrawRewards:        (reward: bigint) => void;
  onAddToPosition:          () => void;
  needsApprovalForAdd:      boolean;
  isWithdrawAllLoading:     boolean;
  isWithdrawAmountLoading:  boolean;
  isWithdrawRewardsLoading: boolean;
  isAddToPositionLoading:   boolean;
  anyLoading:               boolean;
}

function WlfPositionCard({
  index, pos, apy, totalAssets, totalShares, positionTick,
  withdrawInput, stakeMoreInput,
  onWithdrawInputChange, onStakeMoreInputChange,
  onWithdrawAll, onWithdrawAmount, onWithdrawRewards, onAddToPosition,
  needsApprovalForAdd,
  isWithdrawAllLoading, isWithdrawAmountLoading, isWithdrawRewardsLoading, isAddToPositionLoading,
  anyLoading,
}: WlfPositionCardProps) {
  const now = BigInt(Math.floor(Date.now() / 1000));
  const isFixed   = pos.unlockAt > 0n;
  const isLocked  = isFixed && now < pos.unlockAt;
  const label           = durationLabel(pos.stakedAt, pos.unlockAt);
  const multiplierLabel = bonusApyToMultiplierLabel(pos.bonusApy);

  // Current value from actual on-chain shares × vault exchange rate (pos.shares * totalAssets / totalShares).
  // Live tick growth: simulate reward accrual since last chain refresh by advancing totalAssets.
  const perSecond = totalAssets && apy && apy > 0n
    ? totalAssets * apy / (31_536_000n * 100_000n)
    : 0n;
  const tickedAssets = totalAssets !== undefined
    ? totalAssets + perSecond * BigInt(positionTick)
    : undefined;
  const currentValue = tickedAssets !== undefined && totalShares && totalShares > 0n
    ? pos.shares * tickedAssets / totalShares
    : pos.assets;

  // Rewards = value above original principal (pos.assets never changes on-chain after partial withdrawals).
  const earned = currentValue > pos.assets ? currentValue - pos.assets : 0n;

  // WLF value = current share-based value (principal + accumulated rewards)
  const displayValue = currentValue;

  const wlfPerDay = apy && apy > 0n
    ? currentValue * apy / (365n * 100_000n)
    : 0n;

  const unlockDate = isFixed
    ? new Date(Number(pos.unlockAt) * 1000).toLocaleDateString()
    : null;

  const typeColor  = isFixed ? '#e9c46a' : '#52b788';
  const typeBadge  = isFixed
    ? `Fixed · ${label} · ${multiplierLabel}`
    : 'Flexible · 1x APY';

  const canWithdraw  = !isLocked;
  const withdrawBig  = (() => { try { return withdrawInput ? parseUnits(withdrawInput, 18) : 0n; } catch { return 0n; } })();

  return (
    <Card title={`Position #${index + 1}`}>
      <div className="space-y-0.5">
        <Row
          label="Type"
          value={<span className="font-semibold text-sm" style={{ color: typeColor }}>{typeBadge}</span>}
        />
        <Row
          label="WLF value"
          value={
            <span className="font-mono font-semibold" style={{ color: '#52b788' }}>
              {fmt18(displayValue, 6)} WLF
            </span>
          }
        />
        <Row
          label="Earned since deposit"
          value={
            <span className="font-mono" style={{ color: earned > 0n ? '#52b788' : undefined }}>
              +{fmt18(earned, 6)} WLF
            </span>
          }
        />
        <Row
          label="Earning ~"
          value={wlfPerDay > 0n ? `${fmt18(wlfPerDay, 6)} WLF / day` : '—'}
        />
        {isFixed && (
          <Row
            label={isLocked ? 'Locked until' : 'Unlocked on'}
            value={
              <span className="font-medium" style={{ color: isLocked ? '#e9c46a' : '#52b788' }}>
                {unlockDate}
                {isLocked && ' 🔒'}
              </span>
            }
          />
        )}
        <Row label="Shares" value={fmt18(pos.shares, 6)} />
      </div>

      <div className="mt-4 space-y-2">
        {/* Withdraw amount row */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Input
              label="Withdraw amount (WLF)"
              type="number"
              value={withdrawInput}
              onChange={(e) => onWithdrawInputChange(e.target.value)}
              placeholder="0.00"
              disabled={anyLoading || !canWithdraw}
            />
          </div>
          <Button
            variant="danger"
            onClick={onWithdrawAmount}
            loading={isWithdrawAmountLoading}
            disabled={anyLoading || !canWithdraw || withdrawBig <= 0n}
          >
            Withdraw
          </Button>
        </div>

        {/* Withdraw rewards only (no principal) */}
        {earned > 0n && canWithdraw && (
          <Button
            variant="secondary"
            fullWidth
            onClick={() => onWithdrawRewards(earned)}
            loading={isWithdrawRewardsLoading}
            disabled={anyLoading}
            title="Withdraw only accrued rewards, keep principal staked"
          >
            Withdraw Rewards (~{fmt18(earned, 4)} WLF)
          </Button>
        )}

        {/* Withdraw all */}
        <Button
          variant="danger"
          fullWidth
          onClick={onWithdrawAll}
          loading={isWithdrawAllLoading}
          disabled={anyLoading || !canWithdraw}
        >
          {isLocked ? `Locked until ${unlockDate}` : 'Withdraw All'}
        </Button>

        {/* Stake More — inline add to this position */}
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Input
              label="Add stake (WLF)"
              type="number"
              value={stakeMoreInput}
              onChange={(e) => onStakeMoreInputChange(e.target.value)}
              placeholder="0.00"
              disabled={anyLoading}
            />
          </div>
          <Button
            variant="primary"
            onClick={onAddToPosition}
            loading={isAddToPositionLoading}
            disabled={anyLoading || !stakeMoreInput || parseFloat(stakeMoreInput) <= 0}
          >
            {needsApprovalForAdd ? 'Approve' : 'Stake More'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ── LPSaleCard ──────────────────────────────────────────────────────────────

interface LPSaleCardProps {
  saleId:           bigint;
  userAddress:      `0x${string}`;
  lpStakingAddress: `0x${string}`;
  tokenSaleAddress: `0x${string}`;
}

function LPSaleCard({ saleId, userAddress, lpStakingAddress, tokenSaleAddress }: LPSaleCardProps) {
  const { theme } = useTheme();

  const { data: usdtLPCreated, refetch: refetchUsdtLPCreated } = useReadContract({
    address: tokenSaleAddress, abi: tokenSaleABI, functionName: 'saleLPCreated', args: [saleId],
  });
  const { data: purchaseAmount, refetch: refetchPurchase } = useReadContract({
    address: tokenSaleAddress, abi: tokenSaleABI, functionName: 'purchases', args: [saleId, userAddress],
  });
  const { data: usdtLP } = useReadContract({
    address: lpStakingAddress, abi: lpStakingABI, functionName: 'lpPositions', args: [saleId],
  });

  const { writeContract: writeEndSale, data: endSaleTxHash, isPending: isEndSalePending } = useWriteContract();
  const { isLoading: isEndSaleConfirming, isSuccess: isEndSaleConfirmed } = useWaitForTransactionReceipt({ hash: endSaleTxHash });

  useEffect(() => {
    if (isEndSaleConfirmed) {
      void refetchUsdtLPCreated();
      void refetchPurchase();
    }
  }, [isEndSaleConfirmed, refetchUsdtLPCreated, refetchPurchase]);

  const isEndSaleLoading = isEndSalePending || isEndSaleConfirming;
  const anyLPExists = usdtLPCreated;

  if (!anyLPExists && (!purchaseAmount || purchaseAmount === 0n)) return null;

  const usdtActive  = !!usdtLP?.[4];
  const usdtPending = !!usdtLPCreated && usdtLP !== undefined && !usdtLP[4];
  const showUsdtRow = usdtLPCreated || usdtActive;

  const statusChip = (active: boolean, pending: boolean, nftId?: bigint) => {
    if (active)  return <span className="text-sm font-semibold" style={{ color: '#52b788' }}>● Active · NFT #{nftId?.toString()}</span>;
    if (pending) return <span className="text-sm font-semibold" style={{ color: '#e9c46a' }}>● Initializing…</span>;
    return <span className="text-sm" style={{ color: theme.textMuted }}>○ Not created</span>;
  };

  return (
    <Card title={`Sale #${saleId.toString()}`}>
      <div className="space-y-0.5">
        {showUsdtRow && <Row label="WLF/USDT LP" value={statusChip(usdtActive, usdtPending, usdtLP?.[0])} />}
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
          <Button variant="success" fullWidth
            onClick={() => writeEndSale({ address: tokenSaleAddress, abi: tokenSaleABI, functionName: 'endSale', args: [] })}
            loading={isEndSaleLoading} disabled={isEndSaleLoading}>
            Create LP Position
          </Button>
        </div>
      )}
      {anyLPExists && purchaseAmount !== undefined && purchaseAmount > 0n && (
        <p className="text-xs mt-3" style={{ color: theme.textMuted }}>
          Your LP shares were automatically locked for 5 years when the sale ended.
          Check your <strong className="text-white">LP staking shares (sWLP)</strong> balance above.
        </p>
      )}
    </Card>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function Staking() {
  const { address, chainId } = useAccount();
  const { theme } = useTheme();

  const stakingAddress   = getAddress(chainId, 'Staking');
  const wlfAddress       = getAddress(chainId, 'WerewolfToken');
  const lpStakingAddress = getAddress(chainId, 'LPStaking');
  const tokenSaleAddress = getAddress(chainId, 'TokenSale');

  const [activeTab, setActiveTab] = useState<'wlf' | 'lp'>('wlf');
  const [searchParams] = useSearchParams();
  const newPositionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'lp' || tab === 'wlf') setActiveTab(tab);
  }, [searchParams]);

  // ── New position form state ──────────────────────────────────────────────

  const [stakeAmount, setStakeAmount] = useState('');
  const [selectedDuration, setSelectedDuration] = useState<typeof DURATIONS[number]>(DURATIONS[0]);

  // ── Per-position withdraw / stake-more inputs ────────────────────────────

  const [posWithdrawInputs, setPosWithdrawInputs] = useState<Record<number, string>>({});
  const [posStakeInputs, setPosStakeInputs]       = useState<Record<number, string>>({});
  const [showRewardsBreakdown, setShowRewardsBreakdown] = useState(false);

  // ── WLF staking reads ────────────────────────────────────────────────────

  const { data: apy } = useReadContract({
    address: stakingAddress, abi: stakingABI, functionName: 'currentApy',
    query: { enabled: !!stakingAddress, refetchInterval: 15_000 },
  });

  const { data: contractMinApy } = useReadContract({
    address: stakingAddress, abi: stakingABI, functionName: 'minApy',
    query: { enabled: !!stakingAddress, refetchInterval: 60_000 },
  });

  const { data: contractMaxApy } = useReadContract({
    address: stakingAddress, abi: stakingABI, functionName: 'maxApy',
    query: { enabled: !!stakingAddress, refetchInterval: 60_000 },
  });

  const { data: totalShares } = useReadContract({
    address: stakingAddress, abi: stakingABI, functionName: 'totalSupply',
    query: { enabled: !!stakingAddress, refetchInterval: 15_000 },
  });

  const { data: totalAssets } = useReadContract({
    address: stakingAddress, abi: stakingABI, functionName: 'totalAssets',
    query: { enabled: !!stakingAddress, refetchInterval: 15_000 },
  });

  const { data: positions, refetch: refetchPositions } = useReadContract({
    address: stakingAddress, abi: stakingABI, functionName: 'getPositions',
    args: [address!],
    query: { enabled: !!address && !!stakingAddress, refetchInterval: 15_000 },
  });

  const { data: wlfWalletBalance } = useReadContract({
    address: wlfAddress, abi: erc20ABI, functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address && !!wlfAddress, refetchInterval: 10_000 },
  });

  const { data: wlfTotalSupply } = useReadContract({
    address: wlfAddress, abi: erc20ABI, functionName: 'totalSupply',
    query: { enabled: !!wlfAddress, refetchInterval: 30_000 },
  });


  const { data: wlfAllowance, refetch: refetchAllowance } = useReadContract({
    address: wlfAddress, abi: erc20ABI, functionName: 'allowance',
    args: [address!, stakingAddress!],
    query: { enabled: !!address && !!wlfAddress && !!stakingAddress },
  });

  // ── LP staking reads ─────────────────────────────────────────────────────

  const { data: lpApy } = useReadContract({
    address: lpStakingAddress, abi: lpStakingABI, functionName: 'calculateAPY',
    query: { enabled: !!lpStakingAddress, refetchInterval: 10_000 },
  });

  const { data: lpShares, refetch: refetchLpShares } = useReadContract({
    address: lpStakingAddress, abi: lpStakingABI, functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address && !!lpStakingAddress },
  });

  const { data: lpUserWlf } = useReadContract({
    address: lpStakingAddress, abi: lpStakingABI, functionName: 'getWLFVotingPower',
    args: [address!],
    query: { enabled: !!address && !!lpStakingAddress },
  });

  const { data: lpEarned, refetch: refetchLpEarned } = useReadContract({
    address: lpStakingAddress, abi: lpStakingABI, functionName: 'earned',
    args: [address!],
    query: { enabled: !!address && !!lpStakingAddress, refetchInterval: 5_000 },
  });

  const { data: lockTime } = useReadContract({
    address: lpStakingAddress, abi: lpStakingABI, functionName: 'fixedLockUnlockTime',
    args: [address!],
    query: { enabled: !!address && !!lpStakingAddress },
  });

  const { data: totalWLFStakedInLP } = useReadContract({
    address: lpStakingAddress, abi: lpStakingABI, functionName: 'totalWLFStaked',
    query: { enabled: !!lpStakingAddress, refetchInterval: 15_000 },
  });

  const { data: saleIdCounter } = useReadContract({
    address: tokenSaleAddress, abi: tokenSaleABI, functionName: 'saleIdCounter',
    query: { enabled: !!tokenSaleAddress, refetchInterval: 10_000 },
  });

  // ── Tickers ──────────────────────────────────────────────────────────────

  // Single tick counter for WLF position cards — reset when chain data refreshes
  const [positionTick, setPositionTick] = useState(0);
  useEffect(() => { setPositionTick(0); }, [positions, totalAssets]);
  useEffect(() => {
    const id = setInterval(() => setPositionTick((p) => p + 1), 1_000);
    return () => clearInterval(id);
  }, []);

  // ── Debug: group-log positions to browser console ───────────────────────
  useEffect(() => {
    const active = (positions ?? []).filter((p) => p.active);
    if (active.length === 0) return;
    const ts = totalShares ?? 0n;
    const ta = totalAssets ?? 0n;
    console.group('%cWLF Staking Positions', 'color:#52b788;font-weight:bold;font-size:13px');
    console.log(`Active positions: ${active.length}`);
    active.forEach((pos, i) => {
      const isFixed  = pos.unlockAt > 0n;
      const posVal   = ts > 0n ? (pos.shares * ta) / ts : pos.shares;
      const nowSecs  = BigInt(Math.floor(Date.now() / 1000));
      const locked   = isFixed && nowSecs < pos.unlockAt;
      console.group(
        `%cPosition #${i + 1} — ${isFixed ? 'Fixed' : 'Flexible'}`,
        `color:${isFixed ? '#e9c46a' : '#52b788'};font-weight:bold`,
      );
      const nowSecsLog = BigInt(Math.floor(Date.now() / 1000));
      const elapsedLog = nowSecsLog > pos.stakedAt ? nowSecsLog - pos.stakedAt : 0n;
      console.log('WLF value:  ', formatUnits(posVal, 18), 'WLF');
      console.log('Deposited:  ', formatUnits(pos.assets, 18), 'WLF');
      console.log('Elapsed:    ', Number(elapsedLog / 3600n).toFixed(1), 'hours');
      console.log('Shares:     ', formatUnits(pos.shares, 18));
      console.log('Staked:     ', new Date(Number(pos.stakedAt) * 1000).toLocaleString());
      if (isFixed) {
        console.log('Unlock:     ', new Date(Number(pos.unlockAt) * 1000).toLocaleString());
        console.log('Status:     ', locked ? '🔒 Locked' : '✅ Unlocked');
        console.log('Multiplier: ', bonusApyToMultiplierLabel(pos.bonusApy));
      }
      console.groupEnd();
    });
    console.groupEnd();
  }, [positions, totalShares, totalAssets]);

  // LP earned growing counter
  const [displayReward, setDisplayReward] = useState<bigint>(0n);
  useEffect(() => { if (lpEarned !== undefined) setDisplayReward(lpEarned); }, [lpEarned]);
  useEffect(() => {
    if (!lpUserWlf || !lpApy || lpUserWlf === 0n || lpApy === 0n) return;
    const perSecond = (lpUserWlf * lpApy) / (31_536_000n * 100_000n);
    if (perSecond === 0n) return;
    const id = setInterval(() => setDisplayReward((prev) => prev + perSecond), 1_000);
    return () => clearInterval(id);
  }, [lpUserWlf, lpApy]);

  // ── WLF write contract ───────────────────────────────────────────────────

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });
  const [lastAction, setLastAction] = useState('');

  useEffect(() => {
    if (!isConfirmed) return;
    void refetchPositions();
    void refetchAllowance();
    // After approve-add-N confirms, fire the actual addToPosition call
    const match = lastAction.match(/^approve-add-(\d+)$/);
    if (match && stakingAddress) {
      const idx = parseInt(match[1], 10);
      const raw = posStakeInputs[idx];
      if (raw) {
        try {
          const amount = parseUnits(raw, 18);
          if (amount > 0n) {
            setLastAction(`add-to-${idx}`);
            writeContract({ address: stakingAddress, abi: stakingABI, functionName: 'addToPosition', args: [BigInt(idx), amount] });
          }
        } catch { /* invalid input */ }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed]);

  // ── LP write contracts ───────────────────────────────────────────────────

  const { writeContract: writeLp, data: lpTxHash, isPending: isLpPending } = useWriteContract();
  const { isLoading: isLpConfirming, isSuccess: isLpConfirmed } = useWaitForTransactionReceipt({ hash: lpTxHash });
  const { writeContract: writeCompound, data: compoundTxHash, isPending: isCompoundPending } = useWriteContract();
  const { isLoading: isCompoundConfirming, isSuccess: isCompoundConfirmed } = useWaitForTransactionReceipt({ hash: compoundTxHash });
  const [lastLpAction, setLastLpAction] = useState('');

  useEffect(() => {
    if (isLpConfirmed) { void refetchLpEarned(); void refetchLpShares(); }
  }, [isLpConfirmed, refetchLpEarned, refetchLpShares]);
  useEffect(() => {
    if (isCompoundConfirmed) void refetchLpEarned();
  }, [isCompoundConfirmed, refetchLpEarned]);

  // ── Bulk rewards flow: WLF rewards tx → LP rewards tx (chained) ──────────
  // 'withdraw-rewards' = send to wallet  |  'withdraw-stake' = stake flexible
  const [bulkFlow, setBulkFlow] = useState<'withdraw-rewards' | 'withdraw-stake' | null>(null);
  const [bulkStep, setBulkStep] = useState<'wlf' | 'lp'>('wlf');

  useEffect(() => {
    if (!isConfirmed || !bulkFlow || bulkStep !== 'wlf') return;
    // WLF rewards tx confirmed — fire LP tx if there are LP rewards
    if (displayReward > 0n && lpStakingAddress) {
      setBulkStep('lp');
      if (bulkFlow === 'withdraw-rewards') {
        setLastLpAction('bulk-claim');
        writeLp({ address: lpStakingAddress, abi: lpStakingABI, functionName: 'claimRewards', args: [] });
      } else {
        setLastLpAction('bulk-compound');
        writeCompound({ address: lpStakingAddress, abi: lpStakingABI, functionName: 'claimAndStakeRewards', args: [stakingAddress!, false] });
      }
    } else {
      setBulkFlow(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed]);

  useEffect(() => {
    if ((isLpConfirmed || isCompoundConfirmed) && bulkFlow && bulkStep === 'lp') {
      setBulkFlow(null);
      setBulkStep('wlf');
    }
  }, [isLpConfirmed, isCompoundConfirmed, bulkFlow, bulkStep]);

  // ── Derived values ───────────────────────────────────────────────────────

  const stakeAmountBig = (() => {
    try { return stakeAmount ? parseUnits(stakeAmount, 18) : 0n; } catch { return 0n; }
  })();

  const needsApproval = wlfAllowance !== undefined && stakeAmountBig > 0n && wlfAllowance < stakeAmountBig;
  const apyDisplay    = apy !== undefined ? `${(Number(apy) / 1_000).toFixed(2)}%` : '—';
  const lpApyDisplay  = lpApy !== undefined ? `${(Number(lpApy) / 1_000).toFixed(2)}%` : '—';

  // Staking ratio = (WLF staking + LP staking) / total WLF supply.
  // Use floating point (after scaling down) to avoid bigint integer-division precision loss.
  const totalCommittedWLF = (totalAssets ?? 0n) + (totalWLFStakedInLP ?? 0n);
  const stakingRatioFrac = ((): number => {
    if (totalCommittedWLF === 0n || !wlfTotalSupply || wlfTotalSupply === 0n) return 0;
    return Number(totalCommittedWLF / 10n ** 9n) / Number(wlfTotalSupply / 10n ** 9n);
  })();

  // APY schedule band index (0–9, each band = 10% of circulating supply)
  const stakingExponent = Math.min(9, Math.floor(stakingRatioFrac * 10));

  const stakingRatioDisplay = ((): string => {
    if (!wlfTotalSupply) return '—';
    if (totalCommittedWLF === 0n && !totalAssets && !totalWLFStakedInLP) return '—';
    const pct = stakingRatioFrac * 100;
    if (pct === 0) return '0.00%';
    if (pct < 0.01) return `${pct.toFixed(4)}%`;
    return `${pct.toFixed(2)}%`;
  })();

  const now = BigInt(Math.floor(Date.now() / 1000));
  const isLpLocked   = lockTime !== undefined && lockTime > 0n && now < lockTime;
  const lpLockDisplay = lockTime && lockTime > 0n
    ? new Date(Number(lockTime) * 1000).toLocaleDateString()
    : 'No lock';

  const saleIds: bigint[] = [];
  if (saleIdCounter !== undefined) {
    for (let i = 0n; i <= saleIdCounter; i++) saleIds.push(i);
  }

  const activePositions = (positions ?? []).filter((p) => p.active);

  // Detect whether the selected duration already has an active position
  const selectedBonusApy = durationSecondsToBonus(selectedDuration.seconds);
  const willAddToExisting = selectedDuration.seconds === 0
    ? activePositions.some((p) => p.unlockAt === 0n)
    : activePositions.some((p) => p.unlockAt > 0n && p.bonusApy === selectedBonusApy);


  // Total rewards earned across all active positions (live, includes positionTick).
  // Uses share-based value (pos.shares * tickedAssets / totalShares) so the number stays correct
  // after partial withdrawals (pos.assets is never updated on-chain).
  const totalEarned = (() => {
    if (!totalAssets || !totalShares || totalShares === 0n) return 0n;
    const perSecond = apy && apy > 0n ? totalAssets * apy / (31_536_000n * 100_000n) : 0n;
    const tickedAssets = totalAssets + perSecond * BigInt(positionTick);
    return activePositions.reduce((acc, pos) => {
      const cv = pos.shares * tickedAssets / totalShares;
      const e = cv > pos.assets ? cv - pos.assets : 0n;
      return acc + e;
    }, 0n);
  })();

  // ── New position handlers ────────────────────────────────────────────────

  const handleApprove = () => {
    if (!wlfAddress || !stakingAddress) return;
    setLastAction('approve');
    writeContract({ address: wlfAddress, abi: erc20ABI, functionName: 'approve', args: [stakingAddress, stakeAmountBig] });
  };

  const handleStake = () => {
    if (!stakingAddress || stakeAmountBig <= 0n) return;
    if (selectedDuration.seconds === 0) {
      setLastAction('stake-flexible');
      writeContract({ address: stakingAddress, abi: stakingABI, functionName: 'stakeFlexible', args: [stakeAmountBig] });
    } else {
      setLastAction('stake-fixed');
      writeContract({ address: stakingAddress, abi: stakingABI, functionName: 'stakeFixed', args: [stakeAmountBig, BigInt(selectedDuration.seconds)] });
    }
  };

  // ── Per-position handlers ────────────────────────────────────────────────

  const handleWithdrawAll = (index: number) => {
    if (!stakingAddress) return;
    setLastAction(`withdraw-all-${index}`);
    writeContract({ address: stakingAddress, abi: stakingABI, functionName: 'withdrawPosition', args: [BigInt(index)] });
  };

  const handleWithdrawAmount = (index: number) => {
    const raw = posWithdrawInputs[index];
    if (!stakingAddress || !raw) return;
    let amount: bigint;
    try { amount = parseUnits(raw, 18); } catch { return; }
    if (amount <= 0n) return;
    setLastAction(`withdraw-${index}`);
    writeContract({ address: stakingAddress, abi: stakingABI, functionName: 'withdrawAmountFromPosition', args: [BigInt(index), amount] });
  };

  const handleWithdrawRewards = (index: number, rewardAmount: bigint) => {
    if (!stakingAddress || rewardAmount <= 0n) return;
    setLastAction(`withdraw-rewards-${index}`);
    writeContract({ address: stakingAddress, abi: stakingABI, functionName: 'withdrawAmountFromPosition', args: [BigInt(index), rewardAmount] });
  };

  const handleAddToPosition = (index: number) => {
    const raw = posStakeInputs[index];
    if (!stakingAddress || !wlfAddress || !raw) return;
    let amount: bigint;
    try { amount = parseUnits(raw, 18); } catch { return; }
    if (amount <= 0n) return;
    if (wlfAllowance !== undefined && wlfAllowance < amount) {
      // Approve first — same approval target (staking contract)
      setLastAction(`approve-add-${index}`);
      writeContract({ address: wlfAddress, abi: erc20ABI, functionName: 'approve', args: [stakingAddress, amount] });
    } else {
      setLastAction(`add-to-${index}`);
      writeContract({ address: stakingAddress, abi: stakingABI, functionName: 'addToPosition', args: [BigInt(index), amount] });
    }
  };

  const handleWithdrawAllRewards = () => {
    if (!stakingAddress) return;
    const hasWlf = totalEarned > 0n;
    const hasLp  = displayReward > 0n;
    if (hasWlf) {
      setBulkFlow(hasLp ? 'withdraw-rewards' : null);
      setBulkStep('wlf');
      setLastAction('withdraw-all-rewards');
      writeContract({ address: stakingAddress, abi: stakingABI, functionName: 'withdrawAllRewards' });
    } else if (hasLp && lpStakingAddress) {
      setLastLpAction('bulk-claim');
      writeLp({ address: lpStakingAddress, abi: lpStakingABI, functionName: 'claimRewards', args: [] });
    }
  };

  const handleWithdrawAllRewardsAndStake = () => {
    if (!stakingAddress) return;
    const hasWlf = totalEarned > 0n;
    const hasLp  = displayReward > 0n;
    if (hasWlf) {
      setBulkFlow(hasLp ? 'withdraw-stake' : null);
      setBulkStep('wlf');
      setLastAction('withdraw-all-rewards-stake');
      writeContract({ address: stakingAddress, abi: stakingABI, functionName: 'withdrawAllRewardsAndStakeFlexible' });
    } else if (hasLp && lpStakingAddress) {
      setLastLpAction('bulk-compound');
      writeCompound({ address: lpStakingAddress, abi: lpStakingABI, functionName: 'claimAndStakeRewards', args: [stakingAddress, false] });
    }
  };

  // ── LP handlers ──────────────────────────────────────────────────────────

  const handleLpClaimRewards    = () => { if (!lpStakingAddress) return; setLastLpAction('claim-rewards');    writeLp({ address: lpStakingAddress, abi: lpStakingABI, functionName: 'claimRewards', args: [] }); };
  const handleLpCompoundRewards = (fixedDuration: boolean) => {
    if (!lpStakingAddress || !stakingAddress) return;
    setLastLpAction(fixedDuration ? 'compound-fixed' : 'compound-flexible');
    writeCompound({ address: lpStakingAddress, abi: lpStakingABI, functionName: 'claimAndStakeRewards', args: [stakingAddress, fixedDuration] });
  };
  const handleLpWithdraw = () => {
    if (!lpStakingAddress || !lpShares || lpShares === 0n) return;
    setLastLpAction('lp-withdraw');
    writeLp({ address: lpStakingAddress, abi: lpStakingABI, functionName: 'withdraw', args: [lpShares] });
  };

  // ── Guards ───────────────────────────────────────────────────────────────

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

  const isLoading   = isPending || isConfirming;
  const isLpLoading = isLpPending || isLpConfirming;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <PageContainer maxWidth="md">
      <h1 className="text-3xl font-bold mb-4">Staking</h1>

      {/* ── WLF Overview — always visible, above tabs ── */}
      <Card title="WLF Staking Overview" className="mb-6">
        <div className="space-y-0.5">
          <Row label="Total WLF staked"        value={`${fmt18(totalCommittedWLF)} WLF`} />
          <Row label="  ↳ Direct staking"      value={`${fmt18(totalAssets ?? 0n)} WLF`} />
          <Row label="  ↳ LP staking"          value={`${fmt18(totalWLFStakedInLP ?? 0n)} WLF`} />
          <Row label="Protocol staking ratio"  value={stakingRatioDisplay} />
          <Row
            label="Current APY (flexible)"
            value={<span className="font-semibold" style={{ color: '#52b788' }}>{apyDisplay}</span>}
          />
          <Row
            label="APY range (governance)"
            value={
              <span style={{ color: theme.textMuted }}>
                {contractMinApy !== undefined && contractMaxApy !== undefined
                  ? `${(Number(contractMinApy) / 1_000).toFixed(0)}% – ${(Number(contractMaxApy) / 1_000).toFixed(0)}%`
                  : '—'}
              </span>
            }
          />
          <Row
            label="10-year lock multiplier"
            value={
              <span className="font-semibold" style={{ color: '#e9c46a' }}>
                3x APY{apy !== undefined ? ` ≈ ${(Number(apy) * 3 / 1_000).toFixed(2)}%` : ''}
              </span>
            }
          />
          <Row label="WLF in wallet"           value={`${fmt18(wlfWalletBalance)} WLF`} />
          {/* ── Combined rewards row with per-position breakdown dropdown ── */}
          {(totalEarned > 0n || displayReward > 0n) && (() => {
            const combinedRewards = totalEarned + displayReward;
            return (
              <>
                <Row
                  label="Total rewards earned"
                  value={
                    <span className="flex items-center gap-2">
                      <span className="font-mono font-semibold" style={{ color: '#52b788' }}>
                        +{fmt18(combinedRewards, 6)} WLF
                      </span>
                      <button
                        onClick={() => setShowRewardsBreakdown((v) => !v)}
                        className="text-xs px-1.5 py-0.5 rounded transition-colors"
                        style={{ color: theme.textMuted, border: '1px solid rgba(255,255,255,0.15)' }}
                        title="Show per-position breakdown"
                      >
                        {showRewardsBreakdown ? '▴' : '▾'}
                      </button>
                    </span>
                  }
                />
                {showRewardsBreakdown && (
                  <div
                    className="mt-1 mb-1 space-y-0.5 pl-3 py-1.5 rounded"
                    style={{ borderLeft: '2px solid rgba(82,183,136,0.3)', background: 'rgba(82,183,136,0.04)' }}
                  >
                    {activePositions.map((pos, i) => {
                      const trueIdx = (positions ?? []).findIndex((p) => p === pos);
                      const idx = trueIdx >= 0 ? trueIdx : i;
                      const e = (() => {
                        if (!totalAssets || !totalShares || totalShares === 0n) return 0n;
                        const perSecond = apy && apy > 0n ? totalAssets * apy / (31_536_000n * 100_000n) : 0n;
                        const tickedAssets = totalAssets + perSecond * BigInt(positionTick);
                        const cv = pos.shares * tickedAssets / totalShares;
                        return cv > pos.assets ? cv - pos.assets : 0n;
                      })();
                      const isFixed = pos.unlockAt > 0n;
                      const typeLabel = isFixed
                        ? `Fixed · ${bonusApyToMultiplierLabel(pos.bonusApy)}`
                        : 'Flexible';
                      return (
                        <Row
                          key={idx}
                          label={<span style={{ color: theme.textMuted }}>#{idx + 1} {typeLabel}</span>}
                          value={<span className="font-mono text-xs" style={{ color: '#52b788' }}>+{fmt18(e, 6)} WLF</span>}
                        />
                      );
                    })}
                    {displayReward > 0n && (
                      <Row
                        label={<span style={{ color: theme.textMuted }}>LP staking</span>}
                        value={<span className="font-mono text-xs" style={{ color: '#52b788' }}>+{fmt18(displayReward, 6)} WLF</span>}
                      />
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </div>
        {(() => {
          const hasWlfRewards = totalEarned > 0n;
          const hasLpRewards  = displayReward > 0n;
          const hasAnyRewards = hasWlfRewards || hasLpRewards;
          const isBulkLoading =
            (isPending || isConfirming) ||
            (bulkFlow !== null && (isLpPending || isLpConfirming || isCompoundPending || isCompoundConfirming));
          return hasAnyRewards ? (
            <div className="mt-4 flex gap-2">
              <Button
                variant="danger"
                fullWidth
                onClick={handleWithdrawAllRewards}
                loading={isBulkLoading && (lastAction === 'withdraw-all-rewards' || lastLpAction === 'bulk-claim')}
                disabled={isBulkLoading}
                title="Withdraw all accrued rewards to wallet — principals stay staked"
              >
                Withdraw Rewards
              </Button>
              <Button
                variant="success"
                fullWidth
                onClick={handleWithdrawAllRewardsAndStake}
                loading={isBulkLoading && (lastAction === 'withdraw-all-rewards-stake' || lastLpAction === 'bulk-compound')}
                disabled={isBulkLoading}
                title="Withdraw all accrued rewards and compound them into a new flexible position"
              >
                Compound Rewards
              </Button>
            </div>
          ) : null;
        })()}
      </Card>

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

        {/* ═══════════════════════════════════════════════════════════════════
            WLF STAKING TAB
            ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'wlf' && (
          <>
            <TxStatus isPending={isPending} isConfirming={isConfirming} isConfirmed={isConfirmed} txHash={txHash} label={lastAction} />

            {/* ── Active position cards ── */}
            {activePositions.length === 0 ? (
              <Card title="Your WLF Positions">
                <p className="text-sm text-center py-4" style={{ color: theme.textMuted }}>
                  No active positions. Create your first stake below.
                </p>
              </Card>
            ) : (
              activePositions.map((pos, activeIdx) => {
                // Find the true index in the full positions array (needed for contract calls)
                const trueIdx = (positions ?? []).findIndex(
                  (p) => p === pos
                );
                const idx = trueIdx >= 0 ? trueIdx : activeIdx;
                return (
                  <WlfPositionCard
                    key={idx}
                    index={idx}
                    pos={pos}
                    apy={apy}
                    totalAssets={totalAssets}
                    totalShares={totalShares}
                    positionTick={positionTick}
                    withdrawInput={posWithdrawInputs[idx] ?? ''}
                    stakeMoreInput={posStakeInputs[idx] ?? ''}
                    onWithdrawInputChange={(val) =>
                      setPosWithdrawInputs((prev) => ({ ...prev, [idx]: val }))
                    }
                    onStakeMoreInputChange={(val) =>
                      setPosStakeInputs((prev) => ({ ...prev, [idx]: val }))
                    }
                    onWithdrawAll={() => handleWithdrawAll(idx)}
                    onWithdrawAmount={() => handleWithdrawAmount(idx)}
                    onWithdrawRewards={(reward) => handleWithdrawRewards(idx, reward)}
                    onAddToPosition={() => handleAddToPosition(idx)}
                    needsApprovalForAdd={(() => {
                      const raw = posStakeInputs[idx];
                      if (!raw) return false;
                      try { const a = parseUnits(raw, 18); return wlfAllowance !== undefined && a > 0n && wlfAllowance < a; } catch { return false; }
                    })()}
                    isWithdrawAllLoading={isLoading && lastAction === `withdraw-all-${idx}`}
                    isWithdrawAmountLoading={isLoading && lastAction === `withdraw-${idx}`}
                    isWithdrawRewardsLoading={isLoading && lastAction === `withdraw-rewards-${idx}`}
                    isAddToPositionLoading={isLoading && (lastAction === `add-to-${idx}` || lastAction === `approve-add-${idx}`)}
                    anyLoading={isLoading}
                  />
                );
              })
            )}

            {/* ── New position form ── */}
            <div ref={newPositionRef}>
              <Card title={willAddToExisting ? `Add to ${selectedDuration.seconds === 0 ? 'Flexible' : selectedDuration.label} Position` : 'New Position'}>
                <Input
                  label="Amount (WLF)"
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  placeholder="0.00"
                  disabled={isLoading}
                />

                {/* Duration picker */}
                <div className="mt-3">
                  <p className="text-xs mb-2 font-medium" style={{ color: theme.textMuted }}>
                    Lock duration
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {DURATIONS.map((d) => {
                      const isSelected = selectedDuration === d;
                      return (
                        <button
                          key={d.label}
                          onClick={() => setSelectedDuration(d)}
                          disabled={isLoading}
                          className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
                          style={{
                            background:   isSelected ? (d.seconds === 0 ? 'rgba(82,183,136,0.2)' : 'rgba(233,196,106,0.2)') : '#0f1117',
                            border:       `1px solid ${isSelected ? (d.seconds === 0 ? '#52b788' : '#e9c46a') : '#333'}`,
                            color:        isSelected ? (d.seconds === 0 ? '#52b788' : '#e9c46a') : theme.textMuted,
                          }}
                        >
                          {d.label}
                          {d.seconds > 0 && (
                            <span className="ml-1" style={{ color: '#e9c46a' }}>{d.multiplierLabel}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Summary line */}
                <p className="text-xs mt-2" style={{ color: theme.textMuted }}>
                  {selectedDuration.seconds === 0
                    ? willAddToExisting
                      ? `Adds to your existing flexible position. Current base APY: ${apyDisplay}.`
                      : `Creates a new flexible position. Current base APY: ${apyDisplay}.`
                    : willAddToExisting
                      ? `Adds to your existing ${selectedDuration.label} position. ${selectedDuration.multiplierLabel} × base APY${apy !== undefined ? ` ≈ ${(Number(apy) * selectedDuration.multiplier / 1_000).toFixed(2)}%` : ''}.`
                      : `Creates a new ${selectedDuration.label} locked position. ${selectedDuration.multiplierLabel} × base APY${apy !== undefined ? ` ≈ ${(Number(apy) * selectedDuration.multiplier / 1_000).toFixed(2)}%` : ''}.`}
                </p>

                <div className="mt-3">
                  {needsApproval ? (
                    <Button variant="info" fullWidth onClick={handleApprove} loading={isLoading && lastAction === 'approve'} disabled={isLoading}>
                      Approve WLF
                    </Button>
                  ) : (
                    <Button
                      variant={selectedDuration.seconds === 0 ? 'secondary' : 'primary'}
                      fullWidth
                      onClick={handleStake}
                      loading={isLoading && (lastAction === 'stake-flexible' || lastAction === 'stake-fixed')}
                      disabled={isLoading || stakeAmountBig <= 0n}
                    >
                      {selectedDuration.seconds === 0
                        ? willAddToExisting ? 'Add to Flexible Position' : 'Stake (Flexible)'
                        : willAddToExisting ? `Add to ${selectedDuration.label} Position` : `Stake (Fixed ${selectedDuration.label})`}
                    </Button>
                  )}
                </div>
              </Card>
            </div>

            {/* ── APY Schedule ── */}
            <Card title="APY Schedule">
              <p className="text-xs mb-2" style={{ color: theme.textMuted }}>
                Base APY decreases as more WLF is staked. Fixed locks multiply the base APY.
                Current band highlighted.
              </p>
              <div className="space-y-0.5">
                {([
                  { range: '0–10%',   exponent: 0, base: 80.00 },
                  { range: '10–20%',  exponent: 1, base: 43.00 },
                  { range: '20–30%',  exponent: 2, base: 24.50 },
                  { range: '30–40%',  exponent: 3, base: 15.25 },
                  { range: '40–50%',  exponent: 4, base: 10.63 },
                  { range: '50–60%',  exponent: 5, base:  8.31 },
                  { range: '60–70%',  exponent: 6, base:  7.16 },
                  { range: '70–80%',  exponent: 7, base:  6.58 },
                  { range: '80–90%',  exponent: 8, base:  6.29 },
                  { range: '90–100%', exponent: 9, base:  6.14 },
                ] as const).map((row) => {
                  const isActive = stakingExponent === row.exponent;
                  return (
                    <div
                      key={row.exponent}
                      className="flex items-center gap-2 px-2 py-1 rounded text-xs"
                      style={isActive ? { background: 'rgba(82,183,136,0.12)', border: '1px solid rgba(82,183,136,0.3)' } : {}}
                    >
                      <span className="w-16 font-mono" style={{ color: theme.textMuted }}>{row.range}</span>
                      <span className="w-16 font-semibold" style={{ color: isActive ? '#52b788' : 'white' }}>
                        {row.base.toFixed(2)}%
                      </span>
                      <span className="flex-1" />
                      {isActive && <span className="font-bold" style={{ color: '#52b788' }}>← now</span>}
                    </div>
                  );
                })}
              </div>

              {/* Duration bonus table */}
              <div className="mt-4 pt-3 border-t border-white/10">
                <p className="text-xs font-medium mb-2" style={{ color: theme.textMuted }}>APY multipliers by lock duration</p>
                <div className="grid grid-cols-4 gap-1 text-xs">
                  {DURATIONS.filter((d) => d.seconds > 0).map((d) => (
                    <div key={d.label} className="text-center py-1 px-2 rounded" style={{ background: 'rgba(233,196,106,0.08)', border: '1px solid rgba(233,196,106,0.15)' }}>
                      <div style={{ color: 'white' }}>{d.label}</div>
                      <div className="font-semibold" style={{ color: '#e9c46a' }}>{d.multiplierLabel} APY</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
            LP STAKING TAB
            ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'lp' && lpStakingAddress && (
          <>
            <h2 className="text-xl font-semibold">LP Staking</h2>

            <Card title="Your Balances">
              <div className="space-y-0.5">
                <Row label="LP staking shares (sWLP)" value={fmt18(lpShares)} />
                <Row label="Unclaimed LP rewards"      value={`${fmt18(displayReward, 6)} WLF`} />
              </div>
            </Card>

            <Card title="LP Staking Overview">
              <div className="space-y-0.5">
                <Row label="Current APY"       value={lpApyDisplay} />
                <Row label="5-year lock expires" value={lpLockDisplay} />
              </div>
            </Card>

            {tokenSaleAddress && saleIds.map((saleId) => (
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
                  <div className="flex gap-2">
                    <Button variant="primary" fullWidth onClick={handleLpClaimRewards}
                      loading={isLpLoading && lastLpAction === 'claim-rewards'}
                      disabled={isLpLoading || isCompoundPending || isCompoundConfirming || !displayReward || displayReward === 0n}>
                      Withdraw to Wallet
                    </Button>
                    <Button variant="success" fullWidth onClick={() => handleLpCompoundRewards(false)}
                      loading={(isCompoundPending || isCompoundConfirming) && lastLpAction === 'compound-flexible'}
                      disabled={isLpLoading || isCompoundPending || isCompoundConfirming || !displayReward || displayReward === 0n}>
                      Stake WLF (Flexible)
                    </Button>
                  </div>
                </div>

                <div>
                  <p className={`text-sm mb-2 ${theme.textMuted}`}>
                    {isLpLocked
                      ? `Locked until ${lpLockDisplay} — shares cannot be withdrawn yet`
                      : lpShares && lpShares > 0n
                      ? `${fmt18(lpShares)} LP shares available to withdraw`
                      : 'No LP shares to withdraw'}
                  </p>
                  <Button variant="danger" fullWidth onClick={handleLpWithdraw}
                    loading={isLpLoading && lastLpAction === 'lp-withdraw'}
                    disabled={isLpLoading || isLpLocked || !lpShares || lpShares === 0n}>
                    {isLpLocked ? `Locked until ${lpLockDisplay}` : 'Withdraw All LP Shares'}
                  </Button>
                </div>
              </div>

              <p className={`text-xs mt-4 ${theme.textMuted}`}>
                Rewards accrue continuously. <strong>Withdraw to Wallet</strong> sends WLF to your address.{' '}
                <strong>Stake WLF (Flexible)</strong> compounds rewards into your existing flexible WLF staking position (or creates one if none exists).
                Withdrawing LP shares does <strong>not</strong> auto-claim rewards — always claim first.
                LP shares are locked for 5 years from sale end.
              </p>
            </Card>
          </>
        )}

      </div>
    </PageContainer>
  );
}
