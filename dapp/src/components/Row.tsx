import type { ReactNode } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface RowProps {
  label: ReactNode;
  value: ReactNode;
}

export function Row({ label, value }: RowProps) {
  const { theme } = useTheme();

  return (
    <div className={`flex justify-between items-center py-2.5 ${theme.divider}`}>
      <span className={`text-sm ${theme.textSecondary}`}>{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}
