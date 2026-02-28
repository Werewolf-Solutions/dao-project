import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { sepolia, foundry, localhost } from 'wagmi/chains';
import { theme } from '@/contexts/ThemeContext';
import { useWLFPrice } from '@/hooks/useWLFPrice';

const SUPPORTED_CHAINS = new Set([sepolia.id, foundry.id, localhost.id]);

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/token-sale', label: 'Token Sale' },
  { to: '/dao', label: 'DAO' },
  { to: '/staking', label: 'Staking' },
  { to: '/account', label: 'Account' },
];

export default function Header() {
  const account = useAccount();
  const { connectors, connect, status, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const location = useLocation();

  const isConnected = account.status === 'connected';
  const isSupported = !account.chainId || SUPPORTED_CHAINS.has(account.chainId as (typeof sepolia.id | typeof foundry.id | typeof localhost.id));
  const wlfPrice = useWLFPrice();
  const priceStr = wlfPrice === null ? null
    : wlfPrice < 0.000001 ? wlfPrice.toExponential(2)
    : wlfPrice < 0.001 ? wlfPrice.toFixed(6)
    : wlfPrice < 1 ? wlfPrice.toFixed(4)
    : wlfPrice.toFixed(2);

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
              isSupported ? (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-900/40 text-green-300 border border-green-700/40">
                  ● {account.chain?.name ?? `Chain ${account.chainId}`}
                </span>
              ) : (
                <button
                  onClick={() => switchChain({ chainId: sepolia.id })}
                  className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-900/40 text-red-300 border border-red-700/40 hover:bg-red-800/60 transition-colors"
                  title="Click to switch to Sepolia"
                >
                  ⚠ Wrong Network
                </button>
              )
            )}
            {account.status === 'connected' ? (
              <button
                className={`${theme.btnSecondary} px-3 py-1.5 text-sm font-mono`}
                onClick={() => disconnect()}
                title="Click to disconnect"
              >
                {account.address?.slice(0, 6)}…{account.address?.slice(-4)}
              </button>
            ) : (
              <button
                className={`${theme.btnPrimary} px-4 py-1.5 text-sm`}
                onClick={() => setIsPopupOpen(true)}
              >
                Connect
              </button>
            )}
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
              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  onClick={() => connect({ connector })}
                  type="button"
                  className={`w-full px-4 py-3 ${theme.btnInfo}`}
                >
                  {connector.name}
                </button>
              ))}
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
