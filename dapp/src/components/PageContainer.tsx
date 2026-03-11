import type { ReactNode } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

type MaxWidth = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const WIDTH_CLASSES: Record<MaxWidth, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-5xl',
};

interface PageContainerProps {
  children: ReactNode;
  maxWidth?: MaxWidth;
  centered?: boolean;
}

export function PageContainer({
  children,
  maxWidth = 'lg',
  centered = false,
}: PageContainerProps) {
  const { theme } = useTheme();

  return (
    <div className={`${theme.page} pb-24 md:pb-12`}>
      <div
        className={[
          'mx-auto px-4 pt-28',
          WIDTH_CLASSES[maxWidth],
          centered ? 'flex flex-col items-center justify-center min-h-[calc(100vh-5rem)]' : '',
        ].join(' ')}
      >
        {children}
      </div>
    </div>
  );
}
