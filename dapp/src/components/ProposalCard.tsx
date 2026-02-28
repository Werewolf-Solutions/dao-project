import { useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { daoABI } from '@/contracts';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from './Button';

const STATE_LABELS: Record<number, string> = {
  0: '—',
  1: 'Pending',
  2: 'Active',
  3: 'Canceled',
  4: 'Defeated',
  5: 'Succeeded',
  6: 'Queued',
  7: 'Expired',
  8: 'Executed',
};

// Map known function signatures to plain-English labels
const SIG_LABELS: Record<string, string> = {
  'airdrop(address,uint256)':        'Airdrop WLF tokens',
  'startSale(uint256,uint256)':      'Start token sale',
  'endSale()':                       'End token sale',
  'transfer(address,uint256)':       'Transfer tokens',
  'setPendingAdmin(address)':        'Set timelock pending admin',
  'acceptAdmin()':                   'Accept timelock admin',
  'setGuardian(address)':            'Set guardian address',
  'payEmployee(address,uint256)':    'Pay employee',
};

function sigToLabel(sig: string): string {
  return SIG_LABELS[sig] ?? sig;
}

function fmtWlf(raw: bigint): string {
  const n = Number(formatUnits(raw, 18));
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtCountdown(targetTs: bigint): string {
  const now = Math.floor(Date.now() / 1000);
  const secs = Number(targetTs) - now;
  if (secs <= 0) return 'ended';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

interface ProposalCardProps {
  id: number;
  daoAddress: `0x${string}`;
  isGuardian: boolean;
  visibleStates: Set<string>;
  onAction: (type: 'approve' | 'vote' | 'queue' | 'execute', id: number, support?: boolean) => void;
}

export function ProposalCard({ id, daoAddress, isGuardian, visibleStates, onAction }: ProposalCardProps) {
  const { address } = useAccount();
  const { theme } = useTheme();
  const [showDetails, setShowDetails] = useState(false);

  const { data: raw } = useReadContract({
    address: daoAddress,
    abi: daoABI,
    functionName: 'proposals',
    args: [BigInt(id)],
  });

  const { data: stateStr } = useReadContract({
    address: daoAddress,
    abi: daoABI,
    functionName: 'getProposalState',
    args: [BigInt(id)],
  });

  const { data: receipt } = useReadContract({
    address: daoAddress,
    abi: daoABI,
    functionName: 'proposalReceipts',
    args: [BigInt(id), address!],
    query: { enabled: !!address },
  });

  const { data: actions } = useReadContract({
    address: daoAddress,
    abi: daoABI,
    functionName: 'getProposalActions',
    args: [BigInt(id)],
  });

  if (!raw) return null;

  // Tuple: (state, id, proposer, votesFor, votesAgainst, startTime, endTime, eta, canceled, executed)
  const [stateIdx, , proposer, votesFor, votesAgainst, startTime, endTime, eta] = raw;
  const label = stateStr ?? STATE_LABELS[Number(stateIdx)] ?? 'Unknown';

  // Apply status filter (empty set = show all)
  if (visibleStates.size > 0 && label !== 'Unknown' && !visibleStates.has(label)) return null;

  const badgeClass = (theme.badge as Record<string, string>)[label] ?? 'text-white/50 bg-white/5 border border-white/10';

  const totalVotes = BigInt(votesFor) + BigInt(votesAgainst);
  const forPct  = totalVotes > 0n ? Number((BigInt(votesFor)     * 100n) / totalVotes) : 0;
  const agstPct = totalVotes > 0n ? Number((BigInt(votesAgainst) * 100n) / totalVotes) : 0;

  const hasVoted = receipt?.[0] ?? false;
  const votedFor = receipt?.[1] ?? false;

  const nowTs = BigInt(Math.floor(Date.now() / 1000));
  const readyToExecute = label === 'Queued' && eta > 0n && nowTs >= eta;

  // Voting period progress (0–100)
  const votingClosed = label === 'Active' && endTime > 0n && nowTs >= endTime;
  const votingProgress = (() => {
    if (startTime === 0n || endTime <= startTime) return 0;
    const elapsed = nowTs > endTime ? endTime - startTime : nowTs - startTime;
    return Math.min(100, Number((elapsed * 100n) / (endTime - startTime)));
  })();

  type ActionsTuple = [`0x${string}`[], string[], `0x${string}`[]];
  const targets    = (actions as ActionsTuple | undefined)?.[0] ?? [];
  const signatures = (actions as ActionsTuple | undefined)?.[1] ?? [];
  const datas      = (actions as ActionsTuple | undefined)?.[2] ?? [];

  return (
    <div className={`${theme.cardNested} p-4 space-y-4`}>

      {/* ── Header ── */}
      <div className="flex justify-between items-start">
        <h3 className="font-bold text-base">Proposal #{id}</h3>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeClass}`}>{label}</span>
      </div>

      {/* ── Proposer (short) ── */}
      <div className={`text-xs ${theme.textMuted}`}>
        <span className={`font-medium ${theme.textSecondary}`}>Proposer: </span>
        <span className="font-mono">{shortAddr(proposer)}</span>
      </div>

      {/* ── Actions (human-readable) ── */}
      {targets.length > 0 && (
        <div className="space-y-1">
          <p className={`text-xs font-medium ${theme.textSecondary}`}>What this proposal does</p>
          {targets.map((t, i) => (
            <div key={i} className="flex items-baseline gap-1.5 text-xs">
              <span className={`shrink-0 font-medium ${theme.textMuted}`}>{i + 1}.</span>
              <span className="text-white/80 font-medium">{sigToLabel(signatures[i] ?? '')}</span>
              <span className={`font-mono ${theme.textMuted}`}>on {shortAddr(t)}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Voting period progress bar ── */}
      {label === 'Active' && endTime > 0n && (
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            {votingClosed ? (
              <span className="text-amber-400 font-medium">Voting Closed</span>
            ) : (
              <span className="text-green-400/80 font-medium">
                Voting open — {fmtCountdown(endTime)} left
              </span>
            )}
            <span className={theme.textMuted}>
              closes {new Date(Number(endTime) * 1000).toLocaleString()}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 rounded-full ${
                votingClosed ? 'bg-amber-500/60' : 'bg-green-500/70'
              }`}
              style={{ width: `${votingProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Vote bar (bicolor with 50% pass-line) ── */}
      <div>
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-green-400 font-medium">For {forPct}%</span>
          <span className="text-red-400 font-medium">Against {agstPct}%</span>
        </div>
        <div className="relative h-2 rounded-full overflow-hidden bg-white/5">
          {totalVotes > 0n && (
            <>
              <div
                className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-500"
                style={{ width: `${forPct}%` }}
              />
              <div
                className="absolute right-0 top-0 h-full bg-red-500 transition-all duration-500"
                style={{ width: `${agstPct}%` }}
              />
            </>
          )}
          {/* 50% pass line always visible */}
          <div className="absolute left-1/2 top-0 h-full w-0.5 bg-white/50 z-10" />
        </div>
        <div className={`flex justify-between text-xs mt-1 ${theme.textMuted}`}>
          <span>{fmtWlf(BigInt(votesFor))} WLF</span>
          <span>{fmtWlf(BigInt(votesAgainst))} WLF</span>
        </div>
        {totalVotes === 0n ? (
          <p className="text-xs mt-1 text-white/30">No votes cast yet</p>
        ) : (
          <p className={`text-xs mt-1 ${theme.textMuted}`}>
            Needs{' '}
            <span className={theme.textSecondary}>For {'>'} Against</span>
            {' '}to pass — line marks 50%
            {forPct > 50
              ? <span className="text-green-400"> — passing ✓</span>
              : <span className="text-red-400"> — failing ✗</span>
            }
          </p>
        )}
      </div>

      {/* ── Timing ── */}
      <div className={`text-xs ${theme.textMuted} space-y-0.5`}>
        {label === 'Succeeded' && endTime > 0n && (
          <p>Voting ended: {new Date(Number(endTime) * 1000).toLocaleString()}</p>
        )}
        {eta > 0n && (
          <p className={readyToExecute ? 'text-sky-400' : ''}>
            {readyToExecute
              ? 'Ready to execute'
              : `Executable after: ${new Date(Number(eta) * 1000).toLocaleString()}`}
          </p>
        )}
      </div>

      {/* ── Action buttons ── */}
      <div className="flex flex-wrap gap-2 items-center">
        {label === 'Pending' && isGuardian && (
          <Button size="sm" variant="info" onClick={() => onAction('approve', id)}>
            Approve (guardian)
          </Button>
        )}
        {label === 'Pending' && !isGuardian && (
          <div className="space-y-1 w-full">
            <span className={`text-xs italic ${theme.textMuted}`}>Awaiting guardian approval</span>
            <p className="text-xs text-white/30 leading-snug">
              The guardian is a temporary anti-spam safeguard common in early DAOs — it prevents
              malicious or low-quality proposals before the community reaches critical mass.
            </p>
          </div>
        )}

        {label === 'Active' && !votingClosed && !hasVoted && (
          <>
            <Button size="sm" variant="success" onClick={() => onAction('vote', id, true)}>Vote For</Button>
            <Button size="sm" variant="danger"  onClick={() => onAction('vote', id, false)}>Vote Against</Button>
          </>
        )}
        {label === 'Active' && !votingClosed && hasVoted && (
          <span className={`text-xs italic ${theme.textMuted}`}>
            You voted {votedFor ? '✅ For' : '❌ Against'}
          </span>
        )}
        {label === 'Active' && votingClosed && (
          totalVotes > 0n && forPct > 50 ? (
            <Button size="sm" variant="info" onClick={() => onAction('queue', id)}>
              Queue (voting ended)
            </Button>
          ) : (
            <span className={`text-xs italic ${theme.textMuted}`}>
              Voting period ended — call Queue to finalize
              {totalVotes > 0n && <span className="text-red-400"> (would Fail)</span>}
              {totalVotes === 0n && <span className="text-red-400"> (no votes — Defeated)</span>}
            </span>
          )
        )}

        {label === 'Succeeded' && (
          <Button size="sm" variant="info" onClick={() => onAction('queue', id)}>Queue</Button>
        )}
        {label === 'Queued' && (
          <Button size="sm" variant="primary" onClick={() => onAction('execute', id)}>Execute</Button>
        )}
      </div>

      {/* ── Details toggle ── */}
      <div>
        <button
          onClick={() => setShowDetails(v => !v)}
          className="text-xs text-white/35 hover:text-white/65 transition-colors"
        >
          {showDetails ? '▴ Hide details' : '▾ Show details'}
        </button>

        {showDetails && (
          <div className="mt-3 space-y-3 text-xs border-t border-white/10 pt-3">
            {/* Full proposer */}
            <div>
              <p className={`font-medium mb-0.5 ${theme.textSecondary}`}>Proposer</p>
              <p className={`font-mono break-all ${theme.textMuted}`}>{proposer}</p>
            </div>

            {/* Per-action breakdown */}
            {targets.length > 0 && targets.map((t, i) => (
              <div key={i} className="space-y-0.5">
                <p className={`font-medium ${theme.textSecondary}`}>Action {i + 1}</p>
                <p className={`font-mono break-all ${theme.textMuted}`}>
                  <span className="text-white/40">Target: </span>{t}
                </p>
                <p className={theme.textMuted}>
                  <span className="text-white/40">Function: </span>{signatures[i] ?? '—'}
                </p>
                {datas[i] && datas[i] !== '0x' && (
                  <div>
                    <p className="text-white/40">Calldata:</p>
                    <p className="font-mono text-white/35 break-all max-h-20 overflow-y-auto bg-white/5 rounded p-1.5 mt-0.5">
                      {datas[i]}
                    </p>
                  </div>
                )}
              </div>
            ))}

            {/* Timeline */}
            <div className="space-y-0.5">
              <p className={`font-medium ${theme.textSecondary}`}>Timeline</p>
              {startTime > 0n && (
                <p className="text-white/40">
                  Voting start: {new Date(Number(startTime) * 1000).toLocaleString()}
                </p>
              )}
              {endTime > 0n && (
                <p className="text-white/40">
                  Voting end: {new Date(Number(endTime) * 1000).toLocaleString()}
                </p>
              )}
              {eta > 0n && (
                <p className="text-white/40">
                  Execution ETA: {new Date(Number(eta) * 1000).toLocaleString()}
                </p>
              )}
            </div>

            {/* Vote receipt */}
            {address && (
              <div>
                <p className={`font-medium mb-0.5 ${theme.textSecondary}`}>Your vote</p>
                <p className="text-white/50">
                  {hasVoted
                    ? `${votedFor ? 'For' : 'Against'} — ${fmtWlf(BigInt(receipt?.[2] ?? 0n))} WLF`
                    : 'Not yet voted'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
