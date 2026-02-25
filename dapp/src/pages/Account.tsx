import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useChain } from '@/contexts/ChainContext';
import { useTheme } from '@/contexts/ThemeContext';
import { PageContainer } from '@/components/PageContainer';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Row } from '@/components/Row';

export default function Account() {
  const account = useAccount();
  const { connectors, connect, status, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { ETHBalance, tokenBalance } = useChain();
  const { theme } = useTheme();

  const ethDisplay = ETHBalance
    ? `${(Number(ETHBalance.value) / 10 ** ETHBalance.decimals).toFixed(4)} ETH`
    : '—';

  return (
    <PageContainer maxWidth="md">
      <h1 className="text-3xl font-bold mb-1">Account</h1>
      <p className={`text-sm ${theme.textSecondary} mb-6`}>
        View your wallet details and manage your connection.
      </p>

      <div className="space-y-4">
        {/* Account info */}
        <Card title="Wallet Information">
          <Row label="Status" value={account.status} />
          <Row label="Chain ID" value={account.chainId ?? '—'} />
          <Row
            label="Address"
            value={
              account.address ? (
                <span className="font-mono text-xs break-all">{account.address}</span>
              ) : '—'
            }
          />
          <Row label="ETH Balance" value={ethDisplay} />
          <Row label="WLF Balance" value={tokenBalance ?? '—'} />

          {account.status === 'connected' && (
            <div className="mt-4">
              <Button variant="danger" onClick={() => disconnect()}>Disconnect</Button>
            </div>
          )}
        </Card>

        {/* Connect section */}
        <Card title="Connect Wallet">
          <div className="space-y-3">
            {connectors.map((connector) => (
              <Button
                key={connector.uid}
                variant="info"
                fullWidth
                onClick={() => connect({ connector })}
              >
                {connector.name}
              </Button>
            ))}
          </div>
          {status === 'pending' && (
            <p className={`text-sm text-center mt-3 ${theme.textMuted}`}>Connecting…</p>
          )}
          {error && (
            <p className="text-sm text-center mt-3 text-red-400">{error.message}</p>
          )}
        </Card>
      </div>
    </PageContainer>
  );
}
