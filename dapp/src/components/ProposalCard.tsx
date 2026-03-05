import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatUnits, decodeAbiParameters, parseAbiParameters } from 'viem';
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

// ── Calldata decoder ──────────────────────────────────────────────────────────

type ParamFmt = 'address' | 'wlf' | 'usdt' | 'price' | 'seconds' | 'blocks' | 'raw';
type ParamDef = { name: string; fmt: ParamFmt };

const SIG_PARAMS: Record<string, ParamDef[]> = {
  'airdrop(address,uint256)':              [{ name: 'to',         fmt: 'address' }, { name: 'amount',      fmt: 'wlf'     }],
  'startSale(uint256,uint256)':            [{ name: 'amount',     fmt: 'wlf'     }, { name: 'price',       fmt: 'price'   }],
  'endSale()':                             [],
  'transfer(address,uint256)':             [{ name: 'to',         fmt: 'address' }, { name: 'amount',      fmt: 'raw'     }],
  'setPendingAdmin(address)':              [{ name: 'admin',      fmt: 'address' }],
  'acceptAdmin()':                         [],
  'setGuardian(address)':                  [{ name: 'guardian',   fmt: 'address' }],
  'payEmployee(address,uint256)':          [{ name: 'employee',   fmt: 'address' }, { name: 'amount',      fmt: 'raw'     }],
  'setVotingPeriod(uint256)':              [{ name: 'period',     fmt: 'seconds' }],
  'setVotingDelay(uint256)':               [{ name: 'delay',      fmt: 'blocks'  }],
  'setDaoContract(address)':               [{ name: 'dao',        fmt: 'address' }],
  'setTokenSaleContract(address)':         [{ name: 'contract',   fmt: 'address' }],
  'buybackWLF(uint256,uint256)':           [{ name: 'usdtAmount', fmt: 'usdt'    }, { name: 'minWlf',      fmt: 'wlf'     }],
  'setSwapRouter(address)':               [{ name: 'router',     fmt: 'address' }],
};

function fmtParamValue(value: unknown, fmt: ParamFmt): string {
  const v = value as bigint;
  switch (fmt) {
    case 'address': return String(value);
    case 'wlf':     return `${Number(formatUnits(v, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })} WLF`;
    case 'usdt':    return `${(Number(v) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT`;
    case 'price':   return `${Number(formatUnits(v, 18)).toLocaleString(undefined, { maximumFractionDigits: 8 })} USDT/WLF`;
    case 'seconds': {
      const s = Number(v);
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
      return h > 0 ? `${h}h ${m}m (${s}s)` : `${m}m ${s % 60}s (${s}s)`;
    }
    case 'blocks':  return `${v} block${v === 1n ? '' : 's'}`;
    default:        return String(value);
  }
}

/** Returns decoded params array, empty array for no-arg functions, or null on failure. */
function decodeCalldata(sig: string, data: `0x${string}`): Array<{ name: string; value: string }> | null {
  const paramDefs = SIG_PARAMS[sig];
  // Extract types string from signature, e.g. "address,uint256" from "foo(address,uint256)"
  const typesStr = sig.match(/\(([^)]*)\)/)?.[1] ?? '';

  // For known no-arg sigs, or data is empty, nothing to show
  if ((paramDefs && paramDefs.length === 0) || !data || data === '0x') return [];

  try {
    const abiParams = parseAbiParameters(typesStr || 'bytes');
    const decoded = decodeAbiParameters(abiParams, data);

    if (paramDefs) {
      return paramDefs.map((def, i) => ({
        name:  def.name,
        value: fmtParamValue(decoded[i], def.fmt),
      }));
    }
    // Unknown sig — show generic param_N labels with raw values
    return Array.from(decoded).map((v, i) => ({
      name:  `param_${i}`,
      value: String(v),
    }));
  } catch {
    return null; // decode failed → caller falls back to raw hex
  }
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
  wlfAddress?: `0x${string}`;
  stakingAddress?: `0x${string}`;
  lpStakingAddress?: `0x${string}`;
}

export function ProposalCard({ id, daoAddress, isGuardian, visibleStates, wlfAddress, stakingAddress, lpStakingAddress }: ProposalCardProps) {
  const { address } = useAccount();
  const { theme } = useTheme();
  const [showDetails, setShowDetails] = useState(false);
  const [lastAction, setLastAction] = useState('');

  // ── Reads ──────────────────────────────────────────────────────────────────

  const { data: raw, refetch: refetchRaw } = useReadContract({
    address: daoAddress,
    abi: daoABI,
    functionName: 'proposals',
    args: [BigInt(id)],
  });

  const { data: stateStr, refetch: refetchStateStr } = useReadContract({
    address: daoAddress,
    abi: daoABI,
    functionName: 'getProposalState',
    args: [BigInt(id)],
  });

  const { data: receipt, refetch: refetchReceipt } = useReadContract({
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

  const { data: votingPower } = useReadContract({
    address: daoAddress,
    abi: daoABI,
    functionName: 'getVotingPower',
    args: [address!],
    query: { enabled: !!address },
  });

  const { data: wlfBalance } = useReadContract({
    address: wlfAddress,
    abi: [{ type: 'function', name: 'balanceOf', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' }] as const,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address && !!wlfAddress },
  });

  const { data: sWlfShares } = useReadContract({
    address: stakingAddress,
    abi: [{ type: 'function', name: 'balanceOf', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' }] as const,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address && !!stakingAddress },
  });

  const { data: lpVotingPower } = useReadContract({
    address: lpStakingAddress,
    abi: [{ type: 'function', name: 'getWLFVotingPower', inputs: [{ name: 'user', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' }] as const,
    functionName: 'getWLFVotingPower',
    args: [address!],
    query: { enabled: !!address && !!lpStakingAddress },
  });

  // ── Writes ─────────────────────────────────────────────────────────────────

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isConfirmed) {
      void refetchRaw();
      void refetchStateStr();
      void refetchReceipt();
      setLastAction('');
    }
  }, [isConfirmed, refetchRaw, refetchStateStr, refetchReceipt]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleApprove = () => {
    setLastAction('approve');
    writeContract({ address: daoAddress, abi: daoABI, functionName: 'approveProposal', args: [BigInt(id)] });
  };

  const handleVote = (support: boolean) => {
    setLastAction(support ? 'vote-for' : 'vote-against');
    writeContract({ address: daoAddress, abi: daoABI, functionName: 'vote', args: [BigInt(id), support] });
  };

  const handleQueue = () => {
    setLastAction('queue');
    writeContract({ address: daoAddress, abi: daoABI, functionName: 'queueProposal', args: [BigInt(id)] });
  };

  const handleExecute = () => {
    setLastAction('execute');
    writeContract({ address: daoAddress, abi: daoABI, functionName: 'executeProposal', args: [BigInt(id)] });
  };

  const handleCancel = () => {
    setLastAction('cancel');
    writeContract({ address: daoAddress, abi: daoABI, functionName: 'cancelProposal', args: [BigInt(id)] });
  };

  const anyLoading = isPending || isConfirming;

  // ── Ticking clock (updates every 5 s so countdown stays fresh) ────────────

  const [nowTs, setNowTs] = useState(() => BigInt(Math.floor(Date.now() / 1000)));

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTs(BigInt(Math.floor(Date.now() / 1000)));
    }, 5_000);
    return () => clearInterval(timer);
  }, []);

  // ── Guard ──────────────────────────────────────────────────────────────────

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
          <Button
            size="sm"
            variant="info"
            onClick={handleApprove}
            loading={lastAction === 'approve' && anyLoading}
            disabled={anyLoading}
          >
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
            <div className={`text-xs w-full space-y-0.5`}>
              <p className={theme.textMuted}>
                Your voting power:{' '}
                <span className={votingPower === 0n ? 'text-red-400' : theme.textSecondary}>
                  {fmtWlf(votingPower ?? 0n)} WLF
                </span>
                {votingPower === 0n && <span className="text-red-400"> (no power)</span>}
              </p>
              {(wlfBalance !== undefined || sWlfShares !== undefined || lpVotingPower !== undefined) && (
                <div className={`pl-3 space-y-0.5 border-l-2 border-white/10`}>
                  {wlfBalance !== undefined && (
                    <p className={theme.textMuted}>WLF wallet: <span className="font-mono text-white/60">{fmtWlf(wlfBalance)}</span></p>
                  )}
                  {sWlfShares !== undefined && sWlfShares > 0n && (
                    <p className={theme.textMuted}>Staked (sWLF): <span className="font-mono text-white/60">{fmtWlf(sWlfShares)}</span></p>
                  )}
                  {lpVotingPower !== undefined && lpVotingPower > 0n && (
                    <p className={theme.textMuted}>LP: <span className="font-mono text-white/60">{fmtWlf(lpVotingPower)}</span></p>
                  )}
                </div>
              )}
            </div>
            <Button
              size="sm"
              variant="success"
              onClick={() => handleVote(true)}
              loading={lastAction === 'vote-for' && anyLoading}
              disabled={anyLoading}
            >
              Vote For
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => handleVote(false)}
              loading={lastAction === 'vote-against' && anyLoading}
              disabled={anyLoading}
            >
              Vote Against
            </Button>
          </>
        )}
        {label === 'Active' && !votingClosed && hasVoted && (
          <span className={`text-xs italic ${theme.textMuted}`}>
            You voted {votedFor ? '✅ For' : '❌ Against'}
          </span>
        )}
        {label === 'Active' && votingClosed && (
          totalVotes > 0n && forPct > 50 ? (
            <Button
              size="sm"
              variant="info"
              onClick={handleQueue}
              loading={lastAction === 'queue' && anyLoading}
              disabled={anyLoading}
            >
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
          <Button
            size="sm"
            variant="info"
            onClick={handleQueue}
            loading={lastAction === 'queue' && anyLoading}
            disabled={anyLoading}
          >
            Queue
          </Button>
        )}
        {label === 'Queued' && (
          <Button
            size="sm"
            variant="primary"
            onClick={handleExecute}
            loading={lastAction === 'execute' && anyLoading}
            disabled={anyLoading}
          >
            Execute
          </Button>
        )}

        {isGuardian && (label === 'Pending' || label === 'Active' || label === 'Succeeded' || label === 'Queued') && (
          <Button
            size="sm"
            variant="danger"
            onClick={handleCancel}
            loading={lastAction === 'cancel' && anyLoading}
            disabled={anyLoading}
          >
            Cancel (guardian)
          </Button>
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
                {(() => {
                  const sig  = signatures[i] ?? '';
                  const data = datas[i] as `0x${string}` | undefined;
                  if (!data || data === '0x') return null;
                  const decoded = decodeCalldata(sig, data);
                  if (decoded === null) {
                    // Decode failed — show raw hex as fallback
                    return (
                      <div>
                        <p className="text-white/40">Calldata (raw):</p>
                        <p className="font-mono text-white/30 break-all bg-white/5 rounded p-1.5 mt-0.5">{data}</p>
                      </div>
                    );
                  }
                  if (decoded.length === 0) return null;
                  return (
                    <div className="space-y-0.5 pt-0.5">
                      {decoded.map(({ name, value }) => (
                        <p key={name} className="text-white/50">
                          <span className="text-white/35">{name}: </span>
                          <span className="font-mono text-white/70">{value}</span>
                        </p>
                      ))}
                    </div>
                  );
                })()}
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
