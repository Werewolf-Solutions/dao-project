import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  useAccount,
  useChainId,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import {
  useAaveMarket,
  useAaveReserve,
  useUserMarketState,
  useUserSupplies,
  chainId as aaveChainId,
  evmAddress,
} from '@aave/react';
import { theme } from '@/contexts/ThemeContext';
import { companiesHouseABI, companyVaultABI, erc20ABI, getAddress } from '@/contracts';
import { fmtUSDT } from '@/utils/formatters';

// ─── Constants ────────────────────────────────────────────────────────────────

const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as `0x${string}`;
const MAX_UINT256 = 2n ** 256n - 1n;

// ─── Protocol registry ────────────────────────────────────────────────────────
// Add new integrations here. status: 'active' | 'soon'

type Protocol = {
  id: string;
  name: string;
  icon: string;
  color: string;
  desc: string;
  status: 'active' | 'soon';
  badge?: string;
};

const PROTOCOLS: Protocol[] = [
  {
    id: 'aave',
    name: 'Aave v3',
    icon: '👻',
    color: '#b6509e',
    desc: 'Supply assets and earn variable yield. Borrow against collateral.',
    status: 'active',
  },
  {
    id: 'compound',
    name: 'Compound',
    icon: '🌿',
    color: '#00d395',
    desc: 'Algorithmic money market for lending and borrowing.',
    status: 'soon',
    badge: 'Coming Soon',
  },
  {
    id: 'uniswap',
    name: 'Uniswap v3',
    icon: '🦄',
    color: '#ff007a',
    desc: 'Provide concentrated liquidity and earn trading fees.',
    status: 'soon',
    badge: 'Coming Soon',
  },
  {
    id: 'flow',
    name: 'Flow Builder',
    icon: '⚡',
    color: '#f59e0b',
    desc: 'Chain DeFi actions visually — like Furucombo. Build custom yield strategies.',
    status: 'soon',
    badge: 'Coming Soon',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── TokenAllowed event signature ─────────────────────────────────────────────

const tokenAllowedEvent = {
  type: 'event' as const,
  name: 'TokenAllowed',
  inputs: [
    { name: 'token', type: 'address' as const, indexed: true },
    { name: 'allowed', type: 'bool' as const, indexed: false },
  ],
};

// ─── ProtocolCard ─────────────────────────────────────────────────────────────

function ProtocolCard({
  protocol,
  selected,
  onClick,
  apySummary,
  positionSummary,
}: {
  protocol: Protocol;
  selected: boolean;
  onClick: () => void;
  apySummary?: string;
  positionSummary?: string;
}) {
  const isDisabled = protocol.status === 'soon';

  return (
    <button
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      className="relative flex flex-col gap-2 p-4 rounded-2xl text-left transition-all"
      style={{
        background: selected
          ? `${protocol.color}18`
          : isDisabled
            ? 'rgba(255,255,255,0.02)'
            : 'rgba(255,255,255,0.04)',
        border: `1px solid ${
          selected
            ? `${protocol.color}55`
            : isDisabled
              ? 'rgba(255,255,255,0.05)'
              : 'rgba(255,255,255,0.08)'
        }`,
        cursor: isDisabled ? 'default' : 'pointer',
        opacity: isDisabled ? 0.55 : 1,
        boxShadow: selected ? `0 0 0 1px ${protocol.color}20, 0 4px 24px ${protocol.color}10` : 'none',
      }}
    >
      {/* Badge */}
      {protocol.badge && (
        <span
          className="absolute top-2.5 right-2.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}
        >
          {protocol.badge}
        </span>
      )}

      <div className="flex items-center gap-2">
        <span className="text-xl leading-none">{protocol.icon}</span>
        <span className="text-sm font-semibold" style={{ color: selected ? protocol.color : 'rgba(255,255,255,0.85)' }}>
          {protocol.name}
        </span>
      </div>

      <p className="text-xs leading-snug text-white/35 pr-12">{protocol.desc}</p>

      {!isDisabled && (apySummary || positionSummary) && (
        <div className="flex items-center gap-3 mt-0.5">
          {apySummary && (
            <span className="text-xs font-mono" style={{ color: protocol.color }}>
              {apySummary}
            </span>
          )}
          {positionSummary && (
            <span className="text-xs font-mono text-white/40">{positionSummary}</span>
          )}
        </div>
      )}
    </button>
  );
}

// ─── AavePanel ────────────────────────────────────────────────────────────────

type AaveAction = 'fund' | 'supply' | 'withdraw' | 'borrow';

function AavePanel({
  tok,
  treasuryBalance,
  supplied,
  walletUsdtBal,
  sdkReserve,
  sdkMarketState,
  sdkSupplyPosition,
  isLoading,
  isAuthorized,
  hasDepositAllowance,
  depositAmt,
  setDepositAmt,
  supplyAmt,
  setSupplyAmt,
  withdrawAmt,
  setWithdrawAmt,
  isApprovePending,
  isApproveMining,
  isDepositPending,
  isDepositMining,
  isDepositSuccess,
  isSupplySuccess,
  isWithdrawSuccess,
  isBorrowPending,
  isBorrowMining,
  isBorrowSuccess,
  borrowingEnabled,
  borrowAmt,
  setBorrowAmt,
  borrowTokenAddr,
  setBorrowTokenAddr,
  borrowTokenOptions,
  availableBorrowsUsd,
  txError,
  onApprove,
  onDeposit,
  onSupply,
  onWithdraw,
  onBorrow,
  depositWei,
  supplyWei,
  insufficientTreasury,
}: {
  tok: string;
  treasuryBalance: bigint | undefined;
  supplied: bigint;
  walletUsdtBal: bigint | undefined;
  sdkReserve: { supplyInfo: { apy: { value: unknown } } } | null | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sdkMarketState: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sdkSupplyPosition: any;
  isLoading: boolean;
  isAuthorized: boolean;
  hasDepositAllowance: boolean;
  depositAmt: string;
  setDepositAmt: (v: string) => void;
  supplyAmt: string;
  setSupplyAmt: (v: string) => void;
  withdrawAmt: string;
  setWithdrawAmt: (v: string) => void;
  isApprovePending: boolean;
  isApproveMining: boolean;
  isDepositPending: boolean;
  isDepositMining: boolean;
  isDepositSuccess: boolean;
  isSupplySuccess: boolean;
  isWithdrawSuccess: boolean;
  isBorrowPending: boolean;
  isBorrowMining: boolean;
  isBorrowSuccess: boolean;
  borrowingEnabled: boolean;
  borrowAmt: string;
  setBorrowAmt: (v: string) => void;
  borrowTokenAddr: string;
  setBorrowTokenAddr: (v: string) => void;
  borrowTokenOptions: { token: `0x${string}`; symbol: string; decimals: number }[];
  availableBorrowsUsd: number;
  txError: string | null;
  onApprove: () => void;
  onDeposit: () => void;
  onSupply: () => void;
  onWithdraw: () => void;
  onBorrow: () => void;
  depositWei: bigint;
  supplyWei: bigint;
  insufficientTreasury: boolean;
}) {
  const [action, setAction] = useState<AaveAction>('fund');

  const supplyApy = sdkReserve
    ? parseFloat(String(sdkReserve.supplyInfo.apy.value)).toFixed(2)
    : null;
  const netApy = sdkMarketState?.netAPY
    ? parseFloat(String(sdkMarketState.netAPY.value)).toFixed(2)
    : null;
  const healthFactor = sdkMarketState?.healthFactor;
  const hfNum = healthFactor === null ? Infinity : parseFloat(String(healthFactor ?? ''));
  const hfColor = !isFinite(hfNum) ? '#52b788' : hfNum >= 2 ? '#52b788' : hfNum >= 1.2 ? '#fbbf24' : '#f87171';

  const suppliedUsd = sdkSupplyPosition
    ? parseFloat(String(sdkSupplyPosition.balance.usd)).toLocaleString(undefined, { maximumFractionDigits: 2 })
    : fmtUSDT(supplied);
  const suppliedTok = sdkSupplyPosition
    ? parseFloat(String(sdkSupplyPosition.balance.amount?.value ?? 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })
    : fmtUSDT(supplied);

  return (
    <div className="flex flex-col gap-4">

      {/* Position overview */}
      <div
        className="rounded-2xl p-4"
        style={{ background: 'rgba(182,80,158,0.06)', border: '1px solid rgba(182,80,158,0.15)' }}
      >
        <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Position Overview</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-[11px] text-white/35 mb-0.5">Supplied</p>
            <p className="text-white font-semibold font-mono text-sm">${suppliedUsd}</p>
            <p className="text-xs text-white/40 font-mono">{suppliedTok} {tok}</p>
          </div>
          <div>
            <p className="text-[11px] text-white/35 mb-0.5">Vault liquid</p>
            <p className="text-white font-semibold font-mono text-sm">${fmtUSDT(treasuryBalance ?? 0n)}</p>
          </div>
          <div>
            <p className="text-[11px] text-white/35 mb-0.5">Supply APY</p>
            <p className="font-semibold font-mono text-sm" style={{ color: '#52b788' }}>
              {supplyApy ? `${supplyApy}%` : netApy ? `${netApy}%` : '—'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-white/35 mb-0.5">Health factor</p>
            <p className="font-semibold font-mono text-sm" style={{ color: hfColor }}>
              {!isFinite(hfNum) ? '∞' : hfNum.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Action tabs */}
      {isAuthorized && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
          {/* Tab bar */}
          <div
            className="flex"
            style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
          >
            {(['fund', 'supply', 'withdraw', 'borrow'] as AaveAction[]).map((tab) => {
              const labels: Record<AaveAction, string> = {
                fund: `Fund Vault`,
                supply: `Supply → Aave`,
                withdraw: `Withdraw`,
                borrow: `Borrow`,
              };
              const active = action === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setAction(tab)}
                  className="flex-1 px-3 py-2.5 text-xs font-medium transition-colors"
                  style={{
                    color: active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
                    background: active ? 'rgba(182,80,158,0.12)' : 'transparent',
                    borderBottom: active ? '2px solid #b6509e' : '2px solid transparent',
                  }}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="p-4 space-y-3" style={{ background: '#0c0e14' }}>

            {/* Fund Vault */}
            {action === 'fund' && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/40">Transfer {tok} from your wallet into the vault.</p>
                  {walletUsdtBal !== undefined && (
                    <span className="text-xs font-mono text-white/30">Wallet: ${fmtUSDT(walletUsdtBal as bigint)}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    placeholder={`Amount ${tok}`}
                    value={depositAmt}
                    onChange={(e) => setDepositAmt(e.target.value)}
                    className={theme.input + ' flex-1'}
                    disabled={isApprovePending || isApproveMining || isDepositPending || isDepositMining}
                  />
                  {!hasDepositAllowance ? (
                    <button
                      onClick={onApprove}
                      disabled={!depositAmt || depositWei === 0n || isApprovePending || isApproveMining}
                      className="shrink-0 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: 'rgba(245,158,11,0.2)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}
                    >
                      {isApprovePending || isApproveMining ? 'Approving…' : 'Approve'}
                    </button>
                  ) : (
                    <button
                      onClick={onDeposit}
                      disabled={!depositAmt || depositWei === 0n || isDepositPending || isDepositMining}
                      className="shrink-0 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: 'rgba(82,183,136,0.2)', color: '#52b788', border: '1px solid rgba(82,183,136,0.3)' }}
                    >
                      {isDepositPending || isDepositMining ? 'Depositing…' : 'Deposit'}
                    </button>
                  )}
                </div>
                {isDepositSuccess && <p className="text-xs text-green-400">Deposited successfully.</p>}
              </>
            )}

            {/* Supply */}
            {action === 'supply' && (
              <>
                <p className="text-xs text-white/40">
                  Supply vault-held {tok} into Aave to earn yield. Vault holds <span className="font-mono text-white/60">${fmtUSDT(treasuryBalance ?? 0n)}</span>.
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    placeholder={`Max $${fmtUSDT(treasuryBalance ?? 0n)}`}
                    value={supplyAmt}
                    onChange={(e) => setSupplyAmt(e.target.value)}
                    className={theme.input + ' flex-1'}
                    disabled={isLoading}
                  />
                  <button
                    onClick={() => setSupplyAmt(fmtUSDT(treasuryBalance ?? 0n, 6).replace(/,/g, ''))}
                    className="px-2.5 py-1.5 rounded-lg text-xs text-white/50 hover:text-white border border-white/10 hover:border-white/30 transition-colors"
                    disabled={isLoading}
                  >
                    MAX
                  </button>
                  <button
                    onClick={onSupply}
                    disabled={isLoading || supplyWei === 0n || insufficientTreasury}
                    className="shrink-0 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: 'rgba(182,80,158,0.2)', color: '#e080d0', border: '1px solid rgba(182,80,158,0.3)' }}
                  >
                    {isLoading ? 'Wait…' : 'Supply'}
                  </button>
                </div>
                {insufficientTreasury && (
                  <p className="text-xs text-amber-400">
                    Vault only has ${fmtUSDT(treasuryBalance ?? 0n)} — fund the vault first.
                  </p>
                )}
                {isSupplySuccess && <p className="text-xs text-green-400">Supplied successfully.</p>}
              </>
            )}

            {/* Withdraw */}
            {action === 'withdraw' && (
              <>
                <p className="text-xs text-white/40">
                  Withdraw {tok} from Aave back to the vault. Position: <span className="font-mono text-white/60">${suppliedUsd}</span>.
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    placeholder={`Max $${suppliedUsd} ${tok}`}
                    value={withdrawAmt}
                    onChange={(e) => setWithdrawAmt(e.target.value)}
                    className={theme.input + ' flex-1'}
                    disabled={isLoading}
                  />
                  <button
                    onClick={() => setWithdrawAmt(fmtUSDT(supplied, 6).replace(/,/g, ''))}
                    className="px-2.5 py-1.5 rounded-lg text-xs text-white/50 hover:text-white border border-white/10 hover:border-white/30 transition-colors"
                    disabled={isLoading}
                  >
                    MAX
                  </button>
                  <button
                    onClick={onWithdraw}
                    disabled={isLoading || !withdrawAmt || parseFloat(withdrawAmt) <= 0}
                    className="shrink-0 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.12)' }}
                  >
                    {isLoading ? 'Wait…' : 'Withdraw'}
                  </button>
                </div>
                {isWithdrawSuccess && <p className="text-xs text-green-400">Withdrawn successfully.</p>}
              </>
            )}

            {/* Borrow */}
            {action === 'borrow' && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/40">
                    Borrow against vault collateral. Borrowed tokens land in the vault.
                  </p>
                  <span className="text-xs font-mono text-white/30">
                    Available: ${availableBorrowsUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
                {!borrowingEnabled && (
                  <p className="text-xs text-amber-400">
                    ⚠ Borrowing is disabled on this vault. Enable it via guardian or DAO proposal first.
                  </p>
                )}
                {borrowTokenOptions.length > 0 && (
                  <select
                    value={borrowTokenAddr}
                    onChange={(e) => setBorrowTokenAddr(e.target.value)}
                    className={theme.input}
                    disabled={isLoading || !borrowingEnabled}
                  >
                    {borrowTokenOptions.map((t) => (
                      <option key={t.token} value={t.token}>{t.symbol}</option>
                    ))}
                  </select>
                )}
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    placeholder={`Amount ${borrowTokenOptions.find(t => t.token === borrowTokenAddr)?.symbol ?? ''}`}
                    value={borrowAmt}
                    onChange={(e) => setBorrowAmt(e.target.value)}
                    className={theme.input + ' flex-1'}
                    disabled={isLoading || !borrowingEnabled}
                  />
                  <button
                    onClick={() => setBorrowAmt(availableBorrowsUsd.toFixed(2))}
                    className="px-2.5 py-1.5 rounded-lg text-xs text-white/50 hover:text-white border border-white/10 hover:border-white/30 transition-colors"
                    disabled={isLoading || !borrowingEnabled || availableBorrowsUsd <= 0}
                  >
                    MAX
                  </button>
                  <button
                    onClick={onBorrow}
                    disabled={isLoading || !borrowingEnabled || !borrowAmt || parseFloat(borrowAmt) <= 0 || !borrowTokenAddr}
                    className="shrink-0 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}
                  >
                    {isBorrowPending || isBorrowMining ? 'Borrowing…' : 'Borrow'}
                  </button>
                </div>
                {isBorrowSuccess && <p className="text-xs text-green-400">Borrowed successfully.</p>}
              </>
            )}

            {txError && <p className="text-xs text-red-400 break-words">{txError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DeFi page ────────────────────────────────────────────────────────────────

export default function DeFi() {
  const { companyId: companyIdParam } = useParams<{ companyId: string }>();
  const companyId = companyIdParam ? BigInt(companyIdParam) : undefined;

  const { address: connectedAddress } = useAccount();
  const connectedChainId = useChainId();
  const publicClient = usePublicClient();

  const companiesHouseAddress = getAddress(connectedChainId, 'CompaniesHouse');
  const defiUsdtAddress =
    getAddress(connectedChainId, 'AaveUSDT') ?? getAddress(connectedChainId, 'USDT');
  const rawUsdtAddress = getAddress(connectedChainId, 'USDT');
  const onchainAavePool = getAddress(connectedChainId, 'AavePool') ?? ZERO_ADDR;
  const aaveMarketAddress = onchainAavePool;

  // ── Selected protocol ───────────────────────────────────────────────────────
  const [selectedProtocol, setSelectedProtocol] = useState('aave');

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [supplyAmt, setSupplyAmt] = useState('');
  const [withdrawAmt, setWithdrawAmt] = useState('');
  const [depositAmt, setDepositAmt] = useState('');
  const [borrowAmt, setBorrowAmt] = useState('');
  const [borrowTokenAddr, setBorrowTokenAddr] = useState<`0x${string}` | ''>('');
  const [supplyTxHash, setSupplyTxHash] = useState<`0x${string}` | undefined>();
  const [withdrawTxHash, setWithdrawTxHash] = useState<`0x${string}` | undefined>();
  const [depositTxHash, setDepositTxHash] = useState<`0x${string}` | undefined>();
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>();
  const [borrowTxHash, setBorrowTxHash] = useState<`0x${string}` | undefined>();
  const [createVaultTxHash, setCreateVaultTxHash] = useState<`0x${string}` | undefined>();
  const [txError, setTxError] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // ── Company info ─────────────────────────────────────────────────────────────
  const { data: company } = useReadContract({
    address: companiesHouseAddress,
    abi: companiesHouseABI,
    functionName: 'retrieveCompany',
    args: [companyId ?? 0n],
    query: { enabled: !!companiesHouseAddress && companyId !== undefined },
  });

  // ── Vault address ─────────────────────────────────────────────────────────────
  const { data: vaultAddressRaw, refetch: refetchVaultAddress } = useReadContract({
    address: companiesHouseAddress,
    abi: companiesHouseABI,
    functionName: 'companyVault',
    args: [companyId ?? 0n],
    query: { enabled: !!companiesHouseAddress && companyId !== undefined, refetchInterval: 15_000 },
  });
  const vaultAddress = vaultAddressRaw as `0x${string}` | undefined;
  const hasVault = !!vaultAddress && vaultAddress !== ZERO_ADDR;

  // ── Vault metadata ─────────────────────────────────────────────────────────
  const { data: aavePool, refetch: refetchAavePool } = useReadContract({
    address: hasVault ? vaultAddress : undefined,
    abi: companyVaultABI,
    functionName: 'aavePool',
    query: { enabled: hasVault, refetchInterval: 60_000 },
  });
  const { data: vaultAdmin } = useReadContract({
    address: hasVault ? vaultAddress : undefined,
    abi: companyVaultABI,
    functionName: 'admin',
    query: { enabled: hasVault, staleTime: Infinity },
  });
  const isDefiAdmin =
    !!connectedAddress &&
    !!vaultAdmin &&
    connectedAddress.toLowerCase() === (vaultAdmin as string).toLowerCase();
  const isAaveConfigured = hasVault && aavePool && aavePool !== ZERO_ADDR;

  const { data: borrowingEnabled } = useReadContract({
    address: hasVault ? vaultAddress : undefined,
    abi: companyVaultABI,
    functionName: 'borrowingEnabled',
    query: { enabled: hasVault, refetchInterval: 30_000 },
  });

  const { data: aaveUserData, refetch: refetchAaveUserData } = useReadContract({
    address: hasVault ? vaultAddress : undefined,
    abi: companyVaultABI,
    functionName: 'getAaveUserData',
    query: { enabled: hasVault && !!isAaveConfigured, refetchInterval: 15_000 },
  });

  // ── DeFi token details ──────────────────────────────────────────────────────
  const { data: defiTokenSymbol } = useReadContract({
    address: defiUsdtAddress,
    abi: erc20ABI,
    functionName: 'symbol',
    query: { enabled: !!defiUsdtAddress, staleTime: Infinity },
  });
  const tok = (defiTokenSymbol as string | undefined) ?? 'USDT';

  const { data: usdtAllowed, refetch: refetchUsdtAllowed } = useReadContract({
    address: hasVault ? vaultAddress : undefined,
    abi: companyVaultABI,
    functionName: 'allowedTokens',
    args: [defiUsdtAddress ?? ZERO_ADDR],
    query: { enabled: hasVault && !!defiUsdtAddress, refetchInterval: 60_000 },
  });

  // ── Token balance enumeration ──────────────────────────────────────────────
  const knownTokens = useMemo<`0x${string}`[]>(() => {
    const list: `0x${string}`[] = [];
    if (defiUsdtAddress) list.push(defiUsdtAddress);
    if (rawUsdtAddress && rawUsdtAddress !== defiUsdtAddress) list.push(rawUsdtAddress);
    return list;
  }, [defiUsdtAddress, rawUsdtAddress]);

  const [eventTokens, setEventTokens] = useState<`0x${string}`[]>([]);
  useEffect(() => {
    if (!hasVault || !vaultAddress || !publicClient) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (publicClient.getLogs as any)({
      address: vaultAddress,
      event: tokenAllowedEvent,
      fromBlock: 0n,
    })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((logs: any[]) => {
        const seenAllowed = new Set<string>();
        const seenRemoved = new Set<string>();
        for (const log of logs) {
          const token = (log.args?.token as `0x${string}`).toLowerCase();
          const allowed = log.args?.allowed as boolean;
          if (allowed) seenAllowed.add(token);
          else seenRemoved.add(token);
        }
        const result = Array.from(seenAllowed)
          .filter((t) => !seenRemoved.has(t))
          .map((t) => t as `0x${string}`);
        setEventTokens(result);
      })
      .catch(() => {});
  }, [hasVault, vaultAddress, publicClient]);

  const allTokens = useMemo<`0x${string}`[]>(() => {
    const seen = new Set<string>();
    const result: `0x${string}`[] = [];
    for (const t of [...knownTokens, ...eventTokens]) {
      const lower = t.toLowerCase();
      if (!seen.has(lower)) { seen.add(lower); result.push(t); }
    }
    return result;
  }, [knownTokens, eventTokens]);

  const tokenContracts = useMemo(() => {
    if (!hasVault || !vaultAddress) return [];
    return allTokens.flatMap((token) => [
      { address: vaultAddress, abi: companyVaultABI, functionName: 'getTokenBalance' as const, args: [token] as [`0x${string}`] },
      { address: token, abi: erc20ABI, functionName: 'balanceOf' as const, args: [connectedAddress ?? ZERO_ADDR] as [`0x${string}`] },
      { address: token, abi: erc20ABI, functionName: 'symbol' as const },
      { address: vaultAddress, abi: companyVaultABI, functionName: 'allowedTokens' as const, args: [token] as [`0x${string}`] },
      { address: token, abi: erc20ABI, functionName: 'decimals' as const },
    ]);
  }, [allTokens, vaultAddress, connectedAddress, hasVault]);

  const { data: tokenData, refetch: refetchTokenBalances } = useReadContracts({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: tokenContracts as any,
    query: { enabled: hasVault && tokenContracts.length > 0, refetchInterval: 15_000 },
  });

  const tokenRows = useMemo(() => {
    if (!tokenData) return [];
    return allTokens
      .map((token, i) => {
        const base = i * 5;
        const vaultBal  = (tokenData[base]?.result     as bigint  | undefined) ?? 0n;
        const walletBal = (tokenData[base + 1]?.result as bigint  | undefined) ?? 0n;
        const symbol    = (tokenData[base + 2]?.result as string  | undefined) ?? '???';
        const allowed   = (tokenData[base + 3]?.result as boolean | undefined) ?? false;
        const decimals  = Number((tokenData[base + 4]?.result as bigint | undefined) ?? 18n);
        return { token, vaultBal, walletBal, symbol, allowed, decimals };
      })
      .filter((row) => row.vaultBal > 0n || row.walletBal > 0n);
  }, [allTokens, tokenData]);

  // All whitelisted tokens — used for the borrow token selector
  const allowedTokenRows = useMemo(() => {
    if (!tokenData) return [];
    return allTokens
      .map((token, i) => {
        const base = i * 5;
        const symbol   = (tokenData[base + 2]?.result as string  | undefined) ?? '???';
        const allowed  = (tokenData[base + 3]?.result as boolean | undefined) ?? false;
        const decimals = Number((tokenData[base + 4]?.result as bigint | undefined) ?? 18n);
        return { token, symbol, allowed, decimals };
      })
      .filter((row) => row.allowed);
  }, [allTokens, tokenData]);

  // ── Aave SDK ────────────────────────────────────────────────────────────────
  useAaveMarket({
    address: evmAddress(aaveMarketAddress ?? ZERO_ADDR),
    chainId: aaveChainId(connectedChainId),
  });
  const { data: sdkMarketState } = useUserMarketState({
    market: evmAddress(aaveMarketAddress ?? ZERO_ADDR),
    user: evmAddress(hasVault ? vaultAddress! : ZERO_ADDR),
    chainId: aaveChainId(connectedChainId),
  });
  const { data: sdkReserve } = useAaveReserve({
    market: evmAddress(aaveMarketAddress ?? ZERO_ADDR),
    underlyingToken: evmAddress(defiUsdtAddress ?? ZERO_ADDR),
    chainId: aaveChainId(connectedChainId),
  });
  const { data: sdkSupplies } = useUserSupplies({
    markets: [{ address: evmAddress(aaveMarketAddress ?? ZERO_ADDR), chainId: aaveChainId(connectedChainId) }],
    user: evmAddress(hasVault ? vaultAddress! : ZERO_ADDR),
  });
  const sdkSupplyPosition = sdkSupplies?.[0];
  const supplied = (() => {
    if (sdkSupplyPosition) {
      const val = parseFloat(String(sdkSupplyPosition.balance.amount?.value ?? 0));
      return BigInt(Math.round(val * 1e6));
    }
    return 0n;
  })();

  // ── Vault liquid balance ────────────────────────────────────────────────────
  const { data: treasuryBalance, refetch: refetchTreasury } = useReadContract({
    address: hasVault ? vaultAddress : undefined,
    abi: companyVaultABI,
    functionName: 'getTokenBalance',
    args: [defiUsdtAddress ?? ZERO_ADDR],
    query: { enabled: hasVault && !!defiUsdtAddress, refetchInterval: 10_000 },
  });

  // ── Deposit ─────────────────────────────────────────────────────────────────
  const depositWei = (() => {
    const n = parseFloat(depositAmt);
    return isNaN(n) || n <= 0 ? 0n : BigInt(Math.round(n * 1e6));
  })();
  const { data: depositAllowance, refetch: refetchDepositAllowance } = useReadContract({
    address: defiUsdtAddress,
    abi: erc20ABI,
    functionName: 'allowance',
    args: [connectedAddress!, hasVault ? vaultAddress! : ZERO_ADDR],
    query: { enabled: !!connectedAddress && hasVault && !!defiUsdtAddress, refetchInterval: 10_000 },
  });
  const { data: walletUsdtBal } = useReadContract({
    address: defiUsdtAddress,
    abi: erc20ABI,
    functionName: 'balanceOf',
    args: [connectedAddress ?? ZERO_ADDR],
    query: { enabled: !!connectedAddress && !!defiUsdtAddress, refetchInterval: 10_000 },
  });
  const { writeContract: writeApproveDeposit, isPending: isApprovePending } = useWriteContract();
  const { writeContract: writeDeposit, isPending: isDepositPending } = useWriteContract();
  const { isLoading: isApproveMining, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveTxHash });
  const { isLoading: isDepositMining, isSuccess: isDepositSuccess } = useWaitForTransactionReceipt({ hash: depositTxHash });
  useEffect(() => { if (isApproveSuccess) refetchDepositAllowance(); }, [isApproveSuccess]);
  useEffect(() => {
    if (isDepositSuccess) { refetchTreasury(); refetchTokenBalances(); setDepositAmt(''); }
  }, [isDepositSuccess]);
  const hasDepositAllowance =
    isApproveSuccess ? true : (depositAllowance ?? 0n) >= depositWei && depositWei > 0n;

  // ── Supply / Withdraw ───────────────────────────────────────────────────────
  const { writeContract, isPending } = useWriteContract();
  const { isLoading: isSupplyMining, isSuccess: isSupplySuccess } = useWaitForTransactionReceipt({ hash: supplyTxHash });
  const { isLoading: isWithdrawMining, isSuccess: isWithdrawSuccess } = useWaitForTransactionReceipt({ hash: withdrawTxHash });
  useEffect(() => {
    if (isSupplySuccess) { refetchTreasury(); refetchTokenBalances(); setSupplyAmt(''); setTxError(null); }
  }, [isSupplySuccess]);
  useEffect(() => {
    if (isWithdrawSuccess) { refetchTreasury(); refetchTokenBalances(); setWithdrawAmt(''); setTxError(null); }
  }, [isWithdrawSuccess]);

  const { isLoading: isBorrowMining, isSuccess: isBorrowSuccess } = useWaitForTransactionReceipt({ hash: borrowTxHash });
  useEffect(() => {
    if (isBorrowSuccess) { refetchTreasury(); refetchTokenBalances(); refetchAaveUserData(); setBorrowAmt(''); setTxError(null); }
  }, [isBorrowSuccess]);

  const isLoading = isSimulating || isPending || isSupplyMining || isWithdrawMining || isBorrowMining;

  async function handleWrite(
    functionName: 'supplyToAave' | 'withdrawFromAave' | 'borrowFromAave',
    amount: bigint,
    setHash: (h: `0x${string}`) => void,
    tokenOverride?: `0x${string}`,
  ) {
    if (!publicClient || !connectedAddress || !hasVault || !defiUsdtAddress) return;
    const tokenAddr = tokenOverride ?? defiUsdtAddress;
    setTxError(null);
    setIsSimulating(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (publicClient.simulateContract as any)({
        address: vaultAddress,
        abi: companyVaultABI,
        functionName,
        args: [tokenAddr, amount],
        account: connectedAddress,
      });
      setIsSimulating(false);
      writeContract(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { ...result.request, gas: result.request.gas ? result.request.gas * 12n / 10n : undefined } as any,
        {
          onSuccess: (hash) => setHash(hash),
          onError: (err) => setTxError((err as { shortMessage?: string }).shortMessage ?? err.message),
        },
      );
    } catch (err) {
      setIsSimulating(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      setTxError(
        e?.cause?.cause?.data?.errorName ??
          e?.cause?.cause?.reason ??
          e?.cause?.data?.errorName ??
          e?.cause?.reason ??
          e?.shortMessage ??
          e?.message ??
          String(err),
      );
    }
  }

  const supplyWei = (() => {
    const n = parseFloat(supplyAmt);
    return isNaN(n) || n <= 0 ? 0n : parseUnits(supplyAmt, 6);
  })();
  const insufficientTreasury = supplyWei > 0n && supplyWei > (treasuryBalance ?? 0n);

  // ── Create vault ────────────────────────────────────────────────────────────
  const { writeContract: writeCreateVault, isPending: isCreateVaultPending } = useWriteContract();
  const { isLoading: isCreateVaultMining, isSuccess: isCreateVaultSuccess } = useWaitForTransactionReceipt({ hash: createVaultTxHash });
  useEffect(() => {
    if (isCreateVaultSuccess) { refetchVaultAddress(); setTxError(null); }
  }, [isCreateVaultSuccess]);

  // ── Set aave pool ────────────────────────────────────────────────────────────
  const { writeContract: writeSetAavePool, isPending: isSetPoolPending } = useWriteContract();
  const { writeContract: writeSetAllowedToken, isPending: isWhitelistPending } = useWriteContract();

  // ── Authorization ────────────────────────────────────────────────────────────
  const isAuthorized = useMemo(() => {
    if (!connectedAddress || !company) return false;
    const lower = connectedAddress.toLowerCase();
    return (
      company.owner.toLowerCase() === lower ||
      company.operatorAddress.toLowerCase() === lower ||
      company.employees.some(
        (e) =>
          e.active &&
          e.employeeId.toLowerCase() === lower &&
          e.salaryItems.some((s) =>
            (company.powerRoles as readonly string[]).includes(s.role),
          ),
      )
    );
  }, [connectedAddress, company]);

  // ── Aave APY for protocol card ───────────────────────────────────────────────
  const aaveApySummary = sdkReserve
    ? `APY ${parseFloat(String(sdkReserve.supplyInfo.apy.value)).toFixed(2)}%`
    : undefined;
  const aavePositionSummary =
    supplied > 0n ? `$${fmtUSDT(supplied)} supplied` : undefined;

  // ─────────────────────────────────────────────────────────────────────────────
  // Guard renders
  // ─────────────────────────────────────────────────────────────────────────────

  if (!connectedAddress) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-white/40">Connect your wallet to view the DeFi hub.</p>
      </div>
    );
  }
  if (companyId === undefined) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <p className="text-white/40">No company selected.</p>
        <Link to="/companies-house" className="text-blue-400 hover:text-blue-300 text-sm underline underline-offset-2">
          ← Back to Companies
        </Link>
      </div>
    );
  }
  if (!companiesHouseAddress || !defiUsdtAddress) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-white/40">DeFi not available on this network.</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Main render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xl">⚡</span>
            <h1 className="text-xl font-bold text-white">DeFi Hub</h1>
            {company?.name && (
              <span className="text-white/35 font-normal text-base">— {company.name}</span>
            )}
            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-white/5 text-white/25 border border-white/10">
              #{companyId.toString()}
            </span>
          </div>
          <p className="text-xs text-white/30 mt-1">
            Earn yield on idle treasury funds across DeFi protocols.
          </p>
        </div>
        <Link
          to="/companies-house"
          className="shrink-0 text-xs text-white/35 hover:text-white/70 transition-colors mt-1"
        >
          ← Companies
        </Link>
      </div>

      {/* ── Vault overview bar ── */}
      {hasVault ? (
        <div
          className="rounded-2xl px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div>
            <span className="text-white/30">Vault </span>
            <span className="font-mono text-white/50">{vaultAddress?.slice(0, 10)}…{vaultAddress?.slice(-6)}</span>
          </div>
          <div>
            <span className="text-white/30">Liquid </span>
            <span className="font-mono text-white/70">${fmtUSDT(treasuryBalance ?? 0n)} {tok}</span>
          </div>
          {supplied > 0n && (
            <div>
              <span className="text-white/30">Supplied </span>
              <span className="font-mono text-white/70">${fmtUSDT(supplied)} {tok}</span>
            </div>
          )}
          {tokenRows.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {tokenRows.map((row) => (
                <span
                  key={row.token}
                  className="font-mono px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.05)', color: row.vaultBal > 0n ? '#52b788' : 'rgba(255,255,255,0.3)' }}
                >
                  {fmtToken(row.vaultBal, row.decimals, 2)} {row.symbol}
                </span>
              ))}
            </div>
          )}
          {!isDefiAdmin && (
            <span className="ml-auto text-white/20 italic">read-only</span>
          )}
          {isDefiAdmin && (
            <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: 'rgba(82,183,136,0.1)', color: '#52b788', border: '1px solid rgba(82,183,136,0.2)' }}>
              admin
            </span>
          )}
        </div>
      ) : (
        /* No vault yet */
        <div
          className="rounded-2xl p-5 space-y-3"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">🔒</span>
            <p className="text-sm font-semibold text-white/70">No Investment Vault</p>
          </div>
          <p className="text-xs text-white/35">
            Create a per-company vault to start earning yield across DeFi protocols.
            Funds are held in isolation from payroll.
          </p>
          {isAuthorized && (
            <button
              disabled={isCreateVaultPending || isCreateVaultMining}
              onClick={() =>
                writeCreateVault(
                  {
                    address: companiesHouseAddress,
                    abi: companiesHouseABI,
                    functionName: 'createVault',
                    args: [companyId, onchainAavePool, defiUsdtAddress],
                    gas: 500_000n,
                  },
                  {
                    onSuccess: (h) => setCreateVaultTxHash(h),
                    onError: (err) => setTxError((err as { shortMessage?: string }).shortMessage ?? err.message),
                  },
                )
              }
              className="px-5 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
              style={{ background: 'rgba(82,183,136,0.15)', color: '#52b788', border: '1px solid rgba(82,183,136,0.25)' }}
            >
              {isCreateVaultPending ? 'Confirm…' : isCreateVaultMining ? 'Creating…' : 'Create Investment Vault'}
            </button>
          )}
          {txError && <p className="text-xs text-red-400 break-words">{txError}</p>}
        </div>
      )}

      {/* ── Setup guards (Aave not configured / token not whitelisted) ── */}
      {hasVault && !isAaveConfigured && (
        <div
          className="rounded-2xl p-4 space-y-3"
          style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)' }}
        >
          <p className="text-sm font-semibold text-amber-300">Aave Pool Not Configured</p>
          <p className="text-xs text-white/40">This vault has no Aave pool address set.</p>
          {isDefiAdmin && onchainAavePool !== ZERO_ADDR && (
            <button
              disabled={isSetPoolPending}
              onClick={() =>
                writeSetAavePool(
                  { address: vaultAddress!, abi: companyVaultABI, functionName: 'setAavePool', args: [onchainAavePool] },
                  { onSuccess: () => refetchAavePool() },
                )
              }
              className="px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
              style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}
            >
              {isSetPoolPending ? 'Setting…' : 'Set Aave Pool'}
            </button>
          )}
        </div>
      )}

      {hasVault && isAaveConfigured && !usdtAllowed && (
        <div
          className="rounded-2xl p-4 space-y-3"
          style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)' }}
        >
          <p className="text-sm font-semibold text-amber-300">{tok} Not Whitelisted</p>
          <p className="text-xs text-white/40">{tok} must be whitelisted before DeFi operations.</p>
          {isDefiAdmin && (
            <button
              disabled={isWhitelistPending}
              onClick={() =>
                writeSetAllowedToken(
                  { address: vaultAddress!, abi: companyVaultABI, functionName: 'setAllowedToken', args: [defiUsdtAddress, true] },
                  { onSuccess: () => refetchUsdtAllowed() },
                )
              }
              className="px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
              style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}
            >
              {isWhitelistPending ? 'Whitelisting…' : `Whitelist ${tok}`}
            </button>
          )}
        </div>
      )}

      {/* ── Protocol selector grid ── */}
      {hasVault && isAaveConfigured && usdtAllowed && (
        <>
          <div>
            <p className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">Integrations</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {PROTOCOLS.map((p) => (
                <ProtocolCard
                  key={p.id}
                  protocol={p}
                  selected={selectedProtocol === p.id}
                  onClick={() => setSelectedProtocol(p.id)}
                  apySummary={p.id === 'aave' ? aaveApySummary : undefined}
                  positionSummary={p.id === 'aave' ? aavePositionSummary : undefined}
                />
              ))}
            </div>
          </div>

          {/* ── Protocol panel ── */}
          {selectedProtocol === 'aave' && (
            <AavePanel
              tok={tok}
              treasuryBalance={treasuryBalance as bigint | undefined}
              supplied={supplied}
              walletUsdtBal={walletUsdtBal as bigint | undefined}
              sdkReserve={sdkReserve as { supplyInfo: { apy: { value: unknown } } } | null | undefined}
              sdkMarketState={sdkMarketState}
              sdkSupplyPosition={sdkSupplyPosition}
              isLoading={isLoading}
              isAuthorized={isAuthorized || isDefiAdmin}
              hasDepositAllowance={hasDepositAllowance}
              depositAmt={depositAmt}
              setDepositAmt={setDepositAmt}
              supplyAmt={supplyAmt}
              setSupplyAmt={setSupplyAmt}
              withdrawAmt={withdrawAmt}
              setWithdrawAmt={setWithdrawAmt}
              isApprovePending={isApprovePending}
              isApproveMining={isApproveMining}
              isDepositPending={isDepositPending}
              isDepositMining={isDepositMining}
              isDepositSuccess={isDepositSuccess}
              isSupplySuccess={isSupplySuccess}
              isWithdrawSuccess={isWithdrawSuccess}
              isBorrowPending={isPending}
              isBorrowMining={isBorrowMining}
              isBorrowSuccess={isBorrowSuccess}
              borrowingEnabled={!!(borrowingEnabled as boolean | undefined)}
              borrowAmt={borrowAmt}
              setBorrowAmt={setBorrowAmt}
              borrowTokenAddr={borrowTokenAddr || (allowedTokenRows[0]?.token ?? '')}
              setBorrowTokenAddr={setBorrowTokenAddr}
              borrowTokenOptions={allowedTokenRows}
              availableBorrowsUsd={(() => {
                const d = aaveUserData as [bigint,bigint,bigint,bigint,bigint,bigint] | undefined;
                return d ? Number(d[2]) / 1e8 : 0;
              })()}
              txError={txError}
              onApprove={() => {
                if (!depositWei || !hasVault) return;
                writeApproveDeposit(
                  { address: defiUsdtAddress, abi: erc20ABI, functionName: 'approve', args: [vaultAddress!, depositWei] },
                  { onSuccess: (h) => setApproveTxHash(h) },
                );
              }}
              onDeposit={() => {
                if (!depositWei || !hasVault) return;
                writeDeposit(
                  { address: vaultAddress!, abi: companyVaultABI, functionName: 'deposit', args: [defiUsdtAddress, depositWei], gas: 120_000n },
                  { onSuccess: (h) => setDepositTxHash(h) },
                );
              }}
              onSupply={() => { if (supplyWei > 0n) handleWrite('supplyToAave', supplyWei, setSupplyTxHash); }}
              onWithdraw={() => {
                const isMax = withdrawAmt === fmtUSDT(supplied, 6).replace(/,/g, '');
                const amt = isMax ? MAX_UINT256 : parseUnits(withdrawAmt, 6);
                if (isMax || parseFloat(withdrawAmt) > 0) handleWrite('withdrawFromAave', amt, setWithdrawTxHash);
              }}
              onBorrow={() => {
                const n = parseFloat(borrowAmt);
                if (isNaN(n) || n <= 0) return;
                const selectedToken = borrowTokenAddr || allowedTokenRows[0]?.token;
                const decimals = allowedTokenRows.find(t => t.token === selectedToken)?.decimals ?? 6;
                if (!selectedToken) return;
                // Override token used in the borrow call
                handleWrite('borrowFromAave', parseUnits(borrowAmt, decimals), setBorrowTxHash, selectedToken as `0x${string}`);
              }}
              depositWei={depositWei}
              supplyWei={supplyWei}
              insufficientTreasury={insufficientTreasury}
            />
          )}

          {/* Placeholder panels for coming-soon protocols */}
          {selectedProtocol !== 'aave' && (() => {
            const proto = PROTOCOLS.find((p) => p.id === selectedProtocol);
            if (!proto) return null;
            return (
              <div
                className="rounded-2xl p-8 text-center space-y-3"
                style={{ background: `${proto.color}08`, border: `1px solid ${proto.color}20` }}
              >
                <span className="text-4xl block">{proto.icon}</span>
                <p className="font-semibold text-white/70">{proto.name}</p>
                <p className="text-sm text-white/35 max-w-xs mx-auto">{proto.desc}</p>
                <span
                  className="inline-block text-xs font-medium px-3 py-1 rounded-full mt-2"
                  style={{ background: `${proto.color}15`, color: proto.color, border: `1px solid ${proto.color}30` }}
                >
                  Coming Soon
                </span>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
