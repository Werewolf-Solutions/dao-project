import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  useAccount,
  useChainId,
  useReadContract,
  useReadContracts,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient,
} from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import {
  useAaveMarket,
  useAaveReserve,
  useUserMarketState,
  useUserSupplies,
  chainId as aaveChainId,
  evmAddress,
} from '@aave/react';
import { theme } from '@/contexts/ThemeContext';
import { companiesHouseABI, companyVaultABI, erc20ABI, getAddress } from '@/contracts';

// ─── Constants ────────────────────────────────────────────────────────────────

const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as `0x${string}`;
const MAX_UINT256 = 2n ** 256n - 1n;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtToken(val: bigint, decimals: number, places = 2): string {
  return Number(formatUnits(val, decimals)).toLocaleString(undefined, {
    maximumFractionDigits: places,
  });
}

function fmtUSDT(val: bigint, places = 2): string {
  return fmtToken(val, 6, places);
}

// ─── TokenAllowed event signature ─────────────────────────────────────────────

const tokenAllowedEvent = {
  type: 'event' as const,
  name: 'TokenAllowed',
  inputs: [
    { name: 'token', type: 'address' as const, indexed: true },
    { name: 'allowed', type: 'bool' as const, indexed: false },
  ],
};

// ─── TokenBalanceRow ──────────────────────────────────────────────────────────

function TokenBalanceRow({
  symbol,
  decimals,
  vaultBal,
  walletBal,
  isAllowed,
  tokenAddress,
  vaultAddress,
  isAdmin,
  onWhitelisted,
}: {
  symbol: string;
  decimals: number;
  vaultBal: bigint;
  walletBal: bigint;
  isAllowed: boolean;
  tokenAddress: `0x${string}`;
  vaultAddress: `0x${string}`;
  isAdmin: boolean;
  onWhitelisted: () => void;
}) {
  const { writeContract, isPending } = useWriteContract();

  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0 text-sm">
      <span className="font-medium text-white/80 w-16 shrink-0">{symbol}</span>
      <div className="flex-1 grid grid-cols-2 gap-2 text-xs font-mono">
        <div>
          <p className="text-white/30 mb-0.5">Vault</p>
          <p className={vaultBal > 0n ? 'text-green-400' : 'text-white/30'}>
            {fmtToken(vaultBal, decimals, 4)}
          </p>
        </div>
        <div>
          <p className="text-white/30 mb-0.5">Wallet</p>
          <p className={walletBal > 0n ? 'text-blue-300' : 'text-white/30'}>
            {fmtToken(walletBal, decimals, 4)}
          </p>
        </div>
      </div>
      {!isAllowed && isAdmin && (
        <button
          disabled={isPending}
          onClick={() =>
            writeContract(
              {
                address: vaultAddress,
                abi: companyVaultABI,
                functionName: 'setAllowedToken',
                args: [tokenAddress, true],
              },
              { onSuccess: onWhitelisted },
            )
          }
          className="shrink-0 text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Whitelisting…' : 'Whitelist'}
        </button>
      )}
      {!isAllowed && !isAdmin && (
        <span className="shrink-0 text-xs text-white/25 italic">not whitelisted</span>
      )}
    </div>
  );
}

// ─── DeFi page ────────────────────────────────────────────────────────────────

export default function DeFi() {
  const { companyId: companyIdParam } = useParams<{ companyId: string }>();
  const companyId = companyIdParam ? BigInt(companyIdParam) : undefined;

  const { address: connectedAddress } = useAccount();
  const connectedChainId = useChainId();
  const publicClient = usePublicClient();

  const companiesHouseAddress = getAddress(connectedChainId, 'CompaniesHouse');
  // AaveUSDT is the DeFi token; fall back to regular USDT
  const defiUsdtAddress =
    getAddress(connectedChainId, 'AaveUSDT') ?? getAddress(connectedChainId, 'USDT');
  const rawUsdtAddress = getAddress(connectedChainId, 'USDT');
  const onchainAavePool = getAddress(connectedChainId, 'AavePool') ?? ZERO_ADDR;
  const aaveMarketAddress = onchainAavePool;

  // ── UI state ────────────────────────────────────────────────────────────────
  const [supplyAmt, setSupplyAmt] = useState('');
  const [withdrawAmt, setWithdrawAmt] = useState('');
  const [depositAmt, setDepositAmt] = useState('');
  const [supplyTxHash, setSupplyTxHash] = useState<`0x${string}` | undefined>();
  const [withdrawTxHash, setWithdrawTxHash] = useState<`0x${string}` | undefined>();
  const [depositTxHash, setDepositTxHash] = useState<`0x${string}` | undefined>();
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>();
  const [createVaultTxHash, setCreateVaultTxHash] = useState<`0x${string}` | undefined>();
  const [txError, setTxError] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // ── Company info ────────────────────────────────────────────────────────────
  const { data: company } = useReadContract({
    address: companiesHouseAddress,
    abi: companiesHouseABI,
    functionName: 'retrieveCompany',
    args: [companyId ?? 0n],
    query: { enabled: !!companiesHouseAddress && companyId !== undefined },
  });

  // ── Vault address ───────────────────────────────────────────────────────────
  const { data: vaultAddressRaw, refetch: refetchVaultAddress } = useReadContract({
    address: companiesHouseAddress,
    abi: companiesHouseABI,
    functionName: 'companyVault',
    args: [companyId ?? 0n],
    query: { enabled: !!companiesHouseAddress && companyId !== undefined, refetchInterval: 15_000 },
  });
  const vaultAddress = vaultAddressRaw as `0x${string}` | undefined;
  const hasVault = !!vaultAddress && vaultAddress !== ZERO_ADDR;

  // ── Vault metadata ──────────────────────────────────────────────────────────
  const { data: aavePool, refetch: refetchAavePool } = useReadContract({
    address: hasVault ? vaultAddress : undefined,
    abi: companyVaultABI,
    functionName: 'aavePool',
    query: { enabled: hasVault, refetchInterval: 60_000 },
  });
  const { data: vaultAdmin } = useReadContract({
    address: hasVault ? vaultAddress : undefined,
    abi: companyVaultABI,
    functionName: 'admin',
    query: { enabled: hasVault, staleTime: Infinity },
  });
  const isDefiAdmin =
    !!connectedAddress &&
    !!vaultAdmin &&
    connectedAddress.toLowerCase() === (vaultAdmin as string).toLowerCase();

  const isAaveConfigured = hasVault && aavePool && aavePool !== ZERO_ADDR;

  // ── DeFi USDT token details ─────────────────────────────────────────────────
  const { data: defiTokenSymbol } = useReadContract({
    address: defiUsdtAddress,
    abi: erc20ABI,
    functionName: 'symbol',
    query: { enabled: !!defiUsdtAddress, staleTime: Infinity },
  });
  const tok = (defiTokenSymbol as string | undefined) ?? 'USDT';

  const { data: usdtAllowed, refetch: refetchUsdtAllowed } = useReadContract({
    address: hasVault ? vaultAddress : undefined,
    abi: companyVaultABI,
    functionName: 'allowedTokens',
    args: [defiUsdtAddress ?? ZERO_ADDR],
    query: { enabled: hasVault && !!defiUsdtAddress, refetchInterval: 60_000 },
  });

  // ── Token balance enumeration ────────────────────────────────────────────────
  // Start from known chain tokens
  const knownTokens = useMemo<`0x${string}`[]>(() => {
    const list: `0x${string}`[] = [];
    if (defiUsdtAddress) list.push(defiUsdtAddress);
    if (rawUsdtAddress && rawUsdtAddress !== defiUsdtAddress) list.push(rawUsdtAddress);
    return list;
  }, [defiUsdtAddress, rawUsdtAddress]);

  // Fetch TokenAllowed events from the vault to discover admin-added tokens
  const [eventTokens, setEventTokens] = useState<`0x${string}`[]>([]);
  useEffect(() => {
    if (!hasVault || !vaultAddress || !publicClient) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (publicClient.getLogs as any)({
      address: vaultAddress,
      event: tokenAllowedEvent,
      fromBlock: 0n,
    })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((logs: any[]) => {
        const seenAllowed = new Set<string>();
        const seenRemoved = new Set<string>();
        for (const log of logs) {
          const token = (log.args?.token as `0x${string}`).toLowerCase();
          const allowed = log.args?.allowed as boolean;
          if (allowed) seenAllowed.add(token);
          else seenRemoved.add(token);
        }
        const result = Array.from(seenAllowed)
          .filter((t) => !seenRemoved.has(t))
          .map((t) => t as `0x${string}`);
        setEventTokens(result);
      })
      .catch(() => {});
  }, [hasVault, vaultAddress, publicClient]);

  // Deduped token list
  const allTokens = useMemo<`0x${string}`[]>(() => {
    const seen = new Set<string>();
    const result: `0x${string}`[] = [];
    for (const t of [...knownTokens, ...eventTokens]) {
      const lower = t.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        result.push(t);
      }
    }
    return result;
  }, [knownTokens, eventTokens]);

  // Batch-read vault balance, wallet balance, symbol, allowedTokens, decimals per token
  const tokenContracts = useMemo(() => {
    if (!hasVault || !vaultAddress) return [];
    return allTokens.flatMap((token) => [
      { address: vaultAddress, abi: companyVaultABI, functionName: 'getTokenBalance' as const, args: [token] as [`0x${string}`] },
      { address: token, abi: erc20ABI, functionName: 'balanceOf' as const, args: [connectedAddress ?? ZERO_ADDR] as [`0x${string}`] },
      { address: token, abi: erc20ABI, functionName: 'symbol' as const },
      { address: vaultAddress, abi: companyVaultABI, functionName: 'allowedTokens' as const, args: [token] as [`0x${string}`] },
      { address: token, abi: erc20ABI, functionName: 'decimals' as const },
    ]);
  }, [allTokens, vaultAddress, connectedAddress, hasVault]);

  const { data: tokenData, refetch: refetchTokenBalances } = useReadContracts({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contracts: tokenContracts as any,
    query: {
      enabled: hasVault && tokenContracts.length > 0,
      refetchInterval: 15_000,
    },
  });

  // Build token rows — only show where vault > 0 OR wallet > 0
  const tokenRows = useMemo(() => {
    if (!tokenData) return [];
    return allTokens
      .map((token, i) => {
        const base = i * 5;
        const vaultBal = ((tokenData[base]?.result as bigint | undefined) ?? 0n);
        const walletBal = ((tokenData[base + 1]?.result as bigint | undefined) ?? 0n);
        const symbol = ((tokenData[base + 2]?.result as string | undefined) ?? '???');
        const allowed = ((tokenData[base + 3]?.result as boolean | undefined) ?? false);
        const decimals = Number((tokenData[base + 4]?.result as bigint | undefined) ?? 18n);
        return { token, vaultBal, walletBal, symbol, allowed, decimals };
      })
      .filter((row) => row.vaultBal > 0n || row.walletBal > 0n);
  }, [allTokens, tokenData]);

  // ── Aave SDK hooks ──────────────────────────────────────────────────────────
  useAaveMarket({
    address: evmAddress(aaveMarketAddress ?? ZERO_ADDR),
    chainId: aaveChainId(connectedChainId),
  });
  const { data: sdkMarketState } = useUserMarketState({
    market: evmAddress(aaveMarketAddress ?? ZERO_ADDR),
    user: evmAddress(hasVault ? vaultAddress! : ZERO_ADDR),
    chainId: aaveChainId(connectedChainId),
  });
  const { data: sdkReserve } = useAaveReserve({
    market: evmAddress(aaveMarketAddress ?? ZERO_ADDR),
    underlyingToken: evmAddress(defiUsdtAddress ?? ZERO_ADDR),
    chainId: aaveChainId(connectedChainId),
  });
  const { data: sdkSupplies } = useUserSupplies({
    markets: [{ address: evmAddress(aaveMarketAddress ?? ZERO_ADDR), chainId: aaveChainId(connectedChainId) }],
    user: evmAddress(hasVault ? vaultAddress! : ZERO_ADDR),
  });
  const sdkSupplyPosition = sdkSupplies?.[0];
  const supplied = (() => {
    if (sdkSupplyPosition) {
      const val = parseFloat(String(sdkSupplyPosition.balance.amount?.value ?? 0));
      return BigInt(Math.round(val * 1e6));
    }
    return 0n;
  })();

  // ── Vault token balance (liquid) ─────────────────────────────────────────────
  const { data: treasuryBalance, refetch: refetchTreasury } = useReadContract({
    address: hasVault ? vaultAddress : undefined,
    abi: companyVaultABI,
    functionName: 'getTokenBalance',
    args: [defiUsdtAddress ?? ZERO_ADDR],
    query: { enabled: hasVault && !!defiUsdtAddress, refetchInterval: 10_000 },
  });

  // ── Deposit to vault ─────────────────────────────────────────────────────────
  const depositWei = (() => {
    const n = parseFloat(depositAmt);
    return isNaN(n) || n <= 0 ? 0n : BigInt(Math.round(n * 1e6));
  })();
  const { data: depositAllowance, refetch: refetchDepositAllowance } = useReadContract({
    address: defiUsdtAddress,
    abi: erc20ABI,
    functionName: 'allowance',
    args: [connectedAddress!, hasVault ? vaultAddress! : ZERO_ADDR],
    query: { enabled: !!connectedAddress && hasVault && !!defiUsdtAddress, refetchInterval: 10_000 },
  });
  const { data: walletUsdtBal } = useReadContract({
    address: defiUsdtAddress,
    abi: erc20ABI,
    functionName: 'balanceOf',
    args: [connectedAddress ?? ZERO_ADDR],
    query: { enabled: !!connectedAddress && !!defiUsdtAddress, refetchInterval: 10_000 },
  });
  const { writeContract: writeApproveDeposit, isPending: isApprovePending } = useWriteContract();
  const { writeContract: writeDeposit, isPending: isDepositPending } = useWriteContract();
  const { isLoading: isApproveMining, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveTxHash });
  const { isLoading: isDepositMining, isSuccess: isDepositSuccess } = useWaitForTransactionReceipt({ hash: depositTxHash });
  useEffect(() => { if (isApproveSuccess) refetchDepositAllowance(); }, [isApproveSuccess]);
  useEffect(() => {
    if (isDepositSuccess) {
      refetchTreasury();
      refetchTokenBalances();
      setDepositAmt('');
    }
  }, [isDepositSuccess]);
  const hasDepositAllowance =
    isApproveSuccess ? true : (depositAllowance ?? 0n) >= depositWei && depositWei > 0n;

  // ── Supply / Withdraw ────────────────────────────────────────────────────────
  const { writeContract, isPending } = useWriteContract();
  const { isLoading: isSupplyMining, isSuccess: isSupplySuccess } = useWaitForTransactionReceipt({ hash: supplyTxHash });
  const { isLoading: isWithdrawMining, isSuccess: isWithdrawSuccess } = useWaitForTransactionReceipt({ hash: withdrawTxHash });

  useEffect(() => {
    if (isSupplySuccess) { refetchTreasury(); refetchTokenBalances(); setSupplyAmt(''); setTxError(null); }
  }, [isSupplySuccess]);
  useEffect(() => {
    if (isWithdrawSuccess) { refetchTreasury(); refetchTokenBalances(); setWithdrawAmt(''); setTxError(null); }
  }, [isWithdrawSuccess]);

  const isLoading = isSimulating || isPending || isSupplyMining || isWithdrawMining;

  async function handleWrite(
    functionName: 'supplyToAave' | 'withdrawFromAave',
    amount: bigint,
    setHash: (h: `0x${string}`) => void,
  ) {
    if (!publicClient || !connectedAddress || !hasVault || !defiUsdtAddress) return;
    setTxError(null);
    setIsSimulating(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (publicClient.simulateContract as any)({
        address: vaultAddress,
        abi: companyVaultABI,
        functionName,
        args: [defiUsdtAddress, amount],
        account: connectedAddress,
      });
      setIsSimulating(false);
      writeContract(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { ...result.request, gas: result.request.gas ? result.request.gas * 12n / 10n : undefined } as any,
        {
          onSuccess: (hash) => setHash(hash),
          onError: (err) => setTxError((err as { shortMessage?: string }).shortMessage ?? err.message),
        },
      );
    } catch (err) {
      setIsSimulating(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      setTxError(
        e?.cause?.cause?.data?.errorName ??
          e?.cause?.cause?.reason ??
          e?.cause?.data?.errorName ??
          e?.cause?.reason ??
          e?.shortMessage ??
          e?.message ??
          String(err),
      );
    }
  }

  const supplyWei = (() => {
    const n = parseFloat(supplyAmt);
    return isNaN(n) || n <= 0 ? 0n : parseUnits(supplyAmt, 6);
  })();
  const insufficientTreasury = supplyWei > 0n && supplyWei > (treasuryBalance ?? 0n);

  // ── Create vault ────────────────────────────────────────────────────────────
  const { writeContract: writeCreateVault, isPending: isCreateVaultPending } = useWriteContract();
  const { isLoading: isCreateVaultMining, isSuccess: isCreateVaultSuccess } = useWaitForTransactionReceipt({ hash: createVaultTxHash });
  useEffect(() => {
    if (isCreateVaultSuccess) { refetchVaultAddress(); setTxError(null); }
  }, [isCreateVaultSuccess]);

  // ── Set aave pool ───────────────────────────────────────────────────────────
  const { writeContract: writeSetAavePool, isPending: isSetPoolPending } = useWriteContract();
  const { writeContract: writeSetAllowedToken, isPending: isWhitelistPending } = useWriteContract();

  // ── Authorization check ──────────────────────────────────────────────────────
  const isAuthorized = useMemo(() => {
    if (!connectedAddress || !company) return false;
    const lower = connectedAddress.toLowerCase();
    return (
      company.owner.toLowerCase() === lower ||
      company.operatorAddress.toLowerCase() === lower ||
      company.employees.some(
        (e) =>
          e.active &&
          e.employeeId.toLowerCase() === lower &&
          e.salaryItems.some((s) =>
            (company.powerRoles as readonly string[]).includes(s.role),
          ),
      )
    );
  }, [connectedAddress, company]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  if (!connectedAddress) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-white/50">Connect your wallet to view DeFi vault.</p>
      </div>
    );
  }

  if (companyId === undefined) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-white/50">No company selected.</p>
        <Link to="/companies-house" className="text-blue-400 hover:text-blue-300 text-sm underline-offset-2 underline">
          ← Back to Companies
        </Link>
      </div>
    );
  }

  if (!companiesHouseAddress || !defiUsdtAddress) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-white/50">DeFi not available on this network.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-blue-400 text-lg">◈</span>
            <h1 className="text-xl font-bold text-white">
              DeFi Vault
              {company?.name && (
                <span className="text-white/40 font-normal text-base ml-2">— {company.name}</span>
              )}
            </h1>
            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-white/5 text-white/30 border border-white/10">
              #{companyId.toString()}
            </span>
          </div>
          <p className="text-xs text-white/30 mt-0.5">Aave yield integration for company treasury</p>
        </div>
        <Link
          to="/companies-house"
          className="shrink-0 text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          ← Companies
        </Link>
      </div>

      {/* ── Token Balances (vault + wallet) ── */}
      {hasVault && (
        <div className={`${theme.card} p-4`}>
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
            Token Balances
          </p>
          {tokenRows.length === 0 ? (
            <p className="text-xs text-white/30 italic">No token balances found (vault and wallet are empty for known tokens).</p>
          ) : (
            <div>
              {/* Column headers */}
              <div className="flex items-center gap-3 pb-2 border-b border-white/10 text-[11px] text-white/30 uppercase tracking-wider">
                <span className="w-16 shrink-0">Token</span>
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <span>Vault balance</span>
                  <span>Wallet balance</span>
                </div>
              </div>
              {tokenRows.map((row) => (
                <TokenBalanceRow
                  key={row.token}
                  symbol={row.symbol}
                  decimals={row.decimals}
                  vaultBal={row.vaultBal}
                  walletBal={row.walletBal}
                  isAllowed={row.allowed}
                  tokenAddress={row.token}
                  vaultAddress={vaultAddress!}
                  isAdmin={isDefiAdmin}
                  onWhitelisted={() => { refetchUsdtAllowed(); refetchTokenBalances(); }}
                />
              ))}
            </div>
          )}
          {hasVault && (
            <p className="text-[11px] text-white/15 font-mono mt-3 break-all">
              Vault: {vaultAddress}
            </p>
          )}
        </div>
      )}

      {/* ── DeFi setup guards ── */}
      {!hasVault ? (
        <div className={`${theme.card} p-5 space-y-3`}>
          <p className="text-sm font-semibold text-white/70">No DeFi Vault</p>
          <p className="text-xs text-white/40">
            This company doesn't have a DeFi vault yet. Create one to start earning yield on idle {tok}.
          </p>
          <p className="text-xs text-white/25">
            A per-company vault is deployed for your company — it holds investment funds separately from payroll and interacts with Aave directly.
          </p>
          {isAuthorized && (
            <button
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                isCreateVaultPending || isCreateVaultMining
                  ? 'bg-white/5 text-white/30 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-500'
              }`}
              disabled={isCreateVaultPending || isCreateVaultMining}
              onClick={() =>
                writeCreateVault(
                  {
                    address: companiesHouseAddress,
                    abi: companiesHouseABI,
                    functionName: 'createVault',
                    args: [companyId, onchainAavePool, defiUsdtAddress],
                    gas: 500_000n,
                  },
                  {
                    onSuccess: (h) => setCreateVaultTxHash(h),
                    onError: (err) =>
                      setTxError((err as { shortMessage?: string }).shortMessage ?? err.message),
                  },
                )
              }
            >
              {isCreateVaultPending
                ? 'Confirm in wallet…'
                : isCreateVaultMining
                  ? 'Creating vault…'
                  : 'Create Investment Vault'}
            </button>
          )}
          {txError && <p className="text-xs text-red-400 break-words">{txError}</p>}
        </div>
      ) : !isAaveConfigured ? (
        <div className={`${theme.card} p-5 space-y-3`}>
          <p className="text-sm font-semibold text-white/70">Aave Pool Not Configured</p>
          <p className="text-xs text-white/40">
            This vault was created without an Aave pool address.
          </p>
          {isDefiAdmin && onchainAavePool !== ZERO_ADDR && (
            <button
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                isSetPoolPending
                  ? 'bg-white/5 text-white/30 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-500'
              }`}
              disabled={isSetPoolPending}
              onClick={() =>
                writeSetAavePool(
                  {
                    address: vaultAddress!,
                    abi: companyVaultABI,
                    functionName: 'setAavePool',
                    args: [onchainAavePool],
                  },
                  { onSuccess: () => refetchAavePool() },
                )
              }
            >
              {isSetPoolPending ? 'Setting…' : 'Set Aave Pool'}
            </button>
          )}
        </div>
      ) : !usdtAllowed ? (
        <div className={`${theme.card} p-5 space-y-3`}>
          <p className="text-sm font-semibold text-amber-400">{tok} Not Whitelisted</p>
          <p className="text-xs text-white/40">
            {tok} must be whitelisted before DeFi operations.
          </p>
          {isDefiAdmin && (
            <button
              className="px-4 py-2 rounded text-sm font-medium bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-50 transition-colors"
              disabled={isWhitelistPending}
              onClick={() =>
                writeSetAllowedToken(
                  {
                    address: vaultAddress!,
                    abi: companyVaultABI,
                    functionName: 'setAllowedToken',
                    args: [defiUsdtAddress, true],
                  },
                  { onSuccess: () => refetchUsdtAllowed() },
                )
              }
            >
              {isWhitelistPending ? 'Whitelisting…' : `Whitelist ${tok}`}
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ── Aave position overview ── */}
          <div className={`${theme.card} p-4`}>
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
              Aave Position
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-white/40 mb-0.5">Supplied (live)</p>
                {sdkSupplyPosition ? (
                  <>
                    <p className="text-white font-medium font-mono">
                      ${parseFloat(String(sdkSupplyPosition.balance.usd)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-green-400 text-xs">
                      {parseFloat(String(sdkSupplyPosition.balance.amount?.value ?? 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })} {tok}
                    </p>
                  </>
                ) : (
                  <p className="text-white font-medium font-mono">${fmtUSDT(supplied)}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-white/40 mb-0.5">Vault {tok} (liquid)</p>
                <p className="text-white font-medium font-mono">${fmtUSDT(treasuryBalance ?? 0n)}</p>
              </div>
            </div>
            <div className="mt-3 space-y-1.5 border-t border-white/10 pt-3 text-xs">
              {sdkReserve && (
                <div className="flex justify-between items-center">
                  <span className="text-white/40">Supply APY</span>
                  <span className="font-medium font-mono text-green-400">
                    {parseFloat(String(sdkReserve.supplyInfo.apy.value)).toFixed(2)}%
                  </span>
                </div>
              )}
              {sdkMarketState?.netAPY && (
                <div className="flex justify-between items-center">
                  <span className="text-white/40">Net APY</span>
                  <span className="font-medium font-mono text-blue-400">
                    {parseFloat(String(sdkMarketState.netAPY.value)).toFixed(2)}%
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-white/40">Health factor</span>
                <span
                  className={`font-medium font-mono ${
                    sdkMarketState?.healthFactor === null
                      ? 'text-green-400'
                      : parseFloat(String(sdkMarketState?.healthFactor ?? 9)) >= 2
                        ? 'text-green-400'
                        : parseFloat(String(sdkMarketState?.healthFactor ?? 9)) >= 1.2
                          ? 'text-yellow-400'
                          : 'text-red-400'
                  }`}
                >
                  {sdkMarketState?.healthFactor === null
                    ? '∞'
                    : sdkMarketState?.healthFactor
                      ? parseFloat(String(sdkMarketState.healthFactor)).toLocaleString(undefined, { maximumFractionDigits: 2 })
                      : '∞'}
                </span>
              </div>
            </div>
          </div>

          {/* ── Fund vault ── */}
          <div className={`${theme.card} p-4 space-y-3`}>
            <div className="flex justify-between items-center">
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                Fund Vault ({tok})
              </p>
              {walletUsdtBal !== undefined && (
                <span className="text-xs text-white/30">Wallet: ${fmtUSDT(walletUsdtBal as bigint)}</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                placeholder={`Amount ${tok}`}
                value={depositAmt}
                onChange={(e) => setDepositAmt(e.target.value)}
                className={theme.input + ' flex-1'}
                disabled={isApprovePending || isApproveMining || isDepositPending || isDepositMining}
              />
              {!hasDepositAllowance ? (
                <button
                  onClick={() => {
                    if (!depositWei || !hasVault) return;
                    writeApproveDeposit(
                      {
                        address: defiUsdtAddress,
                        abi: erc20ABI,
                        functionName: 'approve',
                        args: [vaultAddress!, depositWei],
                      },
                      { onSuccess: (h) => setApproveTxHash(h) },
                    );
                  }}
                  disabled={!depositAmt || depositWei === 0n || isApprovePending || isApproveMining}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    !depositAmt || depositWei === 0n || isApprovePending || isApproveMining
                      ? 'bg-white/5 text-white/30 cursor-not-allowed'
                      : 'bg-amber-600 text-white hover:bg-amber-500'
                  }`}
                >
                  {isApprovePending || isApproveMining ? 'Approving…' : 'Approve'}
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (!depositWei || !hasVault) return;
                    writeDeposit(
                      {
                        address: vaultAddress!,
                        abi: companyVaultABI,
                        functionName: 'deposit',
                        args: [defiUsdtAddress, depositWei],
                        gas: 120_000n,
                      },
                      { onSuccess: (h) => setDepositTxHash(h) },
                    );
                  }}
                  disabled={!depositAmt || depositWei === 0n || isDepositPending || isDepositMining}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    !depositAmt || depositWei === 0n || isDepositPending || isDepositMining
                      ? 'bg-white/5 text-white/30 cursor-not-allowed'
                      : 'bg-green-700 text-white hover:bg-green-600'
                  }`}
                >
                  {isDepositPending || isDepositMining ? 'Depositing…' : 'Deposit'}
                </button>
              )}
            </div>
            {isDepositSuccess && <p className="text-xs text-green-400">Deposited to vault.</p>}
          </div>

          {/* ── Supply to Aave ── */}
          <div className={`${theme.card} p-4 space-y-3`}>
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">
              Supply {tok} to Aave
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                placeholder={`Max $${fmtUSDT(treasuryBalance ?? 0n)} in vault`}
                value={supplyAmt}
                onChange={(e) => setSupplyAmt(e.target.value)}
                className={theme.input + ' flex-1'}
                disabled={isLoading}
              />
              <button
                onClick={() => { if (supplyWei > 0n) handleWrite('supplyToAave', supplyWei, setSupplyTxHash); }}
                disabled={isLoading || supplyWei === 0n || insufficientTreasury}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  isLoading || supplyWei === 0n || insufficientTreasury
                    ? 'bg-white/5 text-white/30 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-500'
                }`}
              >
                {isSimulating ? 'Checking…' : isPending && !withdrawTxHash ? 'Confirm…' : isSupplyMining ? 'Supplying…' : 'Supply'}
              </button>
            </div>
            {insufficientTreasury && (
              <p className="text-xs text-amber-400">
                Vault only has ${fmtUSDT(treasuryBalance ?? 0n)} {tok} — fund the vault above first.
              </p>
            )}
            {isSupplySuccess && <p className="text-xs text-green-400">Supplied successfully.</p>}
          </div>

          {/* ── Withdraw from Aave ── */}
          {supplied > 0n && (
            <div className={`${theme.card} p-4 space-y-3`}>
              <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                Withdraw from Aave
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  placeholder={`Max $${fmtUSDT(supplied)} ${tok}`}
                  value={withdrawAmt}
                  onChange={(e) => setWithdrawAmt(e.target.value)}
                  className={theme.input + ' flex-1'}
                  disabled={isLoading}
                />
                <button
                  onClick={() => setWithdrawAmt(fmtUSDT(supplied, 6).replace(/,/g, ''))}
                  className="px-2 py-1.5 rounded text-xs text-white/50 hover:text-white border border-white/10 hover:border-white/30 transition-colors"
                  disabled={isLoading}
                >
                  MAX
                </button>
                <button
                  onClick={() => {
                    const isMax = withdrawAmt === fmtUSDT(supplied, 6).replace(/,/g, '');
                    const amt = isMax ? MAX_UINT256 : parseUnits(withdrawAmt, 6);
                    if (isMax || parseFloat(withdrawAmt) > 0) handleWrite('withdrawFromAave', amt, setWithdrawTxHash);
                  }}
                  disabled={isLoading || !withdrawAmt || parseFloat(withdrawAmt) <= 0}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    isLoading || !withdrawAmt || parseFloat(withdrawAmt) <= 0
                      ? 'bg-white/5 text-white/30 cursor-not-allowed'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {isWithdrawMining ? 'Withdrawing…' : 'Withdraw'}
                </button>
              </div>
              {isWithdrawSuccess && <p className="text-xs text-green-400">Withdrawn successfully.</p>}
            </div>
          )}

          {txError && (
            <p className="text-xs text-red-400 break-words px-1">{txError}</p>
          )}
        </>
      )}
    </div>
  );
}
