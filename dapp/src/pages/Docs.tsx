import { useState } from 'react';
import { useAccount } from 'wagmi';
import { theme } from '@/contexts/ThemeContext';
import { PageContainer } from '@/components/PageContainer';
import { ADDRESSES } from '@/contracts/addresses';

// ── Chain labels ──────────────────────────────────────────────────────────────

const CHAIN_LABELS: Record<number, { name: string; color: string; icon: string }> = {
  31337:    { name: 'Anvil / Local',  color: '#9ca3af', icon: '⚒' },
  84532:    { name: 'Base Sepolia',   color: '#0052ff', icon: '🔵' },
  11155111: { name: 'Sepolia',        color: '#f97316', icon: '⟠' },
  1:        { name: 'Ethereum',       color: '#627eea', icon: '⟠' },
};

// ── Contract descriptions ─────────────────────────────────────────────────────

const CONTRACT_INFO: Record<string, { icon: string; desc: string }> = {
  Treasury:         { icon: '🏦', desc: 'Holds DAO funds and distributes staking rewards' },
  TimeLock:         { icon: '⏱', desc: 'Enforces time delay on all governance actions' },
  WerewolfToken:    { icon: '🐺', desc: 'WLF governance token (1B total supply)' },
  Staking:          { icon: '📈', desc: 'ERC4626 vault — stake WLF to earn compounding rewards' },
  LPStaking:        { icon: '💧', desc: 'Stake WLF/USDT LP tokens for governance voting power' },
  DAO:              { icon: '🗳️', desc: 'Proposal creation, voting, and execution' },
  TokenSale:        { icon: '🪙', desc: 'Public WLF token sale with Uniswap LP auto-add' },
  USDT:             { icon: '💵', desc: 'USDT token used for token purchases and payroll' },
  CompaniesHouse:   { icon: '🏢', desc: 'On-chain company registry with employee payroll' },
  CompanyVaultImpl: { icon: '🔒', desc: 'CompanyVault beacon implementation (proxy target)' },
  AaveUSDT:         { icon: '🌊', desc: 'Aave-listed USDC/USDT for DeFi yield' },
  AavePool:         { icon: '🌊', desc: 'Aave v3 Pool proxy for supplying / borrowing' },
  USDC:             { icon: '💵', desc: 'USDC token (Aave-listed on live networks)' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ── CopyButton ────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={copy}
      title="Copy address"
      className="ml-2 px-2 py-0.5 rounded text-xs font-mono transition-all"
      style={{
        background: copied ? 'rgba(82,183,136,0.15)' : 'rgba(255,255,255,0.06)',
        color: copied ? '#52b788' : 'rgba(255,255,255,0.45)',
        border: `1px solid ${copied ? 'rgba(82,183,136,0.3)' : 'rgba(255,255,255,0.1)'}`,
      }}
    >
      {copied ? '✓ copied' : 'copy'}
    </button>
  );
}

// ── AddressRow ────────────────────────────────────────────────────────────────

function AddressRow({ name, address }: { name: string; address: string }) {
  const info = CONTRACT_INFO[name];
  return (
    <div
      className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl transition-colors hover:bg-white/[0.03]"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {name === 'WerewolfToken' ? (
          <img src="/ws-icon.png" alt="WLF" className="w-6 h-6 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="text-lg shrink-0">{info?.icon ?? '📄'}</span>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-white/90">{name}</p>
          {info?.desc && (
            <p className="text-xs text-white/35 truncate">{info.desc}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="font-mono text-xs text-white/50 hidden sm:inline">{address}</span>
        <span className="font-mono text-xs text-white/50 sm:hidden">{short(address)}</span>
        <CopyButton text={address} />
      </div>
    </div>
  );
}

// ── ChainSection ──────────────────────────────────────────────────────────────

function ChainSection({ chainId, contracts, active }: {
  chainId: number;
  contracts: Record<string, string>;
  active: boolean;
}) {
  const meta = CHAIN_LABELS[chainId] ?? { name: `Chain ${chainId}`, color: '#9ca3af', icon: '🔗' };
  const entries = Object.entries(contracts);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: '#0f1117',
        border: `1px solid ${active ? `${meta.color}40` : 'rgba(255,255,255,0.07)'}`,
        boxShadow: active ? `0 0 0 1px ${meta.color}20` : 'none',
      }}
    >
      {/* Chain header */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: `${meta.color}08` }}
      >
        <span style={{ color: meta.color }}>{meta.icon}</span>
        <span className="font-semibold text-sm" style={{ color: meta.color }}>{meta.name}</span>
        <span className="text-xs text-white/30 font-mono">id={chainId}</span>
        {active && (
          <span
            className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ background: `${meta.color}20`, color: meta.color }}
          >
            connected
          </span>
        )}
      </div>

      {/* Address rows */}
      <div>
        {entries.map(([name, addr]) => (
          <AddressRow key={name} name={name} address={addr} />
        ))}
      </div>

      {/* Copy all button */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <CopyAllButton chainId={chainId} contracts={contracts} />
      </div>
    </div>
  );
}

// ── CopyAllButton ─────────────────────────────────────────────────────────────

function CopyAllButton({ chainId, contracts }: { chainId: number; contracts: Record<string, string> }) {
  const [copied, setCopied] = useState(false);

  const copyAll = async () => {
    const text = Object.entries(contracts)
      .map(([name, addr]) => `${name}: ${addr}`)
      .join('\n');
    await navigator.clipboard.writeText(`Chain ${chainId}\n${text}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={copyAll}
      className="text-xs px-3 py-1.5 rounded-lg transition-all"
      style={{
        background: copied ? 'rgba(82,183,136,0.12)' : 'rgba(255,255,255,0.05)',
        color: copied ? '#52b788' : 'rgba(255,255,255,0.4)',
        border: `1px solid ${copied ? 'rgba(82,183,136,0.25)' : 'rgba(255,255,255,0.08)'}`,
      }}
    >
      {copied ? '✓ Copied all addresses' : 'Copy all addresses'}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Docs() {
  const { chainId } = useAccount();

  const chains = Object.entries(ADDRESSES) as [string, Record<string, string>][];

  // Sort: connected chain first, then by chainId
  const sorted = [...chains].sort(([a], [b]) => {
    const aId = Number(a);
    const bId = Number(b);
    if (aId === chainId) return -1;
    if (bId === chainId) return 1;
    return aId - bId;
  });

  return (
    <PageContainer>
      {/* Useful Links */}
      <div className="mb-8">
        <h2 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${theme.textMuted}`}>Useful Links</h2>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://app.aave.com/faucet/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors hover:bg-white/10"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.75)' }}
          >
            <span>🌊</span>
            <span>Aave Faucet</span>
            <svg className="w-3 h-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>

      <div className="space-y-3 mb-8">
        <h1 className={`text-2xl font-bold ${theme.textPrimary}`}>Contract Addresses</h1>
        <p className={`text-sm ${theme.textMuted}`}>
          Deployed contracts across all supported networks. Click <span className="font-mono bg-white/5 px-1 py-0.5 rounded text-white/60">copy</span> on any address to copy it, or use "Copy all addresses" to grab every address for a chain at once.
        </p>
      </div>

      <div className="space-y-6">
        {sorted.map(([id, contracts]) => (
          <ChainSection
            key={id}
            chainId={Number(id)}
            contracts={contracts}
            active={Number(id) === chainId}
          />
        ))}
      </div>
    </PageContainer>
  );
}
