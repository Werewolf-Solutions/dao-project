import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, encodeAbiParameters, parseAbiParameters, formatEther, formatUnits } from 'viem';
import { daoABI, werewolfTokenABI, erc20ABI, treasuryABI, tokenSaleABI, companiesHouseABI, getAddress } from '@/contracts';
import { useTheme } from '@/contexts/ThemeContext';
import { PageContainer } from '@/components/PageContainer';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { TxStatus } from '@/components/TxStatus';
import { ProposalCard } from '@/components/ProposalCard';
import { LPDelegation } from '@/components/LPDelegation';

const ALL_STATES = ['Pending', 'Active', 'Succeeded', 'Queued', 'Defeated', 'Canceled', 'Expired', 'Executed'];



export default function DAO() {
  const { address, chainId } = useAccount();
  const { theme } = useTheme();

  const daoAddress = getAddress(chainId, 'DAO');
  const wlfAddress = getAddress(chainId, 'WerewolfToken');
  const tokenSaleAddress = getAddress(chainId, 'TokenSale');
  const lpStakingAddress = getAddress(chainId, 'LPStaking');
  const treasuryAddress = getAddress(chainId, 'Treasury');
  const usdtAddress = getAddress(chainId, 'USDT');
  const companiesHouseAddress = getAddress(chainId, 'CompaniesHouse');

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

  const { data: daoTokenSaleContract, refetch: refetchDaoTokenSale } = useReadContract({
    address: daoAddress,
    abi: daoABI,
    functionName: 'tokenSaleContract',
    query: { enabled: !!daoAddress },
  });

  const { data: currentVotingPeriod } = useReadContract({
    address: daoAddress,
    abi: daoABI,
    functionName: 'votingPeriod',
    query: { enabled: !!daoAddress },
  });

  const { data: currentVotingDelay } = useReadContract({
    address: daoAddress,
    abi: daoABI,
    functionName: 'votingDelay',
    query: { enabled: !!daoAddress },
  });

  const { data: wlfAllowance, refetch: refetchWlfAllowance } = useReadContract({
    address: wlfAddress,
    abi: werewolfTokenABI,
    functionName: 'allowance',
    args: [address!, daoAddress!],
    query: { enabled: !!address && !!wlfAddress && !!daoAddress },
  });

  const { data: tokenSaleDaoContract } = useReadContract({
    address: tokenSaleAddress,
    abi: tokenSaleABI,
    functionName: 'daoContract',
    query: { enabled: !!tokenSaleAddress },
  });

  const { data: saleIdCounter } = useReadContract({
    address: tokenSaleAddress,
    abi: tokenSaleABI,
    functionName: 'saleIdCounter',
    query: { enabled: !!tokenSaleAddress, refetchInterval: 30_000 },
  });

  const { data: saleActive } = useReadContract({
    address: tokenSaleAddress,
    abi: tokenSaleABI,
    functionName: 'saleActive',
    query: { enabled: !!tokenSaleAddress, refetchInterval: 15_000 },
  });

  const { data: tokenSalePrice } = useReadContract({
    address: tokenSaleAddress,
    abi: tokenSaleABI,
    functionName: 'price',
    query: { enabled: !!tokenSaleAddress, refetchInterval: 30_000 },
  });

  const { data: treasurySwapRouter } = useReadContract({
    address: treasuryAddress,
    abi: treasuryABI,
    functionName: 'swapRouter',
    query: { enabled: !!treasuryAddress },
  });

  const { data: treasuryUsdtBalance } = useReadContract({
    address: usdtAddress,
    abi: erc20ABI,
    functionName: 'balanceOf',
    args: [treasuryAddress!],
    query: { enabled: !!usdtAddress && !!treasuryAddress },
  });

  const { data: treasuryWlfBalance } = useReadContract({
    address: wlfAddress,
    abi: erc20ABI,
    functionName: 'balanceOf',
    args: [treasuryAddress!],
    query: { enabled: !!wlfAddress && !!treasuryAddress },
  });


  const { data: currentCompanyIndex } = useReadContract({
    address: companiesHouseAddress,
    abi: companiesHouseABI,
    functionName: 'currentCompanyIndex',
    query: { enabled: !!companiesHouseAddress },
  });

  // IDs start at 1; currentCompanyIndex is the next ID to be assigned
  const companyCount = currentCompanyIndex !== undefined ? Number(currentCompanyIndex) : 0;
  const companyReadConfigs = companyCount > 1
    ? Array.from({ length: companyCount - 1 }, (_, i) => ({
        address: companiesHouseAddress as `0x${string}`,
        abi: companiesHouseABI,
        functionName: 'retrieveCompany' as const,
        args: [BigInt(i + 1)] as [bigint],
      }))
    : [];

  const { data: companyResults } = useReadContracts({
    contracts: companyReadConfigs,
    query: { enabled: !!companiesHouseAddress && companyCount > 1 },
  });

  // ── Writes ─────────────────────────────────────────────────────────────────

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });
  const [lastAction, setLastAction] = useState('');

  useEffect(() => {
    if (isConfirmed) {
      void refetchCount();
      if (lastAction === 'approve-wlf') void refetchWlfAllowance();
      if (lastAction === 'wire-tokensale-into-dao') void refetchDaoTokenSale();
    }
  }, [isConfirmed, lastAction, refetchCount, refetchWlfAllowance, refetchDaoTokenSale]);

  // Next sale number comes purely from chain: last completed sale + 1
  const nextSaleNumber = saleIdCounter !== undefined ? Number(saleIdCounter) + 1 : undefined;

  // ── Modal / form state ─────────────────────────────────────────────────────

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'quick' | 'raw'>('quick');

  // Raw proposal inputs
  const [targets, setTargets] = useState('');
  const [sigs, setSigs] = useState('');
  const [datas, setDatas] = useState('');

  // Quick: set voting period
  const [vpHours, setVpHours] = useState('24');

  // Quick: set voting delay
  const [vdBlocks, setVdBlocks] = useState('1');

  // Quick: token sale
  const [saleUsdtTarget, setSaleUsdtTarget] = useState('');
  const [salePriceInput, setSalePriceInput] = useState('');

  // Auto-populate sale price from chain when first loaded (user can override)
  useEffect(() => {
    if (tokenSalePrice !== undefined && !salePriceInput) {
      setSalePriceInput(formatUnits(tokenSalePrice, 18));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenSalePrice]);

  // Quick: WLF buyback
  const [buybackUsdt, setBuybackUsdt] = useState('');
  const [buybackMinWlf, setBuybackMinWlf] = useState('0');

  // Quick: multi-address airdrop
  const [airdropEntries, setAirdropEntries] = useState<{ address: string; amount: string }[]>([
    { address: '', amount: '' },
  ]);

  // Quick: company airdrop
  const [companyAirdropAmount, setCompanyAirdropAmount] = useState('');
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<number>>(new Set());

  const toggleCompany = (id: number) =>
    setSelectedCompanyIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

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

  // Sale form: price and WLF amount derived from USDT target ÷ sale price
  const salePriceWei = (() => { try { return salePriceInput ? parseUnits(salePriceInput, 18) : 0n; } catch { return 0n; } })();
  const saleUsdtWei  = (() => { try { return saleUsdtTarget ? parseUnits(saleUsdtTarget, 6)  : 0n; } catch { return 0n; } })();
  // wlf = usdt_6dec * 10^30 / price_18dec  (preserves 18-dec WLF precision)
  const saleWlfAmount = salePriceWei > 0n ? saleUsdtWei * (10n ** 30n) / salePriceWei : 0n;

  type CompanyInfo = {
    companyId: number;
    name: string;
    industry: string;
    companyWallet: `0x${string}`;
  };

  const activeCompanies: CompanyInfo[] = (companyResults ?? [])
    .map(r => {
      if (r.status !== 'success' || !r.result) return null;
      const c = r.result as { companyId: bigint; name: string; industry: string; companyWallet: `0x${string}`; active: boolean };
      if (!c.active) return null;
      return { companyId: Number(c.companyId), name: c.name, industry: c.industry, companyWallet: c.companyWallet };
    })
    .filter((c): c is CompanyInfo => c !== null);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleApproveWLF = () => {
    if (!wlfAddress || !daoAddress) return;
    setLastAction('approve-wlf');
    writeContract({
      address: wlfAddress,
      abi: erc20ABI,
      functionName: 'approve',
      args: [daoAddress, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')],
    });
  };

  const handleStartSaleProposal = () => {
    if (!daoAddress || !wlfAddress || !tokenSaleAddress) return;
    if (saleWlfAmount <= 0n || salePriceWei <= 0n) return;
    const targetArr: `0x${string}`[] = [wlfAddress, tokenSaleAddress];
    const sigArr = ['airdrop(address,uint256)', 'startSale(uint256,uint256)'];
    const dataArr: `0x${string}`[] = [
      encodeAbiParameters(parseAbiParameters('address, uint256'), [tokenSaleAddress, saleWlfAmount]),
      encodeAbiParameters(parseAbiParameters('uint256, uint256'), [saleWlfAmount, salePriceWei]),
    ];
    setLastAction('create-sale-proposal');
    writeContract({ address: daoAddress, abi: daoABI, functionName: 'createProposal', args: [targetArr, sigArr, dataArr] });
    setIsModalOpen(false);
  };

  const handleSetVotingPeriod = () => {
    if (!daoAddress) return;
    const seconds = BigInt(Math.max(3600, Math.round(parseFloat(vpHours) * 3600)));
    setLastAction('create-set-vp');
    writeContract({
      address: daoAddress,
      abi: daoABI,
      functionName: 'createProposal',
      args: [
        [daoAddress],
        ['setVotingPeriod(uint256)'],
        [encodeAbiParameters(parseAbiParameters('uint256'), [seconds])],
      ],
    });
    setIsModalOpen(false);
  };

  const handleSetVotingDelay = () => {
    if (!daoAddress) return;
    const blocks = BigInt(Math.max(1, parseInt(vdBlocks) || 1));
    setLastAction('create-set-vd');
    writeContract({
      address: daoAddress,
      abi: daoABI,
      functionName: 'createProposal',
      args: [
        [daoAddress],
        ['setVotingDelay(uint256)'],
        [encodeAbiParameters(parseAbiParameters('uint256'), [blocks])],
      ],
    });
    setIsModalOpen(false);
  };

  const handleAirdropProposal = () => {
    if (!daoAddress || !wlfAddress) return;
    const valid = airdropEntries.filter(e => e.address.trim() && e.amount.trim());
    if (valid.length === 0) return;
    const targetArr = valid.map(() => wlfAddress as `0x${string}`);
    const sigArr    = valid.map(() => 'airdrop(address,uint256)');
    const dataArr   = valid.map(e =>
      encodeAbiParameters(parseAbiParameters('address, uint256'), [
        e.address.trim() as `0x${string}`,
        parseUnits(e.amount.trim(), 18),
      ])
    );
    setLastAction('create-airdrop');
    writeContract({ address: daoAddress, abi: daoABI, functionName: 'createProposal', args: [targetArr, sigArr, dataArr] });
    setIsModalOpen(false);
  };

  const handleCompanyAirdropProposal = () => {
    if (!daoAddress || !wlfAddress || selectedCompanyIds.size === 0 || !companyAirdropAmount) return;
    const amountWei = parseUnits(companyAirdropAmount, 18);
    const selected = activeCompanies.filter(c => selectedCompanyIds.has(c.companyId));
    const targetArr = selected.map(() => wlfAddress as `0x${string}`);
    const sigArr    = selected.map(() => 'airdrop(address,uint256)');
    const dataArr   = selected.map(c =>
      encodeAbiParameters(parseAbiParameters('address, uint256'), [c.companyWallet, amountWei])
    );
    setLastAction('create-company-airdrop');
    writeContract({ address: daoAddress, abi: daoABI, functionName: 'createProposal', args: [targetArr, sigArr, dataArr] });
    setIsModalOpen(false);
  };

  const handleCreateProposal = () => {
    if (!daoAddress) return;
    const targetArr = targets.split(',').map((s) => s.trim()).filter(Boolean) as `0x${string}`[];
    const sigArr    = sigs.split(',').map((s) => s.trim()).filter(Boolean);
    const dataArr   = datas.split(',').map((s) => s.trim()).filter(Boolean) as `0x${string}`[];
    if (targetArr.length === 0) return;
    setLastAction('create-proposal');
    writeContract({ address: daoAddress, abi: daoABI, functionName: 'createProposal', args: [targetArr, sigArr, dataArr] });
    setIsModalOpen(false);
  };

  const handleWireTokenSaleIntoDAO = () => {
    if (!daoAddress || !tokenSaleAddress) return;
    setLastAction('wire-tokensale-into-dao');
    writeContract({
      address: daoAddress,
      abi: daoABI,
      functionName: 'setTokenSaleContract',
      args: [tokenSaleAddress],
    });
  };

  const handleSetDaoContractProposal = () => {
    if (!daoAddress || !tokenSaleAddress) return;
    setLastAction('create-set-dao-contract');
    writeContract({
      address: daoAddress,
      abi: daoABI,
      functionName: 'createProposal',
      args: [
        [tokenSaleAddress],
        ['setDaoContract(address)'],
        [encodeAbiParameters(parseAbiParameters('address'), [daoAddress])],
      ],
    });
    setIsModalOpen(false);
  };

  const handleBuybackProposal = () => {
    if (!daoAddress || !treasuryAddress) return;
    const usdtWei  = parseUnits(buybackUsdt || '0', 6);   // USDT is 6 decimals
    const minWlfWei = parseUnits(buybackMinWlf || '0', 18); // WLF is 18 decimals
    if (usdtWei <= 0n) return;
    setLastAction('create-buyback');
    writeContract({
      address: daoAddress,
      abi: daoABI,
      functionName: 'createProposal',
      args: [
        [treasuryAddress],
        ['buybackWLF(uint256,uint256)'],
        [encodeAbiParameters(parseAbiParameters('uint256, uint256'), [usdtWei, minWlfWei])],
      ],
    });
    setIsModalOpen(false);
  };

  // Airdrop entry helpers
  const addAirdropRow = () =>
    setAirdropEntries(prev => [...prev, { address: '', amount: '' }]);
  const removeAirdropRow = (i: number) =>
    setAirdropEntries(prev => prev.filter((_, idx) => idx !== i));
  const updateAirdropRow = (i: number, field: 'address' | 'amount', value: string) =>
    setAirdropEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e));

  // ── Airdrop form validation ─────────────────────────────────────────────────

  const isValidAddress = (addr: string) => /^0x[0-9a-fA-F]{40}$/.test(addr.trim());
  const isValidAmount  = (amt: string)  => parseFloat(amt) > 0;

  const airdropRowErrors = airdropEntries.map(e => ({
    address: e.address.trim() !== '' && !isValidAddress(e.address) ? 'Invalid address' : null,
    amount:  e.amount.trim()  !== '' && !isValidAmount(e.amount)   ? 'Must be > 0'    : null,
  }));

  const airdropHasErrors = airdropEntries.some(
    (e, i) => !e.address.trim() || !e.amount.trim() || !!airdropRowErrors[i].address || !!airdropRowErrors[i].amount
  );

  // ── Raw proposal validation ─────────────────────────────────────────────────

  const rawTargets = targets.split(',').map(s => s.trim()).filter(Boolean);
  const rawSigs    = sigs.split(',').map(s => s.trim()).filter(Boolean);
  const rawDatas   = datas.split(',').map(s => s.trim()).filter(Boolean);
  const rawLengthMismatch = rawTargets.length > 0 && (
    rawTargets.length !== rawSigs.length || rawTargets.length !== rawDatas.length
  );

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

      {/* ── Treasury & Governance overview ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">

        {/* Treasury Holdings */}
        <div className={`${theme.card} p-4 space-y-2`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Treasury Holdings</p>
          <div className="space-y-1.5">
            <div className="flex justify-between items-baseline">
              <span className={`text-sm ${theme.textMuted}`}>WLF</span>
              <span className="text-sm font-mono text-white">
                {treasuryWlfBalance !== undefined
                  ? Number(formatEther(treasuryWlfBalance)).toLocaleString(undefined, { maximumFractionDigits: 0 })
                  : '…'}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className={`text-sm ${theme.textMuted}`}>USDT</span>
              <span className="text-sm font-mono text-white">
                {treasuryUsdtBalance !== undefined
                  ? Number(formatUnits(treasuryUsdtBalance, 6)).toLocaleString(undefined, { maximumFractionDigits: 2 })
                  : '…'}
              </span>
            </div>
            <div className="flex justify-between items-baseline opacity-35">
              <span className="text-sm">ETH</span>
              <span className="text-xs italic">coming soon</span>
            </div>
            <div className="flex justify-between items-baseline opacity-35">
              <span className="text-sm">WBTC</span>
              <span className="text-xs italic">coming soon</span>
            </div>
          </div>
        </div>

        {/* Governance Details */}
        <div className={`${theme.card} p-4 space-y-2`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Governance</p>
          <div className="space-y-1.5">
            <div className="flex justify-between items-baseline">
              <span className={`text-sm ${theme.textMuted}`}>Proposals</span>
              <span className="text-sm font-mono text-white">
                {proposalCount !== undefined ? (Number(proposalCount) - 1).toString() : '…'}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className={`text-sm ${theme.textMuted}`}>Proposal cost</span>
              <span className="text-sm font-mono text-white">
                {proposalCost !== undefined
                  ? `${Number(formatEther(proposalCost)).toLocaleString(undefined, { maximumFractionDigits: 0 })} WLF`
                  : '…'}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className={`text-sm ${theme.textMuted}`}>Voting period</span>
              <span className="text-sm font-mono text-white">
                {currentVotingPeriod !== undefined
                  ? `${(Number(currentVotingPeriod) / 3600).toLocaleString(undefined, { maximumFractionDigits: 1 })}h`
                  : '…'}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className={`text-sm ${theme.textMuted}`}>Voting delay</span>
              <span className="text-sm font-mono text-white">
                {currentVotingDelay !== undefined
                  ? `${Number(currentVotingDelay)} block${Number(currentVotingDelay) === 1 ? '' : 's'}`
                  : '…'}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* ── Vote Delegation ── */}
      <LPDelegation daoAddress={daoAddress} lpStakingAddress={lpStakingAddress} />

      {/* ── Guardian: Wire TokenSale into DAO (direct call, no proposal needed) ── */}
      {isGuardian && tokenSaleAddress && (!daoTokenSaleContract || daoTokenSaleContract === '0x0000000000000000000000000000000000000000') && (
        <div className="mt-4 rounded-xl border border-amber-700/50 bg-amber-950/20 p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-400">Guardian action: Wire TokenSale into DAO</p>
          <p className={`text-xs ${theme.textMuted}`}>
            <code className="text-amber-300">dao.tokenSaleContract</code> is not set.
            Without this, <code className="text-amber-300">DAO.autoDelegate()</code> will revert when
            TokenSale tries to delegate buyers&apos; voting power — causing gas estimation to fail on{' '}
            <code className="text-amber-300">endSale()</code>.
          </p>
          <p className={`text-xs font-mono ${theme.textMuted}`}>
            Calls: dao.setTokenSaleContract({tokenSaleAddress?.slice(0, 10)}…)
          </p>
          <Button
            variant="info"
            size="sm"
            onClick={handleWireTokenSaleIntoDAO}
            disabled={isPending || isConfirming}
            loading={isPending || isConfirming}
          >
            Wire TokenSale into DAO
          </Button>
        </div>
      )}

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

      {/* ── Create Proposal modal ── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className={`${theme.card} w-full max-w-lg mx-4 flex flex-col max-h-[90vh]`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Fixed header */}
            <div className={`px-6 py-4 ${theme.divider} shrink-0`}>
              <h2 className="text-lg font-bold">Create Proposal</h2>
              <p className={`text-xs mt-0.5 ${theme.textMuted}`}>
                Cost: {proposalCost ? (Number(proposalCost) / 1e18).toFixed(0) : '10'} WLF (paid to Treasury)
              </p>
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

            {/* Scrollable body */}
            {modalTab === 'quick' ? (
              <div className="px-6 py-5 space-y-4 overflow-y-auto">

                {/* ── Set DAO Contract on TokenSale (one-time fix for existing deployments) ── */}
                {(!tokenSaleDaoContract || tokenSaleDaoContract === '0x0000000000000000000000000000000000000000') && (
                  <div className={`${theme.cardNested} p-4 space-y-2 border border-amber-700/40`}>
                    <p className="font-semibold text-sm text-amber-400">Fix: Wire DAO into TokenSale</p>
                    <p className={`text-xs ${theme.textMuted}`}>
                      TokenSale.daoContract is not set. Without this, sale #0/#1 buyers&apos; voting power is
                      never delegated to the founder when the sale ends. This proposal calls
                      tokenSale.setDaoContract(dao).
                    </p>
                    <div className={`text-xs font-mono ${theme.textMuted} pt-1`}>
                      tokenSale.setDaoContract({daoAddress?.slice(0, 10)}…)
                    </div>
                    <Button
                      variant="info"
                      size="sm"
                      onClick={handleSetDaoContractProposal}
                      disabled={!tokenSaleAddress || isPending || isConfirming}
                      loading={isPending || isConfirming}
                    >
                      Submit Fix Proposal
                    </Button>
                  </div>
                )}

                {/* ── Start Sale #N — hidden when a sale is active or a proposal for it already exists ── */}
                {!saleActive && nextSaleNumber !== undefined && (
                  <div className={`${theme.cardNested} p-4 space-y-3`}>
                    <div>
                      <p className="font-semibold text-sm">Start Sale #{nextSaleNumber}</p>
                      <p className={`text-xs mt-0.5 ${theme.textMuted}`}>
                        Enter the USDT target. WLF is calculated automatically from the current token price.
                        The sale price must be ≥ the current floor price.
                      </p>
                      {tokenSalePrice !== undefined && (
                        <p className={`text-xs mt-1 ${theme.textMuted}`}>
                          Current floor price:{' '}
                          <span className="text-white font-mono">{formatUnits(tokenSalePrice, 18)} USDT/WLF</span>
                        </p>
                      )}
                    </div>

                    <Input
                      label="USDT to raise"
                      type="number"
                      min="0"
                      value={saleUsdtTarget}
                      onChange={e => setSaleUsdtTarget(e.target.value)}
                      placeholder="100000"
                    />

                    <Input
                      label="Sale price (USDT / WLF)"
                      type="number"
                      min="0"
                      value={salePriceInput}
                      onChange={e => setSalePriceInput(e.target.value)}
                      placeholder="0.004"
                    />

                    {saleWlfAmount > 0n && (
                      <p className={`text-xs ${theme.textMuted}`}>
                        WLF to allocate:{' '}
                        <span className="text-white font-mono">
                          {Number(formatUnits(saleWlfAmount, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 })} WLF
                        </span>
                      </p>
                    )}

                    <div className={`text-xs font-mono ${theme.textMuted} space-y-0.5 pt-1`}>
                      <p>1. werewolfToken.airdrop(tokenSale, {saleWlfAmount > 0n ? Number(formatUnits(saleWlfAmount, 18)).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '?'} WLF)</p>
                      <p>2. tokenSale.startSale(…, {salePriceInput || '?'} USDT/WLF)</p>
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleStartSaleProposal}
                      disabled={!tokenSaleAddress || saleWlfAmount <= 0n || salePriceWei <= 0n || isPending || isConfirming}
                      loading={isPending || isConfirming}
                    >
                      Submit Start Sale #{nextSaleNumber}
                    </Button>
                  </div>
                )}

                {/* ── Set Voting Period ── */}
                <div className={`${theme.cardNested} p-4 space-y-3`}>
                  <div>
                    <p className="font-semibold text-sm">Update Voting Period</p>
                    <p className={`text-xs mt-0.5 ${theme.textMuted}`}>
                      Current: {currentVotingPeriod !== undefined ? `${Number(currentVotingPeriod) / 3600}h` : '…'}
                      {' · '}Min: 1h
                    </p>
                  </div>
                  <Input
                    label="New period (hours)"
                    type="number"
                    min="1"
                    value={vpHours}
                    onChange={e => setVpHours(e.target.value)}
                    placeholder="24"
                  />
                  <p className={`text-xs font-mono ${theme.textMuted}`}>
                    Calls: dao.setVotingPeriod({Math.max(3600, Math.round(parseFloat(vpHours || '0') * 3600))}s)
                  </p>
                  <Button
                    variant="info"
                    size="sm"
                    onClick={handleSetVotingPeriod}
                    disabled={!vpHours || parseFloat(vpHours) < 1 || isPending || isConfirming}
                    loading={isPending || isConfirming}
                  >
                    Submit
                  </Button>
                </div>

                {/* ── Set Voting Delay ── */}
                <div className={`${theme.cardNested} p-4 space-y-3`}>
                  <div>
                    <p className="font-semibold text-sm">Update Voting Delay</p>
                    <p className={`text-xs mt-0.5 ${theme.textMuted}`}>
                      Current: {currentVotingDelay !== undefined ? `${Number(currentVotingDelay)} block(s)` : '…'}
                    </p>
                  </div>
                  <Input
                    label="New delay (blocks)"
                    type="number"
                    min="1"
                    value={vdBlocks}
                    onChange={e => setVdBlocks(e.target.value)}
                    placeholder="1"
                  />
                  <p className={`text-xs font-mono ${theme.textMuted}`}>
                    Calls: dao.setVotingDelay({Math.max(1, parseInt(vdBlocks || '0') || 1)} blocks)
                  </p>
                  <Button
                    variant="info"
                    size="sm"
                    onClick={handleSetVotingDelay}
                    disabled={!vdBlocks || parseInt(vdBlocks) < 1 || isPending || isConfirming}
                    loading={isPending || isConfirming}
                  >
                    Submit
                  </Button>
                </div>

                {/* ── WLF Buyback ── */}
                <div className={`${theme.cardNested} p-4 space-y-3`}>
                  <div>
                    <p className="font-semibold text-sm">Buy Back WLF</p>
                    <p className={`text-xs mt-0.5 ${theme.textMuted}`}>
                      Propose spending treasury USDT to buy WLF from the Uniswap pool.
                      Purchased WLF stays in treasury and raises the market price.
                    </p>
                    {treasuryUsdtBalance !== undefined && (
                      <p className={`text-xs mt-1 ${theme.textMuted}`}>
                        Treasury USDT: <span className="text-white font-mono">{(Number(treasuryUsdtBalance) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      </p>
                    )}
                    {!treasurySwapRouter || treasurySwapRouter === '0x0000000000000000000000000000000000000000' ? (
                      <p className="text-xs mt-1 text-amber-400">Swap router not configured — deploy with swap router or call setSwapRouter first.</p>
                    ) : null}
                  </div>
                  <Input
                    label="USDT to spend"
                    type="number"
                    min="0"
                    value={buybackUsdt}
                    onChange={e => setBuybackUsdt(e.target.value)}
                    placeholder="90000"
                  />
                  <Input
                    label="Min WLF out (0 = no slippage guard)"
                    type="number"
                    min="0"
                    value={buybackMinWlf}
                    onChange={e => setBuybackMinWlf(e.target.value)}
                    placeholder="0"
                  />
                  <p className={`text-xs font-mono ${theme.textMuted}`}>
                    Calls: treasury.buybackWLF({buybackUsdt || '0'} USDT, min {buybackMinWlf || '0'} WLF)
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleBuybackProposal}
                    disabled={!buybackUsdt || parseFloat(buybackUsdt) <= 0 || !treasuryAddress || isPending || isConfirming}
                    loading={isPending || isConfirming}
                  >
                    Submit Buyback Proposal
                  </Button>
                </div>

                {/* ── Airdrop WLF ── */}
                <div className={`${theme.cardNested} p-4 space-y-3`}>
                  <div>
                    <p className="font-semibold text-sm">Airdrop WLF</p>
                    <p className={`text-xs mt-0.5 ${theme.textMuted}`}>
                      Each address receives the specified amount. One action per address.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {airdropEntries.map((entry, i) => (
                      <div key={i} className="space-y-0.5">
                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <Input
                              label={i === 0 ? 'Address' : undefined}
                              type="text"
                              value={entry.address}
                              onChange={e => updateAirdropRow(i, 'address', e.target.value)}
                              placeholder="0x..."
                              style={airdropRowErrors[i].address ? { borderColor: 'rgb(248 113 113)' } : undefined}
                            />
                          </div>
                          <div className="w-28">
                            <Input
                              label={i === 0 ? 'Amount (WLF)' : undefined}
                              type="number"
                              min="0"
                              value={entry.amount}
                              onChange={e => updateAirdropRow(i, 'amount', e.target.value)}
                              placeholder="1000"
                              style={airdropRowErrors[i].amount ? { borderColor: 'rgb(248 113 113)' } : undefined}
                            />
                          </div>
                          {airdropEntries.length > 1 && (
                            <button
                              onClick={() => removeAirdropRow(i)}
                              className={`mb-0.5 px-2 py-1.5 text-sm rounded ${theme.textMuted} hover:text-red-400 transition-colors`}
                              title="Remove"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        {(airdropRowErrors[i].address || airdropRowErrors[i].amount) && (
                          <p className="text-red-400 text-xs">
                            {airdropRowErrors[i].address ?? airdropRowErrors[i].amount}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={addAirdropRow}
                    className={`text-xs ${theme.textMuted} hover:text-white transition-colors flex items-center gap-1`}
                  >
                    <span className="text-base leading-none">+</span> Add address
                  </button>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleAirdropProposal}
                    disabled={airdropHasErrors || !wlfAddress || isPending || isConfirming}
                    loading={isPending || isConfirming}
                  >
                    Submit Airdrop Proposal
                  </Button>
                </div>

                {/* ── Airdrop WLF to Companies ── */}
                <div className={`${theme.cardNested} p-4 space-y-3`}>
                  <div>
                    <p className="font-semibold text-sm">Airdrop WLF to Companies</p>
                    <p className={`text-xs mt-0.5 ${theme.textMuted}`}>
                      Select registered companies and airdrop WLF to each company wallet.
                      One operation per company.
                    </p>
                  </div>

                  {/* Company checklist */}
                  {activeCompanies.length === 0 ? (
                    <p className={`text-xs ${theme.textMuted}`}>No active companies found.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {activeCompanies.map(company => (
                        <label key={company.companyId} className="flex items-center gap-2.5 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={selectedCompanyIds.has(company.companyId)}
                            onChange={() => toggleCompany(company.companyId)}
                            className="accent-primary w-3.5 h-3.5 rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-white group-hover:text-white/80 truncate">{company.name}</span>
                            <span className={`text-xs ${theme.textMuted} ml-1.5`}>{company.industry}</span>
                          </div>
                          <span className={`text-xs font-mono ${theme.textMuted} shrink-0`}>
                            {company.companyWallet.slice(0, 6)}…{company.companyWallet.slice(-4)}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Select all / none */}
                  {activeCompanies.length > 1 && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => setSelectedCompanyIds(new Set(activeCompanies.map(c => c.companyId)))}
                        className={`text-xs ${theme.textMuted} hover:text-white transition-colors`}
                      >
                        Select all
                      </button>
                      <button
                        onClick={() => setSelectedCompanyIds(new Set())}
                        className={`text-xs ${theme.textMuted} hover:text-white transition-colors`}
                      >
                        Clear
                      </button>
                    </div>
                  )}

                  <Input
                    label="Amount per company (WLF)"
                    type="number"
                    min="0"
                    value={companyAirdropAmount}
                    onChange={e => setCompanyAirdropAmount(e.target.value)}
                    placeholder="1000"
                  />

                  {selectedCompanyIds.size > 0 && companyAirdropAmount && (
                    <p className={`text-xs font-mono ${theme.textMuted}`}>
                      {selectedCompanyIds.size} operation{selectedCompanyIds.size > 1 ? 's' : ''} ·{' '}
                      Total: {(selectedCompanyIds.size * parseFloat(companyAirdropAmount || '0')).toLocaleString()} WLF
                    </p>
                  )}

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleCompanyAirdropProposal}
                    disabled={selectedCompanyIds.size === 0 || !companyAirdropAmount || parseFloat(companyAirdropAmount) <= 0 || !wlfAddress || isPending || isConfirming}
                    loading={isPending || isConfirming}
                  >
                    Submit Company Airdrop Proposal
                  </Button>
                </div>

                <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              </div>
            ) : (
              <div className="px-6 py-5 space-y-3 overflow-y-auto">
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
                {rawLengthMismatch && (
                  <p className="text-red-400 text-xs">
                    Targets ({rawTargets.length}), signatures ({rawSigs.length}), and calldata ({rawDatas.length}) arrays must all have the same length.
                  </p>
                )}
                <div className="flex gap-3 pt-1">
                  <Button variant="primary" onClick={handleCreateProposal} disabled={rawLengthMismatch || rawTargets.length === 0}>Submit</Button>
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
