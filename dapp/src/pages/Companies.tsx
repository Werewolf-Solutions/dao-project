import { useState, useEffect } from 'react';
import { useAccount, useBalance, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { formatEther, parseUnits } from 'viem';
import { theme } from '@/contexts/ThemeContext';
import { companiesHouseABI, erc20ABI, getAddress } from '@/contracts';
import { useWLFPrice } from '@/hooks/useWLFPrice';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Convert user-entered $/month string → USDT wei per hour (6 dec). */
function monthlyUSDToHourlyWei(monthlyUSD: string): bigint {
  const parsed = parseFloat(monthlyUSD);
  if (isNaN(parsed) || parsed <= 0) return 0n;
  const usdtWeiPerMonth = BigInt(Math.round(parsed * 1_000_000));
  return usdtWeiPerMonth / 730n;
}

/** Convert USDT wei per hour → human $/month string. */
function hourlyWeiToMonthlyUSD(hourlyWei: bigint): string {
  const monthlyWei = hourlyWei * 730n;
  return (Number(monthlyWei) / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** Format USDT (6 dec bigint) to human USD string. */
function fmtUSDT(val: bigint, decimals = 2): string {
  return (Number(val) / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: decimals });
}

/** Format WLF (18 dec bigint) to human string. */
function fmtWLF(val: bigint, decimals = 4): string {
  return Number(formatEther(val)).toLocaleString(undefined, { maximumFractionDigits: decimals });
}

/** USDT (6 dec) → WLF (18 dec). wlfPrice is 18-dec-scaled price from TokenSale. */
function usdtToWlf(usdtWei: bigint, wlfPrice: bigint): bigint {
  if (wlfPrice === 0n || usdtWei === 0n) return 0n;
  return (usdtWei * 10n ** 30n) / wlfPrice;
}

/** Format a number of months as a human string, e.g. 14 → "1yr 2mo". */
function fmtMonths(months: number): string {
  if (months <= 0) return '0 months';
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} year${years === 1 ? '' : 's'}`;
  return `${years}yr ${rem}mo`;
}

// ─── types ───────────────────────────────────────────────────────────────────

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
  companyWallet: `0x${string}`;
  industry: string;
  name: string;
  createdAt: bigint;
  active: boolean;
  employees: readonly Employee[];
  domain: string;
  roles: readonly string[];
  powerRoles: readonly string[];
};

// ─── EmployeePaid event ABI ───────────────────────────────────────────────────

const employeePaidEventAbi = {
  type: 'event',
  name: 'EmployeePaid',
  inputs: [
    { name: 'employee', type: 'address', indexed: true },
    { name: 'usdtAmount', type: 'uint256', indexed: false },
  ],
} as const;

// ─── DepositUSDTForm ──────────────────────────────────────────────────────────

function DepositUSDTForm({
  companyId,
  companiesHouseAddress,
  usdtAddress,
  onDeposited,
}: {
  companyId: bigint;
  companiesHouseAddress: `0x${string}`;
  usdtAddress: `0x${string}` | undefined;
  onDeposited: () => void;
}) {
  const { address } = useAccount();
  const [amount, setAmount] = useState('');
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>();
  const [depositTxHash, setDepositTxHash] = useState<`0x${string}` | undefined>();

  const amountWei = (() => {
    const n = parseFloat(amount);
    if (isNaN(n) || n <= 0) return 0n;
    return BigInt(Math.round(n * 1_000_000));
  })();

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: usdtAddress,
    abi: erc20ABI,
    functionName: 'allowance',
    args: [address!, companiesHouseAddress],
    query: { enabled: !!address && !!usdtAddress },
  });

  const { writeContract: writeApprove, isPending: isApprovePending } = useWriteContract();
  const { writeContract: writeDeposit, isPending: isDepositPending } = useWriteContract();

  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveTxHash });
  const { isLoading: isDepositConfirming, isSuccess: isDepositSuccess } = useWaitForTransactionReceipt({ hash: depositTxHash });

  useEffect(() => { if (isApproveSuccess) refetchAllowance(); }, [isApproveSuccess]);
  useEffect(() => { if (isDepositSuccess) { onDeposited(); setAmount(''); } }, [isDepositSuccess]);

  const hasAllowance = isApproveSuccess ? true : (allowance ?? 0n) >= amountWei && amountWei > 0n;
  const approveLoading = isApprovePending || isApproveConfirming;
  const depositLoading = isDepositPending || isDepositConfirming;

  function handleApprove() {
    if (!usdtAddress || amountWei === 0n) return;
    writeApprove(
      { address: usdtAddress, abi: erc20ABI, functionName: 'approve', args: [companiesHouseAddress, amountWei] },
      { onSuccess: (hash) => setApproveTxHash(hash) }
    );
  }

  function handleDeposit() {
    if (!usdtAddress || amountWei === 0n) return;
    writeDeposit(
      {
        address: companiesHouseAddress,
        abi: companiesHouseABI,
        functionName: 'depositToCompany',
        args: [companyId, usdtAddress, amountWei],
        gas: 200_000n,
      },
      { onSuccess: (hash) => setDepositTxHash(hash) }
    );
  }

  return (
    <div className={`p-3 rounded-lg ${theme.cardNested} space-y-2`}>
      <p className="text-xs font-semibold text-white/70">Deposit USDT to Company Treasury</p>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
          <input
            className={`${theme.input} pl-7`}
            placeholder="Amount (USDT)"
            type="number"
            min="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
        </div>
        {!hasAllowance ? (
          <button
            onClick={handleApprove}
            disabled={approveLoading || amountWei === 0n}
            className={`shrink-0 px-3 py-2 rounded text-xs font-medium transition-colors ${
              approveLoading || amountWei === 0n
                ? 'bg-white/5 text-white/30 cursor-not-allowed'
                : 'bg-blue-700/60 text-white hover:bg-blue-600/70'
            }`}
          >
            {approveLoading ? 'Approving…' : 'Approve'}
          </button>
        ) : (
          <button
            onClick={handleDeposit}
            disabled={depositLoading || amountWei === 0n}
            className={`shrink-0 px-3 py-2 rounded text-xs font-medium transition-colors ${
              depositLoading || amountWei === 0n
                ? 'bg-white/5 text-white/30 cursor-not-allowed'
                : 'bg-green-700/60 text-white hover:bg-green-600/70'
            }`}
          >
            {depositLoading ? 'Depositing…' : 'Deposit'}
          </button>
        )}
      </div>
      {isDepositSuccess && <p className="text-xs text-green-400">USDT deposited to company treasury.</p>}
    </div>
  );
}

// ─── DepositWLFForm ───────────────────────────────────────────────────────────

function DepositWLFForm({
  companyId,
  companiesHouseAddress,
  wlfAddress,
  onDeposited,
}: {
  companyId: bigint;
  companiesHouseAddress: `0x${string}`;
  wlfAddress: `0x${string}` | undefined;
  onDeposited: () => void;
}) {
  const { address } = useAccount();
  const [amount, setAmount] = useState('');
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>();
  const [depositTxHash, setDepositTxHash] = useState<`0x${string}` | undefined>();

  const amountWei = (() => {
    try {
      const n = parseFloat(amount);
      if (isNaN(n) || n <= 0) return 0n;
      return parseUnits(amount, 18);
    } catch { return 0n; }
  })();

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: wlfAddress,
    abi: erc20ABI,
    functionName: 'allowance',
    args: [address!, companiesHouseAddress],
    query: { enabled: !!address && !!wlfAddress },
  });

  const { writeContract: writeApprove, isPending: isApprovePending } = useWriteContract();
  const { writeContract: writeDeposit, isPending: isDepositPending } = useWriteContract();

  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveTxHash });
  const { isLoading: isDepositConfirming, isSuccess: isDepositSuccess } = useWaitForTransactionReceipt({ hash: depositTxHash });

  useEffect(() => { if (isApproveSuccess) refetchAllowance(); }, [isApproveSuccess]);
  useEffect(() => { if (isDepositSuccess) { onDeposited(); setAmount(''); } }, [isDepositSuccess]);

  const hasAllowance = isApproveSuccess ? true : (allowance ?? 0n) >= amountWei && amountWei > 0n;
  const approveLoading = isApprovePending || isApproveConfirming;
  const depositLoading = isDepositPending || isDepositConfirming;

  function handleApprove() {
    if (!wlfAddress || amountWei === 0n) return;
    writeApprove(
      { address: wlfAddress, abi: erc20ABI, functionName: 'approve', args: [companiesHouseAddress, amountWei] },
      { onSuccess: (hash) => setApproveTxHash(hash) }
    );
  }

  function handleDeposit() {
    if (!wlfAddress || amountWei === 0n) return;
    writeDeposit(
      {
        address: companiesHouseAddress,
        abi: companiesHouseABI,
        functionName: 'depositToCompany',
        args: [companyId, wlfAddress, amountWei],
        gas: 200_000n,
      },
      { onSuccess: (hash) => setDepositTxHash(hash) }
    );
  }

  return (
    <div className={`p-3 rounded-lg ${theme.cardNested} space-y-2`}>
      <p className="text-xs font-semibold text-white/70">Deposit WLF to Company Treasury</p>
      <div className="flex items-center gap-2">
        <input
          className={`${theme.input} flex-1`}
          placeholder="Amount (WLF)"
          type="number"
          min="0"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />
        {!hasAllowance ? (
          <button
            onClick={handleApprove}
            disabled={approveLoading || amountWei === 0n}
            className={`shrink-0 px-3 py-2 rounded text-xs font-medium transition-colors ${
              approveLoading || amountWei === 0n
                ? 'bg-white/5 text-white/30 cursor-not-allowed'
                : 'bg-blue-700/60 text-white hover:bg-blue-600/70'
            }`}
          >
            {approveLoading ? 'Approving…' : 'Approve'}
          </button>
        ) : (
          <button
            onClick={handleDeposit}
            disabled={depositLoading || amountWei === 0n}
            className={`shrink-0 px-3 py-2 rounded text-xs font-medium transition-colors ${
              depositLoading || amountWei === 0n
                ? 'bg-white/5 text-white/30 cursor-not-allowed'
                : 'bg-green-700/60 text-white hover:bg-green-600/70'
            }`}
          >
            {depositLoading ? 'Depositing…' : 'Deposit'}
          </button>
        )}
      </div>
      {isDepositSuccess && <p className="text-xs text-green-400">WLF deposited to company treasury.</p>}
    </div>
  );
}

// ─── MyWalletPanel ────────────────────────────────────────────────────────────

function MyWalletPanel({
  address,
  wlfPrice,
}: {
  address: `0x${string}`;
  wlfPrice: bigint;
}) {
  const chainId = useChainId();
  const wlfAddress = getAddress(chainId, 'WerewolfToken');
  const usdtAddress = getAddress(chainId, 'USDT');

  const { data: wlfBalance } = useReadContract({
    address: wlfAddress,
    abi: erc20ABI,
    functionName: 'balanceOf',
    args: [address],
    query: { enabled: !!wlfAddress, refetchInterval: 10_000 },
  });

  const { data: usdtBalance } = useReadContract({
    address: usdtAddress,
    abi: erc20ABI,
    functionName: 'balanceOf',
    args: [address],
    query: { enabled: !!usdtAddress, refetchInterval: 10_000 },
  });

  return (
    <div className="mt-2 pt-2 border-t border-white/10 space-y-3">
      <p className="text-xs font-semibold text-white/50 uppercase tracking-wide">My Wallet</p>

      <div className="grid grid-cols-2 gap-2">
        <div className={`p-2.5 rounded-lg ${theme.cardNested}`}>
          <p className={`text-xs ${theme.textMuted} mb-0.5`}>WLF</p>
          <p className="text-sm font-mono text-white">{fmtWLF(wlfBalance ?? 0n)}</p>
          {wlfPrice > 0n && wlfBalance !== undefined && wlfBalance > 0n && (
            <p className={`text-xs ${theme.textMuted}`}>
              ≈ ${fmtUSDT((wlfBalance * wlfPrice) / 10n ** 30n)}
            </p>
          )}
        </div>
        <div className={`p-2.5 rounded-lg ${theme.cardNested}`}>
          <p className={`text-xs ${theme.textMuted} mb-0.5`}>USDT</p>
          <p className="text-sm font-mono text-white">${fmtUSDT(usdtBalance ?? 0n)}</p>
        </div>
      </div>

      <p className={`text-xs ${theme.textMuted}`}>
        To sell WLF for USDT, use{' '}
        <a
          href="https://app.uniswap.org"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline"
        >
          Uniswap
        </a>.
      </p>
    </div>
  );
}

// ─── EmployeeCard ─────────────────────────────────────────────────────────────

function EmployeeCard({
  employee,
  company,
  isAuthorized,
  companyUsdtBalance,
  requiredReserve,
  wlfPrice,
  connectedAddress,
  companiesHouseAddress,
  onRefetch,
}: {
  employee: Employee;
  company: Company;
  isAuthorized: boolean;
  companyUsdtBalance: bigint;
  requiredReserve: bigint;
  wlfPrice: bigint;
  connectedAddress: `0x${string}`;
  companiesHouseAddress: `0x${string}`;
  onRefetch: () => void;
}) {
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [payError, setPayError] = useState<string | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showFireConfirm, setShowFireConfirm] = useState(false);
  const [fireTxHash, setFireTxHash] = useState<`0x${string}` | undefined>();
  const [showHistory, setShowHistory] = useState(false);
  const [payHistory, setPayHistory] = useState<{ date: Date; usdt: bigint }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Tick every 5s so pending-USDT recalculates from Date.now() without a contract call
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5_000);
    return () => clearInterval(id);
  }, []);

  const { writeContract, isPending } = useWriteContract();
  const { isSuccess, isLoading: isMining } = useWaitForTransactionReceipt({ hash: txHash });

  const { writeContract: writeFire, isPending: isFirePending } = useWriteContract();
  const { isLoading: isFireMining, isSuccess: isFireSuccess } = useWaitForTransactionReceipt({ hash: fireTxHash });

  useEffect(() => { if (isFireSuccess) onRefetch(); }, [isFireSuccess]);

  const publicClient = usePublicClient();

  async function loadHistory() {
    if (!publicClient) return;
    setHistoryLoading(true);
    try {
      const logs = await publicClient.getLogs({
        address: companiesHouseAddress,
        event: employeePaidEventAbi,
        args: { employee: employee.employeeId },
        fromBlock: 0n,
        toBlock: 'latest',
      });
      const entries = await Promise.all(
        logs.slice(-20).reverse().map(async (log) => {
          const block = await publicClient.getBlock({ blockNumber: log.blockNumber! });
          return {
            date: new Date(Number(block.timestamp) * 1000),
            usdt: (log.args as { usdtAmount?: bigint }).usdtAmount ?? 0n,
          };
        })
      );
      setPayHistory(entries);
    } finally {
      setHistoryLoading(false);
    }
  }

  function handleToggleHistory() {
    if (!showHistory && payHistory.length === 0) {
      loadHistory();
    }
    setShowHistory(v => !v);
  }
  const isLoading = isPending || isMining;

  // USDT owed (6 dec)
  const totalPendingUSDT = employee.salaryItems.reduce((acc, item) => {
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    const elapsed = nowSec > item.lastPayDate ? nowSec - item.lastPayDate : 0n;
    return acc + (elapsed * item.salaryPerHour) / 3600n;
  }, 0n);

  const MIN_PAY_USDT = 1_000_000n; // 1 USDT (6 dec)
  const hasPending = totalPendingUSDT > 0n;
  const aboveMinimum = totalPendingUSDT >= MIN_PAY_USDT;
  const canPay = hasPending && aboveMinimum && companyUsdtBalance >= totalPendingUSDT + requiredReserve;
  const payTitle = !hasPending
    ? 'No pending pay'
    : !aboveMinimum
      ? `Minimum $1.00 USDT required to pay (currently $${fmtUSDT(totalPendingUSDT, 4)})`
      : canPay
        ? 'Pay salary in USDT'
        : 'USDT balance below minimum reserve threshold';

  function handlePay() {
    setPayError(null);
    writeContract(
      {
        address: companiesHouseAddress,
        abi: companiesHouseABI,
        functionName: 'payEmployee',
        args: [employee.employeeId, company.companyId],
      },
      {
        onSuccess: (hash) => setTxHash(hash),
        onError: (err) => {
          const msg = (err as { shortMessage?: string }).shortMessage ?? err.message;
          setPayError(msg);
        },
      }
    );
  }

  function handleFire() {
    writeFire(
      {
        address: companiesHouseAddress,
        abi: companiesHouseABI,
        functionName: 'fireEmployee',
        args: [employee.employeeId, company.companyId],
      },
      { onSuccess: (hash) => setFireTxHash(hash) }
    );
  }

  const roles = employee.salaryItems.map(s => s.role).join(', ') || '—';
  const totalMonthlyUSD = employee.salaryItems.reduce(
    (acc, item) => acc + Number(item.salaryPerHour * 730n) / 1_000_000,
    0
  );

  return (
    <div className={`p-3 rounded-lg ${theme.cardNested} space-y-2`}>
      {/* Employee header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-white">{employee.name}</p>
          <p className={`text-xs ${theme.textMuted}`}>{roles}</p>
          <p className={`text-xs ${theme.textMuted}`}>
            {employee.employeeId.slice(0, 6)}…{employee.employeeId.slice(-4)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <p className="text-sm font-mono text-white/80">${totalMonthlyUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}/mo</p>
          <p className={`text-xs ${theme.textMuted}`}>USDT</p>
          {isAuthorized && (
            <button
              onClick={() => setShowEditForm(v => !v)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                showEditForm
                  ? 'bg-white/15 text-white/80'
                  : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70'
              }`}
            >
              {showEditForm ? 'Cancel' : 'Edit'}
            </button>
          )}
          {isAuthorized && employee.employeeId.toLowerCase() !== connectedAddress.toLowerCase() && (
            showFireConfirm ? (
              <div className="flex items-center gap-1">
                <button onClick={handleFire} className="px-2 py-0.5 rounded text-xs font-medium bg-red-700/60 text-white hover:bg-red-600/70">
                  {isFirePending || isFireMining ? 'Firing…' : 'Confirm'}
                </button>
                <button onClick={() => setShowFireConfirm(false)} className="px-2 py-0.5 rounded text-xs text-white/40 hover:text-white/70">
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setShowFireConfirm(true)} className="px-2 py-0.5 rounded text-xs font-medium bg-white/5 text-white/40 hover:bg-red-900/30 hover:text-red-300 transition-colors">
                Fire
              </button>
            )
          )}
        </div>
      </div>

      {/* Salary items breakdown */}
      {employee.salaryItems.length > 1 && (
        <div className="space-y-0.5">
          {employee.salaryItems.map((item, i) => (
            <div key={i} className="flex justify-between text-xs text-white/50">
              <span>{item.role}</span>
              <span>${hourlyWeiToMonthlyUSD(item.salaryPerHour)}/mo</span>
            </div>
          ))}
        </div>
      )}

      {/* Pending pay + actions */}
      <div className="space-y-1.5">
        {hasPending ? (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <p className="text-sm font-mono text-green-300">
                ${fmtUSDT(totalPendingUSDT)} USDT pending
              </p>
            </div>
            {isAuthorized && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePay}
                  disabled={!canPay || isLoading}
                  title={isLoading ? (isPending ? 'Waiting for wallet…' : 'Transaction confirming…') : payTitle}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                    canPay && !isLoading
                      ? 'bg-[#8e2421] text-white hover:bg-[#a12926]'
                      : 'bg-white/5 text-white/30 cursor-not-allowed'
                  }`}
                >
                  {isLoading && (
                    <svg className="animate-spin h-3 w-3 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {isPending ? 'Confirm…' : isMining ? 'Processing…' : `Pay ${employee.name.split(' ')[0]}`}
                </button>
                <span
                  title="WLF payment option is coming in a future version"
                  className="px-2 py-0.5 rounded text-xs bg-white/5 text-white/20 cursor-not-allowed select-none"
                >
                  WLF soon™
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className={`text-xs ${theme.textMuted}`}>No pending pay yet</p>
        )}
        {payError && (
          <p className="text-xs text-red-400 break-words">{payError}</p>
        )}
      </div>

      {isSuccess && (
        <p className="text-xs text-green-400">Payment sent successfully.</p>
      )}

      {employee.employeeId.toLowerCase() === connectedAddress.toLowerCase() && (
        <MyWalletPanel address={connectedAddress} wlfPrice={wlfPrice} />
      )}

      {showEditForm && (
        <EditEmployeeForm
          employee={employee}
          company={company}
          companiesHouseAddress={companiesHouseAddress}
          onSaved={() => { setShowEditForm(false); onRefetch(); }}
          onCancel={() => setShowEditForm(false)}
        />
      )}

      {/* Payment History */}
      <div className="pt-1">
        <button
          onClick={handleToggleHistory}
          className={`text-xs transition-colors ${showHistory ? 'text-white/60' : 'text-white/30 hover:text-white/60'}`}
        >
          Payment History {showHistory ? '▴' : '▾'}
        </button>
        {showHistory && (
          <div className="mt-2 pt-2 border-t border-white/10">
            {historyLoading ? (
              <p className="text-xs text-white/40">Loading…</p>
            ) : payHistory.length === 0 ? (
              <p className="text-xs text-white/40">No payments recorded.</p>
            ) : (
              <div className="space-y-0.5">
                {payHistory.map((entry, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-white/50">{entry.date.toLocaleDateString()}</span>
                    <span className="font-mono text-green-300">${fmtUSDT(entry.usdt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── HireEmployeeForm ─────────────────────────────────────────────────────────

function HireEmployeeForm({
  company,
  companiesHouseAddress,
  onHired,
}: {
  company: Company;
  companiesHouseAddress: `0x${string}`;
  onHired: () => void;
}) {
  const [address, setAddress] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState(company.roles[0] ?? '');
  const [monthlyUSD, setMonthlyUSD] = useState('');
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { writeContract, isPending } = useWriteContract();
  const { isLoading: isWaiting, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const isHiring = isPending || isWaiting;

  useEffect(() => {
    if (isSuccess) { onHired(); setAddress(''); setName(''); setMonthlyUSD(''); }
  }, [isSuccess]);

  function handleHire() {
    if (!address.startsWith('0x') || !name || !role || !monthlyUSD) return;
    const salaryPerHour = monthlyUSDToHourlyWei(monthlyUSD);
    writeContract(
      {
        address: companiesHouseAddress,
        abi: companiesHouseABI,
        functionName: 'hireEmployee',
        args: [{
          employeeAddress: address as `0x${string}`,
          name,
          companyId: company.companyId,
          salaryItems: [{ role, salaryPerHour, lastPayDate: 0n }],
        }],
      },
      { onSuccess: (hash) => setTxHash(hash) }
    );
  }

  return (
    <div className={`p-4 rounded-lg ${theme.cardNested} space-y-3`}>
      <p className="font-semibold text-white/80">Hire Employee</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          className={`${theme.input} col-span-full`}
          placeholder="Wallet address (0x…)"
          value={address}
          onChange={e => setAddress(e.target.value)}
        />
        <input
          className={theme.input}
          placeholder="Full name"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <select
          className={theme.input}
          value={role}
          onChange={e => setRole(e.target.value)}
        >
          {company.roles.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
          <input
            className={`${theme.input} pl-7`}
            placeholder="Monthly salary (USD)"
            type="number"
            min="0"
            value={monthlyUSD}
            onChange={e => setMonthlyUSD(e.target.value)}
          />
        </div>
        {monthlyUSD && (
          <p className={`text-xs self-center ${theme.textMuted}`}>
            ≈ ${hourlyWeiToMonthlyUSD(monthlyUSDToHourlyWei(monthlyUSD))}/mo → {(parseFloat(monthlyUSD) / 730).toFixed(4)}/hr USDT
          </p>
        )}
      </div>
      <button
        onClick={handleHire}
        disabled={isHiring || !address || !name || !monthlyUSD}
        className={`${theme.btnPrimary} px-4 py-2 text-sm disabled:opacity-40 flex items-center gap-2`}
      >
        {isHiring && (
          <svg className="animate-spin h-3 w-3 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {isHiring ? 'Hiring…' : 'Hire Employee'}
      </button>
      {isSuccess && <p className="text-xs text-green-400">Employee hired.</p>}
    </div>
  );
}

// ─── EditEmployeeForm ─────────────────────────────────────────────────────────

function EditEmployeeForm({
  employee,
  company,
  companiesHouseAddress,
  onSaved,
  onCancel,
}: {
  employee: Employee;
  company: Company;
  companiesHouseAddress: `0x${string}`;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(employee.name);
  const [payableAddress, setPayableAddress] = useState(employee.payableAddress);
  const [salaryItems, setSalaryItems] = useState<{ role: string; monthlyUSD: string }[]>(
    employee.salaryItems.map(item => ({
      role: item.role,
      monthlyUSD: hourlyWeiToMonthlyUSD(item.salaryPerHour),
    }))
  );
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { writeContract, isPending } = useWriteContract();
  const { isLoading: isWaiting, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const isSaving = isPending || isWaiting;

  useEffect(() => { if (isSuccess) onSaved(); }, [isSuccess]);

  function updateItem(idx: number, field: 'role' | 'monthlyUSD', value: string) {
    setSalaryItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }
  function removeItem(idx: number) {
    setSalaryItems(prev => prev.filter((_, i) => i !== idx));
  }
  function addItem() {
    setSalaryItems(prev => [...prev, { role: company.roles[0] ?? '', monthlyUSD: '' }]);
  }

  function handleSave() {
    if (!name.trim() || salaryItems.length === 0) return;
    writeContract(
      {
        address: companiesHouseAddress,
        abi: companiesHouseABI,
        functionName: 'updateEmployee',
        args: [
          employee.employeeId,
          company.companyId,
          {
            name: name.trim(),
            payableAddress: payableAddress as `0x${string}`,
            salaryItems: salaryItems.map(item => ({
              role: item.role,
              salaryPerHour: monthlyUSDToHourlyWei(item.monthlyUSD),
              lastPayDate: 0n,
            })),
          },
        ],
        gas: 500_000n,
      },
      { onSuccess: (hash) => setTxHash(hash) }
    );
  }

  return (
    <div className={`p-4 rounded-lg ${theme.cardNested} space-y-4`}>
      <p className="font-semibold text-white/80">Edit Employee</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={`block text-xs mb-1 ${theme.textMuted}`}>Name *</label>
          <input className={theme.input} value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className={`block text-xs mb-1 ${theme.textMuted}`}>Payable Address</label>
          <input className={`${theme.input} font-mono text-xs`} value={payableAddress} onChange={e => setPayableAddress(e.target.value as `0x${string}`)} />
        </div>
      </div>

      <div>
        <label className={`block text-xs mb-2 ${theme.textMuted}`}>Salary Streams</label>
        <div className="space-y-2">
          {salaryItems.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                className={`${theme.input} flex-1`}
                value={item.role}
                onChange={e => updateItem(i, 'role', e.target.value)}
              >
                {(company.roles as string[]).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
                <input
                  className={`${theme.input} pl-7`}
                  placeholder="Monthly USD"
                  type="number"
                  min="0"
                  value={item.monthlyUSD}
                  onChange={e => updateItem(i, 'monthlyUSD', e.target.value)}
                />
              </div>
              <button
                onClick={() => removeItem(i)}
                disabled={salaryItems.length === 1}
                className="shrink-0 px-2 py-1.5 rounded text-xs text-white/40 hover:text-red-400 disabled:opacity-20"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addItem}
          className="mt-2 text-xs text-white/50 hover:text-white/80 transition-colors"
        >
          + Add Salary Stream
        </button>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={handleSave}
          disabled={isSaving || !name.trim() || salaryItems.length === 0}
          className={`${theme.btnPrimary} px-4 py-2 text-sm disabled:opacity-40 flex items-center gap-2`}
        >
          {isSaving && (
            <svg className="animate-spin h-3 w-3 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {isSaving ? 'Saving…' : 'Save Changes'}
        </button>
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="px-4 py-2 rounded text-sm text-white/50 hover:text-white/80 disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── EditCompanyForm ──────────────────────────────────────────────────────────

function EditCompanyForm({
  company,
  companiesHouseAddress,
  onSaved,
  onCancel,
}: {
  company: Company;
  companiesHouseAddress: `0x${string}`;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(company.name);
  const [industry, setIndustry] = useState(company.industry);
  const [domain, setDomain] = useState(company.domain);
  const [wallet, setWallet] = useState(company.companyWallet);
  const [roles, setRoles] = useState<string[]>([...company.roles]);
  const [powerRoles, setPowerRoles] = useState<string[]>([...company.powerRoles]);
  const [newRole, setNewRole] = useState('');
  const [newPowerRole, setNewPowerRole] = useState('');
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { writeContract, isPending } = useWriteContract();
  const { isLoading: isWaiting, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const isSaving = isPending || isWaiting;

  useEffect(() => { if (isSuccess) onSaved(); }, [isSuccess]);

  function addRole() {
    const r = newRole.trim();
    if (r && !roles.includes(r)) { setRoles([...roles, r]); }
    setNewRole('');
  }
  function removeRole(r: string) { setRoles(roles.filter(x => x !== r)); }

  function addPowerRole() {
    const r = newPowerRole.trim();
    if (r && !powerRoles.includes(r)) { setPowerRoles([...powerRoles, r]); }
    setNewPowerRole('');
  }
  function removePowerRole(r: string) { setPowerRoles(powerRoles.filter(x => x !== r)); }

  function handleSave() {
    if (!name.trim()) return;
    writeContract(
      {
        address: companiesHouseAddress,
        abi: companiesHouseABI,
        functionName: 'updateCompany',
        args: [company.companyId, {
          name: name.trim(),
          industry: industry.trim(),
          domain: domain.trim(),
          roles,
          powerRoles,
          companyWallet: wallet as `0x${string}`,
        }],
        gas: 500_000n,
      },
      { onSuccess: (hash) => setTxHash(hash) }
    );
  }

  return (
    <div className={`p-4 rounded-lg ${theme.cardNested} space-y-4`}>
      <p className="font-semibold text-white/80">Edit Company</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={`block text-xs mb-1 ${theme.textMuted}`}>Name *</label>
          <input className={theme.input} value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className={`block text-xs mb-1 ${theme.textMuted}`}>Industry</label>
          <input className={theme.input} value={industry} onChange={e => setIndustry(e.target.value)} />
        </div>
        <div>
          <label className={`block text-xs mb-1 ${theme.textMuted}`}>Domain</label>
          <input className={theme.input} value={domain} onChange={e => setDomain(e.target.value)} />
        </div>
        <div>
          <label className={`block text-xs mb-1 ${theme.textMuted}`}>Company Wallet</label>
          <input className={`${theme.input} font-mono text-xs`} value={wallet} onChange={e => setWallet(e.target.value as `0x${string}`)} />
        </div>
      </div>

      {/* Roles */}
      <div>
        <label className={`block text-xs mb-1 ${theme.textMuted}`}>Roles</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {roles.map(r => (
            <span key={r} className="flex items-center gap-1 px-2 py-0.5 rounded bg-white/10 text-xs text-white/80">
              {r}
              <button onClick={() => removeRole(r)} className="text-white/40 hover:text-red-400 leading-none">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className={`${theme.input} flex-1`}
            placeholder="New role"
            value={newRole}
            onChange={e => setNewRole(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRole(); } }}
          />
          <button
            onClick={addRole}
            disabled={!newRole.trim()}
            className="px-3 py-1.5 rounded text-xs bg-white/10 text-white/70 hover:bg-white/20 disabled:opacity-40"
          >
            + Add
          </button>
        </div>
      </div>

      {/* Power Roles */}
      <div>
        <label className={`block text-xs mb-1 ${theme.textMuted}`}>Power Roles (admin access)</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {powerRoles.map(r => (
            <span key={r} className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-900/40 border border-amber-700/40 text-xs text-amber-300">
              {r}
              <button onClick={() => removePowerRole(r)} className="text-amber-400/60 hover:text-red-400 leading-none">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className={`${theme.input} flex-1`}
            placeholder="New power role"
            value={newPowerRole}
            onChange={e => setNewPowerRole(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPowerRole(); } }}
          />
          <button
            onClick={addPowerRole}
            disabled={!newPowerRole.trim()}
            className="px-3 py-1.5 rounded text-xs bg-amber-900/30 text-amber-300 hover:bg-amber-900/50 disabled:opacity-40"
          >
            + Add
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={handleSave}
          disabled={isSaving || !name.trim()}
          className={`${theme.btnPrimary} px-4 py-2 text-sm disabled:opacity-40 flex items-center gap-2`}
        >
          {isSaving && (
            <svg className="animate-spin h-3 w-3 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {isSaving ? 'Saving…' : 'Save Changes'}
        </button>
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="px-4 py-2 rounded text-sm text-white/50 hover:text-white/80 disabled:opacity-40"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── CompanyCard ──────────────────────────────────────────────────────────────

function CompanyCard({
  companyId,
  address,
  companiesHouseAddress,
  usdtAddress,
  wlfAddress,
  wlfPrice,
  onRefetch,
}: {
  companyId: bigint;
  address: `0x${string}`;
  companiesHouseAddress: `0x${string}`;
  usdtAddress: `0x${string}` | undefined;
  wlfAddress: `0x${string}` | undefined;
  wlfPrice: bigint;
  onRefetch: () => void;
}) {
  const [showHireForm, setShowHireForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [showDepositWlfForm, setShowDepositWlfForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTxHash, setDeleteTxHash] = useState<`0x${string}` | undefined>();
  const [payAllTxHash, setPayAllTxHash] = useState<`0x${string}` | undefined>();
  const [payAllError, setPayAllError] = useState<string | null>(null);
  const [copiedWallet, setCopiedWallet] = useState(false);
  const { writeContract: writePayAll, isPending: isPayAllPending } = useWriteContract();
  const { isSuccess: isPayAllSuccess, isLoading: isPayAllMining } = useWaitForTransactionReceipt({ hash: payAllTxHash });
  const isPayAllLoading = isPayAllPending || isPayAllMining;

  useEffect(() => { if (isPayAllSuccess) { refetchCompany(); setPayAllError(null); } }, [isPayAllSuccess]);

  const { writeContract: writeDelete, isPending: isDeletePending } = useWriteContract();
  const { isLoading: isDeleteMining, isSuccess: isDeleteSuccess } = useWaitForTransactionReceipt({ hash: deleteTxHash });

  useEffect(() => { if (isDeleteSuccess) onRefetch(); }, [isDeleteSuccess]);

  const { data: company, refetch: refetchCompany } = useReadContract({
    address: companiesHouseAddress,
    abi: companiesHouseABI,
    functionName: 'retrieveCompany',
    args: [companyId],
    query: { refetchInterval: 5_000 },
  });

  const { data: monthlyBurnUSDT, refetch: refetchMonthly } = useReadContract({
    address: companiesHouseAddress,
    abi: companiesHouseABI,
    functionName: 'getMonthlyBurnUSDT',
    args: [companyId],
    query: { refetchInterval: 30_000 },
  });

  const { data: requiredReserveUSDT, refetch: refetchReserve } = useReadContract({
    address: companiesHouseAddress,
    abi: companiesHouseABI,
    functionName: 'getRequiredReserveUSDT',
    args: [companyId],
    query: { refetchInterval: 30_000 },
  });

  const { data: companyUSDTBalance, refetch: refetchBalance } = useReadContract({
    address: companiesHouseAddress,
    abi: companiesHouseABI,
    functionName: 'companyTokenBalances',
    args: [companyId, usdtAddress ?? '0x0000000000000000000000000000000000000000'],
    query: { enabled: !!usdtAddress, refetchInterval: 5_000 },
  });

  const { data: companyWLFBalance, refetch: refetchWlfBalance } = useReadContract({
    address: companiesHouseAddress,
    abi: companiesHouseABI,
    functionName: 'companyTokenBalances',
    args: [companyId, wlfAddress ?? '0x0000000000000000000000000000000000000000'],
    query: { enabled: !!wlfAddress, refetchInterval: 5_000 },
  });

  const { data: minReserveMonthsData } = useReadContract({
    address: companiesHouseAddress,
    abi: companiesHouseABI,
    functionName: 'minReserveMonths',
    query: { refetchInterval: 60_000 },
  });
  const minResMo = minReserveMonthsData !== undefined ? Number(minReserveMonthsData) : undefined;

  function refetchAll() {
    refetchCompany();
    refetchMonthly();
    refetchReserve();
    refetchBalance();
    refetchWlfBalance();
  }

  function handleDelete() {
    writeDelete(
      {
        address: companiesHouseAddress,
        abi: companiesHouseABI,
        functionName: 'deleteCompany',
        args: [companyId],
      },
      { onSuccess: (hash) => setDeleteTxHash(hash) }
    );
  }

  const zeroAddr = '0x0000000000000000000000000000000000000000';
  const walletAddr = company?.companyWallet !== zeroAddr ? company?.companyWallet : undefined;
  const { data: walletBalance } = useBalance({
    address: walletAddr,
    query: { enabled: !!walletAddr, refetchInterval: 5_000 },
  });

  if (!company) {
    return (
      <div className={`${theme.card} p-6 animate-pulse`}>
        <div className="h-5 bg-white/10 rounded w-1/3 mb-2" />
        <div className="h-3 bg-white/5 rounded w-2/3" />
      </div>
    );
  }

  // Authorized if: company owner, company wallet, or active employee with a power role
  const addrLower = address.toLowerCase();
  const isAuthorized =
    company.owner.toLowerCase() === addrLower ||
    company.companyWallet.toLowerCase() === addrLower ||
    company.employees.some(
      e =>
        e.active &&
        e.employeeId.toLowerCase() === addrLower &&
        e.salaryItems.some(s => (company.powerRoles as readonly string[]).includes(s.role))
    );
  const activeEmployees = company.employees.filter(e => e.active);

  const companyBalance = companyUSDTBalance ?? 0n;
  const companyWlfBal = companyWLFBalance ?? 0n;
  const reserve = requiredReserveUSDT ?? 0n;
  const monthly = monthlyBurnUSDT ?? 0n;

  // Runway = how many months the company can pay at current burn rate
  const runwayMonths = monthly > 0n ? Number(companyBalance / monthly) : null;
  const runwayColor =
    runwayMonths === null ? theme.textMuted :
    runwayMonths > 60 ? 'text-green-400' :
    runwayMonths > 12 ? 'text-yellow-400' :
    'text-red-400';

  // Can pay all: company balance must exceed reserve after paying everyone
  const MIN_PAY_USDT = 1_000_000n; // 1 USDT (6 dec)
  const totalPendingAllUSDT = activeEmployees.reduce((acc, emp) => {
    return acc + emp.salaryItems.reduce((a, item) => {
      const nowSec = BigInt(Math.floor(Date.now() / 1000));
      const elapsed = nowSec > item.lastPayDate ? nowSec - item.lastPayDate : 0n;
      return a + (elapsed * item.salaryPerHour) / 3600n;
    }, 0n);
  }, 0n);
  const allAboveMinimum = activeEmployees.length > 0 && activeEmployees.every(emp => {
    const pending = emp.salaryItems.reduce((a, item) => {
      const nowSec = BigInt(Math.floor(Date.now() / 1000));
      const elapsed = nowSec > item.lastPayDate ? nowSec - item.lastPayDate : 0n;
      return a + (elapsed * item.salaryPerHour) / 3600n;
    }, 0n);
    return pending >= MIN_PAY_USDT;
  });
  const canPayAll = allAboveMinimum && companyBalance >= totalPendingAllUSDT + reserve;

  return (
    <div className={`${theme.card} space-y-4`}>
      {/* Company header */}
      <div className="p-5 border-b border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">{company.name}</h2>
            <p className={`text-sm ${theme.textMuted}`}>{company.industry} · {company.domain}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${company.active ? 'bg-green-900/40 text-green-300' : 'bg-red-900/30 text-red-400'}`}>
              {company.active ? 'Active' : 'Inactive'}
            </span>
            {company.owner.toLowerCase() === addrLower && (
              <>
                <button
                  onClick={() => setShowEditForm(v => !v)}
                  className={`px-2.5 py-0.5 rounded text-xs font-medium transition-colors ${
                    showEditForm
                      ? 'bg-white/15 text-white/80'
                      : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80'
                  }`}
                >
                  {showEditForm ? 'Cancel Edit' : 'Edit'}
                </button>
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-1">
                    <button onClick={handleDelete} className="px-2.5 py-0.5 rounded text-xs font-medium bg-red-700/60 text-white hover:bg-red-600/70">
                      {isDeletePending || isDeleteMining ? 'Deleting…' : 'Confirm Delete'}
                    </button>
                    <button onClick={() => setShowDeleteConfirm(false)} className="px-2.5 py-0.5 rounded text-xs text-white/40 hover:text-white/70">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setShowDeleteConfirm(true)} className="px-2.5 py-0.5 rounded text-xs font-medium bg-white/5 text-red-400/50 hover:bg-red-900/30 hover:text-red-300 transition-colors">
                    Delete
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Company wallet + live ETH balance */}
        <div className="mt-2 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs ${theme.textMuted} shrink-0`}>Company wallet:</span>
            {company.companyWallet === zeroAddr ? (
              <span className="text-xs text-yellow-400">Not set</span>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                <span className="text-xs font-mono text-white/70 break-all">
                  {company.companyWallet}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(company.companyWallet);
                    setCopiedWallet(true);
                    setTimeout(() => setCopiedWallet(false), 2000);
                  }}
                  className={`shrink-0 text-xs px-1.5 py-0.5 rounded transition-colors ${
                    copiedWallet
                      ? 'bg-green-800/50 text-green-300'
                      : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70'
                  }`}
                >
                  {copiedWallet ? '✓ Copied' : 'Copy'}
                </button>
                {walletBalance !== undefined && (
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/60">
                    {Number(formatEther(walletBalance.value)).toLocaleString(undefined, { maximumFractionDigits: 4 })} ETH
                  </span>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Treasury summary */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className={`p-3 rounded-lg ${theme.cardNested}`}>
            <p className={`text-xs ${theme.textMuted} mb-0.5`}>Company USDT balance</p>
            <p className="font-mono text-white text-sm">${fmtUSDT(companyBalance)} USDT</p>
            {runwayMonths !== null && (
              <p className={`text-xs mt-0.5 ${runwayColor}`}>
                ~{runwayMonths} months runway
              </p>
            )}
            {companyWlfBal > 0n && (
              <p className={`text-xs mt-1 ${theme.textMuted}`}>
                WLF: {fmtWLF(companyWlfBal)}
                {wlfPrice > 0n && <> (≈${fmtUSDT((companyWlfBal * wlfPrice) / 10n ** 30n)})</>}
              </p>
            )}
          </div>
          <div className={`p-3 rounded-lg ${theme.cardNested}`}>
            <p className={`text-xs ${theme.textMuted} mb-0.5`}>Monthly payroll</p>
            <p className="font-mono text-white text-sm">${fmtUSDT(monthly)} USDT</p>
            {reserve > 0n ? (
              <div className={`text-xs mt-1 space-y-0.5 ${theme.textMuted}`}>
                <p>
                  Min reserve:{' '}
                  <span className="text-white/70 font-mono">${fmtUSDT(reserve)} USDT</span>
                  {monthly > 0n && (
                    <span className="ml-1">
                      · {fmtMonths(Math.floor(Number(reserve / monthly)))}
                    </span>
                  )}
                </p>
                {wlfPrice > 0n && (
                  <p>
                    ≈{' '}
                    <span className="text-white/70 font-mono">
                      {fmtWLF(usdtToWlf(reserve, wlfPrice))} WLF
                    </span>
                  </p>
                )}
              </div>
            ) : (
              <p className={`text-xs mt-0.5 ${theme.textMuted}`}>No reserve configured</p>
            )}
          </div>
        </div>

        {/* Company details */}
        <div className={`mt-3 px-3 py-2.5 rounded-lg ${theme.cardNested} text-xs space-y-1.5`}>
          <div className="flex items-center justify-between gap-2">
            <span className={theme.textMuted}>Registered</span>
            <span className="font-mono text-white/70">
              {new Date(Number(company.createdAt) * 1000).toLocaleDateString()}
            </span>
          </div>
          {company.domain && (
            <div className="flex items-center justify-between gap-2">
              <span className={theme.textMuted}>Domain</span>
              <span className="text-white/70">{company.domain}</span>
            </div>
          )}
          {company.roles.length > 0 && (
            <div className="flex items-start justify-between gap-2">
              <span className={`${theme.textMuted} shrink-0`}>Roles</span>
              <span className="text-white/70 text-right">{(company.roles as string[]).join(', ')}</span>
            </div>
          )}
          {company.powerRoles.length > 0 && (
            <div className="flex items-start justify-between gap-2">
              <span className={`${theme.textMuted} shrink-0`}>Power roles</span>
              <span className="text-white/70 text-right">{(company.powerRoles as string[]).join(', ')}</span>
            </div>
          )}
        </div>

        {/* Reserve warning */}
        {companyBalance < reserve && monthly > 0n && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-red-900/20 border border-red-700/40 text-xs text-red-300">
            <span className="shrink-0 mt-0.5">⛔</span>
            <span>
              Company USDT balance is below the minimum reserve ({fmtUSDT(reserve)} USDT required for {reserve / (monthly > 0n ? monthly : 1n)} months).
              Payments are blocked until the treasury is funded.
            </span>
          </div>
        )}

        {/* Payment diagnostics */}
        {activeEmployees.length > 0 && (() => {
          const usdtNeeded = totalPendingAllUSDT + reserve;
          const reserveMonths = monthly > 0n ? Math.floor(Number(reserve / monthly)) : 0;
          const usdtOk = companyBalance >= usdtNeeded;
          return (
            <div className={`mt-3 px-3 py-2.5 rounded-lg ${theme.cardNested} text-xs space-y-1.5`}>
              <p className={`font-semibold ${theme.textMuted} uppercase tracking-wide`} style={{ fontSize: '0.65rem' }}>
                Payment diagnostics
              </p>
              {minResMo !== undefined && (
                <div className={`flex items-center justify-between gap-2 ${theme.textMuted}`}>
                  <span>Min reserve</span>
                  <span className="font-mono">{fmtMonths(minResMo)}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className={theme.textMuted}>Pay in USDT</span>
                <span className={`font-mono ${usdtOk ? 'text-green-400' : 'text-red-400'}`}>
                  ${fmtUSDT(companyBalance)} / ${fmtUSDT(usdtNeeded)} {usdtOk ? '✓' : '✗'}
                </span>
              </div>
              {monthly > 0n && (
                <div className={`flex items-center justify-between gap-2 ${theme.textMuted}`}>
                  <span>Reserve ({reserveMonths} months)</span>
                  <span className="font-mono">${fmtUSDT(reserve)} USDT</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2 text-white/20">
                <span>Pay in WLF</span>
                <span>coming soon</span>
              </div>
            </div>
          );
        })()}

        {/* Edit company form */}
        {showEditForm && (
          <div className="mt-3">
            <EditCompanyForm
              company={{ ...company, companyId } as Company}
              companiesHouseAddress={companiesHouseAddress}
              onSaved={() => { setShowEditForm(false); refetchAll(); onRefetch(); }}
              onCancel={() => setShowEditForm(false)}
            />
          </div>
        )}

        {/* Deposit buttons */}
        <div className="mt-3 space-y-2">
          {showDepositForm ? (
            <DepositUSDTForm
              companyId={companyId}
              companiesHouseAddress={companiesHouseAddress}
              usdtAddress={usdtAddress}
              onDeposited={() => { refetchBalance(); setShowDepositForm(false); }}
            />
          ) : showDepositWlfForm ? (
            <DepositWLFForm
              companyId={companyId}
              companiesHouseAddress={companiesHouseAddress}
              wlfAddress={wlfAddress}
              onDeposited={() => { refetchWlfBalance(); setShowDepositWlfForm(false); }}
            />
          ) : (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setShowDepositForm(true)}
                className={`${theme.btnSecondary} px-4 py-2 text-xs`}
              >
                + Deposit USDT
              </button>
              <button
                onClick={() => setShowDepositWlfForm(true)}
                className={`${theme.btnSecondary} px-4 py-2 text-xs`}
              >
                + Deposit WLF
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Employees */}
      <div className="px-5 pb-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-semibold text-white/80 text-sm">
              Employees ({activeEmployees.length})
            </p>
            {activeEmployees.length > 0 && totalPendingAllUSDT > 0n && (
              <p className="text-xs text-white/40 mt-0.5">
                Total pending: ${fmtUSDT(totalPendingAllUSDT)} USDT
              </p>
            )}
          </div>
          {isAuthorized && activeEmployees.length > 0 && (
            <button
              onClick={() =>
                writePayAll(
                  {
                    address: companiesHouseAddress,
                    abi: companiesHouseABI,
                    functionName: 'payEmployees',
                    args: [companyId],
                  },
                  {
                    onSuccess: (hash) => { setPayAllError(null); setPayAllTxHash(hash); },
                    onError: (err) => {
                      const msg = (err as { shortMessage?: string }).shortMessage ?? err.message;
                      setPayAllError(msg);
                    },
                  }
                )
              }
              disabled={isPayAllLoading || !canPayAll}
              title={
                isPayAllLoading
                  ? (isPayAllPending ? 'Waiting for wallet…' : 'Transaction confirming…')
                  : canPayAll
                    ? 'Pay all employees in USDT'
                    : !allAboveMinimum
                      ? 'All employees must have at least $1.00 USDT pending before paying'
                      : `USDT balance below minimum ${monthly > 0n && reserve > 0n ? fmtMonths(Math.floor(Number(reserve / monthly))) : 'reserve'} threshold`
              }
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                isPayAllLoading || !canPayAll
                  ? 'bg-white/5 text-white/30 cursor-not-allowed'
                  : 'bg-[#8e2421] text-white hover:bg-[#a12926]'
              }`}
            >
              {isPayAllLoading && (
                <svg className="animate-spin h-3 w-3 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {isPayAllPending ? 'Confirm…' : isPayAllMining ? 'Processing…' : 'Pay All'}
            </button>
          )}
        </div>
        {isPayAllSuccess && (
          <p className="text-xs text-green-400">All employees paid successfully.</p>
        )}
        {payAllError && (
          <p className="text-xs text-red-400 break-words">{payAllError}</p>
        )}

        {activeEmployees.length === 0 && (
          <p className={`text-sm ${theme.textMuted}`}>No employees yet.</p>
        )}

        {activeEmployees.map((emp, idx) => (
          <EmployeeCard
            key={`${emp.employeeId}-${idx}`}
            employee={emp}
            company={{ ...company, companyId } as Company}
            isAuthorized={isAuthorized}
            companyUsdtBalance={companyBalance}
            requiredReserve={reserve}
            wlfPrice={wlfPrice}
            connectedAddress={address}
            companiesHouseAddress={companiesHouseAddress}
            onRefetch={refetchAll}
          />
        ))}

        {isAuthorized && (
          <div className="pt-1">
            {showHireForm ? (
              <HireEmployeeForm
                company={{ ...company, companyId } as Company}
                companiesHouseAddress={companiesHouseAddress}
                onHired={() => { setShowHireForm(false); refetchAll(); onRefetch(); }}
              />
            ) : (
              <button
                onClick={() => setShowHireForm(true)}
                className={`${theme.btnSecondary} px-4 py-2 text-sm`}
              >
                + Hire Employee
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

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
          companyWallet: address,
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Companies() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const wlfPriceHuman = useWLFPrice();
  const wlfPrice = wlfPriceHuman !== null ? BigInt(Math.round(wlfPriceHuman * 1e18)) : 0n;

  const companiesHouseAddress = getAddress(chainId, 'CompaniesHouse');
  const wlfAddress = getAddress(chainId, 'WerewolfToken');
  const usdtAddress = getAddress(chainId, 'USDT');

  const [showCreateForm, setShowCreateForm] = useState(false);

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
            Register and manage your on-chain business. Salaries are denominated in USD and paid in WLF — from the company's WLF balance or bought via Uniswap.
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

      {ids.length === 0 && !showCreateForm && (
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

      {ids.map((id) => (
        <CompanyCard
          key={id}
          companyId={id}
          address={address!}
          companiesHouseAddress={companiesHouseAddress}
          usdtAddress={usdtAddress}
          wlfAddress={wlfAddress}
          wlfPrice={wlfPrice}
          onRefetch={refetchIds}
        />
      ))}
    </main>
  );
}
