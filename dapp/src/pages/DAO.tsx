import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useSendTransaction } from 'wagmi';
import { parseUnits, parseEther, encodeAbiParameters, parseAbiParameters, formatEther, formatUnits } from 'viem';
import { daoABI, werewolfTokenABI, erc20ABI, treasuryABI, tokenSaleABI, companiesHouseABI, stakingABI, companyDeFiABI, companyVaultABI, getAddress } from '@/contracts';
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
  const stakingAddress = getAddress(chainId, 'Staking');
  const treasuryAddress = getAddress(chainId, 'Treasury');
  const usdtAddress = getAddress(chainId, 'USDT');
  const companiesHouseAddress = getAddress(chainId, 'CompaniesHouse');
  const usdcAddress = getAddress(chainId, 'USDC');
  const companyDeFiAddress = getAddress(chainId, 'CompanyDefi');
  // DeFi integration only on chains with a real Aave pool (Base Sepolia, Mainnet)
  const aaveUsdtAddress = getAddress(chainId, 'AaveToken');
  // WBTC: mainnet only
  const wbtcAddress: `0x${string}` | undefined = chainId === 1 ? '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' : undefined;

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

  const { data: treasuryUsdcBalance } = useReadContract({
    address: usdcAddress,
    abi: erc20ABI,
    functionName: 'balanceOf',
    args: [treasuryAddress!],
    query: { enabled: !!usdcAddress && !!treasuryAddress },
  });

  const { data: currentCompanyIndex } = useReadContract({
    address: companiesHouseAddress,
    abi: companiesHouseABI,
    functionName: 'currentCompanyIndex',
    query: { enabled: !!companiesHouseAddress },
  });

  const { data: daoCompanyIdOnChain } = useReadContract({
    address: companiesHouseAddress,
    abi: companiesHouseABI,
    functionName: 'daoCompanyId',
    query: { enabled: !!companiesHouseAddress },
  });

  const hasDaoCompany = daoCompanyIdOnChain !== undefined && daoCompanyIdOnChain > 0n;

  const { data: daoCompanyRaw } = useReadContract({
    address: companiesHouseAddress,
    abi: companiesHouseABI,
    functionName: 'retrieveCompany',
    args: [daoCompanyIdOnChain ?? 0n],
    query: { enabled: !!companiesHouseAddress && hasDaoCompany },
  });

  const { data: daoVaultAddress } = useReadContract({
    address: companiesHouseAddress,
    abi: companiesHouseABI,
    functionName: 'companyVault',
    args: [daoCompanyIdOnChain ?? 0n],
    query: { enabled: !!companiesHouseAddress && hasDaoCompany },
  });

  const { data: daoVaultAaveData, refetch: refetchDaoVaultAave } = useReadContract({
    address: daoVaultAddress,
    abi: companyVaultABI,
    functionName: 'getAaveUserData',
    query: { enabled: !!daoVaultAddress, refetchInterval: 30_000 },
  });

  const { data: daoVaultMinHf, refetch: refetchDaoVaultMinHf } = useReadContract({
    address: daoVaultAddress,
    abi: companyVaultABI,
    functionName: 'minHealthFactor',
    query: { enabled: !!daoVaultAddress, refetchInterval: 60_000 },
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

  // ── CompanyDeFi reads ───────────────────────────────────────────────────────

  const { data: defiAdmin } = useReadContract({
    address: companyDeFiAddress,
    abi: companyDeFiABI,
    functionName: 'admin',
    query: { enabled: !!companyDeFiAddress, refetchInterval: 30_000 },
  });
  const { data: defiPaused, refetch: refetchDefiPaused } = useReadContract({
    address: companyDeFiAddress,
    abi: companyDeFiABI,
    functionName: 'paused',
    query: { enabled: !!companyDeFiAddress, refetchInterval: 15_000 },
  });
  const { data: defiBorrowingEnabled, refetch: refetchDefiBorrowing } = useReadContract({
    address: companyDeFiAddress,
    abi: companyDeFiABI,
    functionName: 'borrowingEnabled',
    query: { enabled: !!companyDeFiAddress, refetchInterval: 30_000 },
  });
  const { data: defiUsdtAllowed, refetch: refetchDefiUsdtAllowed } = useReadContract({
    address: companyDeFiAddress,
    abi: companyDeFiABI,
    functionName: 'allowedTokens',
    args: [aaveUsdtAddress ?? '0x0000000000000000000000000000000000000000'],
    query: { enabled: !!companyDeFiAddress && !!aaveUsdtAddress, refetchInterval: 30_000 },
  });

  // ── Writes ─────────────────────────────────────────────────────────────────

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });
  const { sendTransaction, isPending: isSendEthPending } = useSendTransaction();
  const [lastAction, setLastAction] = useState('');

  useEffect(() => {
    if (isConfirmed) {
      void refetchCount();
      if (lastAction === 'approve-wlf') void refetchWlfAllowance();
      if (lastAction === 'wire-tokensale-into-dao') void refetchDaoTokenSale();
      if (lastAction === 'defi-pause' || lastAction === 'defi-unpause') void refetchDefiPaused();
      if (lastAction === 'defi-borrow-enable' || lastAction === 'defi-borrow-disable') void refetchDefiBorrowing();
      if (lastAction === 'defi-allow-token' || lastAction === 'defi-disallow-token') void refetchDefiUsdtAllowed();
      if (lastAction === 'dao-vault-proposal') { void refetchDaoVaultAave(); void refetchDaoVaultMinHf(); }
    }
  }, [isConfirmed, lastAction, refetchCount, refetchWlfAllowance, refetchDaoTokenSale, refetchDefiPaused, refetchDefiBorrowing, refetchDefiUsdtAllowed, refetchDaoVaultAave, refetchDaoVaultMinHf]);

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

  // Quick: hire employee proposal
  const [hireCompanyId, setHireCompanyId] = useState('');
  const [hireAddr, setHireAddr] = useState('');
  const [hireName, setHireName] = useState('');
  const [hireRole, setHireRole] = useState('');
  const [hireSalaryMonthly, setHireSalaryMonthly] = useState('');

  // Quick: fire employee proposal
  const [fireAddr, setFireAddr] = useState('');
  const [fireCompanyId, setFireCompanyId] = useState('');

  // Quick: update salary proposal
  const [salUpdateAddr, setSalUpdateAddr] = useState('');
  const [salUpdateCompanyId, setSalUpdateCompanyId] = useState('');
  const [salUpdateRole, setSalUpdateRole] = useState('');
  const [salUpdateMonthly, setSalUpdateMonthly] = useState('');

  // Quick: move funds from treasury
  const [moveFundsToken, setMoveFundsToken] = useState<'usdt' | 'wlf'>('usdt');
  const [moveFundsAmount, setMoveFundsAmount] = useState('');
  const [moveFundsTo, setMoveFundsTo] = useState('');

  // Quick: set CompaniesHouse fees
  const [chWlfBps, setChWlfBps] = useState('50');
  const [chNonWlfBps, setChNonWlfBps] = useState('500');

  // Quick: DAO vault DeFi proposals
  const [daoVaultSupplyAmt, setDaoVaultSupplyAmt] = useState('');
  const [daoVaultWithdrawAmt, setDaoVaultWithdrawAmt] = useState('');
  const [daoVaultBorrowAmt, setDaoVaultBorrowAmt] = useState('');
  const [daoVaultMinHfInput, setDaoVaultMinHfInput] = useState('1.5');

  // Quick: update power roles
  const [powerRolesInput, setPowerRolesInput] = useState('');
  const [powerRolesCompanyId, setPowerRolesCompanyId] = useState('');

  // Fund treasury
  const [fundToken, setFundToken] = useState<'usdt' | 'usdc' | 'wlf' | 'eth' | 'wbtc'>('usdt');
  const [fundAmount, setFundAmount] = useState('');

  // CompanyDeFi admin
  const [defiAllowTokenInput, setDefiAllowTokenInput] = useState('');
  const isDefiAdmin = !!(defiAdmin && address && defiAdmin.toLowerCase() === address.toLowerCase());

  // DAO team live tick (for pending pay display)
  const [daoTeamTick, setDaoTeamTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setDaoTeamTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

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

  type SalaryItemData = { role: string; salaryPerHour: bigint; lastPayDate: bigint };
  type EmployeeData   = { employeeAddress: `0x${string}`; payableAddress: `0x${string}`; name: string; salaryItems: SalaryItemData[]; active: boolean };
  type DaoCompanyData = { companyId: bigint; name: string; industry: string; domain: string; roles: string[]; powerRoles: string[]; operatorAddress: `0x${string}`; active: boolean; employees: EmployeeData[] };

  const daoCompany   = daoCompanyRaw as DaoCompanyData | undefined;
  const daoEmployees = daoCompany?.employees?.filter(e => e.active) ?? [];

  // Pending pay per employee — recomputed on each tick (daoTeamTick triggers re-render)
  const nowSec = BigInt(Math.floor(Date.now() / 1000 + daoTeamTick * 0));
  const employeePending = (emp: EmployeeData): bigint =>
    emp.salaryItems.reduce((acc, s) =>
      acc + (s.lastPayDate > 0n ? (nowSec - s.lastPayDate) * s.salaryPerHour / 3600n : 0n), 0n);
  const employeeMonthlySalary = (emp: EmployeeData): bigint =>
    emp.salaryItems.reduce((acc, s) => acc + s.salaryPerHour * 730n, 0n);

  type CompanyInfo = {
    companyId: number;
    name: string;
    industry: string;
    operatorAddress: `0x${string}`;
  };

  const activeCompanies: CompanyInfo[] = (companyResults ?? [])
    .map(r => {
      if (r.status !== 'success' || !r.result) return null;
      const c = r.result as { companyId: bigint; name: string; industry: string; operatorAddress: `0x${string}`; active: boolean };
      if (!c.active) return null;
      return { companyId: Number(c.companyId), name: c.name, industry: c.industry, operatorAddress: c.operatorAddress };
    })
    .filter((c): c is CompanyInfo => c !== null);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleFundTreasury = () => {
    if (!treasuryAddress || !fundAmount) return;
    if (fundToken === 'eth') {
      sendTransaction({ to: treasuryAddress, value: parseEther(fundAmount) });
      return;
    }
    const tokenAddr = fundToken === 'usdt' ? usdtAddress
      : fundToken === 'usdc' ? usdcAddress
      : fundToken === 'wlf' ? wlfAddress
      : wbtcAddress;
    if (!tokenAddr) return;
    const decimals = fundToken === 'wlf' ? 18 : fundToken === 'wbtc' ? 8 : 6;
    setLastAction('fund-treasury');
    writeContract({
      address: tokenAddr,
      abi: erc20ABI,
      functionName: 'transfer',
      args: [treasuryAddress, parseUnits(fundAmount, decimals)],
    });
  };

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
      encodeAbiParameters(parseAbiParameters('address, uint256'), [c.operatorAddress, amountWei])
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

  // Auto-fill company ID fields when daoCompanyId loads
  useEffect(() => {
    if (daoCompanyIdOnChain && daoCompanyIdOnChain > 0n) {
      const idStr = daoCompanyIdOnChain.toString();
      if (!hireCompanyId) setHireCompanyId(idStr);
      if (!fireCompanyId) setFireCompanyId(idStr);
      if (!salUpdateCompanyId) setSalUpdateCompanyId(idStr);
      if (!powerRolesCompanyId) setPowerRolesCompanyId(idStr);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daoCompanyIdOnChain]);

  const handleHireEmployeeProposal = () => {
    if (!daoAddress || !companiesHouseAddress || !hireAddr || !hireName || !hireRole || !hireSalaryMonthly || !hireCompanyId) return;
    const compId = BigInt(parseInt(hireCompanyId));
    const hourlyWei = BigInt(Math.round(parseFloat(hireSalaryMonthly) * 1_000_000 / 730));
    setLastAction('hire-employee-proposal');
    writeContract({
      address: daoAddress,
      abi: daoABI,
      functionName: 'createProposal',
      args: [
        [companiesHouseAddress],
        ['hireEmployee((address,string,uint96,(string,uint256,uint256)[]))'],
        [encodeAbiParameters(
          [{ type: 'tuple', components: [
            { name: 'employeeAddress', type: 'address' },
            { name: 'name', type: 'string' },
            { name: 'companyId', type: 'uint96' },
            { name: 'salaryItems', type: 'tuple[]', components: [
              { name: 'role', type: 'string' },
              { name: 'salaryPerHour', type: 'uint256' },
              { name: 'lastPayDate', type: 'uint256' },
            ]},
          ]}] as const,
          [{ employeeAddress: hireAddr as `0x${string}`, name: hireName, companyId: compId, salaryItems: [{ role: hireRole, salaryPerHour: hourlyWei, lastPayDate: 0n }] }]
        )],
      ],
    });
    setIsModalOpen(false);
  };

  const handleFireEmployeeProposal = () => {
    if (!daoAddress || !companiesHouseAddress || !fireAddr || !fireCompanyId) return;
    const compId = BigInt(parseInt(fireCompanyId));
    setLastAction('fire-employee-proposal');
    writeContract({
      address: daoAddress,
      abi: daoABI,
      functionName: 'createProposal',
      args: [
        [companiesHouseAddress],
        ['fireEmployee(address,uint96)'],
        [encodeAbiParameters(parseAbiParameters('address, uint96'), [fireAddr as `0x${string}`, compId])],
      ],
    });
    setIsModalOpen(false);
  };

  const handleUpdateSalaryProposal = () => {
    if (!daoAddress || !companiesHouseAddress || !salUpdateAddr || !salUpdateCompanyId || !salUpdateRole || !salUpdateMonthly) return;
    const compId = BigInt(parseInt(salUpdateCompanyId));
    const hourlyWei = BigInt(Math.round(parseFloat(salUpdateMonthly) * 1_000_000 / 730));
    setLastAction('update-salary-proposal');
    writeContract({
      address: daoAddress,
      abi: daoABI,
      functionName: 'createProposal',
      args: [
        [companiesHouseAddress],
        ['updateEmployee(address,uint96,(string,address,(string,uint256,uint256)[]))'],
        [encodeAbiParameters(
          [
            { type: 'address' },
            { type: 'uint96' },
            { type: 'tuple', components: [
              { name: 'name', type: 'string' },
              { name: 'payableAddress', type: 'address' },
              { name: 'salaryItems', type: 'tuple[]', components: [
                { name: 'role', type: 'string' },
                { name: 'salaryPerHour', type: 'uint256' },
                { name: 'lastPayDate', type: 'uint256' },
              ]},
            ]},
          ] as const,
          [
            salUpdateAddr as `0x${string}`,
            compId,
            { name: '', payableAddress: salUpdateAddr as `0x${string}`, salaryItems: [{ role: salUpdateRole, salaryPerHour: hourlyWei, lastPayDate: 0n }] },
          ]
        )],
      ],
    });
    setIsModalOpen(false);
  };

  const handleMoveFundsProposal = () => {
    if (!daoAddress || !treasuryAddress || !moveFundsTo || !moveFundsAmount) return;
    const tokenAddr = moveFundsToken === 'wlf' ? wlfAddress : usdtAddress;
    if (!tokenAddr) return;
    const decimals = moveFundsToken === 'wlf' ? 18 : 6;
    const amountWei = parseUnits(moveFundsAmount, decimals);
    if (amountWei <= 0n) return;
    setLastAction('move-funds-proposal');
    writeContract({
      address: daoAddress,
      abi: daoABI,
      functionName: 'createProposal',
      args: [
        [treasuryAddress],
        ['withdrawToken(address,uint256,address)'],
        [encodeAbiParameters(parseAbiParameters('address, uint256, address'), [tokenAddr, amountWei, moveFundsTo as `0x${string}`])],
      ],
    });
    setIsModalOpen(false);
  };

  const handleSetChFeesProposal = () => {
    if (!daoAddress || !companiesHouseAddress) return;
    const wlfBps = BigInt(parseInt(chWlfBps) || 50);
    const nonWlfBps = BigInt(parseInt(chNonWlfBps) || 500);
    setLastAction('set-ch-fees-proposal');
    writeContract({
      address: daoAddress,
      abi: daoABI,
      functionName: 'createProposal',
      args: [
        [companiesHouseAddress],
        ['setFees(uint256,uint256)'],
        [encodeAbiParameters(parseAbiParameters('uint256, uint256'), [wlfBps, nonWlfBps])],
      ],
    });
    setIsModalOpen(false);
  };

  const handleDaoVaultSupplyProposal = () => {
    if (!daoAddress || !daoVaultAddress || !daoVaultSupplyAmt) return;
    const tokenAddr = aaveUsdtAddress ?? usdtAddress;
    if (!tokenAddr) return;
    const decimals = 6;
    const amountWei = parseUnits(daoVaultSupplyAmt, decimals);
    if (amountWei <= 0n) return;
    setLastAction('dao-vault-proposal');
    writeContract({
      address: daoAddress,
      abi: daoABI,
      functionName: 'createProposal',
      args: [
        [daoVaultAddress],
        ['supplyToAave(address,uint256)'],
        [encodeAbiParameters(parseAbiParameters('address, uint256'), [tokenAddr, amountWei])],
      ],
    });
    setIsModalOpen(false);
  };

  const handleDaoVaultWithdrawProposal = () => {
    if (!daoAddress || !daoVaultAddress || !daoVaultWithdrawAmt) return;
    const tokenAddr = aaveUsdtAddress ?? usdtAddress;
    if (!tokenAddr) return;
    const isMax = daoVaultWithdrawAmt.toLowerCase() === 'max';
    const amountWei = isMax ? (2n ** 256n - 1n) : parseUnits(daoVaultWithdrawAmt, 6);
    setLastAction('dao-vault-proposal');
    writeContract({
      address: daoAddress,
      abi: daoABI,
      functionName: 'createProposal',
      args: [
        [daoVaultAddress],
        ['withdrawFromAave(address,uint256)'],
        [encodeAbiParameters(parseAbiParameters('address, uint256'), [tokenAddr, amountWei])],
      ],
    });
    setIsModalOpen(false);
  };

  const handleDaoVaultBorrowProposal = () => {
    if (!daoAddress || !daoVaultAddress || !daoVaultBorrowAmt) return;
    const tokenAddr = aaveUsdtAddress ?? usdtAddress;
    if (!tokenAddr) return;
    const amountWei = parseUnits(daoVaultBorrowAmt, 6);
    if (amountWei <= 0n) return;
    setLastAction('dao-vault-proposal');
    writeContract({
      address: daoAddress,
      abi: daoABI,
      functionName: 'createProposal',
      args: [
        [daoVaultAddress],
        ['borrowFromAave(address,uint256)'],
        [encodeAbiParameters(parseAbiParameters('address, uint256'), [tokenAddr, amountWei])],
      ],
    });
    setIsModalOpen(false);
  };

  const handleDaoVaultSetMinHfProposal = () => {
    if (!daoAddress || !daoVaultAddress || !daoVaultMinHfInput) return;
    const hfValue = parseUnits(daoVaultMinHfInput, 18);
    if (hfValue <= 0n) return;
    setLastAction('dao-vault-proposal');
    writeContract({
      address: daoAddress,
      abi: daoABI,
      functionName: 'createProposal',
      args: [
        [daoVaultAddress],
        ['setMinHealthFactor(uint256)'],
        [encodeAbiParameters(parseAbiParameters('uint256'), [hfValue])],
      ],
    });
    setIsModalOpen(false);
  };

  const handleUpdatePowerRolesProposal = () => {
    if (!daoAddress || !companiesHouseAddress || !powerRolesCompanyId || !daoCompany) return;
    const compId = BigInt(parseInt(powerRolesCompanyId));
    const newPowerRoles = powerRolesInput.split(',').map(s => s.trim()).filter(Boolean);
    setLastAction('update-power-roles-proposal');
    writeContract({
      address: daoAddress,
      abi: daoABI,
      functionName: 'createProposal',
      args: [
        [companiesHouseAddress],
        ['updateCompany(uint96,(string,string,string,string[],string[],address))'],
        [encodeAbiParameters(
          [
            { type: 'uint96' },
            { type: 'tuple', components: [
              { name: 'name', type: 'string' },
              { name: 'industry', type: 'string' },
              { name: 'domain', type: 'string' },
              { name: 'roles', type: 'string[]' },
              { name: 'powerRoles', type: 'string[]' },
              { name: 'operatorAddress', type: 'address' },
            ]},
          ] as const,
          [
            compId,
            {
              name: daoCompany.name,
              industry: daoCompany.industry,
              domain: daoCompany.domain,
              roles: [...daoCompany.roles],
              powerRoles: newPowerRoles,
              operatorAddress: daoCompany.operatorAddress,
            },
          ]
        )],
      ],
    });
    setIsModalOpen(false);
  };

  const handleDistributeRewards = () => {
    if (!treasuryAddress) return;
    setLastAction('distribute-rewards');
    writeContract({
      address: treasuryAddress,
      abi: treasuryABI,
      functionName: 'distributeRewards',
      args: [],
    });
  };

  const handleDistributeRewardsToLP = () => {
    if (!treasuryAddress) return;
    setLastAction('distribute-rewards-lp');
    writeContract({
      address: treasuryAddress,
      abi: treasuryABI,
      functionName: 'distributeRewardsToLP',
      args: [],
    });
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
            {usdcAddress && (
              <div className="flex justify-between items-baseline">
                <span className={`text-sm ${theme.textMuted}`}>USDC</span>
                <span className="text-sm font-mono text-white">
                  {treasuryUsdcBalance !== undefined
                    ? Number(formatUnits(treasuryUsdcBalance, 6)).toLocaleString(undefined, { maximumFractionDigits: 2 })
                    : '…'}
                </span>
              </div>
            )}
            <div className="flex justify-between items-baseline opacity-35">
              <span className="text-sm">ETH</span>
              <span className="text-xs italic">coming soon</span>
            </div>
            <div className="flex justify-between items-baseline opacity-35">
              <span className="text-sm">WBTC</span>
              <span className="text-xs italic">coming soon</span>
            </div>
          </div>
          {daoCompanyIdOnChain !== undefined && (
            <div className="pt-2 mt-1 border-t border-white/10">
              <Link
                to={`/defi/${daoCompanyIdOnChain.toString()}`}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
              >
                <span className="text-blue-400/60">◈</span>
                DeFi vault →
              </Link>
            </div>
          )}
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

      {/* ── Fund Treasury ── */}
      <div className={`${theme.card} p-4 mt-4`}>
        <p className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3">Fund Treasury</p>
        <div className="flex gap-2 items-center">
          <select
            value={fundToken}
            onChange={e => setFundToken(e.target.value as typeof fundToken)}
            className="bg-[#1e2433] border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/40 cursor-pointer transition-colors"
          >
            <option value="usdt" className="bg-[#1e2433] text-white">USDT</option>
            {usdcAddress && <option value="usdc" className="bg-[#1e2433] text-white">USDC</option>}
            <option value="wlf" className="bg-[#1e2433] text-white">WLF</option>
            <option value="eth" className="bg-[#1e2433] text-white">ETH</option>
            {wbtcAddress && <option value="wbtc" className="bg-[#1e2433] text-white">WBTC</option>}
          </select>
          <div className="flex-1">
            <Input
              value={fundAmount}
              onChange={e => setFundAmount(e.target.value)}
              placeholder="Amount"
            />
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={handleFundTreasury}
            loading={isPending || isConfirming || isSendEthPending}
            disabled={!fundAmount || isPending || isConfirming || isSendEthPending}
          >
            Send
          </Button>
        </div>
      </div>

      {/* ── DAO DeFi Vault ── */}
      {daoVaultAddress && (
        <div className={`${theme.card} p-4 mt-4`}>
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/40">DAO DeFi Vault</p>
            <Link
              to={`/defi/${daoCompanyIdOnChain?.toString() ?? ''}`}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              manage →
            </Link>
          </div>
          <div className="space-y-1.5">
            {(() => {
              const [collateral, debt, available, , , hf] = (daoVaultAaveData as [bigint,bigint,bigint,bigint,bigint,bigint] | undefined) ?? [undefined,undefined,undefined,undefined,undefined,undefined];
              const hfNum = hf !== undefined ? (hf === (2n**256n - 1n) ? Infinity : Number(formatUnits(hf, 18))) : undefined;
              const hfColor = hfNum === undefined ? 'text-white/40' : hfNum >= 2 ? 'text-green-400' : hfNum >= 1.2 ? 'text-yellow-400' : 'text-red-400';
              const minHfNum = daoVaultMinHf !== undefined ? Number(formatUnits(daoVaultMinHf as bigint, 18)) : 1.5;
              return (
                <>
                  <div className="flex justify-between items-baseline">
                    <span className={`text-sm ${theme.textMuted}`}>Collateral</span>
                    <span className="text-sm font-mono text-white">
                      {collateral !== undefined ? `$${(Number(collateral) / 1e8).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '…'}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className={`text-sm ${theme.textMuted}`}>Debt</span>
                    <span className="text-sm font-mono text-white">
                      {debt !== undefined ? `$${(Number(debt) / 1e8).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '…'}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className={`text-sm ${theme.textMuted}`}>Available</span>
                    <span className="text-sm font-mono text-white">
                      {available !== undefined ? `$${(Number(available) / 1e8).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '…'}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className={`text-sm ${theme.textMuted}`}>Health factor</span>
                    <span className={`text-sm font-mono font-semibold ${hfColor}`}>
                      {hfNum === undefined ? '…' : hfNum === Infinity ? '∞' : hfNum.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className={`text-sm ${theme.textMuted}`}>Min HF (governance)</span>
                    <span className="text-sm font-mono text-white/60">{minHfNum.toFixed(2)}</span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── DAO Team ── */}
      <div className={`${theme.card} p-4 mt-4`}>
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/40">DAO Team</p>
          {daoCompany && (
            <span className={`text-xs ${theme.textMuted}`}>{daoCompany.name} · {daoCompany.industry}</span>
          )}
        </div>

        {!hasDaoCompany ? (
          <p className={`text-xs ${theme.textMuted}`}>
            No DAO company set. Create a company in CompaniesHouse named &quot;Werewolf DAO&quot;,
            then call <code className="text-white/60">setDaoCompanyId(id)</code> from the admin.
            <span className="block mt-1 text-white/30">All protocol fees (5% / 0.5% WLF) from every company go to this DAO&apos;s Treasury.</span>
          </p>
        ) : daoEmployees.length === 0 ? (
          <p className={`text-xs ${theme.textMuted}`}>No active employees in the DAO company yet.</p>
        ) : (
          <div className="space-y-2">
            {daoEmployees.map((emp) => {
              const pending = employeePending(emp);
              const monthly = employeeMonthlySalary(emp);
              return (
                <div key={emp.employeeAddress} className={`${theme.cardNested} p-3 flex items-start justify-between gap-3`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{emp.name}</p>
                    <p className={`text-xs ${theme.textMuted} truncate`}>
                      {emp.salaryItems.map(s => s.role).join(', ')}
                    </p>
                    <p className={`text-xs ${theme.textMuted} mt-0.5`}>
                      {(Number(monthly) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT/mo
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-amber-300 font-mono">
                      +{(Number(pending) / 1e6).toFixed(2)} USDT pending
                    </p>
                    <button
                      className={`text-xs mt-1 ${theme.textMuted} hover:text-white underline transition-colors`}
                      onClick={() => {
                        setSalUpdateAddr(emp.payableAddress);
                        setSalUpdateCompanyId(daoCompanyIdOnChain?.toString() ?? '');
                        setSalUpdateRole(emp.salaryItems[0]?.role ?? '');
                        setSalUpdateMonthly(emp.salaryItems[0] ? (Number(emp.salaryItems[0].salaryPerHour * 730n) / 1e6).toFixed(0) : '');
                        setModalTab('quick');
                        setIsModalOpen(true);
                      }}
                    >
                      Propose salary change
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasDaoCompany && (
          <p className={`text-xs ${theme.textMuted} mt-3 pt-3 border-t border-white/5`}>
            Protocol fees from all companies: <span className="text-white/60">5% (non-WLF) · 0.5% (WLF) → Treasury</span>
          </p>
        )}
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

      {/* ── Guardian: Direct Reward Distribution ── */}
      {isGuardian && (
        <div className={`${theme.card} p-4 mt-4`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/70 mb-3">
            Guardian: Direct Distribution (early bootstrapping)
          </p>
          <p className={`text-xs ${theme.textMuted} mb-3`}>
            Distribute staking rewards directly without a governance proposal. Use during early bootstrapping only — once the DAO matures, this should go through proposals.
          </p>
          <div className="flex gap-3 flex-wrap">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDistributeRewards}
              loading={isPending || isConfirming}
              disabled={isPending || isConfirming}
            >
              Distribute to WLF Staking
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDistributeRewardsToLP}
              loading={isPending || isConfirming}
              disabled={isPending || isConfirming}
            >
              Distribute to LP Staking
            </Button>
          </div>
          <TxStatus isPending={isPending} isConfirming={isConfirming} isConfirmed={isConfirmed} txHash={txHash} label={lastAction} />
        </div>
      )}

      {/* ── Guardian: Emergency Pause Controls ── */}
      {isGuardian && (
        <div className={`${theme.card} p-4 mt-4 border border-red-900/30`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-red-400/70 mb-3">
            Guardian: Emergency Pause Controls
          </p>
          <p className={`text-xs mb-3 ${theme.textMuted}`}>
            Pause protocol contracts to halt activity during emergencies. Use with extreme caution — pausing blocks all staking and employee payments.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (!stakingAddress) return;
                setLastAction('pause-staking');
                writeContract({ address: stakingAddress, abi: stakingABI, functionName: 'pause', args: [] });
              }}
              loading={lastAction === 'pause-staking' && (isPending || isConfirming)}
              disabled={isPending || isConfirming}
            >
              Pause Staking
            </Button>
            <Button
              variant="info"
              size="sm"
              onClick={() => {
                if (!stakingAddress) return;
                setLastAction('unpause-staking');
                writeContract({ address: stakingAddress, abi: stakingABI, functionName: 'unpause', args: [] });
              }}
              loading={lastAction === 'unpause-staking' && (isPending || isConfirming)}
              disabled={isPending || isConfirming}
            >
              Unpause Staking
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (!companiesHouseAddress) return;
                setLastAction('pause-companies');
                writeContract({ address: companiesHouseAddress, abi: companiesHouseABI, functionName: 'pause', args: [] });
              }}
              loading={lastAction === 'pause-companies' && (isPending || isConfirming)}
              disabled={isPending || isConfirming}
            >
              Pause CompaniesHouse
            </Button>
            <Button
              variant="info"
              size="sm"
              onClick={() => {
                if (!companiesHouseAddress) return;
                setLastAction('unpause-companies');
                writeContract({ address: companiesHouseAddress, abi: companiesHouseABI, functionName: 'unpause', args: [] });
              }}
              loading={lastAction === 'unpause-companies' && (isPending || isConfirming)}
              disabled={isPending || isConfirming}
            >
              Unpause CompaniesHouse
            </Button>
          </div>
        </div>
      )}

      {/* ── CompanyDeFi Admin Controls ── */}
      {companyDeFiAddress && aaveUsdtAddress && (isGuardian || isDefiAdmin) && (
        <div className={`${theme.card} p-4 mt-4 border border-blue-900/30`}>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-400/70 mb-1">
            CompanyDeFi Admin
          </p>
          <p className={`text-xs mb-3 ${theme.textMuted}`}>
            Manage DeFi operations for company treasuries (Aave yield). Admin: {defiAdmin ?? '…'}
          </p>

          {/* Pause / Unpause */}
          <div className="mb-3">
            <p className={`text-xs mb-1.5 ${theme.textMuted}`}>
              Status: <span className={defiPaused ? 'text-red-400' : 'text-green-400'}>{defiPaused ? 'Paused' : 'Active'}</span>
            </p>
            <div className="flex gap-2">
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  if (!companyDeFiAddress) return;
                  setLastAction('defi-pause');
                  writeContract({ address: companyDeFiAddress, abi: companyDeFiABI, functionName: 'pause', args: [] });
                }}
                loading={lastAction === 'defi-pause' && (isPending || isConfirming)}
                disabled={isPending || isConfirming || !!defiPaused}
              >
                Pause DeFi
              </Button>
              <Button
                variant="info"
                size="sm"
                onClick={() => {
                  if (!companyDeFiAddress) return;
                  setLastAction('defi-unpause');
                  writeContract({ address: companyDeFiAddress, abi: companyDeFiABI, functionName: 'unpause', args: [] });
                }}
                loading={lastAction === 'defi-unpause' && (isPending || isConfirming)}
                disabled={isPending || isConfirming || !defiPaused}
              >
                Unpause DeFi
              </Button>
            </div>
          </div>

          {/* Borrowing toggle */}
          <div className="mb-3">
            <p className={`text-xs mb-1.5 ${theme.textMuted}`}>
              Borrowing: <span className={defiBorrowingEnabled ? 'text-green-400' : 'text-white/40'}>{defiBorrowingEnabled ? 'Enabled' : 'Disabled'}</span>
            </p>
            <div className="flex gap-2">
              <Button
                variant="info"
                size="sm"
                onClick={() => {
                  if (!companyDeFiAddress) return;
                  setLastAction('defi-borrow-enable');
                  writeContract({ address: companyDeFiAddress, abi: companyDeFiABI, functionName: 'setBorrowingEnabled', args: [true] });
                }}
                loading={lastAction === 'defi-borrow-enable' && (isPending || isConfirming)}
                disabled={isPending || isConfirming || !!defiBorrowingEnabled}
              >
                Enable Borrowing
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  if (!companyDeFiAddress) return;
                  setLastAction('defi-borrow-disable');
                  writeContract({ address: companyDeFiAddress, abi: companyDeFiABI, functionName: 'setBorrowingEnabled', args: [false] });
                }}
                loading={lastAction === 'defi-borrow-disable' && (isPending || isConfirming)}
                disabled={isPending || isConfirming || !defiBorrowingEnabled}
              >
                Disable Borrowing
              </Button>
            </div>
          </div>

          {/* Token whitelist */}
          <div>
            <p className={`text-xs mb-1.5 ${theme.textMuted}`}>
              Token Whitelist — USDT: <span className={defiUsdtAllowed ? 'text-green-400' : 'text-red-400'}>{defiUsdtAllowed ? '✓ Allowed' : '✗ Not allowed'}</span>
            </p>
            <div className="flex gap-2 mb-1.5">
              {!defiUsdtAllowed && aaveUsdtAddress && (
                <Button
                  variant="info"
                  size="sm"
                  onClick={() => {
                    setLastAction('defi-allow-token');
                    writeContract({ address: companyDeFiAddress, abi: companyDeFiABI, functionName: 'setAllowedToken', args: [aaveUsdtAddress, true] });
                  }}
                  loading={lastAction === 'defi-allow-token' && (isPending || isConfirming)}
                  disabled={isPending || isConfirming}
                >
                  Whitelist USDT
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Token address 0x…"
                value={defiAllowTokenInput}
                onChange={e => setDefiAllowTokenInput(e.target.value)}
                className={`${theme.input} flex-1 text-xs`}
              />
              <Button
                variant="info"
                size="sm"
                onClick={() => {
                  if (!defiAllowTokenInput.startsWith('0x')) return;
                  setLastAction('defi-allow-token');
                  writeContract({ address: companyDeFiAddress, abi: companyDeFiABI, functionName: 'setAllowedToken', args: [defiAllowTokenInput as `0x${string}`, true] });
                }}
                disabled={isPending || isConfirming || !defiAllowTokenInput.startsWith('0x')}
              >
                Allow
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  if (!defiAllowTokenInput.startsWith('0x')) return;
                  setLastAction('defi-disallow-token');
                  writeContract({ address: companyDeFiAddress, abi: companyDeFiABI, functionName: 'setAllowedToken', args: [defiAllowTokenInput as `0x${string}`, false] });
                }}
                disabled={isPending || isConfirming || !defiAllowTokenInput.startsWith('0x')}
              >
                Disallow
              </Button>
            </div>
          </div>

          <TxStatus isPending={isPending} isConfirming={isConfirming} isConfirmed={isConfirmed} txHash={txHash} label={lastAction} />
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
              wlfAddress={wlfAddress}
              stakingAddress={stakingAddress}
              lpStakingAddress={lpStakingAddress}
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
                            {company.operatorAddress.slice(0, 6)}…{company.operatorAddress.slice(-4)}
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

                {/* ── Hire Employee ── */}
                <div className={`${theme.cardNested} p-4 space-y-3`}>
                  <div>
                    <p className="font-semibold text-sm">Hire Employee</p>
                    <p className={`text-xs mt-0.5 ${theme.textMuted}`}>
                      Add a new employee to a company via governance. Defaults to the DAO company.
                    </p>
                  </div>
                  <Input label="Employee address" type="text" value={hireAddr} onChange={e => setHireAddr(e.target.value)} placeholder="0x..." />
                  <Input label="Name" type="text" value={hireName} onChange={e => setHireName(e.target.value)} placeholder="Alice" />
                  <Input label="Role" type="text" value={hireRole} onChange={e => setHireRole(e.target.value)} placeholder="Engineer" />
                  <Input label="Monthly salary (USD)" type="number" min="0" value={hireSalaryMonthly} onChange={e => setHireSalaryMonthly(e.target.value)} placeholder="5000" />
                  <Input label="Company ID" type="number" min="1" value={hireCompanyId} onChange={e => setHireCompanyId(e.target.value)} placeholder="1" />
                  {hireSalaryMonthly && (
                    <p className={`text-xs font-mono ${theme.textMuted}`}>
                      ≈ {Math.round(parseFloat(hireSalaryMonthly || '0') * 1_000_000 / 730).toLocaleString()} USDT-wei/hr
                    </p>
                  )}
                  <Button
                    variant="primary" size="sm"
                    onClick={handleHireEmployeeProposal}
                    disabled={!hireAddr || !hireName || !hireRole || !hireSalaryMonthly || !hireCompanyId || isPending || isConfirming}
                    loading={isPending || isConfirming}
                  >
                    Submit Hire Proposal
                  </Button>
                </div>

                {/* ── Fire Employee ── */}
                <div className={`${theme.cardNested} p-4 space-y-3`}>
                  <div>
                    <p className="font-semibold text-sm">Fire Employee</p>
                    <p className={`text-xs mt-0.5 ${theme.textMuted}`}>Soft-remove an employee from a company.</p>
                  </div>
                  <Input label="Employee address" type="text" value={fireAddr} onChange={e => setFireAddr(e.target.value)} placeholder="0x..." />
                  <Input label="Company ID" type="number" min="1" value={fireCompanyId} onChange={e => setFireCompanyId(e.target.value)} placeholder="1" />
                  <p className={`text-xs font-mono ${theme.textMuted}`}>
                    Calls: companiesHouse.fireEmployee({fireAddr || '0x...'}, {fireCompanyId || '?'})
                  </p>
                  <Button
                    variant="danger" size="sm"
                    onClick={handleFireEmployeeProposal}
                    disabled={!fireAddr || !fireCompanyId || isPending || isConfirming}
                    loading={isPending || isConfirming}
                  >
                    Submit Fire Proposal
                  </Button>
                </div>

                {/* ── Update Salary ── */}
                <div className={`${theme.cardNested} p-4 space-y-3`}>
                  <div>
                    <p className="font-semibold text-sm">Update Salary</p>
                    <p className={`text-xs mt-0.5 ${theme.textMuted}`}>
                      Propose a pay raise or cut. Replaces all salary items with a single new entry.
                    </p>
                  </div>
                  <Input label="Employee address" type="text" value={salUpdateAddr} onChange={e => setSalUpdateAddr(e.target.value)} placeholder="0x..." />
                  <Input label="Company ID" type="number" min="1" value={salUpdateCompanyId} onChange={e => setSalUpdateCompanyId(e.target.value)} placeholder="1" />
                  <Input label="Role" type="text" value={salUpdateRole} onChange={e => setSalUpdateRole(e.target.value)} placeholder="Engineer" />
                  <Input label="New monthly salary (USD)" type="number" min="0" value={salUpdateMonthly} onChange={e => setSalUpdateMonthly(e.target.value)} placeholder="6000" />
                  {salUpdateMonthly && (
                    <p className={`text-xs font-mono ${theme.textMuted}`}>
                      ≈ {Math.round(parseFloat(salUpdateMonthly || '0') * 1_000_000 / 730).toLocaleString()} USDT-wei/hr
                    </p>
                  )}
                  <Button
                    variant="info" size="sm"
                    onClick={handleUpdateSalaryProposal}
                    disabled={!salUpdateAddr || !salUpdateCompanyId || !salUpdateRole || !salUpdateMonthly || isPending || isConfirming}
                    loading={isPending || isConfirming}
                  >
                    Submit Salary Update Proposal
                  </Button>
                </div>

                {/* ── Update Power Roles ── */}
                <div className={`${theme.cardNested} p-4 space-y-3`}>
                  <div>
                    <p className="font-semibold text-sm">Update Power Roles</p>
                    <p className={`text-xs mt-0.5 ${theme.textMuted}`}>
                      Change which roles have authority to hire, fire, and pay in a company.
                      {daoCompany && <span> Current: <span className="text-white/60">{daoCompany.powerRoles.join(', ') || '(none)'}</span></span>}
                    </p>
                  </div>
                  <Input label="Company ID" type="number" min="1" value={powerRolesCompanyId} onChange={e => setPowerRolesCompanyId(e.target.value)} placeholder="1" />
                  <Input
                    label="New power roles (comma-separated)"
                    type="text"
                    value={powerRolesInput}
                    onChange={e => setPowerRolesInput(e.target.value)}
                    placeholder="CEO, CTO, CFO"
                  />
                  {powerRolesInput && (
                    <p className={`text-xs font-mono ${theme.textMuted}`}>
                      {powerRolesInput.split(',').map(s => s.trim()).filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <Button
                    variant="info" size="sm"
                    onClick={handleUpdatePowerRolesProposal}
                    disabled={!powerRolesInput || !powerRolesCompanyId || !daoCompany || isPending || isConfirming}
                    loading={isPending || isConfirming}
                  >
                    Submit Power Roles Proposal
                  </Button>
                  {!daoCompany && powerRolesCompanyId && (
                    <p className="text-xs text-amber-400">DAO company data not loaded — check company ID.</p>
                  )}
                </div>

                {/* ── Move Funds ── */}
                <div className={`${theme.cardNested} p-4 space-y-3`}>
                  <div>
                    <p className="font-semibold text-sm">Move Treasury Funds</p>
                    <p className={`text-xs mt-0.5 ${theme.textMuted}`}>
                      Transfer tokens from the DAO Treasury to any address.
                    </p>
                    <div className="flex gap-4 mt-1.5">
                      <p className={`text-xs ${theme.textMuted}`}>
                        WLF: <span className="text-white font-mono">
                          {treasuryWlfBalance !== undefined ? Number(formatEther(treasuryWlfBalance)).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '…'}
                        </span>
                      </p>
                      <p className={`text-xs ${theme.textMuted}`}>
                        USDT: <span className="text-white font-mono">
                          {treasuryUsdtBalance !== undefined ? Number(formatUnits(treasuryUsdtBalance, 6)).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '…'}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setMoveFundsToken('usdt')}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${moveFundsToken === 'usdt' ? 'bg-primary border-primary text-white' : `border-white/10 ${theme.textMuted}`}`}
                    >USDT</button>
                    <button
                      onClick={() => setMoveFundsToken('wlf')}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${moveFundsToken === 'wlf' ? 'bg-primary border-primary text-white' : `border-white/10 ${theme.textMuted}`}`}
                    >WLF</button>
                  </div>
                  <Input label={`Amount (${moveFundsToken.toUpperCase()})`} type="number" min="0" value={moveFundsAmount} onChange={e => setMoveFundsAmount(e.target.value)} placeholder="1000" />
                  <Input label="Recipient address" type="text" value={moveFundsTo} onChange={e => setMoveFundsTo(e.target.value)} placeholder="0x..." />
                  <p className={`text-xs font-mono ${theme.textMuted}`}>
                    treasury.withdrawToken({moveFundsToken.toUpperCase()}, {moveFundsAmount || '?'}, {moveFundsTo ? `${moveFundsTo.slice(0, 8)}…` : '?'})
                  </p>
                  <Button
                    variant="primary" size="sm"
                    onClick={handleMoveFundsProposal}
                    disabled={!moveFundsAmount || parseFloat(moveFundsAmount) <= 0 || !moveFundsTo || isPending || isConfirming}
                    loading={isPending || isConfirming}
                  >
                    Submit Move Funds Proposal
                  </Button>
                </div>

                {/* ── Set CompaniesHouse Fees ── */}
                <div className={`${theme.cardNested} p-4 space-y-3`}>
                  <div>
                    <p className="font-semibold text-sm">Set CompaniesHouse Fees</p>
                    <p className={`text-xs mt-0.5 ${theme.textMuted}`}>
                      Adjust protocol fees charged on employee payments. Current defaults: 0.5% WLF / 5% other.
                      Max 10% each.
                    </p>
                  </div>
                  <Input label="WLF fee (basis points, e.g. 50 = 0.5%)" type="number" min="0" max="1000" value={chWlfBps} onChange={e => setChWlfBps(e.target.value)} placeholder="50" />
                  <Input label="Non-WLF fee (basis points, e.g. 500 = 5%)" type="number" min="0" max="1000" value={chNonWlfBps} onChange={e => setChNonWlfBps(e.target.value)} placeholder="500" />
                  <p className={`text-xs font-mono ${theme.textMuted}`}>
                    WLF: {parseInt(chWlfBps || '0') / 100}% · Non-WLF: {parseInt(chNonWlfBps || '0') / 100}%
                  </p>
                  <Button
                    variant="info" size="sm"
                    onClick={handleSetChFeesProposal}
                    disabled={!chWlfBps || !chNonWlfBps || parseInt(chWlfBps) > 1000 || parseInt(chNonWlfBps) > 1000 || isPending || isConfirming}
                    loading={isPending || isConfirming}
                  >
                    Submit Set Fees Proposal
                  </Button>
                </div>

                {/* ── DAO DeFi: Supply to Aave ── */}
                {daoVaultAddress && (
                  <div className={`${theme.cardNested} p-4 space-y-3`}>
                    <div>
                      <p className="font-semibold text-sm">Supply to Aave (DAO Vault)</p>
                      <p className={`text-xs mt-0.5 ${theme.textMuted}`}>
                        Propose supplying USDT from the DAO company vault into Aave v3 to earn yield.
                        Vault must hold liquid USDT before execution.
                      </p>
                    </div>
                    <Input label="Amount (USDT)" type="number" min="0" value={daoVaultSupplyAmt} onChange={e => setDaoVaultSupplyAmt(e.target.value)} placeholder="1000" />
                    <p className={`text-xs font-mono ${theme.textMuted}`}>
                      vault.supplyToAave(USDT, {daoVaultSupplyAmt || '?'})
                    </p>
                    <Button
                      variant="primary" size="sm"
                      onClick={handleDaoVaultSupplyProposal}
                      disabled={!daoVaultSupplyAmt || parseFloat(daoVaultSupplyAmt) <= 0 || isPending || isConfirming}
                      loading={isPending || isConfirming}
                    >
                      Submit Supply Proposal
                    </Button>
                  </div>
                )}

                {/* ── DAO DeFi: Withdraw from Aave ── */}
                {daoVaultAddress && (
                  <div className={`${theme.cardNested} p-4 space-y-3`}>
                    <div>
                      <p className="font-semibold text-sm">Withdraw from Aave (DAO Vault)</p>
                      <p className={`text-xs mt-0.5 ${theme.textMuted}`}>
                        Propose redeeming supplied USDT (+ accrued yield) back into the DAO vault.
                        Enter "max" to withdraw full position.
                      </p>
                    </div>
                    <Input label="Amount (USDT, or 'max')" type="text" value={daoVaultWithdrawAmt} onChange={e => setDaoVaultWithdrawAmt(e.target.value)} placeholder="1000 or max" />
                    <p className={`text-xs font-mono ${theme.textMuted}`}>
                      vault.withdrawFromAave(USDT, {daoVaultWithdrawAmt || '?'})
                    </p>
                    <Button
                      variant="primary" size="sm"
                      onClick={handleDaoVaultWithdrawProposal}
                      disabled={!daoVaultWithdrawAmt || isPending || isConfirming}
                      loading={isPending || isConfirming}
                    >
                      Submit Withdraw Proposal
                    </Button>
                  </div>
                )}

                {/* ── DAO DeFi: Borrow from Aave ── */}
                {daoVaultAddress && (
                  <div className={`${theme.cardNested} p-4 space-y-3`}>
                    <div>
                      <p className="font-semibold text-sm">Borrow from Aave (DAO Vault)</p>
                      <p className={`text-xs mt-0.5 ${theme.textMuted}`}>
                        Propose borrowing USDT from Aave against the vault's collateral.
                        Requires admin to enable borrowing first (setBorrowingEnabled).
                      </p>
                    </div>
                    <Input label="Amount (USDT)" type="number" min="0" value={daoVaultBorrowAmt} onChange={e => setDaoVaultBorrowAmt(e.target.value)} placeholder="500" />
                    <p className={`text-xs font-mono ${theme.textMuted}`}>
                      vault.borrowFromAave(USDT, {daoVaultBorrowAmt || '?'})
                    </p>
                    <p className="text-xs text-yellow-400/80">
                      ⚠ Borrowing must be enabled on the vault by admin before this proposal can execute.
                    </p>
                    <Button
                      variant="info" size="sm"
                      onClick={handleDaoVaultBorrowProposal}
                      disabled={!daoVaultBorrowAmt || parseFloat(daoVaultBorrowAmt) <= 0 || isPending || isConfirming}
                      loading={isPending || isConfirming}
                    >
                      Submit Borrow Proposal
                    </Button>
                  </div>
                )}

                {/* ── DAO DeFi: Set Min Health Factor ── */}
                {daoVaultAddress && (
                  <div className={`${theme.cardNested} p-4 space-y-3`}>
                    <div>
                      <p className="font-semibold text-sm">Set Min Health Factor (DAO Vault)</p>
                      <p className={`text-xs mt-0.5 ${theme.textMuted}`}>
                        Propose updating the governance-defined minimum health factor for the DAO vault.
                        Current on-chain value: {daoVaultMinHf !== undefined ? Number(formatUnits(daoVaultMinHf as bigint, 18)).toFixed(2) : '…'}
                      </p>
                    </div>
                    <Input label="Min health factor (e.g. 1.5)" type="number" min="1" value={daoVaultMinHfInput} onChange={e => setDaoVaultMinHfInput(e.target.value)} placeholder="1.5" />
                    <p className={`text-xs font-mono ${theme.textMuted}`}>
                      vault.setMinHealthFactor({daoVaultMinHfInput || '?'}e18 = {daoVaultMinHfInput ? parseUnits(daoVaultMinHfInput, 18).toString() : '?'})
                    </p>
                    <Button
                      variant="info" size="sm"
                      onClick={handleDaoVaultSetMinHfProposal}
                      disabled={!daoVaultMinHfInput || parseFloat(daoVaultMinHfInput) <= 0 || isPending || isConfirming}
                      loading={isPending || isConfirming}
                    >
                      Submit Min HF Proposal
                    </Button>
                  </div>
                )}

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
