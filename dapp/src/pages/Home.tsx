import { Link } from 'react-router-dom';
import { theme } from '@/contexts/ThemeContext';

// ── Data ────────────────────────────────────────────────────────────────────

const STATS = [
  { value: '1B',   label: 'WLF Supply' },
  { value: '3d',   label: 'Voting period' },
  { value: '80%',  label: 'Max APY' },
  { value: '2d',   label: 'Timelock delay' },
];

const FEATURES = [
  {
    step: '01',
    to: '/token-sale',
    icon: '🪙',
    label: 'Token Sale',
    desc: 'Acquire WLF tokens with USDT and join the ecosystem at the ground floor.',
    cta: 'Buy WLF',
    hoverBorder: 'hover:border-amber-500/40',
    hoverShadow: 'hover:shadow-amber-900/20',
    iconBg: 'bg-amber-500/10 text-amber-400',
    ctaColor: 'text-amber-400',
  },
  {
    step: '02',
    to: '/dao',
    icon: '🗳️',
    label: 'DAO Governance',
    desc: 'Submit on-chain proposals and vote to shape the future of the protocol.',
    cta: 'Open DAO',
    hoverBorder: 'hover:border-red-800/50',
    hoverShadow: 'hover:shadow-red-950/30',
    iconBg: 'bg-[#8e2421]/15 text-red-400',
    ctaColor: 'text-red-400',
  },
  {
    step: '03',
    to: '/staking',
    icon: '📈',
    label: 'Staking',
    desc: 'Lock WLF to earn yield. Fixed 30-day deposits receive a +5% APY bonus.',
    cta: 'Stake WLF',
    hoverBorder: 'hover:border-emerald-500/40',
    hoverShadow: 'hover:shadow-emerald-900/20',
    iconBg: 'bg-emerald-500/10 text-emerald-400',
    ctaColor: 'text-emerald-400',
  },
];

// ── Component ────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="bg-[#0f1117] text-white overflow-x-hidden">

      {/* ══ HERO ════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-16 pb-24 text-center overflow-hidden">

        {/* Background: dot grid — only this needs style={}, no Tailwind equivalent */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.035] pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '28px 28px' }}
        />

        {/* Glow blobs — pure Tailwind */}
        <div aria-hidden className="absolute -top-48 -left-48 w-[600px] h-[600px] rounded-full bg-[#8e2421]/20 blur-[160px] pointer-events-none" />
        <div aria-hidden className="absolute -bottom-48 -right-48 w-[500px] h-[500px] rounded-full bg-indigo-600/10 blur-[140px] pointer-events-none" />

        {/* Hero content */}
        <div className="relative z-10 flex flex-col items-center max-w-2xl mx-auto gap-6">

          {/* Pill badge */}
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold tracking-[0.12em] uppercase bg-[#8e2421]/20 text-[#e87070] border border-[#8e2421]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#e87070] animate-pulse" />
            On-chain governance
          </span>

          {/* Headline */}
          <h1 className="text-6xl sm:text-7xl font-black tracking-tight leading-[1.05]">
            The Future of<br />
            <span className="bg-gradient-to-br from-[#e87070] to-[#8e2421] bg-clip-text text-transparent">
              Decentralized
            </span>
            <br />Governance
          </h1>

          {/* Subtitle */}
          <p className="text-white/50 text-lg leading-relaxed max-w-lg">
            A community-owned protocol. Buy tokens, vote on proposals,
            and earn yield — all on-chain, fully transparent.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-3 justify-center mt-2">
            <Link
              to="/token-sale"
              className={`${theme.btnPrimary} px-7 py-3 text-base inline-flex items-center gap-2 rounded-xl`}
            >
              Buy WLF
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <Link
              to="/dao"
              className={`${theme.btnOutline} px-7 py-3 text-base inline-flex items-center gap-2 rounded-xl`}
            >
              Open DAO
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>

          {/* Stats strip */}
          <div className="flex flex-wrap items-center justify-center gap-0 mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] divide-x divide-white/[0.08] overflow-hidden">
            {STATS.map(({ value, label }) => (
              <div key={label} className="flex flex-col items-center px-6 py-4">
                <span className="text-xl font-black text-white">{value}</span>
                <span className="text-xs text-white/35 mt-0.5 whitespace-nowrap">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll arrow */}
        <a
          href="#features"
          aria-label="Scroll to features"
          className="absolute bottom-8 flex flex-col items-center gap-1.5 text-white/25 hover:text-white/60 transition-colors animate-bounce"
        >
          <span className="text-[10px] tracking-[0.15em] uppercase font-medium">Explore</span>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
          </svg>
        </a>
      </section>

      {/* ══ FEATURES ════════════════════════════════════════════════════════ */}
      <section id="features" className="py-24 px-4">
        <div className="max-w-4xl mx-auto">

          {/* Section header */}
          <div className="text-center mb-14">
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-[#e87070] mb-3">
              What you can do
            </p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              Explore the Protocol
            </h2>
            <p className="text-white/40 mt-3 text-sm max-w-md mx-auto">
              Three core modules work together to give token holders real power over the treasury and protocol parameters.
            </p>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {FEATURES.map(({ step, to, icon, label, desc, cta, hoverBorder, hoverShadow, iconBg, ctaColor }) => (
              <Link
                key={to}
                to={to}
                className={`group relative flex flex-col gap-5 p-6 rounded-2xl border border-white/[0.08] bg-[#161b27] transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl ${hoverBorder} ${hoverShadow}`}
              >
                {/* Step number watermark */}
                <span className="absolute top-5 right-5 text-4xl font-black text-white/[0.05] select-none leading-none">
                  {step}
                </span>

                {/* Icon */}
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl ${iconBg}`}>
                  {icon}
                </div>

                {/* Text */}
                <div className="flex-1">
                  <p className="font-bold text-white text-base mb-2">{label}</p>
                  <p className="text-white/40 text-sm leading-relaxed">{desc}</p>
                </div>

                {/* CTA */}
                <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${ctaColor} group-hover:gap-2.5 transition-all`}>
                  {cta}
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
