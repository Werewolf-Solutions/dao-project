import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { formatEther } from 'viem';
import { theme } from '@/contexts/ThemeContext';
import { companiesHouseABI, erc20ABI, getAddress } from '@/contracts';
import { useWLFPrice } from '@/hooks/useWLFPrice';
import { monthlyUSDToHourlyWei, hourlyWeiToMonthlyUSD, fmtUSDT, fmtMonths } from '@/utils/formatters';

// ─── types ────────────────────────────────────────────────────────────────────

type SalaryItem = { role: string; salaryPerHour: bigint; lastPayDate: bigint };
type Employee = {
  employeeId: `0x${string}`;
  payableAddress: `0x${string}`;
  name: string;
  companyId: bigint;
  hiredAt: bigint;
  active: boolean;
  salaryItems: readonly SalaryItem[];
};
type Company = {
  companyId: bigint;
  owner: `0x${string}`;
  operatorAddress: `0x${string}`;
  industry: string;
  name: string;
  createdAt: bigint;
  active: boolean;
  employees: readonly Employee[];
  domain: string;
  roles: readonly string[];
  powerRoles: readonly string[];
};

// ─── CreateCompanyForm ────────────────────────────────────────────────────────

function CreateCompanyForm({
  companiesHouseAddress,
  wlfAddress,
  creationFee,
  onCreated,
}: {
  companiesHouseAddress: `0x${string}`;
  wlfAddress: `0x${string}` | undefined;
  creationFee: bigint;
  onCreated: () => void;
}) {
  const { address } = useAccount();
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [domain, setDomain] = useState('');

  const [rolesStr, setRolesStr] = useState('Founder,CEO,CTO,HR,Developer');
  const [powerRolesStr, setPowerRolesStr] = useState('Founder,CEO');
  const [ownerRole, setOwnerRole] = useState('Founder');
  const [ownerName, setOwnerName] = useState('');
  const [monthlyUSD, setMonthlyUSD] = useState('500');

  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>();
  const [createTxHash, setCreateTxHash] = useState<`0x${string}` | undefined>();

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: wlfAddress,
    abi: erc20ABI,
    functionName: 'allowance',
    args: [address!, companiesHouseAddress],
    query: { enabled: !!address && !!wlfAddress },
  });

  const { writeContract: writeApprove, isPending: isApprovePending } = useWriteContract();
  const { writeContract: writeCreate, isPending: isCreatePending } = useWriteContract();

  const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } = useWaitForTransactionReceipt({ hash: approveTxHash });
  const { isLoading: isCreateConfirming, isSuccess: isCreateConfirmed } = useWaitForTransactionReceipt({ hash: createTxHash });

  useEffect(() => { if (isApproveConfirmed) refetchAllowance(); }, [isApproveConfirmed]);
  useEffect(() => { if (isCreateConfirmed) onCreated(); }, [isCreateConfirmed]);

  const hasAllowance = isApproveConfirmed ? true : (allowance ?? 0n) >= creationFee;
  const approveLoading = isApprovePending || isApproveConfirming;
  const createLoading = isCreatePending || isCreateConfirming;

  const rolesArr = rolesStr.split(',').map(r => r.trim()).filter(Boolean);
  const powerRolesArr = powerRolesStr.split(',').map(r => r.trim()).filter(Boolean);
  const salaryPerHour = monthlyUSDToHourlyWei(monthlyUSD);
  const canCreate = !!name && !!ownerName && !!ownerRole && rolesArr.length > 0 && salaryPerHour > 0n;

  function handleApprove() {
    if (!wlfAddress) return;
    writeApprove(
      {
        address: wlfAddress,
        abi: erc20ABI,
        functionName: 'approve',
        args: [companiesHouseAddress, creationFee],
      },
      { onSuccess: (hash) => setApproveTxHash(hash) }
    );
  }

  function handleCreate() {
    if (!address) return;
    writeCreate(
      {
        address: companiesHouseAddress,
        abi: companiesHouseABI,
        functionName: 'createCompany',
        gas: 4_000_000n,
        args: [{
          name,
          industry,
          domain,
          roles: rolesArr,
          powerRoles: powerRolesArr,
          operatorAddress: address,
          ownerRole,
          ownerSalaryPerHour: salaryPerHour,
          ownerName,
        }],
      },
      { onSuccess: (hash) => setCreateTxHash(hash) }
    );
  }

  return (
    <div className={`${theme.card} p-5 space-y-4`}>
      <h3 className="font-bold text-white text-lg">Create New Company</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input className={theme.input} placeholder="Company name *" value={name} onChange={e => setName(e.target.value)} />
        <input className={theme.input} placeholder="Industry (e.g. Software)" value={industry} onChange={e => setIndustry(e.target.value)} />
        <input className={`${theme.input} col-span-full sm:col-span-1`} placeholder="Domain (e.g. werewolf.solutions)" value={domain} onChange={e => setDomain(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={`block text-xs mb-1 ${theme.textMuted}`}>All roles (comma-separated)</label>
          <input className={theme.input} value={rolesStr} onChange={e => setRolesStr(e.target.value)} />
        </div>
        <div>
          <label className={`block text-xs mb-1 ${theme.textMuted}`}>Power roles (admin access)</label>
          <input className={theme.input} value={powerRolesStr} onChange={e => setPowerRolesStr(e.target.value)} />
        </div>
      </div>

      <div className={`p-3 rounded-lg ${theme.cardNested} space-y-3`}>
        <p className="text-sm font-semibold text-white/80">Your details (initial employee)</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input className={theme.input} placeholder="Your name *" value={ownerName} onChange={e => setOwnerName(e.target.value)} />
          <input className={theme.input} placeholder="Your role (e.g. Founder) *" value={ownerRole} onChange={e => setOwnerRole(e.target.value)} />
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
            <input
              className={`${theme.input} pl-7`}
              placeholder="Monthly salary (USD) *"
              type="number" min="0"
              value={monthlyUSD}
              onChange={e => setMonthlyUSD(e.target.value)}
            />
          </div>
        </div>
        <p className={`text-xs ${theme.textMuted}`}>
          Salary is denominated in USD. At pay time, the WLF equivalent is sent from the company's WLF balance (or bought via Uniswap if no WLF is available). Fund the treasury via "Deposit USDT" after creation.
        </p>
      </div>

      <div className={`p-3 rounded-lg bg-amber-900/20 border border-amber-700/40 text-xs text-amber-300 space-y-1`}>
        <p className="font-semibold">Creation fee: {formatEther(creationFee)} WLF</p>
        <p>This fee is sent to the DAO treasury and counts toward your governance power.</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {!hasAllowance ? (
          <button
            onClick={handleApprove}
            disabled={approveLoading || !wlfAddress}
            className={`${theme.btnPrimary} px-5 py-2 text-sm disabled:opacity-40`}
          >
            {approveLoading ? 'Waiting for confirmation…' : `Approve ${formatEther(creationFee)} WLF`}
          </button>
        ) : (
          <button
            onClick={handleCreate}
            disabled={createLoading || !canCreate}
            className={`${theme.btnPrimary} px-5 py-2 text-sm disabled:opacity-40`}
          >
            {createLoading ? 'Creating…' : 'Create Company'}
          </button>
        )}
        {!canCreate && hasAllowance && !createLoading && (
          <p className={`text-xs ${theme.textMuted}`}>Fill in all required fields.</p>
        )}
      </div>

      {isApproveConfirmed && hasAllowance && !createLoading && !createTxHash && (
        <p className="text-xs text-green-400">WLF approved — ready to create company.</p>
      )}
    </div>
  );
}

// ─── CompanyListCard ──────────────────────────────────────────────────────────

function CompanyListCard({
  companyId,
  connectedAddress,
  companiesHouseAddress,
  usdtAddress,
}: {
  companyId: bigint;
  connectedAddress: `0x${string}`;
  companiesHouseAddress: `0x${string}`;
  usdtAddress: `0x${string}` | undefined;
}) {
  const navigate = useNavigate();

  const { data: company } = useReadContract({
    address: companiesHouseAddress,
    abi: companiesHouseABI,
    functionName: 'retrieveCompany',
    args: [companyId],
    query: { refetchInterval: 30_000 },
  });

  const { data: companyUSDTBalance } = useReadContract({
    address: companiesHouseAddress,
    abi: companiesHouseABI,
    functionName: 'companyTokenBalances',
    args: [companyId, usdtAddress ?? '0x0000000000000000000000000000000000000000'],
    query: { enabled: !!usdtAddress, refetchInterval: 30_000 },
  });

  const { data: monthlyBurn } = useReadContract({
    address: companiesHouseAddress,
    abi: companiesHouseABI,
    functionName: 'getMonthlyBurnUSDT',
    args: [companyId],
    query: { refetchInterval: 60_000 },
  });

  if (!company) {
    return (
      <div className={`${theme.card} p-5 animate-pulse`}>
        <div className="h-5 bg-white/10 rounded w-1/3 mb-2" />
        <div className="h-3 bg-white/5 rounded w-2/3" />
      </div>
    );
  }

  const activeEmployees = company.employees.filter((e: Employee) => e.active);
  const balance = companyUSDTBalance ?? 0n;
  const monthly = monthlyBurn ?? 0n;
  const runwayMonths = monthly > 0n ? Number(balance / monthly) : null;
  const runwayColor =
    runwayMonths === null ? 'text-white/40' :
    runwayMonths > 60 ? 'text-green-400' :
    runwayMonths > 12 ? 'text-yellow-400' :
    'text-red-400';

  const addrLower = connectedAddress.toLowerCase();
  const isOwner = company.owner.toLowerCase() === addrLower;
  const isEmployee = company.employees.some(
    (e: Employee) => e.active && e.employeeId.toLowerCase() === addrLower
  );

  return (
    <div
      onClick={() => navigate(`/companies-house/${companyId.toString()}`)}
      className={`${theme.card} p-5 cursor-pointer hover:border-white/20 transition-all group`}
      style={{ borderColor: 'rgba(255,255,255,0.08)' }}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: name + industry */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-white group-hover:text-white/90 transition-colors">
              {company.name}
            </h3>
            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-white/5 text-white/35 border border-white/10">
              #{companyId.toString()}
            </span>
            {(isOwner || isEmployee) && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-[#8e2421]/30 text-[#e87070] border border-[#8e2421]/40">
                {isOwner ? 'Owner' : 'Employee'}
              </span>
            )}
          </div>
          <p className={`text-sm mt-0.5 ${theme.textMuted}`}>
            {company.industry || '—'}
            {company.domain && (
              <span className="text-white/25"> · {company.domain}</span>
            )}
          </p>
        </div>

        {/* Right: status + arrow */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${company.active ? 'bg-green-900/40 text-green-300' : 'bg-red-900/30 text-red-400'}`}>
            {company.active ? 'Active' : 'Inactive'}
          </span>
          <span className="text-white/30 group-hover:text-white/60 transition-colors text-sm">→</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-3 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-white/30 text-xs">👥</span>
          <span className={`text-xs ${theme.textMuted}`}>
            {activeEmployees.length} employee{activeEmployees.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-white/30 text-xs">💵</span>
          <span className="text-xs text-white/60 font-mono">${fmtUSDT(balance)} USDT</span>
        </div>
        {monthly > 0n && (
          <div className="flex items-center gap-1.5">
            <span className="text-white/30 text-xs">🔥</span>
            <span className="text-xs text-white/40 font-mono">${fmtUSDT(monthly)}/mo</span>
          </div>
        )}
        {runwayMonths !== null && (
          <div className="flex items-center gap-1.5">
            <span className="text-white/30 text-xs">⏱</span>
            <span className={`text-xs font-mono ${runwayColor}`}>
              {fmtMonths(runwayMonths)} runway
            </span>
          </div>
        )}
        <span className="text-xs text-white/20 font-mono ml-auto">
          {new Date(Number(company.createdAt) * 1000).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Companies() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const wlfPriceHuman = useWLFPrice();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _wlfPrice = wlfPriceHuman !== null ? BigInt(Math.round(wlfPriceHuman * 1e18)) : 0n;

  const companiesHouseAddress = getAddress(chainId, 'CompaniesHouse');
  const wlfAddress = getAddress(chainId, 'WerewolfToken');
  const usdtAddress = getAddress(chainId, 'USDT');

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [employeeCompanyIds, setEmployeeCompanyIds] = useState<bigint[]>([]);
  const publicClient = usePublicClient();

  const { data: companyIds, refetch: refetchIds } = useReadContract({
    address: companiesHouseAddress,
    abi: companiesHouseABI,
    functionName: 'getOwnerCompanyIds',
    args: [address!],
    query: { enabled: !!address && !!companiesHouseAddress },
  });

  const { data: creationFee } = useReadContract({
    address: companiesHouseAddress,
    abi: companiesHouseABI,
    functionName: 'creationFee',
    query: { enabled: !!companiesHouseAddress },
  });

  const { data: totalCompanies } = useReadContract({
    address: companiesHouseAddress,
    abi: companiesHouseABI,
    functionName: 'currentCompanyIndex',
    query: { enabled: !!companiesHouseAddress, refetchInterval: 30_000 },
  });

  // Scan all companies to find ones where the connected user is an active employee (but not owner)
  useEffect(() => {
    if (!address || !totalCompanies || !publicClient || !companiesHouseAddress) return;
    const total = Number(totalCompanies);
    if (total === 0) return;
    const ownerIds = new Set((companyIds ?? []).map(id => id.toString()));
    const scanIds = Array.from({ length: Math.min(total, 200) }, (_, i) => BigInt(i + 1));
    publicClient.multicall({
      contracts: scanIds.map(id => ({
        address: companiesHouseAddress as `0x${string}`,
        abi: companiesHouseABI,
        functionName: 'retrieveCompany' as const,
        args: [id] as [bigint],
      })),
    }).then(results => {
      const addrLower = address.toLowerCase();
      const empIds: bigint[] = [];
      results.forEach((result, i) => {
        if (result.status !== 'success') return;
        const company = result.result as Company;
        if (!company.active) return;
        if (ownerIds.has(scanIds[i].toString())) return;
        const isEmp = company.employees.some(
          (e: Employee) => e.active && e.employeeId.toLowerCase() === addrLower
        );
        if (isEmp) empIds.push(scanIds[i]);
      });
      setEmployeeCompanyIds(empIds);
    });
  }, [address, totalCompanies, publicClient, companiesHouseAddress, companyIds]);

  const ids = companyIds ? [...companyIds] : [];

  if (!isConnected) {
    return (
      <main className="pt-24 max-w-3xl mx-auto px-4 pb-16">
        <h1 className="text-3xl font-bold text-white mb-2">Companies House</h1>
        <p className={theme.textMuted}>Connect your wallet to view and manage your companies.</p>
      </main>
    );
  }

  if (!companiesHouseAddress) {
    return (
      <main className="pt-24 max-w-3xl mx-auto px-4 pb-16">
        <h1 className="text-3xl font-bold text-white mb-2">Companies House</h1>
        <p className={theme.textMuted}>CompaniesHouse not deployed on chain {chainId}.</p>
      </main>
    );
  }

  return (
    <main className="pt-24 max-w-3xl mx-auto px-4 pb-16 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Companies House</h1>
          <p className={`text-sm mt-1 ${theme.textMuted}`}>
            Register and manage your on-chain business. Salaries are denominated in USD and paid in WLF.
          </p>
        </div>
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className={`${theme.btnPrimary} px-4 py-2 text-sm shrink-0`}
          >
            + New Company
          </button>
        )}
      </div>

      {showCreateForm && (
        <CreateCompanyForm
          companiesHouseAddress={companiesHouseAddress}
          wlfAddress={wlfAddress}
          creationFee={creationFee ?? 10n * 10n ** 18n}
          onCreated={() => { setShowCreateForm(false); refetchIds(); }}
        />
      )}

      {ids.length === 0 && !showCreateForm && employeeCompanyIds.length === 0 && (
        <div className={`${theme.card} p-8 text-center`}>
          <p className="text-white/60 mb-4">You don't have any registered companies yet.</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className={`${theme.btnPrimary} px-6 py-2`}
          >
            Register Your First Company
          </button>
          <div className={`mt-4 text-xs ${theme.textMuted} max-w-sm mx-auto`}>
            <p>Each company has its own USDT treasury. Fund it via DAO airdrop or direct deposit to pay employees.</p>
          </div>
        </div>
      )}

      {/* My companies */}
      {ids.length > 0 && (
        <div className="space-y-3">
          {ids.length > 1 && (
            <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">My Companies</h2>
          )}
          {ids.map((id) => (
            <CompanyListCard
              key={id.toString()}
              companyId={id}
              connectedAddress={address!}
              companiesHouseAddress={companiesHouseAddress}
              usdtAddress={usdtAddress}
            />
          ))}
        </div>
      )}

      {/* Employment */}
      {employeeCompanyIds.length > 0 && (
        <div className="space-y-3">
          <div className="pt-2 border-t border-white/10">
            <h2 className="text-xl font-bold text-white">My Employment</h2>
            <p className={`text-sm mt-1 ${theme.textMuted}`}>
              Companies where you are employed.
            </p>
          </div>
          {employeeCompanyIds.map((id) => (
            <CompanyListCard
              key={id.toString()}
              companyId={id}
              connectedAddress={address!}
              companiesHouseAddress={companiesHouseAddress}
              usdtAddress={usdtAddress}
            />
          ))}
        </div>
      )}
    </main>
  );
}
