import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAccount, useBalance, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { formatEther, parseUnits } from 'viem';
import { theme } from '@/contexts/ThemeContext';
import { companiesHouseABI, payrollExecutorABI, erc20ABI, getAddress } from '@/contracts';
import { useWLFPrice } from '@/hooks/useWLFPrice';
import { monthlyUSDToHourlyWei, hourlyWeiToMonthlyUSD, fmtUSDT, fmtWLF, usdtToWlf, fmtMonths } from '@/utils/formatters';

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
  operatorAddress: `0x${string}`;
  industry: string;
  name: string;
  createdAt: bigint;
  active: boolean;
  employees: readonly Employee[];
  domain: string;
  roles: readonly { name: string; level: number }[];
};

type PayrollPreviewItem = {
  employeeAddress: `0x${string}`;
  name: string;
  grossUSDT: bigint;
  fee: bigint;
  netUSDT: bigint;
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
  myLevel,
  companyUsdtBalance,
  requiredReserve,
  wlfPrice,
  connectedAddress,
  companiesHouseAddress,
  payrollExecutorAddress,
  nonWlfFeeBps,
  wlfFeeBps,
  onRefetch,
}: {
  employee: Employee;
  company: Company;
  myLevel: number;
  companyUsdtBalance: bigint;
  requiredReserve: bigint;
  wlfPrice: bigint;
  connectedAddress: `0x${string}`;
  companiesHouseAddress: `0x${string}`;
  payrollExecutorAddress: `0x${string}` | undefined;
  nonWlfFeeBps: bigint;
  wlfFeeBps: bigint;
  onRefetch: () => void;
}) {
  // Effective level of this employee (min role level across all salary streams; 99 = no role)
  const empLevel = (() => {
    const levels = employee.salaryItems
      .map(s => company.roles.find(r => r.name === s.role)?.level ?? 0)
      .filter(l => l > 0);
    return levels.length > 0 ? Math.min(...levels) : 99;
  })();

  const canManage = myLevel > 0 && myLevel < empLevel; // STRICT: outrank target
  const canPayOrSubmit = myLevel > 0 && myLevel <= empLevel; // LENIENT: same or above
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [payError, setPayError] = useState<string | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showFireConfirm, setShowFireConfirm] = useState(false);
  const [fireTxHash, setFireTxHash] = useState<`0x${string}` | undefined>();
  const [showHistory, setShowHistory] = useState(false);
  const [payHistory, setPayHistory] = useState<{ date: Date; usdt: bigint }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showSubmitEarning, setShowSubmitEarning] = useState(false);
  const [earningType, setEarningType] = useState<1 | 2 | 3 | 4>(2); // default BONUS
  const [earningAmountStr, setEarningAmountStr] = useState('');
  const [earningDesc, setEarningDesc] = useState('');
  const [earningTxHash, setEarningTxHash] = useState<`0x${string}` | undefined>();
  const [earningError, setEarningError] = useState<string | null>(null);

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

  const { writeContract: writeEarning, isPending: isEarningPending } = useWriteContract();
  const { isLoading: isEarningMining, isSuccess: isEarningSuccess } = useWaitForTransactionReceipt({ hash: earningTxHash });

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

  async function handlePay() {
    setPayError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (publicClient!.simulateContract as any)({
        address: payrollExecutorAddress ?? companiesHouseAddress,
        abi: payrollExecutorABI,
        functionName: 'payEmployee',
        args: [employee.employeeId, company.companyId],
        account: connectedAddress,
      });
      writeContract(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { ...result.request, gas: result.request.gas ? result.request.gas * 12n / 10n : undefined } as any,
        {
          onSuccess: (hash) => setTxHash(hash),
          onError: (err) => {
            const msg = (err as { shortMessage?: string }).shortMessage ?? err.message;
            setPayError(msg);
          },
        }
      );
    } catch (err: unknown) {
      const msg =
        (err as { shortMessage?: string }).shortMessage ??
        (err as { message?: string }).message ??
        'Simulation failed';
      setPayError(msg);
    }
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

  function handleSubmitEarning() {
    setEarningError(null);
    const amount = parseUnits(earningAmountStr || '0', 6);
    if (amount === 0n) { setEarningError('Amount must be greater than 0'); return; }
    writeEarning(
      {
        address: companiesHouseAddress,
        abi: companiesHouseABI,
        functionName: 'submitEarning',
        args: [employee.employeeId, company.companyId, earningType, amount, earningDesc],
      },
      {
        onSuccess: (hash) => { setEarningTxHash(hash); },
        onError: (err) => setEarningError((err as { shortMessage?: string }).shortMessage ?? err.message),
      }
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
          {canManage && (
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
          {canManage && employee.employeeId.toLowerCase() !== connectedAddress.toLowerCase() && (
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
            {canPayOrSubmit && (
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
                  title={`WLF payment option is coming in a future version (${Number(wlfFeeBps) / 100}% fee)`}
                  className="px-2 py-0.5 rounded text-xs bg-white/5 text-white/20 cursor-not-allowed select-none"
                >
                  WLF soon™
                </span>
              </div>
            )}
            {canPayOrSubmit && canPay && nonWlfFeeBps > 0n && (
              <p className="text-xs text-white/25 mt-1">
                Fee: ${fmtUSDT(totalPendingUSDT * nonWlfFeeBps / 10_000n)} USDT ({Number(nonWlfFeeBps) / 100}%) → employee receives ${fmtUSDT(totalPendingUSDT * (10_000n - nonWlfFeeBps) / 10_000n)}
              </p>
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

      {/* Submit Earning (authorized users only) */}
      {canPayOrSubmit && (
        <div className="pt-2 border-t border-white/5">
          <button
            onClick={() => setShowSubmitEarning(v => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
              showSubmitEarning
                ? 'bg-white/15 border-white/20 text-white/90'
                : 'bg-white/8 border-white/15 text-white/60 hover:bg-white/12 hover:text-white/80'
            }`}
          >
            + Submit Earning {showSubmitEarning ? '▴' : '▾'}
          </button>
          {showSubmitEarning && (
            <div className="mt-2 space-y-2">
              <div className="flex gap-2 flex-wrap items-center">
                <div className="relative">
                  <select
                    value={earningType}
                    onChange={e => setEarningType(Number(e.target.value) as 1 | 2 | 3 | 4)}
                    className={`appearance-none rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#8e2421]/60 pr-6 cursor-pointer border transition-colors ${
                      earningType === 1 ? 'bg-amber-400/10   border-amber-400/25   text-amber-400'  :
                      earningType === 2 ? 'bg-green-400/10   border-green-400/25   text-green-400'  :
                      earningType === 3 ? 'bg-sky-400/10     border-sky-400/25     text-sky-400'    :
                                         'bg-violet-400/10  border-violet-400/25  text-violet-400'
                    }`}
                  >
                    <option value={1} className="bg-[#161b27] text-amber-400">Overtime</option>
                    <option value={2} className="bg-[#161b27] text-green-400">Bonus</option>
                    <option value={3} className="bg-[#161b27] text-sky-400">Commission</option>
                    <option value={4} className="bg-[#161b27] text-violet-400">Reimbursement</option>
                  </select>
                  <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] opacity-50">▾</span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Amount (USDT)"
                  value={earningAmountStr}
                  onChange={e => setEarningAmountStr(e.target.value)}
                  className="bg-[#0f1117] border border-white/[0.12] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#8e2421] focus:ring-1 focus:ring-[#8e2421]/50 placeholder:text-white/25 w-36 transition-colors"
                />
              </div>
              <input
                type="text"
                placeholder="Description (e.g. 10hrs overtime week 12)"
                value={earningDesc}
                onChange={e => setEarningDesc(e.target.value)}
                className="w-full bg-[#0f1117] border border-white/[0.12] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#8e2421] focus:ring-1 focus:ring-[#8e2421]/50 placeholder:text-white/25 transition-colors"
              />
              <button
                onClick={handleSubmitEarning}
                disabled={isEarningPending || isEarningMining || !earningAmountStr}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  isEarningPending || isEarningMining || !earningAmountStr
                    ? 'bg-white/5 text-white/30 cursor-not-allowed'
                    : 'bg-white/10 text-white/70 hover:bg-white/15 hover:text-white/90'
                }`}
              >
                {isEarningPending ? 'Confirm…' : isEarningMining ? 'Submitting…' : 'Queue Earning'}
              </button>
              {isEarningSuccess && <p className="text-xs text-green-400">Earning queued — will be paid at next pay run.</p>}
              {earningError && <p className="text-xs text-red-400 break-words">{earningError}</p>}
            </div>
          )}
        </div>
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
  const [wallet, setWallet] = useState(company.operatorAddress);
  const [roles, setRoles] = useState<{ name: string; level: number }[]>([...company.roles]);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleLevel, setNewRoleLevel] = useState(3);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { writeContract, isPending } = useWriteContract();
  const { isLoading: isWaiting, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const isSaving = isPending || isWaiting;

  useEffect(() => { if (isSuccess) onSaved(); }, [isSuccess]);

  function addRole() {
    const n = newRoleName.trim();
    if (n && !roles.find(r => r.name === n)) {
      setRoles([...roles, { name: n, level: newRoleLevel }]);
    }
    setNewRoleName('');
    setNewRoleLevel(3);
  }
  function removeRole(name: string) { setRoles(roles.filter(r => r.name !== name)); }

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
          operatorAddress: wallet as `0x${string}`,
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

      {/* Role Hierarchy */}
      <div>
        <label className={`block text-xs mb-1 ${theme.textMuted}`}>Role hierarchy (L1 = owner/founder, L2 = management, L3+ = staff)</label>
        <div className="space-y-1 mb-2">
          {[...roles].sort((a, b) => a.level - b.level).map(r => (
            <div key={r.name} className="flex items-center gap-2">
              <span className="text-white/40 text-xs font-mono w-6">L{r.level}</span>
              <span className="flex-1 px-2 py-0.5 rounded bg-white/10 text-xs text-white/80">{r.name}</span>
              <button onClick={() => removeRole(r.name)} className="text-white/30 hover:text-red-400 text-xs leading-none px-1">×</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <input
            className={`${theme.input} flex-1`}
            placeholder="Role name"
            value={newRoleName}
            onChange={e => setNewRoleName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRole(); } }}
          />
          <input
            type="number"
            min={1}
            max={99}
            value={newRoleLevel}
            onChange={e => setNewRoleLevel(Number(e.target.value))}
            className={`${theme.input} w-16 text-center`}
            title="Level (1=owner/founder, 2=management, 3+=staff)"
          />
          <button
            onClick={addRole}
            disabled={!newRoleName.trim()}
            className="px-3 py-1.5 rounded text-xs bg-white/10 text-white/70 hover:bg-white/20 disabled:opacity-40"
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
  payrollExecutorAddress,
  usdtAddress,
  defiUsdtAddress,
  wlfAddress,
  wlfPrice,
  onRefetch,
}: {
  companyId: bigint;
  address: `0x${string}`;
  companiesHouseAddress: `0x${string}`;
  payrollExecutorAddress: `0x${string}` | undefined;
  usdtAddress: `0x${string}` | undefined;
  defiUsdtAddress: `0x${string}` | undefined;
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
  const [showPayrollPreview, setShowPayrollPreview] = useState(false);
  const [payBatchTxHash, setPayBatchTxHash] = useState<`0x${string}` | undefined>();
  const [payBatchError, setPayBatchError] = useState<string | null>(null);
  const { writeContract: writePayAll, isPending: isPayAllPending } = useWriteContract();
  const { isSuccess: isPayAllSuccess, isLoading: isPayAllMining } = useWaitForTransactionReceipt({ hash: payAllTxHash });
  const isPayAllLoading = isPayAllPending || isPayAllMining;
  const { writeContract: writePayBatch, isPending: isPayBatchPending } = useWriteContract();
  const { isSuccess: isPayBatchSuccess, isLoading: isPayBatchMining } = useWaitForTransactionReceipt({ hash: payBatchTxHash });
  const isPayBatchLoading = isPayBatchPending || isPayBatchMining;
  const publicClientCompany = usePublicClient();

  useEffect(() => { if (isPayAllSuccess) { refetchCompany(); setPayAllError(null); } }, [isPayAllSuccess]);
  useEffect(() => { if (isPayBatchSuccess) { refetchCompany(); setPayBatchError(null); refetchPreview(); } }, [isPayBatchSuccess]);

  const { writeContract: writeDelete, isPending: isDeletePending } = useWriteContract();
  const { isLoading: isDeleteMining, isSuccess: isDeleteSuccess } = useWaitForTransactionReceipt({ hash: deleteTxHash });

  useEffect(() => { if (isDeleteSuccess) onRefetch(); }, [isDeleteSuccess]);

  // Tick every 5 s so Date.now()-based pending USDT recalculates without a contract call
  const [, setCompanyTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setCompanyTick(t => t + 1), 5_000);
    return () => clearInterval(id);
  }, []);

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

  const { data: nonWlfFeeBpsData } = useReadContract({
    address: companiesHouseAddress,
    abi: companiesHouseABI,
    functionName: 'nonWlfFeeBps',
    query: { refetchInterval: 60_000 },
  });
  const { data: wlfFeeBpsData } = useReadContract({
    address: companiesHouseAddress,
    abi: companiesHouseABI,
    functionName: 'wlfFeeBps',
    query: { refetchInterval: 60_000 },
  });
  const nonWlfFeeBps = nonWlfFeeBpsData ?? 500n;
  const wlfFeeBps    = wlfFeeBpsData    ?? 50n;
  const nonWlfFeePct = `${(Number(nonWlfFeeBps) / 100).toFixed(1).replace(/\.0$/, '')}%`;
  const wlfFeePct    = `${(Number(wlfFeeBps)    / 100).toFixed(1).replace(/\.0$/, '')}%`;

  const { data: previewData, isFetching: isPreviewFetching, refetch: refetchPreview } = useReadContract({
    address: companiesHouseAddress,
    abi: companiesHouseABI,
    functionName: 'previewPayroll',
    args: [companyId],
    query: { enabled: false },
  });
  // previewData is [items, totalGross, totalFee, totalNet]
  const previewItems = previewData ? (previewData as [PayrollPreviewItem[], bigint, bigint, bigint])[0] : undefined;
  const previewTotalGross = previewData ? (previewData as [PayrollPreviewItem[], bigint, bigint, bigint])[1] : 0n;
  const previewTotalFee   = previewData ? (previewData as [PayrollPreviewItem[], bigint, bigint, bigint])[2] : 0n;
  const previewTotalNet   = previewData ? (previewData as [PayrollPreviewItem[], bigint, bigint, bigint])[3] : 0n;

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
  const walletAddr = company?.operatorAddress !== zeroAddr ? company?.operatorAddress : undefined;
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

  // Compute caller's authority level: 1=owner, 2=operator, role-level for employees, 0=none
  const addrLower = address.toLowerCase();
  const myLevel = (() => {
    if (company.owner.toLowerCase() === addrLower) return 1;
    if (company.operatorAddress.toLowerCase() === addrLower) return 2;
    const me = company.employees.find(e => e.active && e.employeeId.toLowerCase() === addrLower);
    if (!me) return 0;
    const levels = me.salaryItems
      .map(s => company.roles.find(r => r.name === s.role)?.level ?? 0)
      .filter(l => l > 0);
    return levels.length > 0 ? Math.min(...levels) : 0;
  })();
  const isAuthorized = myLevel > 0; // any level can trigger some ops (e.g. hire form)
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

  async function handlePayAll() {
    setPayAllError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (publicClientCompany!.simulateContract as any)({
        address: payrollExecutorAddress ?? companiesHouseAddress,
        abi: payrollExecutorABI,
        functionName: 'payEmployees',
        args: [companyId],
        account: address,
      });
      writePayAll(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { ...result.request, gas: result.request.gas ? result.request.gas * 12n / 10n : undefined } as any,
        {
          onSuccess: (hash) => { setPayAllError(null); setPayAllTxHash(hash); },
          onError: (err) => {
            const msg = (err as { shortMessage?: string }).shortMessage ?? err.message;
            setPayAllError(msg);
          },
        }
      );
    } catch (err: unknown) {
      const msg =
        (err as { shortMessage?: string }).shortMessage ??
        (err as { message?: string }).message ??
        'Simulation failed';
      setPayAllError(msg);
    }
  }

  async function handlePayBatch(fromIndex: bigint, toIndex: bigint) {
    setPayBatchError(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (publicClientCompany!.simulateContract as any)({
        address: payrollExecutorAddress ?? companiesHouseAddress,
        abi: payrollExecutorABI,
        functionName: 'payEmployeesBatch',
        args: [companyId, fromIndex, toIndex],
        account: address,
      });
      writePayBatch(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { ...result.request, gas: result.request.gas ? result.request.gas * 12n / 10n : undefined } as any,
        {
          onSuccess: (hash) => { setPayBatchError(null); setPayBatchTxHash(hash); },
          onError: (err) => {
            const msg = (err as { shortMessage?: string }).shortMessage ?? err.message;
            setPayBatchError(msg);
          },
        }
      );
    } catch (err: unknown) {
      const msg =
        (err as { shortMessage?: string }).shortMessage ??
        (err as { message?: string }).message ??
        'Simulation failed';
      setPayBatchError(msg);
    }
  }

  return (
    <div className={`${theme.card} space-y-4`}>
      {/* Company header */}
      <div className="p-5 border-b border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">{company.name}</h2>
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/10">#{companyId.toString()}</span>
            </div>
            <p className={`text-sm ${theme.textMuted}`}>
              {company.industry}
              {company.domain && (
                <>
                  {' · '}
                  <a
                    href={`https://${company.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white/90 underline underline-offset-2 transition-colors"
                    onClick={e => e.stopPropagation()}
                  >
                    {company.domain}
                  </a>
                </>
              )}
            </p>
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

        {/* Operator address + live ETH balance */}
        <div className="mt-2 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs ${theme.textMuted} shrink-0`}>Operator address:</span>
            {company.operatorAddress === zeroAddr ? (
              <span className="text-xs text-yellow-400">Not set</span>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                <span className="text-xs font-mono text-white/70 break-all">
                  {company.operatorAddress}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(company.operatorAddress);
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

        {/* DeFi vault link */}
        {defiUsdtAddress && (
          <div className="mt-2 flex justify-end">
            <Link
              to={`/defi/${companyId.toString()}`}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
            >
              <span className="text-blue-400/60">◈</span>
              DeFi vault →
            </Link>
          </div>
        )}

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
              <a
                href={`https://${company.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/70 hover:text-white transition-colors underline underline-offset-2"
              >
                {company.domain}
              </a>
            </div>
          )}
          {company.roles.length > 0 && (
            <div className="flex items-start justify-between gap-2">
              <span className={`${theme.textMuted} shrink-0`}>Role hierarchy</span>
              <div className="text-right space-y-0.5">
                {[...company.roles]
                  .sort((a, b) => a.level - b.level)
                  .map(r => (
                    <div key={r.name} className="flex items-center justify-end gap-2">
                      <span className="text-white/40 text-xs font-mono">L{r.level}</span>
                      <span className="text-white/70 text-xs">{r.name}</span>
                    </div>
                  ))
                }
              </div>
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
              onClick={() => {
                const next = !showPayrollPreview;
                setShowPayrollPreview(next);
                if (next) refetchPreview();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80 border border-white/10"
            >
              {showPayrollPreview ? 'Close Preview' : 'Preview Payroll'}
            </button>
          )}
        </div>

        {/* Payroll preview panel */}
        {showPayrollPreview && (
          <div className="rounded-lg border border-white/10 bg-white/3 p-4 space-y-3">
            {isPreviewFetching ? (
              <p className="text-xs text-white/40">Calculating payroll…</p>
            ) : previewItems && previewItems.length > 0 ? (
              <>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-white/40 border-b border-white/10">
                      <th className="text-left pb-1.5 font-medium">Employee</th>
                      <th className="text-right pb-1.5 font-medium">Gross</th>
                      <th className="text-right pb-1.5 font-medium">Fee ({nonWlfFeePct})</th>
                      <th className="text-right pb-1.5 font-medium">Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {previewItems.map((item) => (
                      <tr key={item.employeeAddress} className="text-white/70">
                        <td className="py-1.5">{item.name}</td>
                        <td className="text-right py-1.5">${fmtUSDT(item.grossUSDT)}</td>
                        <td className="text-right py-1.5 text-white/40">${fmtUSDT(item.fee)}</td>
                        <td className="text-right py-1.5 text-green-400">${fmtUSDT(item.netUSDT)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="text-white/80 border-t border-white/10 font-semibold">
                      <td className="pt-1.5">Total</td>
                      <td className="text-right pt-1.5">${fmtUSDT(previewTotalGross)}</td>
                      <td className="text-right pt-1.5 text-white/40">${fmtUSDT(previewTotalFee)}</td>
                      <td className="text-right pt-1.5 text-green-400">${fmtUSDT(previewTotalNet)}</td>
                    </tr>
                  </tfoot>
                </table>

                {canPayAll && (() => {
                  const BATCH_SIZE = 50;
                  const totalRaw = company.employees.length;
                  if (totalRaw <= BATCH_SIZE) {
                    return (
                      <div className="flex flex-col items-start gap-1">
                        <button
                          onClick={handlePayAll}
                          disabled={isPayAllLoading}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${isPayAllLoading ? 'bg-white/5 text-white/30 cursor-not-allowed' : 'bg-[#8e2421] text-white hover:bg-[#a12926]'}`}
                        >
                          {isPayAllLoading && <svg className="animate-spin h-3 w-3 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                          {isPayAllPending ? 'Confirm…' : isPayAllMining ? 'Processing…' : 'Confirm & Pay All'}
                        </button>
                        {isPayAllSuccess && <p className="text-xs text-green-400">All employees paid successfully.</p>}
                        {payAllError && <p className="text-xs text-red-400 break-words">{payAllError}</p>}
                      </div>
                    );
                  }
                  const chunks = Array.from({ length: Math.ceil(totalRaw / BATCH_SIZE) }, (_, i) => ({
                    from: BigInt(i * BATCH_SIZE),
                    to: BigInt(Math.min((i + 1) * BATCH_SIZE, totalRaw)),
                    label: `${i * BATCH_SIZE + 1}–${Math.min((i + 1) * BATCH_SIZE, totalRaw)}`,
                  }));
                  return (
                    <div className="space-y-1">
                      <p className="text-xs text-white/40">Large company — pay in batches of {BATCH_SIZE}:</p>
                      <div className="flex flex-wrap gap-2">
                        {chunks.map((chunk, i) => (
                          <button
                            key={i}
                            onClick={() => handlePayBatch(chunk.from, chunk.to)}
                            disabled={isPayBatchLoading}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${isPayBatchLoading ? 'bg-white/5 text-white/30 cursor-not-allowed' : 'bg-[#8e2421] text-white hover:bg-[#a12926]'}`}
                          >
                            {isPayBatchLoading && <svg className="animate-spin h-3 w-3 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
                            Pay {chunk.label}
                          </button>
                        ))}
                      </div>
                      {isPayBatchSuccess && <p className="text-xs text-green-400">Batch paid successfully.</p>}
                      {payBatchError && <p className="text-xs text-red-400 break-words">{payBatchError}</p>}
                    </div>
                  );
                })()}

                {!canPayAll && (
                  <p className="text-xs text-red-400">
                    {!allAboveMinimum
                      ? 'All employees must have at least $1.00 USDT pending before paying.'
                      : `USDT balance below minimum ${monthly > 0n && reserve > 0n ? fmtMonths(Math.floor(Number(reserve / monthly))) : 'reserve'} threshold.`}
                  </p>
                )}
              </>
            ) : previewItems && previewItems.length === 0 ? (
              <p className="text-xs text-white/40">All employees are up to date — nothing owed right now.</p>
            ) : null}
          </div>
        )}

        {activeEmployees.length === 0 && (
          <p className={`text-sm ${theme.textMuted}`}>No employees yet.</p>
        )}

        {activeEmployees.map((emp, idx) => (
          <EmployeeCard
            key={`${emp.employeeId}-${idx}`}
            employee={emp}
            company={{ ...company, companyId } as Company}
            myLevel={myLevel}
            companyUsdtBalance={companyBalance}
            requiredReserve={reserve}
            wlfPrice={wlfPrice}
            connectedAddress={address}
            companiesHouseAddress={companiesHouseAddress}
            payrollExecutorAddress={payrollExecutorAddress}
            nonWlfFeeBps={nonWlfFeeBps}
            wlfFeeBps={wlfFeeBps}
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

// ─── Business (page) ──────────────────────────────────────────────────────────

export default function Business() {
  const { companyId: companyIdStr } = useParams<{ companyId: string }>();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const wlfPriceHuman = useWLFPrice();
  const wlfPrice = wlfPriceHuman !== null ? BigInt(Math.round(wlfPriceHuman * 1e18)) : 0n;

  const companiesHouseAddress = getAddress(chainId, 'CompaniesHouse');
  const payrollExecutorAddress = getAddress(chainId, 'PayrollExecutor');
  const wlfAddress = getAddress(chainId, 'WerewolfToken');
  const usdtAddress = getAddress(chainId, 'USDT');
  const defiUsdtAddress = getAddress(chainId, 'AaveUSDT') ?? getAddress(chainId, 'AaveToken');

  const companyId = companyIdStr ? BigInt(companyIdStr) : undefined;

  if (!isConnected || !address) {
    return (
      <main className="pt-24 max-w-3xl mx-auto px-4 pb-16">
        <Link to="/companies-house" className="text-sm text-white/50 hover:text-white/80 mb-6 inline-flex items-center gap-1">
          ← Companies
        </Link>
        <p className="text-white/60 mt-4">Connect your wallet to view this company.</p>
      </main>
    );
  }

  if (!companiesHouseAddress || !companyId) {
    return (
      <main className="pt-24 max-w-3xl mx-auto px-4 pb-16">
        <Link to="/companies-house" className="text-sm text-white/50 hover:text-white/80 mb-6 inline-flex items-center gap-1">
          ← Companies
        </Link>
        <p className="text-white/60 mt-4">Company not found.</p>
      </main>
    );
  }

  return (
    <main className="pt-24 max-w-3xl mx-auto px-4 pb-16 space-y-4">
      <Link
        to="/companies-house"
        className="text-sm text-white/50 hover:text-white/80 inline-flex items-center gap-1 transition-colors"
      >
        ← Companies
      </Link>
      <CompanyCard
        companyId={companyId}
        address={address}
        companiesHouseAddress={companiesHouseAddress}
        payrollExecutorAddress={payrollExecutorAddress}
        usdtAddress={usdtAddress}
        defiUsdtAddress={defiUsdtAddress}
        wlfAddress={wlfAddress}
        wlfPrice={wlfPrice}
        onRefetch={() => {}}
      />
    </main>
  );
}
