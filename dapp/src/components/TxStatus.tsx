import { useTheme } from '@/contexts/ThemeContext';
import { Spinner } from './Spinner';

interface TxStatusProps {
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  txHash?: string;
  label?: string;
}

export function TxStatus({ isPending, isConfirming, isConfirmed, txHash, label = 'Transaction' }: TxStatusProps) {
  const { theme } = useTheme();

  if (!isPending && !isConfirming && !isConfirmed) return null;

  return (
    <div className={`mt-3 p-3 rounded-lg text-sm ${theme.cardNested}`}>
      {isPending && (
        <div className="flex items-center gap-2 text-yellow-400">
          <Spinner className="h-4 w-4" />
          <span>{label}: waiting for wallet confirmation…</span>
        </div>
      )}
      {isConfirming && (
        <div className="flex items-center gap-2 text-blue-400">
          <Spinner className="h-4 w-4" />
          <span>Confirming {label}…</span>
          {txHash && <span className={`${theme.textMuted} truncate max-w-xs`}>{txHash.slice(0, 12)}…</span>}
        </div>
      )}
      {isConfirmed && (
        <div className="flex items-center gap-2 text-emerald-400">
          <span>✓</span>
          <span>{label} confirmed!</span>
          {txHash && <span className={`${theme.textMuted} truncate max-w-xs`}>{txHash.slice(0, 12)}…</span>}
        </div>
      )}
    </div>
  );
}
