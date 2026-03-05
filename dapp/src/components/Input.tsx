import type { ChangeEvent, CSSProperties } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface InputProps {
  label?: string;
  type?: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  hint?: string;
  min?: string;
  style?: CSSProperties;
}

export function Input({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled,
  hint,
  min,
  style,
}: InputProps) {
  const { theme } = useTheme();

  return (
    <div>
      {label && <label className={theme.label}>{label}</label>}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        style={style}
        className={theme.input}
      />
      {hint && <p className={`text-xs mt-1 ${theme.textMuted}`}>{hint}</p>}
    </div>
  );
}
