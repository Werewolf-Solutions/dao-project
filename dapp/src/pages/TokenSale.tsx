import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits, formatEther } from 'viem';
import { tokenSaleABI, erc20ABI, getAddress } from '@/contracts';
import { useChain } from '@/contexts/ChainContext';
import { useTheme } from '@/contexts/ThemeContext';
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

  // ── Writes ─────────────────────────────────────────────────────────────────

  const { writeContract: writeApprove, data: approveTxHash, isPending: isApprovePending } = useWriteContract();
  const { writeContract: writeBuy, data: buyTxHash, isPending: isBuyPending } = useWriteContract();
  const { writeContract: writeEndSale, data: endSaleTxHash, isPending: isEndSalePending } = useWriteContract();

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
    writeEndSale({ address: tokenSaleAddress, abi: tokenSaleABI, functionName: 'endSale', args: [] });
  };

  const handleApprove = () => {
    if (!usdtAddress || !tokenSaleAddress) return showMessage('Contracts not found on this network.');
    // Approve max so the user only needs to approve once
    const maxUint256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
    writeApprove({
      address: usdtAddress,
      abi: erc20ABI,
      functionName: 'approve',
      args: [tokenSaleAddress, maxUint256],
    });
  };

  const handleBuyUsdt = () => {
    if (!tokenSaleAddress) return showMessage('Contracts not found on this network.');
    if (!saleActive) return showMessage('Sale is not active.');
    if (amountWei <= 0n) return showMessage('Enter a valid amount.');
    if (!hasEnoughUsdt) return showMessage('Insufficient USDT balance.');
    writeBuy({
      address: tokenSaleAddress,
      abi: tokenSaleABI,
      functionName: 'buyTokens',
      // _amount = WLF wei, amount0Desired = WLF wei, amount1Desired = USDT 6-dec
      args: [amountWei, amountWei, usdtCost],
    });
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
          className="rounded-lg p-4 mb-6 border text-sm space-y-2"
          style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}
        >
          <p className="font-semibold text-white">How it works</p>
          <ol className="list-decimal list-inside space-y-1" style={{ color: theme.textMuted }}>
            <li>You pay USDT — your payment is held alongside WLF tokens in the contract.</li>
            <li>After the sale ends, the pooled funds create a <strong className="text-white">Uniswap v3 LP position</strong> (WLF/USDT).</li>
            <li>You claim <strong className="text-white">LP staking shares</strong> on the Staking page, proportional to your purchase.</li>
            <li>Shares earn <strong className="text-white">WLF rewards continuously</strong> — same APY as WLF staking, locked 5 years.</li>
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
