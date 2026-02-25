import { useAccount, useReadContract } from 'wagmi';
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

interface ProposalCardProps {
  id: number;
  daoAddress: `0x${string}`;
  onAction: (type: 'vote' | 'queue' | 'execute', id: number, support?: boolean) => void;
}

export function ProposalCard({ id, daoAddress, onAction }: ProposalCardProps) {
  const { address } = useAccount();
  const { theme } = useTheme();

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

  if (!raw) return null;

  // Tuple: (state uint8, id, proposer, votesFor, votesAgainst, startTime, endTime, eta, canceled, executed)
  const [stateIdx, , proposer, votesFor, votesAgainst, , endTime, eta] = raw;
  const label = stateStr ?? STATE_LABELS[Number(stateIdx)] ?? 'Unknown';
  const badgeClass = (theme.badge as Record<string, string>)[label] ?? 'text-white/50 bg-white/5 border border-white/10';
  const totalVotes = BigInt(votesFor) + BigInt(votesAgainst);
  const forPct = totalVotes > 0n ? Number((BigInt(votesFor) * 100n) / totalVotes) : 0;
  const hasVoted = receipt?.[0] ?? false;

  return (
    <div className={`${theme.cardNested} p-4 space-y-4`}>
      {/* Header */}
      <div className="flex justify-between items-start">
        <h3 className="font-bold text-base">Proposal #{id}</h3>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeClass}`}>{label}</span>
      </div>

      {/* Proposer */}
      <div className={`text-xs ${theme.textMuted} break-all`}>
        <span className={`font-medium ${theme.textSecondary}`}>Proposer: </span>{proposer}
      </div>

      {/* Vote bar */}
      <div>
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-green-400 font-medium">For {forPct}%</span>
          <span className="text-red-400 font-medium">Against {100 - forPct}%</span>
        </div>
        <div className="h-2 rounded-full bg-surface-border overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500"
            style={{ width: `${forPct}%` }}
          />
        </div>
        <div className={`flex justify-between text-xs mt-1 ${theme.textMuted}`}>
          <span>{votesFor.toString()} WLF</span>
          <span>{votesAgainst.toString()} WLF</span>
        </div>
      </div>

      {/* Timing */}
      {(endTime > 0n || eta > 0n) && (
        <div className={`text-xs ${theme.textMuted} space-y-0.5`}>
          {endTime > 0n && <p>Voting ends: {new Date(Number(endTime) * 1000).toLocaleString()}</p>}
          {eta > 0n && <p>Executable after: {new Date(Number(eta) * 1000).toLocaleString()}</p>}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {label === 'Active' && !hasVoted && (
          <>
            <Button size="sm" variant="success" onClick={() => onAction('vote', id, true)}>Vote For</Button>
            <Button size="sm" variant="danger" onClick={() => onAction('vote', id, false)}>Vote Against</Button>
          </>
        )}
        {label === 'Active' && hasVoted && (
          <span className={`text-xs italic ${theme.textMuted}`}>You already voted</span>
        )}
        {label === 'Succeeded' && (
          <Button size="sm" variant="info" onClick={() => onAction('queue', id)}>Queue</Button>
        )}
        {label === 'Queued' && (
          <Button size="sm" variant="primary" onClick={() => onAction('execute', id)}>Execute</Button>
        )}
      </div>
    </div>
  );
}
