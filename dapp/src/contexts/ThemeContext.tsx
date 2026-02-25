import type { ReactNode } from 'react';

// Single dark theme — plain constant, no React context needed.
// Usage:  import { theme } from '@/contexts/ThemeContext';
//  or:    import { useTheme } from '@/contexts/ThemeContext';  (legacy shim)

export const theme = {
  // ── Page & surfaces ─────────────────────────────────────────────────────────
  page:       'min-h-screen bg-[#0f1117] text-white',
  card:       'bg-[#161b27] rounded-2xl border border-white/[0.08] shadow-2xl',
  cardNested: 'bg-[#1e2433] rounded-xl border border-white/[0.06]',

  // ── Buttons ──────────────────────────────────────────────────────────────────
  btnPrimary:   'bg-[#8e2421] hover:bg-[#a12c29] active:bg-[#7a1f1d] text-white font-semibold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed',
  btnSecondary: 'bg-white/[0.08] hover:bg-white/[0.12] text-white font-semibold rounded-lg border border-white/[0.12] transition-all disabled:opacity-40 disabled:cursor-not-allowed',
  btnDanger:    'bg-red-700 hover:bg-red-600 text-white font-semibold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed',
  btnSuccess:   'bg-green-700 hover:bg-green-600 text-white font-semibold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed',
  btnInfo:      'bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed',
  btnOutline:   'border border-white/20 hover:border-[#8e2421] hover:bg-white/5 text-white font-semibold rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed',

  // ── Form ─────────────────────────────────────────────────────────────────────
  input: 'w-full px-3 py-2.5 bg-[#0f1117] text-white rounded-lg border border-white/[0.12] focus:border-[#8e2421] focus:outline-none focus:ring-1 focus:ring-[#8e2421]/50 transition-colors placeholder:text-white/25 disabled:opacity-50 text-sm',
  label: 'block text-sm font-medium text-white/60 mb-1.5',

  // ── Text ─────────────────────────────────────────────────────────────────────
  textPrimary:   'text-white',
  textSecondary: 'text-white/60',
  textMuted:     'text-white/40',

  // ── Structural ───────────────────────────────────────────────────────────────
  divider: 'border-b border-white/[0.08]',
  header:  'bg-[#0a0d14]/90 backdrop-blur-md border-b border-white/[0.08]',
  footer:  'bg-[#0a0d14]/90 backdrop-blur-md border-t border-white/[0.08]',

  // ── Proposal state badges ─────────────────────────────────────────────────
  badge: {
    Pending:   'text-amber-400   bg-amber-400/10   border border-amber-400/25',
    Active:    'text-green-400   bg-green-400/10   border border-green-400/25',
    Canceled:  'text-white/40    bg-white/5        border border-white/10',
    Defeated:  'text-red-400     bg-red-400/10     border border-red-400/25',
    Succeeded: 'text-sky-400     bg-sky-400/10     border border-sky-400/25',
    Queued:    'text-violet-400  bg-violet-400/10  border border-violet-400/25',
    Expired:   'text-white/30    bg-white/5        border border-white/10',
    Executed:  'text-emerald-400 bg-emerald-400/10 border border-emerald-400/25',
  },
} as const;

export type Theme = typeof theme;

// Shim so existing `useTheme()` calls still compile without any changes.
export function useTheme() {
  return { theme, isDark: true as const, toggleTheme: () => {} };
}

// No-op wrapper so `<ThemeProvider>` in main.tsx still works.
export function ThemeProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
