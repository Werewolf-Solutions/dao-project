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

// Format 18-decimal bigint (WLF, ETH)
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
  const { ETHBalance, tokenBalance, loadContracts } = useChain();
  const { theme } = useTheme();

  const tokenSaleAddress = getAddress(chainId, 'TokenSale');
  const usdtAddress = getAddress(chainId, 'USDT');

  const [amount, setAmount] = useState('1');
  const [payMode, setPayMode] = useState<'usdt' | 'eth'>('usdt');
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

  const { data: saleLPETHCreated } = useReadContract({
    address: tokenSaleAddress,
    abi: tokenSaleABI,
    functionName: 'saleLPETHCreated',
    args: [saleIdCounter ?? 0n],
    query: { enabled: !!tokenSaleAddress && saleIdCounter !== undefined, refetchInterval: 5_000 },
  });

  // ── Writes ─────────────────────────────────────────────────────────────────

  const { writeContract: writeApprove, data: approveTxHash, isPending: isApprovePending } = useWriteContract();
  const { writeContract: writeBuy, data: buyTxHash, isPending: isBuyPending } = useWriteContract();
  const { writeContract: writeBuyEth, data: buyEthTxHash, isPending: isBuyEthPending } = useWriteContract();
  const { writeContract: writeEndSale, data: endSaleTxHash, isPending: isEndSalePending } = useWriteContract();

  const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } = useWaitForTransactionReceipt({ hash: approveTxHash });
  const { isLoading: isBuyConfirming, isSuccess: isBuyConfirmed } = useWaitForTransactionReceipt({ hash: buyTxHash });
  const { isLoading: isBuyEthConfirming, isSuccess: isBuyEthConfirmed } = useWaitForTransactionReceipt({ hash: buyEthTxHash });
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
    if (isBuyEthConfirmed) {
      showMessage('Purchase successful!');
      void refetchSaleData();
      void refetchSaleActive();
      void loadContracts();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBuyEthConfirmed]);

  useEffect(() => {
    if (isEndSaleConfirmed) void refetchSaleLPCreated();
  }, [isEndSaleConfirmed, refetchSaleLPCreated]);

  // ── Derived values ─────────────────────────────────────────────────────────

  const tokensAvailable = saleData?.[1];
  const pricePerToken = contractPrice ?? 0n;

  // WLF wei amount (18 decimals) — this is what the contract's _amount param expects
  const amountWei = (() => {
    try { return parseUnits(amount || '0', 18); } catch { return 0n; }
  })();

  // USDT cost in 6-decimal units: N_wlf * price(18dec) / 10^12
  // price = 0.001 ether = 10^15; 1 WLF → 10^15 / 10^12 = 10^3 = 0.001 USDT (in 6-dec)
  const usdtCost = BigInt(Math.max(0, Number(amount) || 0)) * pricePerToken / 10n ** 12n;

  // ETH cost in wei: amountWei * price / 10^18
  // 1 WLF: 10^18 * 10^15 / 10^18 = 10^15 = 0.001 ETH
  const ethCost = amountWei * pricePerToken / 10n ** 18n;

  const hasEnoughAllowance = usdtAllowance !== undefined && usdtAllowance >= usdtCost;
  const hasEnoughUsdt = usdtBalance !== undefined && usdtBalance >= usdtCost;
  const hasEnoughEth = ETHBalance !== null && ETHBalance !== undefined && ETHBalance.value >= ethCost;
  const isLoading = isApprovePending || isApproveConfirming || isBuyPending || isBuyConfirming || isBuyEthPending || isBuyEthConfirming;

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

  const handleBuyEth = () => {
    if (!tokenSaleAddress) return showMessage('Contracts not found on this network.');
    if (!saleActive) return showMessage('Sale is not active.');
    if (amountWei <= 0n) return showMessage('Enter a valid amount.');
    if (!hasEnoughEth) return showMessage('Insufficient ETH balance.');
    writeBuyEth({
      address: tokenSaleAddress,
      abi: tokenSaleABI,
      functionName: 'buyTokensWithEth',
      args: [amountWei],
      value: ethCost,
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
            <li>You pay USDT or ETH — your payment is held alongside WLF tokens in the contract.</li>
            <li>After the sale ends, the pooled funds create a <strong className="text-white">Uniswap v3 LP position</strong> (WLF/USDT and/or WLF/ETH).</li>
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
          <Row
            label="Tokens available"
            value={tokensAvailable === undefined ? '…' : `${fmt18(tokensAvailable)} WLF`}
          />
        </div>

        {/* ── Wallet balances ── */}
        <div className="space-y-0.5 mb-6">
          <Row
            label="ETH balance"
            value={ETHBalance ? `${Number(formatEther(ETHBalance.value)).toFixed(4)} ETH` : '—'}
          />
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
            {!saleLPCreated && !saleLPETHCreated ? (
              <>
                <p className={`text-sm mb-3 ${theme.textMuted}`}>
                  The Uniswap LP position has not been created yet. The owner triggers this step —
                  it creates the LP and automatically locks all buyer shares for 5 years.
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
              <Link to="/staking?tab=lp">
                <Button variant="success" fullWidth>
                  View Staking Positions →
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* ── Payment toggle ── */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setPayMode('usdt')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  payMode === 'usdt'
                    ? 'bg-[#8e2421] text-white'
                    : `bg-[#0f1117] ${theme.textMuted} hover:text-white`
                }`}
              >
                Pay with USDT
              </button>
              <button
                onClick={() => setPayMode('eth')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  payMode === 'eth'
                    ? 'bg-[#8e2421] text-white'
                    : `bg-[#0f1117] ${theme.textMuted} hover:text-white`
                }`}
              >
                Pay with ETH
              </button>
            </div>

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

              <p className={`text-sm ${theme.textMuted}`}>
                {payMode === 'usdt' ? (
                  <>Total cost: <span className="font-semibold text-white">{fmt6(usdtCost)} USDT</span></>
                ) : (
                  <>Total cost: <span className="font-semibold text-white">{Number(formatEther(ethCost)).toFixed(6)} ETH</span></>
                )}
              </p>

              {payMode === 'usdt' ? (
                !hasEnoughAllowance ? (
                  <Button
                    variant="info"
                    fullWidth
                    onClick={handleApprove}
                    disabled={amountWei <= 0n}
                    loading={isApprovePending || isApproveConfirming}
                  >
                    Approve USDT (one-time)
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={handleBuyUsdt}
                    disabled={amountWei <= 0n || !hasEnoughUsdt}
                    loading={isBuyPending || isBuyConfirming}
                  >
                    Buy with USDT
                  </Button>
                )
              ) : (
                <Button
                  variant="primary"
                  fullWidth
                  onClick={handleBuyEth}
                  disabled={amountWei <= 0n || !hasEnoughEth}
                  loading={isBuyEthPending || isBuyEthConfirming}
                >
                  Buy with ETH
                </Button>
              )}
            </div>
          </>
        )}

        {/* ── Tx hashes ── */}
        {(approveTxHash || buyTxHash || buyEthTxHash) && (
          <div className={`mt-3 space-y-1 text-xs ${theme.textMuted} break-all`}>
            {approveTxHash && <p>Approve tx: {approveTxHash}</p>}
            {buyTxHash && <p>Buy (USDT) tx: {buyTxHash}</p>}
            {buyEthTxHash && <p>Buy (ETH) tx: {buyEthTxHash}</p>}
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
