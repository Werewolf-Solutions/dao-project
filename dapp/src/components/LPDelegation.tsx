import { useState, useEffect, useMemo } from 'react';
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from 'wagmi';
import { parseAbiItem, isAddress, formatUnits } from 'viem';
import { daoABI, lpStakingABI } from '@/contracts';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';

interface Props {
  daoAddress: `0x${string}` | undefined;
  lpStakingAddress: `0x${string}` | undefined;
}

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
// v2 key clears any stale data that was persisted under the old key
const LS_KEY = 'dao_validators_v2';

function shortAddr(addr: string): string {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmtWLF(raw: bigint | undefined): string {
  if (raw === undefined || raw === 0n) return '0';
  const n = Number(formatUnits(raw, 18));
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtDuration(secs: bigint): string {
  const n = Number(secs);
  if (n >= 86400) return `${Math.round(n / 86400)} days`;
  if (n >= 3600) return `${Math.round(n / 3600)} hours`;
  return `${Math.round(n / 60)} minutes`;
}

export function LPDelegation({ daoAddress, lpStakingAddress }: Props) {
  const { address } = useAccount();
  const { theme } = useTheme();
  const publicClient = usePublicClient();

  // ── Tracked validators (v2 key — starts fresh, old stale data ignored) ─────
  const [trackedValidators, setTrackedValidators] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]'); }
    catch { return []; }
  });
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(trackedValidators));
  }, [trackedValidators]);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [showSection, setShowSection] = useState(false);
  const [addInput, setAddInput] = useState('');
  const [addError, setAddError] = useState('');
  const [addChecking, setAddChecking] = useState(false);
  const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set());

  // All-time unique delegators discovered from DelegateChanged events in DAO
  const [allDelegators, setAllDelegators] = useState<string[]>([]);

  // ── Connected user's delegation status ────────────────────────────────────
  const { data: myDelegate, refetch: refetchMyDelegate } = useReadContract({
    address: daoAddress,
    abi: daoABI,
    functionName: 'voteDelegate',
    args: [address!],
    query: { enabled: !!daoAddress && !!address },
  });

  const { data: myLockExpiry } = useReadContract({
    address: daoAddress,
    abi: daoABI,
    functionName: 'voteDelegateLockExpiry',
    args: [address!],
    query: { enabled: !!daoAddress && !!address },
  });

  const { data: myIsValidator } = useReadContract({
    address: daoAddress,
    abi: daoABI,
    functionName: 'isValidator',
    args: [address!],
    query: { enabled: !!daoAddress && !!address },
  });

  const { data: validatorThreshold } = useReadContract({
    address: daoAddress,
    abi: daoABI,
    functionName: 'VALIDATOR_THRESHOLD',
    query: { enabled: !!daoAddress },
  });

  const { data: delegationCooldown } = useReadContract({
    address: daoAddress,
    abi: daoABI,
    functionName: 'delegationCooldown',
    query: { enabled: !!daoAddress },
  });

  const { data: myLPPower } = useReadContract({
    address: lpStakingAddress,
    abi: lpStakingABI,
    functionName: 'userWLFStaked',
    args: [address!],
    query: { enabled: !!lpStakingAddress && !!address },
  });

  const { data: myTotalPower } = useReadContract({
    address: daoAddress,
    abi: daoABI,
    functionName: 'getVotingPower',
    args: [address!],
    query: { enabled: !!daoAddress && !!address },
  });

  // ── Validator multicall: 3 reads per address ──────────────────────────────
  // delegatedVotingPower | getVotingPower | isValidator
  const validatorContracts = useMemo(() =>
    daoAddress
      ? trackedValidators.flatMap(v => [
          { address: daoAddress, abi: daoABI, functionName: 'delegatedVotingPower' as const, args: [v as `0x${string}`] },
          { address: daoAddress, abi: daoABI, functionName: 'getVotingPower' as const, args: [v as `0x${string}`] },
          { address: daoAddress, abi: daoABI, functionName: 'isValidator' as const, args: [v as `0x${string}`] },
        ])
      : [],
    [daoAddress, trackedValidators],
  );

  const { data: validatorData, refetch: refetchValidators } = useReadContracts({
    contracts: validatorContracts,
    query: { enabled: !!daoAddress && trackedValidators.length > 0, refetchInterval: 8_000 },
  });

  const validatorInfoMap = useMemo(() => {
    const map: Record<string, { delegated: bigint; total: bigint; isVal: boolean; loaded: boolean }> = {};
    trackedValidators.forEach((v, i) => {
      const entry = validatorData?.[i * 3];
      map[v] = {
        delegated: (validatorData?.[i * 3]?.result as bigint) ?? 0n,
        total:     (validatorData?.[i * 3 + 1]?.result as bigint) ?? 0n,
        isVal:     (validatorData?.[i * 3 + 2]?.result as boolean) ?? false,
        loaded:    entry !== undefined,
      };
    });
    return map;
  }, [trackedValidators, validatorData]);

  // ── Discover delegators from DelegateChanged events (DAO) ─────────────────
  // Using DAO events is correct — covers all delegation types (auto + manual).
  useEffect(() => {
    if (!publicClient || !daoAddress) return;
    publicClient.getLogs({
      address: daoAddress,
      event: parseAbiItem('event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate)'),
      fromBlock: 0n,
    }).then(logs => {
      const delegators = [...new Set(
        logs
          .map(l => (l.args.delegator as string | undefined)?.toLowerCase())
          .filter((d): d is string => !!d),
      )];
      setAllDelegators(delegators);
    }).catch(() => { /* RPC may not support full log scan — silently skip */ });
  }, [publicClient, daoAddress]);

  // ── Delegator details multicall: 2 reads per delegator ────────────────────
  // voteDelegate (current) | userDelegatedPower (cached WLF power contributed)
  const delegatorContracts = useMemo(() =>
    daoAddress
      ? allDelegators.flatMap(d => [
          { address: daoAddress, abi: daoABI, functionName: 'voteDelegate' as const,         args: [d as `0x${string}`] },
          { address: daoAddress, abi: daoABI, functionName: 'userDelegatedPower' as const, args: [d as `0x${string}`] },
        ])
      : [],
    [daoAddress, allDelegators],
  );

  const { data: delegatorData, refetch: refetchDelegators } = useReadContracts({
    contracts: delegatorContracts,
    query: { enabled: !!daoAddress && allDelegators.length > 0, refetchInterval: 8_000 },
  });

  // Build validator → current delegators map
  const delegatorsByValidator = useMemo(() => {
    const map: Record<string, { holder: string; power: bigint }[]> = {};
    allDelegators.forEach((delegator, i) => {
      const currentDelegate = delegatorData?.[i * 2]?.result as string | undefined;
      const power = (delegatorData?.[i * 2 + 1]?.result as bigint) ?? 0n;
      if (currentDelegate && currentDelegate.toLowerCase() !== ZERO_ADDR) {
        const key = currentDelegate.toLowerCase();
        if (!map[key]) map[key] = [];
        map[key].push({ holder: delegator, power });
      }
    });
    return map;
  }, [allDelegators, delegatorData]);

  // ── Write: delegate / undelegate ──────────────────────────────────────────
  const { writeContract: writeDelegation, data: delegateTxHash, isPending: isDelegatePending } = useWriteContract();
  const { isSuccess: isDelegateConfirmed } = useWaitForTransactionReceipt({ hash: delegateTxHash });

  useEffect(() => {
    if (!isDelegateConfirmed) return;
    void refetchMyDelegate();
    void refetchValidators();
    void refetchDelegators();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDelegateConfirmed]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  // Validate on-chain before adding to list — only real validators (≥ threshold own stake) are added
  const handleAddValidator = async () => {
    const addr = addInput.trim();
    if (!isAddress(addr)) { setAddError('Invalid Ethereum address'); return; }
    const lower = addr.toLowerCase();
    if (trackedValidators.includes(lower)) { setAddError('Already tracked'); return; }

    if (daoAddress && publicClient) {
      setAddChecking(true);
      try {
        const isVal = await publicClient.readContract({
          address: daoAddress,
          abi: daoABI,
          functionName: 'isValidator',
          args: [addr as `0x${string}`],
        });
        if (!isVal) {
          setAddError(`Not a validator — address needs ${thresholdFmt} WLF own stake`);
          setAddChecking(false);
          return;
        }
      } catch {
        // If the check fails (no RPC, wrong network), allow adding as a best-effort
      }
      setAddChecking(false);
    }

    setTrackedValidators(prev => [...prev, lower]);
    setAddInput('');
    setAddError('');
  };

  const toggleExpand = (addr: string) => {
    setExpandedSet(prev => {
      const next = new Set(prev);
      next.has(addr) ? next.delete(addr) : next.add(addr);
      return next;
    });
  };

  const execDelegate = (target: `0x${string}`) => {
    if (!daoAddress) return;
    writeDelegation({ address: daoAddress, abi: daoABI, functionName: 'delegate', args: [target] });
  };

  const execUndelegate = () => {
    if (!daoAddress) return;
    writeDelegation({ address: daoAddress, abi: daoABI, functionName: 'undelegate', args: [] });
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const nowSecs = BigInt(Math.floor(Date.now() / 1000));
  const lockExpiry = myLockExpiry as bigint | undefined;
  const isLocked = lockExpiry !== undefined && lockExpiry > nowSecs;
  const lockDate = lockExpiry && lockExpiry > 0n
    ? new Date(Number(lockExpiry) * 1000).toLocaleDateString()
    : undefined;
  const myDelegateLower = myDelegate && (myDelegate as string) !== ZERO_ADDR
    ? (myDelegate as string).toLowerCase()
    : undefined;
  const canBeValidator = !!(myIsValidator as boolean | undefined);
  const thresholdFmt = validatorThreshold ? fmtWLF(validatorThreshold as bigint) : '5.00M';
  const cooldownFmt = delegationCooldown ? fmtDuration(delegationCooldown as bigint) : '7 days';

  // Split tracked list: actual validators vs. below-threshold (shown as info only)
  const activeValidators  = trackedValidators.filter(v => validatorInfoMap[v]?.isVal === true);
  const loadingValidators = trackedValidators.filter(v => !validatorInfoMap[v]?.loaded);
  const belowThreshold    = trackedValidators.filter(v =>
    validatorInfoMap[v]?.loaded && !validatorInfoMap[v].isVal
  );

  if (!daoAddress) return null;

  return (
    <div className="mt-4 rounded-xl border border-white/10 overflow-hidden">
      {/* Section header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-white/5 transition-colors"
        onClick={() => setShowSection(v => !v)}
      >
        <span>Vote Delegation</span>
        <span className={theme.textMuted}>{showSection ? '▴' : '▾'}</span>
      </button>

      {showSection && (
        <div className="px-4 pb-5 space-y-4">

          {/* ── Your delegation status ── */}
          {address && (
            <div className={`rounded-lg p-3 ${theme.cardNested} space-y-2`}>
              <p className="text-sm font-semibold">Your Delegation</p>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className={theme.textMuted}>Total voting power</span>
                  <span className="text-white font-mono">{fmtWLF(myTotalPower as bigint | undefined)} WLF</span>
                </div>
                <div className="flex justify-between">
                  <span className={theme.textMuted}>LP staked (WLF)</span>
                  <span className="text-white font-mono">{fmtWLF(myLPPower as bigint | undefined)} WLF</span>
                </div>
                <div className="flex justify-between">
                  <span className={theme.textMuted}>Delegating to</span>
                  <span className="text-white font-mono">
                    {myDelegateLower
                      ? shortAddr(myDelegateLower)
                      : <span className={theme.textMuted}>—</span>}
                  </span>
                </div>
                {isLocked && (
                  <div className="flex justify-between">
                    <span className={theme.textMuted}>Locked until</span>
                    <span className="text-amber-400">{lockDate}</span>
                  </div>
                )}
                {!isLocked && myDelegateLower && (
                  <div className="flex justify-between">
                    <span className={theme.textMuted}>Cooldown</span>
                    <span className="text-green-400">Unlocked — can change</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className={theme.textMuted}>Validator eligible</span>
                  <span className={canBeValidator ? 'text-green-400' : theme.textMuted}>
                    {canBeValidator
                      ? `Yes (≥ ${thresholdFmt} WLF own stake)`
                      : `No (need ${thresholdFmt} WLF own stake)`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={theme.textMuted}>Cooldown period</span>
                  <span className={theme.textMuted}>{cooldownFmt} after each change</span>
                </div>
              </div>


              {isLocked && (
                <p className="text-xs pt-1 text-amber-400/80">
                  Delegation locked until {lockDate}. Changes possible once the cooldown expires.
                </p>
              )}

              {!myDelegateLower && !canBeValidator && (
                <p className={`text-xs pt-1 ${theme.textMuted}`}>
                  Delegate to a validator below, or accumulate {thresholdFmt} WLF own stake to become one yourself.
                </p>
              )}
            </div>
          )}

          {/* ── Validator list ── */}
          <div className="space-y-2">
            <p className={`text-xs font-semibold uppercase tracking-wider ${theme.textMuted}`}>
              Validators ({activeValidators.length + loadingValidators.length})
            </p>

            {activeValidators.length === 0 && loadingValidators.length === 0 ? (
              <p className={`text-xs py-2 text-center ${theme.textMuted}`}>
                No validators yet. Only addresses with ≥ {thresholdFmt} WLF own stake qualify.
              </p>
            ) : (
              [...activeValidators, ...loadingValidators].map(v => {
                const info = validatorInfoMap[v];
                const delegators = delegatorsByValidator[v] ?? [];
                const expanded = expandedSet.has(v);
                const isMe = v === address?.toLowerCase();
                const isCurrentDelegate = v === myDelegateLower;
                const canAct = !!address && !isDelegatePending;
                const canChange = canAct && !isLocked;
                const isLoading = !info?.loaded;

                return (
                  <div key={v} className={`rounded-lg ${theme.cardNested} overflow-hidden`}>
                    {/* Header row */}
                    <div className="flex items-center gap-2 px-3 py-2.5 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-xs text-white truncate" title={v}>
                          {shortAddr(v)}
                          {isMe && <span className="ml-1.5 text-sky-400">(you)</span>}
                        </p>
                        {isLoading ? (
                          <p className={`text-xs ${theme.textMuted} mt-0.5`}>Loading…</p>
                        ) : (
                          <div className={`text-xs ${theme.textMuted} mt-0.5 space-y-0.5`}>
                            <p>
                              <span className="text-sky-300 font-mono">{fmtWLF(info.delegated)}</span>
                              {' '}WLF delegated by others
                            </p>
                            <p>
                              Total DAO power:{' '}
                              <span className="text-white font-mono">{fmtWLF(info.total)}</span> WLF
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Per-validator delegation actions */}
                      {address && (
                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          {isCurrentDelegate ? (
                            <>
                              <span className="text-xs text-green-400 font-semibold">✓ Delegating</span>
                              {canChange && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={execUndelegate}
                                  loading={isDelegatePending}
                                >
                                  Undelegate
                                </Button>
                              )}
                              {isLocked && (
                                <span className="text-xs text-amber-400" title={`Locked until ${lockDate}`}>
                                  🔒 {lockDate}
                                </span>
                              )}
                            </>
                          ) : !isMe && (
                            <Button
                              variant="info"
                              size="sm"
                              disabled={!canChange}
                              title={isLocked ? `Locked until ${lockDate}` : `Delegate to ${shortAddr(v)}`}
                              onClick={() => execDelegate(v as `0x${string}`)}
                              loading={isDelegatePending}
                            >
                              {isLocked ? '🔒 Delegate to' : 'Delegate to'}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Delegators toggle */}
                    <button
                      className={`w-full flex items-center gap-1.5 px-3 py-1.5 border-t border-white/5 text-xs hover:bg-white/5 transition-colors ${theme.textMuted}`}
                      onClick={() => toggleExpand(v)}
                    >
                      <span>{expanded ? '▾' : '▸'}</span>
                      <span>{delegators.length} delegator{delegators.length !== 1 ? 's' : ''}</span>
                    </button>

                    {/* Delegators list */}
                    {expanded && (
                      <div className="border-t border-white/5">
                        {delegators.length === 0 ? (
                          <p className={`px-3 py-2 text-xs ${theme.textMuted}`}>
                            No delegators found yet.
                          </p>
                        ) : (
                          delegators
                            .sort((a, b) => (b.power > a.power ? 1 : -1))
                            .map(({ holder, power }) => (
                              <div
                                key={holder}
                                className="flex items-center justify-between px-5 py-1.5 border-b border-white/5 last:border-b-0"
                              >
                                <span className="font-mono text-xs text-white/70">{shortAddr(holder)}</span>
                                <span className="font-mono text-xs text-white/50">{fmtWLF(power)} WLF</span>
                              </div>
                            ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Below-threshold notice (tracked but no longer qualify) */}
            {belowThreshold.length > 0 && (
              <p className={`text-xs ${theme.textMuted} pt-1`}>
                {belowThreshold.length} tracked address{belowThreshold.length !== 1 ? 'es' : ''} currently below threshold (hidden from list)
              </p>
            )}
          </div>

          {/* ── Add validator form ── */}
          <div className="space-y-1.5">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Input
                  label={`Add validator address (must have ≥ ${thresholdFmt} WLF own stake)`}
                  type="text"
                  value={addInput}
                  onChange={e => { setAddInput(e.target.value); setAddError(''); }}
                  placeholder="0x..."
                />
              </div>
              <div className="mb-0.5">
                <Button variant="info" size="sm" onClick={handleAddValidator} loading={addChecking}>
                  Add
                </Button>
              </div>
            </div>
            {addError && <p className="text-red-400 text-xs">{addError}</p>}
          </div>

        </div>
      )}
    </div>
  );
}
