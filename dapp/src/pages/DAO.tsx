import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { daoABI, werewolfTokenABI, erc20ABI, getAddress } from '@/contracts';
import { useTheme } from '@/contexts/ThemeContext';
import { PageContainer } from '@/components/PageContainer';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { TxStatus } from '@/components/TxStatus';
import { ProposalCard } from '@/components/ProposalCard';

export default function DAO() {
  const { address, chainId } = useAccount();
  const { theme } = useTheme();

  const daoAddress = getAddress(chainId, 'DAO');
  const wlfAddress = getAddress(chainId, 'WerewolfToken');

  // ── Reads ──────────────────────────────────────────────────────────────────

  const { data: proposalCount, refetch: refetchCount } = useReadContract({
    address: daoAddress,
    abi: daoABI,
    functionName: 'proposalCount',
    query: { enabled: !!daoAddress },
  });

  const { data: proposalCost } = useReadContract({
    address: daoAddress,
    abi: daoABI,
    functionName: 'proposalCost',
    query: { enabled: !!daoAddress },
  });

  const { data: wlfAllowance, refetch: refetchWlfAllowance } = useReadContract({
    address: wlfAddress,
    abi: werewolfTokenABI,
    functionName: 'allowance',
    args: [address!, daoAddress!],
    query: { enabled: !!address && !!wlfAddress && !!daoAddress },
  });

  // ── Writes ─────────────────────────────────────────────────────────────────

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });
  const [lastAction, setLastAction] = useState('');

  useEffect(() => {
    if (isConfirmed) {
      void refetchCount();
      if (lastAction === 'approve-wlf') void refetchWlfAllowance();
    }
  }, [isConfirmed, lastAction, refetchCount, refetchWlfAllowance]);

  // ── Create proposal form ───────────────────────────────────────────────────

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targets, setTargets] = useState('');
  const [sigs, setSigs] = useState('');
  const [datas, setDatas] = useState('');

  const handleApproveWLF = () => {
    if (!wlfAddress || !daoAddress) return;
    setLastAction('approve-wlf');
    writeContract({
      address: wlfAddress,
      abi: erc20ABI,
      functionName: 'approve',
      args: [daoAddress, proposalCost ?? parseUnits('10', 18)],
    });
  };

  const handleCreateProposal = () => {
    if (!daoAddress) return;
    const targetArr = targets.split(',').map((s) => s.trim()).filter(Boolean) as `0x${string}`[];
    const sigArr = sigs.split(',').map((s) => s.trim()).filter(Boolean);
    const dataArr = datas.split(',').map((s) => s.trim()).filter(Boolean) as `0x${string}`[];
    if (targetArr.length === 0) return;
    setLastAction('create-proposal');
    writeContract({
      address: daoAddress,
      abi: daoABI,
      functionName: 'createProposal',
      args: [targetArr, sigArr, dataArr],
    });
    setIsModalOpen(false);
  };

  const handleAction = (type: 'vote' | 'queue' | 'execute', id: number, support?: boolean) => {
    if (!daoAddress) return;
    if (type === 'vote') {
      setLastAction('vote');
      writeContract({ address: daoAddress, abi: daoABI, functionName: 'vote', args: [BigInt(id), support!] });
    } else if (type === 'queue') {
      setLastAction('queue');
      writeContract({ address: daoAddress, abi: daoABI, functionName: 'queueProposal', args: [BigInt(id)] });
    } else if (type === 'execute') {
      setLastAction('execute');
      writeContract({ address: daoAddress, abi: daoABI, functionName: 'executeProposal', args: [BigInt(id)] });
    }
  };

  // ── Guards ─────────────────────────────────────────────────────────────────

  if (!address) {
    return (
      <PageContainer centered maxWidth="sm">
        <p className={theme.textMuted}>Connect your wallet to view DAO proposals.</p>
      </PageContainer>
    );
  }

  if (!daoAddress) {
    return (
      <PageContainer centered maxWidth="sm">
        <p className={theme.textMuted}>DAO not deployed on chain {chainId}.</p>
      </PageContainer>
    );
  }

  const count = proposalCount ? Number(proposalCount) : 0;
  const needsWlfApproval = proposalCost !== undefined && (wlfAllowance === undefined || wlfAllowance < proposalCost);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <PageContainer maxWidth="lg">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">DAO Proposals</h1>
        {needsWlfApproval ? (
          <Button
            variant="info"
            size="sm"
            onClick={handleApproveWLF}
            loading={isPending || isConfirming}
            disabled={isPending || isConfirming}
          >
            Approve WLF (proposal fee)
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            disabled={isPending || isConfirming}
          >
            + Create Proposal
          </Button>
        )}
      </div>

      <TxStatus isPending={isPending} isConfirming={isConfirming} isConfirmed={isConfirmed} txHash={txHash} label={lastAction} />

      {count === 0 ? (
        <p className={`text-center mt-12 ${theme.textMuted}`}>No proposals yet.</p>
      ) : (
        <div className="space-y-4 mt-4">
          {Array.from({ length: count }, (_, i) => count - i).map((id) => (
            <ProposalCard key={id} id={id} daoAddress={daoAddress} onAction={handleAction} />
          ))}
        </div>
      )}

      {/* Create Proposal modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className={`${theme.card} w-full max-w-lg mx-4`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`px-6 py-4 ${theme.divider}`}>
              <h2 className="text-lg font-bold">Create Proposal</h2>
              <p className={`text-xs mt-0.5 ${theme.textMuted}`}>
                Cost: {proposalCost ? (Number(proposalCost) / 1e18).toFixed(0) : '10'} WLF (paid to Treasury)
              </p>
            </div>
            <div className="px-6 py-5 space-y-3">
              <Input
                label="Target addresses (comma-separated)"
                type="text"
                value={targets}
                onChange={(e) => setTargets(e.target.value)}
                placeholder="0xAbc..., 0xDef..."
              />
              <Input
                label="Function signatures (comma-separated)"
                type="text"
                value={sigs}
                onChange={(e) => setSigs(e.target.value)}
                placeholder="transfer(address,uint256)"
              />
              <Input
                label="Calldata (hex, comma-separated)"
                type="text"
                value={datas}
                onChange={(e) => setDatas(e.target.value)}
                placeholder="0x..."
              />
              <div className="flex gap-3 pt-1">
                <Button variant="primary" onClick={handleCreateProposal}>Submit</Button>
                <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
