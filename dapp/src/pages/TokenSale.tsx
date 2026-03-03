import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { parseUnits, formatUnits, formatEther, parseAbiItem } from 'viem';
import { tokenSaleABI, erc20ABI, getAddress } from '@/contracts';
import { useChain } from '@/contexts/ChainContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useWLFPrice } from '@/hooks/useWLFPrice';
import { PageContainer } from '@/components/PageContainer';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Row } from '@/components/Row';

// Format 18-decimal bigint (WLF)
function fmt18(raw: bigint | undefined, decimals = 2): string {
  if (raw === undefined) return '—';
  return Number(formatUnits(raw, 18)).toLocaleString(undefined, {
    maximumFractionDigits: decimals,
  });
}

// Format 6-decimal bigint (USDT)
function fmt6(raw: bigint | undefined, decimals = 4): string {
  if (raw === undefined) return '—';
  return Number(formatUnits(raw, 6)).toLocaleString(undefined, {
    maximumFractionDigits: decimals,
  });
}

// ── Past Sales ────────────────────────────────────────────────────────────────

const PURCHASE_EVENT = parseAbiItem(
  'event TokensPurchased(address indexed buyer, uint256 amount, uint256 saleId)'
);

type BuyerMap = Map<string, bigint>; // addr → total WLF

function SalePastCard({
  saleId, price, wlfCollected, usdtCollected, buyers, logsLoading, logsError,
}: {
  saleId: number;
  price: bigint | undefined;
  wlfCollected: bigint | undefined;
  usdtCollected: bigint | undefined;
  buyers: BuyerMap;
  logsLoading: boolean;
  logsError: boolean;
}) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const sortedBuyers = [...buyers.entries()].sort((a, b) => (b[1] > a[1] ? 1 : -1));

  return (
    <div className={`${theme.cardNested} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">Sale #{saleId}</h3>
        <span className="text-xs text-green-400 font-medium px-2 py-0.5 rounded-full bg-green-400/10 border border-green-400/20">
          Completed
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-white/40">Price</span>
          <p className="font-mono text-white/80 mt-0.5">
            {price !== undefined ? `${formatEther(price)} USDT/WLF` : '…'}
          </p>
        </div>
        <div>
          <span className="text-white/40">Participants</span>
          <p className="font-mono text-white/80 mt-0.5">
            {logsLoading ? '…' : buyers.size}
          </p>
        </div>
        <div>
          <span className="text-white/40">WLF sold</span>
          <p className="font-mono text-white/80 mt-0.5">
            {wlfCollected !== undefined ? `${fmt18(wlfCollected, 0)} WLF` : '…'}
          </p>
        </div>
        <div>
          <span className="text-white/40">USDT raised</span>
          <p className="font-mono text-white/80 mt-0.5">
            {usdtCollected !== undefined ? `$${fmt6(usdtCollected, 2)}` : '…'}
          </p>
        </div>
      </div>

      {logsError && (
        <p className="text-xs text-red-400">Could not load participant data.</p>
      )}

      {!logsLoading && !logsError && sortedBuyers.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-xs text-white/35 hover:text-white/65 transition-colors"
          >
            {expanded
              ? '▴ Hide participants'
              : `▾ Show ${sortedBuyers.length} participant${sortedBuyers.length !== 1 ? 's' : ''}`}
          </button>
          {expanded && (
            <div className="mt-2 space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {sortedBuyers.map(([addr, amount], i) => (
                <div key={addr} className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-white/30 shrink-0 w-4">{i + 1}.</span>
                  <span className="font-mono text-white/55 flex-1 break-all">{addr}</span>
                  <span className="font-mono text-white/80 shrink-0">{fmt18(amount, 0)} WLF</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PastSalesSection({
  tokenSaleAddress,
  saleIdCounter,
  chainId,
}: {
  tokenSaleAddress: `0x${string}`;
  saleIdCounter: bigint;
  chainId: number | undefined;
}) {
  const publicClient = usePublicClient({ chainId });
  const pastCount = Number(saleIdCounter);
  const pastIds = Array.from({ length: pastCount }, (_, i) => BigInt(i));

  // Batch-read sale metadata: for each past ID fetch sales(), saleWLFCollected(), saleUSDTCollected()
  const { data: salesData } = useReadContracts({
    contracts: pastIds.flatMap(id => [
      { address: tokenSaleAddress, abi: tokenSaleABI, functionName: 'sales' as const,             args: [id] as [bigint] },
      { address: tokenSaleAddress, abi: tokenSaleABI, functionName: 'saleWLFCollected' as const,  args: [id] as [bigint] },
      { address: tokenSaleAddress, abi: tokenSaleABI, functionName: 'saleUSDTCollected' as const, args: [id] as [bigint] },
    ]),
    query: { enabled: pastCount > 0 },
  });

  // Fetch all TokensPurchased logs and group by saleId
  const [buyersBySale, setBuyersBySale] = useState<Map<number, BuyerMap>>(new Map());
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState(false);

  useEffect(() => {
    if (!publicClient || pastCount === 0) return;
    let cancelled = false;
    setLogsLoading(true);
    setLogsError(false);

    publicClient.getLogs({
      address: tokenSaleAddress,
      event: PURCHASE_EVENT,
      fromBlock: 'earliest',
      toBlock: 'latest',
    }).then(logs => {
      if (cancelled) return;
      const map = new Map<number, BuyerMap>();
      for (const log of logs) {
        const sid = Number(log.args.saleId ?? 0n);
        if (!map.has(sid)) map.set(sid, new Map());
        const buyers = map.get(sid)!;
        const addr = (log.args.buyer ?? '').toLowerCase();
        buyers.set(addr, (buyers.get(addr) ?? 0n) + (log.args.amount ?? 0n));
      }
      setBuyersBySale(map);
      setLogsLoading(false);
    }).catch(() => {
      if (!cancelled) { setLogsError(true); setLogsLoading(false); }
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicClient, tokenSaleAddress, pastCount]);

  if (pastCount === 0) return null;

  return (
    <div className="mt-6 space-y-3">
      <h2 className="font-bold text-base text-white/80">Past Sales</h2>
      {pastIds.map((id, i) => {
        type SaleTuple = [bigint, bigint, bigint, boolean];
        const sale = salesData?.[i * 3]?.result as SaleTuple | undefined;
        const wlf  = salesData?.[i * 3 + 1]?.result as bigint | undefined;
        const usdt = salesData?.[i * 3 + 2]?.result as bigint | undefined;
        return (
          <SalePastCard
            key={Number(id)}
            saleId={Number(id)}
            price={sale?.[2]}
            wlfCollected={wlf}
            usdtCollected={usdt}
            buyers={buyersBySale.get(Number(id)) ?? new Map()}
            logsLoading={logsLoading}
            logsError={logsError}
          />
        );
      })}
    </div>
  );
}

export default function TokenSale() {
  const { address, chainId } = useAccount();
  const { tokenBalance } = useChain();
  const { theme } = useTheme();

  const tokenSaleAddress = getAddress(chainId, 'TokenSale');
  const usdtAddress = getAddress(chainId, 'USDT');

  const [amount, setAmount] = useState('1');
  const [message, setMessage] = useState('');
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  // ── Reads ──────────────────────────────────────────────────────────────────

  const { data: saleIdCounter } = useReadContract({
    address: tokenSaleAddress,
    abi: tokenSaleABI,
    functionName: 'saleIdCounter',
    query: { enabled: !!tokenSaleAddress },
  });

  const { data: saleData, refetch: refetchSaleData } = useReadContract({
    address: tokenSaleAddress,
    abi: tokenSaleABI,
    functionName: 'sales',
    args: [saleIdCounter ?? 0n],
    query: { enabled: !!tokenSaleAddress && saleIdCounter !== undefined, refetchInterval: 5_000 },
  });

  const { data: saleActive, refetch: refetchSaleActive } = useReadContract({
    address: tokenSaleAddress,
    abi: tokenSaleABI,
    functionName: 'saleActive',
    query: { enabled: !!tokenSaleAddress, refetchInterval: 5_000 },
  });

  const { data: contractPrice } = useReadContract({
    address: tokenSaleAddress,
    abi: tokenSaleABI,
    functionName: 'price',
    query: { enabled: !!tokenSaleAddress },
  });

  const { data: usdtBalance, refetch: refetchUsdtBalance } = useReadContract({
    address: usdtAddress,
    abi: erc20ABI,
    functionName: 'balanceOf',
    args: [address!],
    query: { enabled: !!address && !!usdtAddress },
  });

  const { data: usdtAllowance, refetch: refetchAllowance } = useReadContract({
    address: usdtAddress,
    abi: erc20ABI,
    functionName: 'allowance',
    args: [address!, tokenSaleAddress!],
    query: { enabled: !!address && !!usdtAddress && !!tokenSaleAddress },
  });

  const { data: userPurchase } = useReadContract({
    address: tokenSaleAddress,
    abi: tokenSaleABI,
    functionName: 'purchases',
    args: [saleIdCounter ?? 0n, address!],
    query: { enabled: !!tokenSaleAddress && !!address && saleIdCounter !== undefined },
  });

  const { data: saleLPCreated, refetch: refetchSaleLPCreated } = useReadContract({
    address: tokenSaleAddress,
    abi: tokenSaleABI,
    functionName: 'saleLPCreated',
    args: [saleIdCounter ?? 0n],
    query: { enabled: !!tokenSaleAddress && saleIdCounter !== undefined, refetchInterval: 5_000 },
  });

  const { data: wlfCollected } = useReadContract({
    address: tokenSaleAddress,
    abi: tokenSaleABI,
    functionName: 'saleWLFCollected',
    args: [saleIdCounter ?? 0n],
    query: { enabled: !!tokenSaleAddress && saleIdCounter !== undefined, refetchInterval: 5_000 },
  });

  const { data: saleFounder } = useReadContract({
    address: tokenSaleAddress,
    abi: tokenSaleABI,
    functionName: 'founder',
    query: { enabled: !!tokenSaleAddress },
  });

  const { data: usdtCollected } = useReadContract({
    address: tokenSaleAddress,
    abi: tokenSaleABI,
    functionName: 'saleUSDTCollected',
    args: [saleIdCounter ?? 0n],
    query: { enabled: !!tokenSaleAddress && saleIdCounter !== undefined, refetchInterval: 10_000 },
  });

  const { data: usdtWlfCollected } = useReadContract({
    address: tokenSaleAddress,
    abi: tokenSaleABI,
    functionName: 'saleUSDTWLFCollected',
    args: [saleIdCounter ?? 0n],
    query: { enabled: !!tokenSaleAddress && saleIdCounter !== undefined, refetchInterval: 10_000 },
  });

  // ── Writes ─────────────────────────────────────────────────────────────────

  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>();
  const [buyTxHash, setBuyTxHash] = useState<`0x${string}` | undefined>();
  const [endSaleTxHash, setEndSaleTxHash] = useState<`0x${string}` | undefined>();

  const { writeContract: writeApprove, isPending: isApprovePending } = useWriteContract();
  const { writeContract: writeBuy, isPending: isBuyPending } = useWriteContract();
  const { writeContract: writeEndSale, isPending: isEndSalePending } = useWriteContract();

  const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } = useWaitForTransactionReceipt({ hash: approveTxHash });
  const { isLoading: isBuyConfirming, isSuccess: isBuyConfirmed } = useWaitForTransactionReceipt({ hash: buyTxHash });
  const { isLoading: isEndSaleConfirming, isSuccess: isEndSaleConfirmed } = useWaitForTransactionReceipt({ hash: endSaleTxHash });

  useEffect(() => {
    if (isApproveConfirmed) void refetchAllowance();
  }, [isApproveConfirmed, refetchAllowance]);

  useEffect(() => {
    if (isBuyConfirmed) {
      showMessage('Purchase successful!');
      void refetchAllowance();
      void refetchUsdtBalance();
      void refetchSaleData();
      void refetchSaleActive();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBuyConfirmed]);

  useEffect(() => {
    if (isEndSaleConfirmed) void refetchSaleLPCreated();
  }, [isEndSaleConfirmed, refetchSaleLPCreated]);

  // ── Pool price & LP split estimate ─────────────────────────────────────────

  const poolPrice = useWLFPrice(); // human USDT per WLF, or null

  const lpSplitEstimate = (() => {
    if (poolPrice === null || poolPrice === 0) return null;
    const wlfHuman  = Number(formatEther(usdtWlfCollected ?? 0n));   // WLF (18 dec → float)
    const usdtHuman = Number(formatUnits(usdtCollected ?? 0n, 6));   // USDT (6 dec → float)
    if (wlfHuman === 0 && usdtHuman === 0) return null;

    const usdtNeeded = wlfHuman * poolPrice; // USDT needed to pair all WLF at pool price

    if (usdtHuman >= usdtNeeded) {
      // Excess USDT → Treasury; all WLF goes to LP
      return {
        lpWlf:  wlfHuman,
        lpUsdt: usdtNeeded,
        treasuryWlf:  0,
        treasuryUsdt: usdtHuman - usdtNeeded,
        excessToken: 'USDT' as const,
      };
    } else {
      // Excess WLF → Treasury; all USDT goes to LP
      const wlfNeeded = usdtHuman / poolPrice;
      return {
        lpWlf:  wlfNeeded,
        lpUsdt: usdtHuman,
        treasuryWlf:  wlfHuman - wlfNeeded,
        treasuryUsdt: 0,
        excessToken: 'WLF' as const,
      };
    }
  })();

  // ── Derived values ─────────────────────────────────────────────────────────

  const tokensAvailable = saleData?.[1];
  const pricePerToken = contractPrice ?? 0n;

  // Progress bar: sold / total
  const tokensSold = wlfCollected ?? 0n;
  const totalTokens = tokensAvailable !== undefined ? tokensAvailable + tokensSold : undefined;
  const pctSold = totalTokens !== undefined && totalTokens > 0n
    ? Number((tokensSold * 10000n) / totalTokens) / 100  // two decimal places
    : 0;

  // WLF wei amount (18 decimals) — this is what the contract's _amount param expects
  const amountWei = (() => {
    try { return parseUnits(amount || '0', 18); } catch { return 0n; }
  })();

  // USDT cost in 6-decimal units: N_wlf * price(18dec) / 10^12
  // price = 0.01 ether = 10^16; 1 WLF → 10^16 / 10^12 = 10^4 = 0.01 USDT (in 6-dec)
  const usdtCost = BigInt(Math.max(0, Number(amount) || 0)) * pricePerToken / 10n ** 12n;

  const hasEnoughAllowance = usdtAllowance !== undefined && usdtAllowance >= usdtCost;
  const hasEnoughUsdt = usdtBalance !== undefined && usdtBalance >= usdtCost;
  const isLoading = isApprovePending || isApproveConfirming || isBuyPending || isBuyConfirming;

  const isFounder = !!saleFounder && !!address && saleFounder.toLowerCase() === address.toLowerCase();

  const amountError: string | null = (() => {
    if (amountWei <= 0n) return 'Enter an amount greater than 0';
    if (tokensAvailable !== undefined && amountWei > tokensAvailable) return 'Exceeds tokens available';
    return null;
  })();

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const showMessage = (msg: string) => {
    setMessage(msg);
    setIsPopupOpen(true);
  };

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleEndSale = () => {
    if (!tokenSaleAddress) return showMessage('Contract not found on this network.');
    writeEndSale(
      { address: tokenSaleAddress, abi: tokenSaleABI, functionName: 'endSale', args: [] },
      { onSuccess: (hash) => setEndSaleTxHash(hash) },
    );
  };

  const handleApprove = () => {
    if (!usdtAddress || !tokenSaleAddress) return showMessage('Contracts not found on this network.');
    const maxUint256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
    writeApprove(
      { address: usdtAddress, abi: erc20ABI, functionName: 'approve', args: [tokenSaleAddress, maxUint256] },
      { onSuccess: (hash) => setApproveTxHash(hash) },
    );
  };

  const handleBuyUsdt = () => {
    if (!tokenSaleAddress) return showMessage('Contracts not found on this network.');
    if (!saleActive) return showMessage('Sale is not active.');
    if (amountWei <= 0n) return showMessage('Enter a valid amount.');
    if (!hasEnoughUsdt) return showMessage('Insufficient USDT balance.');
    writeBuy(
      {
        address: tokenSaleAddress,
        abi: tokenSaleABI,
        functionName: 'buyTokens',
        args: [amountWei, amountWei, usdtCost],
      },
      { onSuccess: (hash) => setBuyTxHash(hash) },
    );
  };

  // ── Guards ─────────────────────────────────────────────────────────────────

  if (!address) {
    return (
      <PageContainer centered maxWidth="sm">
        <p className={theme.textMuted}>Connect your wallet to participate in the token sale.</p>
      </PageContainer>
    );
  }

  if (!tokenSaleAddress) {
    return (
      <PageContainer centered maxWidth="sm">
        <p className={theme.textMuted}>TokenSale not deployed on chain {chainId}.</p>
      </PageContainer>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <PageContainer maxWidth="sm">
      <Card title="Token Sale">
        {/* ── How it works ── */}
        <div
          className="rounded-lg p-4 mb-6 border text-sm space-y-3"
          style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
        >
          <p className="font-semibold text-white">How it works</p>
          <ol className="list-decimal list-inside space-y-2" style={{ color: theme.textMuted }}>
            <li>
              You pay USDT — it is held in the sale contract alongside the matching WLF tokens until the sale closes.
            </li>
            <li>
              When the sale ends, the pooled USDT and WLF are deposited together into a{' '}
              <strong className="text-white">Uniswap v3 WLF/USDT liquidity position</strong>.
              This is what creates (and deepens) the on-chain market for WLF.
            </li>
            <li>
              Any small remainder of USDT or WLF that could not be perfectly paired — due to the current
              Uniswap pool price ratio — is forwarded to the{' '}
              <strong className="text-white">DAO Treasury</strong> rather than being wasted.
            </li>
            <li>
              LP staking shares are automatically distributed to every buyer proportional to their USDT paid,
              locked for <strong className="text-white">5 years</strong>.
            </li>
            <li>
              Those shares earn <strong className="text-white">WLF rewards continuously</strong> — at the same APY as direct WLF staking.
            </li>
          </ol>
        </div>

        {/* ── Sale info ── */}
        <div className="space-y-0.5 mb-6">
          <Row
            label="Sale #"
            value={saleIdCounter === undefined ? '…' : saleIdCounter.toString()}
          />
          <Row
            label="Status"
            value={
              saleActive === undefined ? '…' :
                <span className={saleActive ? 'text-green-400 font-semibold' : 'text-red-400'}>
                  {saleActive ? 'Active' : 'Ended'}
                </span>
            }
          />
          <Row
            label="Price"
            value={contractPrice === undefined ? '…' : `${formatEther(pricePerToken)} USDT / WLF`}
          />
        </div>

        {/* ── Sale progress bar ── */}
        <div className="mb-6">
          <div className="flex justify-between text-xs mb-1.5" style={{ color: theme.textMuted }}>
            <span>
              {totalTokens === undefined ? '…' : `${fmt18(tokensSold)} sold`}
            </span>
            <span>
              {totalTokens === undefined ? '' : `${fmt18(tokensAvailable)} remaining`}
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: totalTokens === undefined ? '0%' : `${pctSold}%`,
                background: pctSold >= 90 ? '#ef4444' : pctSold >= 60 ? '#f59e0b' : '#52b788',
              }}
            />
          </div>
          <div className="text-right text-xs mt-1" style={{ color: theme.textMuted }}>
            {totalTokens === undefined ? '' : `${pctSold.toFixed(1)}% sold`}
            {totalTokens !== undefined && (
              <span className="ml-2">of {fmt18(totalTokens)} WLF total</span>
            )}
          </div>
        </div>

        {/* ── LP split estimate ── */}
        {(usdtCollected !== undefined || poolPrice !== null) && (
          <div
            className="rounded-lg p-4 mb-6 border text-sm space-y-3"
            style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-white">Estimated distribution at sale end</p>
              {poolPrice !== null ? (
                <span className="text-xs font-mono px-2 py-0.5 rounded-full border border-white/10 text-white/50">
                  Pool: ${poolPrice < 0.001 ? poolPrice.toFixed(6) : poolPrice.toFixed(4)} / WLF
                </span>
              ) : (
                <span className="text-xs text-white/30 italic">No pool yet</span>
              )}
            </div>

            {/* Collected totals */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <p className="text-xs text-white/40 mb-0.5">Collected USDT</p>
                <p className="font-mono text-white text-sm">${fmt6(usdtCollected ?? 0n, 2)}</p>
              </div>
              <div className="rounded-lg p-2.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <p className="text-xs text-white/40 mb-0.5">Paired WLF</p>
                <p className="font-mono text-white text-sm">{fmt18(usdtWlfCollected ?? 0n, 0)}</p>
              </div>
            </div>

            {lpSplitEstimate ? (
              <div className="space-y-2">
                {/* Uniswap LP row */}
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-xs font-bold px-1.5 py-0.5 rounded bg-blue-900/40 text-blue-300 border border-blue-700/40 shrink-0">LP</span>
                  <div>
                    <p style={{ color: theme.textMuted }} className="text-xs">
                      → Uniswap v3 WLF/USDT position
                    </p>
                    <p className="text-sm font-mono text-white">
                      {lpSplitEstimate.lpWlf.toLocaleString(undefined, { maximumFractionDigits: 0 })} WLF
                      {' + '}
                      ${lpSplitEstimate.lpUsdt.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT
                    </p>
                  </div>
                </div>

                {/* Treasury row */}
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 text-xs font-bold px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-700/40 shrink-0">DAO</span>
                  <div>
                    <p style={{ color: theme.textMuted }} className="text-xs">
                      → Treasury (unpaired remainder)
                    </p>
                    {lpSplitEstimate.excessToken === 'USDT' ? (
                      <p className="text-sm font-mono text-white">
                        ${lpSplitEstimate.treasuryUsdt.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT
                        {lpSplitEstimate.treasuryUsdt < 0.01 && (
                          <span className="text-xs text-white/40 ml-1">(negligible)</span>
                        )}
                      </p>
                    ) : (
                      <p className="text-sm font-mono text-white">
                        {lpSplitEstimate.treasuryWlf.toLocaleString(undefined, { maximumFractionDigits: 0 })} WLF
                        {lpSplitEstimate.treasuryWlf < 1 && (
                          <span className="text-xs text-white/40 ml-1">(negligible)</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                <p className="text-xs text-white/25 pt-1">
                  * Estimate based on current pool price. Actual amounts depend on pool price at the moment <code>endSale()</code> is executed.
                </p>
              </div>
            ) : (
              <p className="text-xs text-white/30 italic">
                {poolPrice === null
                  ? 'No active WLF/USDT pool — the sale will seed the initial Uniswap price.'
                  : 'No funds collected yet.'}
              </p>
            )}
          </div>
        )}

        {/* ── Wallet balances ── */}
        <div className="space-y-0.5 mb-6">
          <Row
            label="USDT balance"
            value={usdtBalance === undefined ? '…' : `${fmt6(usdtBalance)} USDT`}
          />
          <Row
            label="WLF balance"
            value={tokenBalance !== null ? `${tokenBalance} WLF` : '—'}
          />
        </div>

        {/* ── Post-sale CTA or buy form ── */}
        {saleActive === false ? (
          <div
            className="rounded-lg p-4 border"
            style={{ borderColor: '#52b788', background: 'rgba(82,183,136,0.07)' }}
          >
            <p className="font-semibold text-white mb-1">
              Sale #{saleIdCounter?.toString()} has ended
            </p>
            {userPurchase !== undefined && userPurchase > 0n && (
              <p className={`text-sm mb-3 ${theme.textMuted}`}>
                Your purchase:{' '}
                <span className="font-semibold text-white">{fmt18(userPurchase)} WLF</span>
              </p>
            )}
            {!saleLPCreated ? (
              <>
                {isFounder ? (
                  <>
                    <p className={`text-sm mb-3 ${theme.textMuted}`}>
                      Create the Uniswap LP position and lock all buyer shares for 5 years.
                    </p>
                    <Button
                      variant="success"
                      fullWidth
                      onClick={handleEndSale}
                      loading={isEndSalePending || isEndSaleConfirming}
                    >
                      Create LP &amp; Lock All Shares
                    </Button>
                  </>
                ) : (
                  <p className={`text-sm ${theme.textMuted}`}>
                    Waiting for the founder to create the Uniswap LP position and lock buyer shares…
                  </p>
                )}
              </>
            ) : (
              <>
                <Link to="/staking?tab=lp">
                  <Button variant="success" fullWidth>
                    View Staking Positions →
                  </Button>
                </Link>
              </>
            )}
          </div>
        ) : (
          <>
            {/* ── Buy form ── */}
            <div className="space-y-3">
              <Input
                label="Amount of WLF to buy"
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isLoading}
              />
              {amountError && (
                <p className="text-red-400 text-xs -mt-1">{amountError}</p>
              )}

              <p className={`text-sm ${theme.textMuted}`}>
                Total cost: <span className="font-semibold text-white">{fmt6(usdtCost)} USDT</span>
              </p>

              {!hasEnoughAllowance ? (
                <Button
                  variant="info"
                  fullWidth
                  onClick={handleApprove}
                  disabled={!!amountError}
                  loading={isApprovePending || isApproveConfirming}
                >
                  Approve USDT (one-time)
                </Button>
              ) : (
                <Button
                  variant="primary"
                  fullWidth
                  onClick={handleBuyUsdt}
                  disabled={!!amountError || !hasEnoughUsdt}
                  loading={isBuyPending || isBuyConfirming}
                >
                  Buy with USDT
                </Button>
              )}
            </div>
          </>
        )}

        {/* ── Tx hashes ── */}
        {(approveTxHash || buyTxHash) && (
          <div className={`mt-3 space-y-1 text-xs ${theme.textMuted} break-all`}>
            {approveTxHash && <p>Approve tx: {approveTxHash}</p>}
            {buyTxHash && <p>Buy tx: {buyTxHash}</p>}
          </div>
        )}
      </Card>

      {/* ── Past Sales ── */}
      {tokenSaleAddress && saleIdCounter !== undefined && saleIdCounter > 0n && (
        <PastSalesSection
          tokenSaleAddress={tokenSaleAddress}
          saleIdCounter={saleIdCounter}
          chainId={chainId}
        />
      )}

      {/* ── Message popup ── */}
      {isPopupOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 backdrop-blur-sm"
          onClick={() => setIsPopupOpen(false)}
        >
          <div
            className={`${theme.card} w-full max-w-sm mx-4`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`px-6 py-4 ${theme.divider}`}>
              <h3 className="font-semibold">Notice</h3>
            </div>
            <div className="px-6 py-5">
              <p className={`mb-4 ${theme.textSecondary}`}>{message}</p>
              <Button variant="primary" onClick={() => setIsPopupOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
