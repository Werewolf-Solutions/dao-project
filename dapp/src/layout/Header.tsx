import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAccount, useConnect, useDisconnect, useReadContract, useSwitchChain } from 'wagmi';
import { mainnet, bsc, sepolia, baseSepolia, foundry } from 'wagmi/chains';
import { formatUnits } from 'viem';
import { theme } from '@/contexts/ThemeContext';
import { useWLFPrice } from '@/hooks/useWLFPrice';
import { stakingABI, lpStakingABI, erc20ABI, getAddress } from '@/contracts';

// ─── Network selector config ─────────────────────────────────────────────────
const NETWORKS = [
  { chain: mainnet,    label: 'Ethereum',    icon: '⟠', color: '#627eea' },
  { chain: bsc,        label: 'BNB Chain',   icon: '⬡', color: '#f0b90b' },
  { chain: sepolia,    label: 'Sepolia',     icon: '⟠', color: '#f97316' },
  { chain: baseSepolia,label: 'Base Sepolia',icon: '🔵', color: '#0052ff' },
  { chain: foundry,    label: 'Anvil/Local', icon: '⚒', color: '#9ca3af' },
] as const;


// ─── NetworkSelector dropdown ────────────────────────────────────────────────
function NetworkSelector({ currentChainId }: { currentChainId: number | undefined }) {
  const { switchChain } = useSwitchChain();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = NETWORKS.find(n => n.chain.id === currentChainId);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
        style={{
          background: current ? `${current.color}18` : 'rgba(239,68,68,0.1)',
          borderColor: current ? `${current.color}55` : 'rgba(239,68,68,0.4)',
          color: current ? current.color : '#f87171',
        }}
        title="Switch network"
      >
        <span>{current?.icon ?? '⚠'}</span>
        <span className="hidden sm:inline">{current?.label ?? 'Wrong Network'}</span>
        <svg className={`w-2.5 h-2.5 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-44 rounded-xl shadow-xl z-50 py-1 overflow-hidden"
          style={{ background: '#0f1117', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {NETWORKS.map(({ chain, label, icon, color }) => {
            const isActive = chain.id === currentChainId;
            return (
              <button
                key={chain.id}
                onClick={() => { switchChain({ chainId: chain.id }); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-white/5 text-left"
                style={{ color: isActive ? color : 'rgba(255,255,255,0.7)' }}
              >
                <span style={{ color }}>{icon}</span>
                <span className="flex-1">{label}</span>
                {isActive && <span className="text-xs" style={{ color }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}


const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/token-sale', label: 'Token Sale' },
  { to: '/dao', label: 'DAO' },
  { to: '/staking', label: 'Staking' },
  { to: '/account', label: 'Account' },
  { to: '/companies-house', label: 'Companies' },
];

type StakePosition = {
  shares:   bigint;
  assets:   bigint;
  stakedAt: bigint;
  unlockAt: bigint;
  bonusApy: bigint;
  active:   boolean;
};

function fmt18(raw: bigint, dec = 4): string {
  return Number(formatUnits(raw, 18)).toLocaleString(undefined, { maximumFractionDigits: dec });
}

function timeRemaining(unlockAt: bigint): string {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (unlockAt === 0n || now >= unlockAt) return '';
  const secs = Number(unlockAt - now);
  const days = Math.ceil(secs / 86400);
  if (days > 365 * 2) return `${(days / 365).toFixed(1)}yr left`;
  if (days > 60)      return `${Math.round(days / 30)}mo left`;
  return `${days}d left`;
}

function positionCurrentValue(pos: StakePosition, totalShares: bigint | undefined, totalAssets: bigint | undefined): bigint {
  if (!totalShares || totalShares === 0n || !totalAssets) return pos.assets;
  return (pos.shares * totalAssets) / totalShares;
}

export default function Header() {
  const account = useAccount();
  const { connectors, connect, status, error } = useConnect();
  const { disconnect } = useDisconnect();
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isBalanceOpen, setIsBalanceOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const isConnected = account.status === 'connected' || account.status === 'reconnecting';
  const wlfPrice = useWLFPrice();
  const priceStr = wlfPrice === null ? null
    : wlfPrice < 0.000001 ? wlfPrice.toExponential(2)
    : wlfPrice < 0.001 ? wlfPrice.toFixed(6)
    : wlfPrice < 1 ? wlfPrice.toFixed(4)
    : wlfPrice.toFixed(2);

  const chainId         = account.chainId;
  const address         = account.address;
  const stakingAddress  = getAddress(chainId, 'Staking');
  const wlfAddress      = getAddress(chainId, 'WerewolfToken');
  const lpStakingAddress = getAddress(chainId, 'LPStaking');

  // ── Contract reads ──────────────────────────────────────────────────────

  const { data: wlfWallet } = useReadContract({
    address: wlfAddress, abi: erc20ABI, functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address && !!wlfAddress, refetchInterval: 15_000 },
  });

  const { data: positions } = useReadContract({
    address: stakingAddress, abi: stakingABI, functionName: 'getPositions',
    args: [address!],
    query: { enabled: !!address && !!stakingAddress, refetchInterval: 15_000 },
  });

  const { data: stakingTotalShares } = useReadContract({
    address: stakingAddress, abi: stakingABI, functionName: 'totalSupply',
    query: { enabled: !!stakingAddress, refetchInterval: 15_000 },
  });

  const { data: stakingTotalAssets } = useReadContract({
    address: stakingAddress, abi: stakingABI, functionName: 'totalAssets',
    query: { enabled: !!stakingAddress, refetchInterval: 15_000 },
  });

  const { data: lpShares } = useReadContract({
    address: lpStakingAddress, abi: lpStakingABI, functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address && !!lpStakingAddress, refetchInterval: 15_000 },
  });

  const { data: lpUserWlf } = useReadContract({
    address: lpStakingAddress, abi: lpStakingABI, functionName: 'getWLFVotingPower',
    args: [address!],
    query: { enabled: !!address && !!lpStakingAddress, refetchInterval: 15_000 },
  });

  const { data: lpLockTime } = useReadContract({
    address: lpStakingAddress, abi: lpStakingABI, functionName: 'fixedLockUnlockTime',
    args: [address!],
    query: { enabled: !!address && !!lpStakingAddress },
  });

  // ── Derived totals ──────────────────────────────────────────────────────

  const activePositions = (positions ?? []).filter(p => p.active);

  const stakedWlf = activePositions.reduce((acc, pos) => {
    return acc + positionCurrentValue(pos, stakingTotalShares, stakingTotalAssets);
  }, 0n);

  const totalWlf = (wlfWallet ?? 0n) + stakedWlf + (lpUserWlf ?? 0n);

  const hasAnyWlf = totalWlf > 0n;

  // ── Close dropdown on outside click ────────────────────────────────────

  useEffect(() => {
    if (!isBalanceOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsBalanceOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isBalanceOpen]);

  useEffect(() => {
    if (status === 'success') setIsPopupOpen(false);
  }, [status]);

  return (
    <>
      <header className={`fixed inset-x-0 top-0 z-50 ${theme.header}`}>
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Brand */}
          <Link to="/" className="font-bold text-lg tracking-tight">
            WLF <span className="text-[#8e2421]">DAO</span>
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ to, label }) => {
              const active = location.pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-[#8e2421] text-white'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Network badge + Wallet button */}
          <div className="flex items-center gap-2">
            {/* WLF price */}
            {priceStr && (
              <span className="hidden sm:inline px-2.5 py-1 rounded-full text-xs font-mono bg-white/5 text-white/50 border border-white/10">
                WLF ${priceStr}
              </span>
            )}
            {isConnected && (
              <NetworkSelector currentChainId={account.chainId} />
            )}

            {(account.status === 'connected' || account.status === 'reconnecting') ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  className={`${theme.btnSecondary} px-3 py-1.5 text-sm font-mono flex items-center gap-2`}
                  onClick={() => setIsBalanceOpen(v => !v)}
                  title="Show WLF balance breakdown"
                >
                  <span>{account.address?.slice(0, 6)}…{account.address?.slice(-4)}</span>
                  {hasAnyWlf && (
                    <>
                      <span className="text-white/30">|</span>
                      <span className="font-mono text-xs" style={{ color: '#52b788' }}>
                        {fmt18(totalWlf, 2)} WLF
                      </span>
                    </>
                  )}
                  <svg
                    className={`w-3 h-3 text-white/40 transition-transform ${isBalanceOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isBalanceOpen && (
                  <div
                    className="absolute right-0 top-full mt-1 w-72 rounded-xl shadow-xl z-50 overflow-hidden"
                    style={{ background: '#0f1117', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    {/* Header row */}
                    <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <p className="text-xs font-medium text-white/50 uppercase tracking-wider">WLF Balance</p>
                      <p className="text-lg font-bold font-mono mt-0.5" style={{ color: '#52b788' }}>
                        {fmt18(totalWlf, 4)} WLF
                      </p>
                    </div>

                    <div className="py-2">
                      {/* Wallet row */}
                      <div className="px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-base">👛</span>
                          <span className="text-sm text-white/70">Wallet</span>
                        </div>
                        <span className="text-sm font-mono text-white/90">
                          {fmt18(wlfWallet ?? 0n, 4)} WLF
                        </span>
                      </div>

                      {/* WLF staked positions */}
                      {activePositions.length > 0 && (
                        <>
                          <div className="px-4 pt-2 pb-1">
                            <p className="text-xs text-white/30 uppercase tracking-wider">WLF Staked</p>
                          </div>
                          {activePositions.map((pos, i) => {
                            const isFixed  = pos.unlockAt > 0n;
                            const now      = BigInt(Math.floor(Date.now() / 1000));
                            const isLocked = isFixed && now < pos.unlockAt;
                            const currentVal = positionCurrentValue(pos, stakingTotalShares, stakingTotalAssets);
                            const reward     = currentVal > pos.assets ? currentVal - pos.assets : 0n;
                            const remaining  = isFixed ? timeRemaining(pos.unlockAt) : '';
                            return (
                              <div key={i} className="px-4 py-2 flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-base shrink-0">{isFixed ? '🔒' : '🔓'}</span>
                                  <div className="min-w-0">
                                    <p className="text-sm text-white/80 leading-tight">
                                      {isFixed ? 'Fixed' : 'Flexible'}
                                      {isLocked && remaining && (
                                        <span className="ml-1.5 text-xs text-yellow-400/70">{remaining}</span>
                                      )}
                                      {isFixed && !isLocked && (
                                        <span className="ml-1.5 text-xs text-green-400/70">unlocked</span>
                                      )}
                                    </p>
                                    {reward > 0n && (
                                      <p className="text-xs leading-tight" style={{ color: '#52b788' }}>
                                        +{fmt18(reward, 4)} rewards
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <span className="text-sm font-mono text-white/90 shrink-0 ml-2">
                                  {fmt18(currentVal, 4)} WLF
                                </span>
                              </div>
                            );
                          })}
                        </>
                      )}

                      {/* LP staked */}
                      {lpShares !== undefined && lpShares > 0n && (
                        <>
                          <div className="px-4 pt-2 pb-1">
                            <p className="text-xs text-white/30 uppercase tracking-wider">LP Staked</p>
                          </div>
                          <div className="px-4 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-base">💧</span>
                              <div>
                                <p className="text-sm text-white/80 leading-tight">WLF/USDT LP</p>
                                {lpLockTime !== undefined && lpLockTime > 0n && (
                                  (() => {
                                    const remaining = timeRemaining(lpLockTime);
                                    const unlocked = BigInt(Math.floor(Date.now() / 1000)) >= lpLockTime;
                                    return remaining ? (
                                      <p className="text-xs text-yellow-400/70 leading-tight">{remaining}</p>
                                    ) : unlocked ? (
                                      <p className="text-xs text-green-400/70 leading-tight">unlocked</p>
                                    ) : null;
                                  })()
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-mono text-white/90">
                                {fmt18(lpUserWlf ?? 0n, 4)} WLF
                              </p>
                              <p className="text-xs text-white/30">
                                {fmt18(lpShares, 4)} sWLP
                              </p>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Disconnect */}
                    <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <button
                        onClick={() => { disconnect(); setIsBalanceOpen(false); }}
                        className="w-full text-xs text-red-400/70 hover:text-red-400 transition-colors text-center py-1"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                className={`${theme.btnPrimary} px-4 py-1.5 text-sm`}
                onClick={() => setIsPopupOpen(true)}
              >
                Connect
              </button>
            )}

            {/* Mobile account link — rightmost */}
            <Link
              to="/account"
              className="md:hidden p-2 rounded-lg transition-colors"
              style={{ color: 'rgba(255,255,255,0.6)' }}
              title="Account"
            >
              <i className="fa-solid fa-user text-base" />
            </Link>
          </div>
        </div>
      </header>

      {/* Wallet connect modal */}
      {isPopupOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 backdrop-blur-sm"
          onClick={() => setIsPopupOpen(false)}
        >
          <div
            className={`${theme.card} w-full max-w-sm mx-4`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`px-6 py-4 ${theme.divider}`}>
              <h2 className="text-lg font-bold">Connect Wallet</h2>
            </div>
            <div className="px-6 py-5 space-y-3">
              {connectors.filter(c => c.name === 'MetaMask').map((connector) => (
                <button
                  key={connector.uid}
                  onClick={() => connect({ connector })}
                  type="button"
                  className={`w-full px-4 py-3 ${theme.btnInfo}`}
                >
                  MetaMask
                </button>
              ))}
              <button
                type="button"
                disabled
                className={`w-full px-4 py-3 ${theme.btnSecondary} opacity-50 cursor-not-allowed text-left flex justify-between items-center`}
              >
                <span>Ledger</span>
                <span className="text-xs">Coming Soon</span>
              </button>
              <button
                type="button"
                disabled
                className={`w-full px-4 py-3 ${theme.btnSecondary} opacity-50 cursor-not-allowed text-left flex justify-between items-center`}
              >
                <span>Other Wallets</span>
                <span className="text-xs">Coming Soon</span>
              </button>
              {status === 'pending' && (
                <p className={`text-sm text-center ${theme.textMuted}`}>Connecting…</p>
              )}
              {error && (
                <p className="text-sm text-center text-red-400">{error.message}</p>
              )}
              <button
                onClick={() => setIsPopupOpen(false)}
                className={`w-full px-4 py-2 ${theme.btnSecondary} text-sm`}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
