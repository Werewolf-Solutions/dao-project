import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, encodeAbiParameters, parseAbiParameters } from 'viem';
import { daoABI, werewolfTokenABI, erc20ABI, getAddress } from '@/contracts';
import { useTheme } from '@/contexts/ThemeContext';
import { PageContainer } from '@/components/PageContainer';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { TxStatus } from '@/components/TxStatus';
import { ProposalCard } from '@/components/ProposalCard';

const ALL_STATES = ['Pending', 'Active', 'Succeeded', 'Queued', 'Defeated', 'Canceled', 'Expired', 'Executed'];

export default function DAO() {
  const { address, chainId } = useAccount();
  const { theme } = useTheme();

  const daoAddress = getAddress(chainId, 'DAO');
  const wlfAddress = getAddress(chainId, 'WerewolfToken');
  const tokenSaleAddress = getAddress(chainId, 'TokenSale');

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

  const { data: guardian } = useReadContract({
    address: daoAddress,
    abi: daoABI,
    functionName: 'guardian',
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
  const [modalTab, setModalTab] = useState<'quick' | 'raw'>('quick');
  const [targets, setTargets] = useState('');
  const [sigs, setSigs] = useState('');
  const [datas, setDatas] = useState('');

  // ── Status filter ──────────────────────────────────────────────────────────

  const [visibleStates, setVisibleStates] = useState<Set<string>>(new Set());

  const toggleState = (s: string) =>
    setVisibleStates(prev => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });

  // ── Derived ────────────────────────────────────────────────────────────────

  const isGuardian = !!(guardian && address && guardian.toLowerCase() === address.toLowerCase());

  // ── Handlers ───────────────────────────────────────────────────────────────

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

  const handleStartSale1 = () => {
    if (!daoAddress || !wlfAddress || !tokenSaleAddress) return;
    const SALE_AMOUNT = parseUnits('100000000', 18);
    const SALE_PRICE = parseUnits('0.01', 18);

    const targetArr: `0x${string}`[] = [wlfAddress, tokenSaleAddress];
    const sigArr = ['airdrop(address,uint256)', 'startSale(uint256,uint256)'];
    const dataArr: `0x${string}`[] = [
      encodeAbiParameters(parseAbiParameters('address, uint256'), [tokenSaleAddress, SALE_AMOUNT]),
      encodeAbiParameters(parseAbiParameters('uint256, uint256'), [SALE_AMOUNT, SALE_PRICE]),
    ];

    setLastAction('create-sale1-proposal');
    writeContract({
      address: daoAddress,
      abi: daoABI,
      functionName: 'createProposal',
      args: [targetArr, sigArr, dataArr],
    });
    setIsModalOpen(false);
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
  // proposalCount starts at 1; valid IDs are 1 to proposalCount-1
  const proposalIds = count > 1 ? Array.from({ length: count - 1 }, (_, i) => count - 1 - i) : [];
  const needsWlfApproval = proposalCost !== undefined && (wlfAllowance === undefined || wlfAllowance < proposalCost);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <PageContainer maxWidth="lg">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold">DAO Proposals</h1>
          {isGuardian && (
            <span className="text-xs text-amber-400 font-medium mt-0.5 block">You are the guardian</span>
          )}
        </div>
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

      {/* ── Status filter chips ── */}
      {proposalIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 mb-1">
          {ALL_STATES.map(s => (
            <button
              key={s}
              onClick={() => toggleState(s)}
              className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${
                visibleStates.has(s)
                  ? 'border-white/30 text-white bg-white/10'
                  : `border-white/10 ${theme.textMuted} hover:text-white/60`
              }`}
            >
              {s}
            </button>
          ))}
          {visibleStates.size > 0 && (
            <button
              onClick={() => setVisibleStates(new Set())}
              className="text-xs text-white/30 hover:text-white/55 px-1 transition-colors"
            >
              clear
            </button>
          )}
        </div>
      )}

      {proposalIds.length === 0 ? (
        <p className={`text-center mt-12 ${theme.textMuted}`}>No proposals yet.</p>
      ) : (
        <div className="space-y-4 mt-4">
          {proposalIds.map((id) => (
            <ProposalCard
              key={id}
              id={id}
              daoAddress={daoAddress}
              isGuardian={isGuardian}
              visibleStates={visibleStates}
            />
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
              {/* Tabs */}
              <div className="flex gap-1 mt-3">
                <button
                  className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${modalTab === 'quick' ? 'bg-primary text-white' : `${theme.textMuted} hover:text-white`}`}
                  onClick={() => setModalTab('quick')}
                >
                  Quick
                </button>
                <button
                  className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${modalTab === 'raw' ? 'bg-primary text-white' : `${theme.textMuted} hover:text-white`}`}
                  onClick={() => setModalTab('raw')}
                >
                  Raw
                </button>
              </div>
            </div>

            {modalTab === 'quick' ? (
              <div className="px-6 py-5 space-y-4">
                {/* Start Sale #1 quick proposal */}
                <div className={`${theme.cardNested} p-4 space-y-2`}>
                  <p className="font-semibold text-sm">Start Sale #1</p>
                  <p className={`text-xs ${theme.textMuted}`}>
                    Airdrop 100,000,000 WLF to TokenSale and open the public sale at 0.01 USDT/WLF.
                  </p>
                  <div className={`text-xs font-mono ${theme.textMuted} space-y-0.5 pt-1`}>
                    <p>1. werewolfToken.airdrop(tokenSale, 100,000,000 WLF)</p>
                    <p>2. tokenSale.startSale(100,000,000 WLF, 0.01 USDT)</p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleStartSale1}
                    disabled={!tokenSaleAddress || isPending || isConfirming}
                    loading={isPending || isConfirming}
                  >
                    Submit Start Sale #1
                  </Button>
                </div>
                <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              </div>
            ) : (
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
            )}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
