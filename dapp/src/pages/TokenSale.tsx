import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { tokenSaleABI, erc20ABI, getAddress } from '@/contracts';
import { useChain } from '@/contexts/ChainContext';
import { useTheme } from '@/contexts/ThemeContext';
import { PageContainer } from '@/components/PageContainer';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Row } from '@/components/Row';

function fmt18(raw: bigint | undefined, decimals = 2): string {
  if (raw === undefined) return '—';
  return Number(formatUnits(raw, 18)).toLocaleString(undefined, {
    maximumFractionDigits: decimals,
  });
}

export default function TokenSale() {
  const { address, chainId } = useAccount();
  const { ETHBalance, tokenBalance } = useChain();
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

  const { data: saleData } = useReadContract({
    address: tokenSaleAddress,
    abi: tokenSaleABI,
    functionName: 'sales',
    args: [saleIdCounter ?? 0n],
    query: { enabled: !!tokenSaleAddress && saleIdCounter !== undefined },
  });

  const { data: saleActive } = useReadContract({
    address: tokenSaleAddress,
    abi: tokenSaleABI,
    functionName: 'saleActive',
    query: { enabled: !!tokenSaleAddress },
  });

  const { data: contractPrice } = useReadContract({
    address: tokenSaleAddress,
    abi: tokenSaleABI,
    functionName: 'price',
    query: { enabled: !!tokenSaleAddress },
  });

  const { data: usdtBalance } = useReadContract({
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

  // ── Writes ─────────────────────────────────────────────────────────────────

  const { writeContract: writeApprove, data: approveTxHash, isPending: isApprovePending } = useWriteContract();
  const { writeContract: writeBuy, data: buyTxHash, isPending: isBuyPending } = useWriteContract();

  const { isLoading: isApproveConfirming, isSuccess: isApproveConfirmed } = useWaitForTransactionReceipt({ hash: approveTxHash });
  const { isLoading: isBuyConfirming, isSuccess: isBuyConfirmed } = useWaitForTransactionReceipt({ hash: buyTxHash });

  useEffect(() => {
    if (isApproveConfirmed) void refetchAllowance();
  }, [isApproveConfirmed, refetchAllowance]);

  useEffect(() => {
    if (isBuyConfirmed) showMessage('Purchase successful!');
  }, [isBuyConfirmed]);

  // ── Derived values ─────────────────────────────────────────────────────────

  const tokensAvailable = saleData?.[1];
  const pricePerToken = contractPrice ?? 0n;

  const amountBig = (() => {
    try { return parseUnits(amount || '0', 0); } catch { return 0n; }
  })();

  const usdtCost = amountBig * pricePerToken;
  const wlfDesired = amountBig * BigInt(10 ** 18);
  const hasEnoughAllowance = usdtAllowance !== undefined && usdtAllowance >= usdtCost;
  const hasEnoughUsdt = usdtBalance !== undefined && usdtBalance >= usdtCost;
  const isLoading = isApprovePending || isApproveConfirming || isBuyPending || isBuyConfirming;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const showMessage = (msg: string) => {
    setMessage(msg);
    setIsPopupOpen(true);
  };

  const handleApprove = () => {
    if (!usdtAddress || !tokenSaleAddress) return showMessage('Contracts not found on this network.');
    writeApprove({
      address: usdtAddress,
      abi: erc20ABI,
      functionName: 'approve',
      args: [tokenSaleAddress, usdtCost],
    });
  };

  const handleBuy = () => {
    if (!tokenSaleAddress) return showMessage('Contracts not found on this network.');
    if (!saleActive) return showMessage('Sale is not active.');
    if (amountBig <= 0n) return showMessage('Enter a valid amount.');
    if (!hasEnoughUsdt) return showMessage('Insufficient USDT balance.');

    writeBuy({
      address: tokenSaleAddress,
      abi: tokenSaleABI,
      functionName: 'buyTokens',
      args: [amountBig, wlfDesired, usdtCost],
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

  return (
    <PageContainer maxWidth="sm">
      <Card title="Token Sale">
        {/* Info grid */}
        <div className="space-y-0.5 mb-6">
          <Row label="Sale status" value={saleActive === undefined ? '…' : saleActive ? 'Active ✓' : 'Inactive'} />
          <Row label="Price" value={contractPrice === undefined ? '…' : `${fmt18(pricePerToken, 4)} USDT / WLF`} />
          <Row label="Tokens available" value={tokensAvailable === undefined ? '…' : fmt18(tokensAvailable)} />
          <Row label="ETH balance" value={ETHBalance ? `${(Number(ETHBalance.value) / 10 ** ETHBalance.decimals).toFixed(4)} ETH` : '—'} />
          <Row label="WLF balance" value={tokenBalance ?? '—'} />
          <Row label="USDT balance" value={usdtBalance === undefined ? '…' : fmt18(usdtBalance)} />
        </div>

        {/* Buy form */}
        <div className="space-y-3">
          <Input
            label="Amount of WLF to buy"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={!saleActive || isLoading}
          />
          <p className={`text-sm ${theme.textMuted}`}>
            Total cost: <span className="font-semibold text-white">{fmt18(usdtCost, 4)} USDT</span>
          </p>

          {!hasEnoughAllowance ? (
            <Button
              variant="info"
              fullWidth
              onClick={handleApprove}
              disabled={amountBig <= 0n}
              loading={isApprovePending || isApproveConfirming}
            >
              Approve USDT
            </Button>
          ) : (
            <Button
              variant="primary"
              fullWidth
              onClick={handleBuy}
              disabled={!saleActive || amountBig <= 0n || !hasEnoughUsdt}
              loading={isBuyPending || isBuyConfirming}
            >
              {!saleActive ? 'Sale not active' : 'Buy Tokens'}
            </Button>
          )}
        </div>

        {/* Tx hashes */}
        {(approveTxHash || buyTxHash) && (
          <div className={`mt-3 space-y-1 text-xs ${theme.textMuted} break-all`}>
            {approveTxHash && <p>Approve tx: {approveTxHash}</p>}
            {buyTxHash && <p>Buy tx: {buyTxHash}</p>}
          </div>
        )}
      </Card>

      {/* Message popup */}
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
