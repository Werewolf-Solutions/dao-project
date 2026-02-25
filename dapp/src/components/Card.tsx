import type { ReactNode } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface CardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export function Card({ title, subtitle, children, className = '' }: CardProps) {
  const { theme } = useTheme();

  return (
    <div className={`${theme.card} ${className}`}>
      {(title ?? subtitle) && (
        <div className={`px-6 py-4 ${theme.divider}`}>
          {title && <h2 className="text-lg font-bold">{title}</h2>}
          {subtitle && <p className={`text-sm mt-0.5 ${theme.textSecondary}`}>{subtitle}</p>}
        </div>
      )}
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}
