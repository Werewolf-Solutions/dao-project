import type { ReactNode } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'info' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
  title?: string;
  children: ReactNode;
}

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

const SPINNER_SIZE: Record<Size, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  onClick,
  type = 'button',
  title,
  children,
}: ButtonProps) {
  const { theme } = useTheme();

  const variantClass = {
    primary:   theme.btnPrimary,
    secondary: theme.btnSecondary,
    danger:    theme.btnDanger,
    success:   theme.btnSuccess,
    info:      theme.btnInfo,
    outline:   theme.btnOutline,
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={[
        variantClass,
        SIZE_CLASSES[size],
        fullWidth ? 'w-full' : '',
        'inline-flex items-center justify-center gap-2',
      ].join(' ')}
    >
      {loading && <Spinner className={SPINNER_SIZE[size]} />}
      {children}
    </button>
  );
}
