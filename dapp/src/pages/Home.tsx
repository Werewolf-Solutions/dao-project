import { Link } from "react-router-dom";
import { theme } from "@/contexts/ThemeContext";

// ── Data ─────────────────────────────────────────────────────────────────────

const STATS = [
  { value: "1B",   label: "WLF Total Supply" },
  { value: "6–80%", label: "Staking APY" },
  { value: "2-Day", label: "Timelock Delay" },
  { value: "50%",  label: "Quorum Required" },
];

const FEATURES = [
  {
    to: "/token-sale",
    step: "01",
    icon: "🪙",
    iconBg: "bg-yellow-500/10 text-yellow-400",
    label: "Token Sale",
    desc: "Buy WLF tokens during the public sale. Proceeds go directly into the DAO treasury, funding everything the community votes on.",
    cta: "Buy WLF",
    accentColor: "text-yellow-400",
    hoverBorder: "hover:border-yellow-500/30",
    hoverShadow: "hover:shadow-yellow-900/20",
  },
  {
    to: "/staking",
    step: "02",
    icon: "📈",
    iconBg: "bg-emerald-500/10 text-emerald-400",
    label: "Staking",
    desc: "Stake WLF to earn compounding rewards — 6% APY flexible or up to 80% APY for long-term fixed commitments. Rewards auto-compound into your share price.",
    cta: "Start Earning",
    accentColor: "text-emerald-400",
    hoverBorder: "hover:border-emerald-500/30",
    hoverShadow: "hover:shadow-emerald-900/20",
  },
  {
    to: "/dao",
    step: "03",
    icon: "🗳️",
    iconBg: "bg-[#8e2421]/20 text-[#e87070]",
    label: "DAO Governance",
    desc: "Create proposals, vote with your WLF, and execute on-chain changes. A 2-day timelock ensures community review before any action takes effect.",
    cta: "Open DAO",
    accentColor: "text-[#e87070]",
    hoverBorder: "hover:border-[#8e2421]/40",
    hoverShadow: "hover:shadow-[#8e2421]/10",
  },
  {
    to: "/companies-house",
    step: "04",
    icon: "🏢",
    iconBg: "bg-sky-500/10 text-sky-400",
    label: "Companies House",
    desc: "Register your company on-chain, hire employees, and pay salaries in WLF — automatically converted from USD at the live market rate.",
    cta: "Explore Companies",
    accentColor: "text-sky-400",
    hoverBorder: "hover:border-sky-500/30",
    hoverShadow: "hover:shadow-sky-900/20",
  },
];

const HOW_IT_WORKS = [
  {
    n: "1",
    title: "Get WLF Tokens",
    body: "Participate in the token sale to acquire WLF, the governance and utility token of the ecosystem. Every token you hold is a vote.",
    color: "bg-yellow-400",
  },
  {
    n: "2",
    title: "Stake & Earn",
    body: "Lock your WLF in the staking vault to earn compounding yield. Choose flexible withdrawal or commit to a fixed term for higher APY.",
    color: "bg-emerald-400",
  },
  {
    n: "3",
    title: "Govern Together",
    body: "Use your WLF voting power to shape the protocol. Propose changes, vote, and watch them execute on-chain — no middlemen.",
    color: "bg-[#e87070]",
  },
];

const TOKENOMICS = [
  { label: "Total Supply",        value: "1,000,000,000 WLF" },
  { label: "Minted To",           value: "DAO Treasury" },
  { label: "Proposal Cost",       value: "10 WLF (→ Treasury)" },
  { label: "Min Proposal Stake",  value: "0.5% of treasury" },
  { label: "Staking APY Range",   value: "6% – 80%" },
  { label: "Epoch Duration",      value: "30 days" },
];

// ── Arrow icon ────────────────────────────────────────────────────────────────

function ArrowRight({ className = "" }: { className?: string }) {
  return (
    <svg className={`w-4 h-4 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="bg-[#0f1117] text-white overflow-x-hidden">

      {/* ══ HERO ═══════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-24 pb-28 text-center overflow-hidden">

        {/* Dot-grid background */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />

        {/* Glow blobs */}
        <div aria-hidden className="absolute -top-56 -left-56 w-[700px] h-[700px] rounded-full bg-[#8e2421]/15 blur-[180px] pointer-events-none" />
        <div aria-hidden className="absolute -bottom-56 -right-56 w-[600px] h-[600px] rounded-full bg-indigo-700/8 blur-[160px] pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center max-w-3xl mx-auto gap-7">

          {/* Live badge */}
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-[0.12em] uppercase bg-[#8e2421]/20 text-[#e87070] border border-[#8e2421]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#e87070] animate-pulse" />
            On-Chain Governance · Sepolia Testnet
          </span>

          {/* Headline */}
          <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-[1.05]">
            Own the Protocol.<br />
            <span className="bg-gradient-to-br from-[#e87070] via-[#c0392b] to-[#8e2421] bg-clip-text text-transparent">
              Shape the Future.
            </span>
          </h1>

          {/* Tagline */}
          <p className="text-white/50 text-lg sm:text-xl leading-relaxed max-w-2xl">
            WLF DAO is a fully on-chain decentralized organization. Buy tokens,
            earn yield through staking, vote on proposals, and register companies
            that pay real employees in crypto — all governed by the community,
            enforced by code.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-3 justify-center mt-1">
            <Link
              to="/token-sale"
              className={`${theme.btnPrimary} px-8 py-3.5 text-base inline-flex items-center gap-2 rounded-xl`}
            >
              Buy WLF <ArrowRight />
            </Link>
            <Link
              to="/dao"
              className={`${theme.btnOutline} px-8 py-3.5 text-base inline-flex items-center gap-2 rounded-xl`}
            >
              Open DAO <ArrowRight />
            </Link>
          </div>

          {/* Stats strip */}
          <div className="flex flex-wrap items-stretch justify-center mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] divide-x divide-white/[0.08] overflow-hidden w-full max-w-xl">
            {STATS.map(({ value, label }) => (
              <div key={label} className="flex flex-col items-center px-5 py-4 flex-1">
                <span className="text-xl font-black text-white">{value}</span>
                <span className="text-[11px] text-white/35 mt-0.5 whitespace-nowrap">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll hint */}
        <a
          href="#what-is-wlf"
          aria-label="Scroll down"
          className="absolute bottom-8 flex flex-col items-center gap-1 text-white/20 hover:text-white/50 transition-colors"
        >
          <span className="text-[10px] tracking-[0.2em] uppercase font-medium">Explore</span>
          <svg className="w-5 h-5 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
          </svg>
        </a>
      </section>

      {/* ══ WHAT IS WLF DAO ════════════════════════════════════════════════════ */}
      <section id="what-is-wlf" className="py-24 px-4 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#e87070] mb-3">
            The mission
          </p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-5">
            A DAO with Real-World Impact
          </h2>
          <p className="text-white/45 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
            Most DAOs govern abstract protocol parameters. WLF DAO goes further —
            companies registered on Companies House can hire employees and pay
            monthly salaries on-chain, automatically converting from USD to WLF
            at the live market rate. The DAO treasury funds it all, and every
            WLF holder has a say in how it grows.
          </p>

          {/* Key points */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 text-left">
            {[
              {
                icon: "🔐",
                title: "Non-custodial",
                body: "Your tokens live in your wallet. The staking vault is a standard ERC-4626 — auditable and open-source.",
              },
              {
                icon: "⏱",
                title: "Timelock protected",
                body: "Every governance action passes through a 2-day timelock. No rushed changes — the community always has time to react.",
              },
              {
                icon: "🌐",
                title: "Fully on-chain",
                body: "Proposals, votes, salary payments, and company records are all stored and executed on Ethereum. No back-end servers.",
              },
            ].map(({ icon, title, body }) => (
              <div key={title} className={`${theme.card} p-5 flex flex-col gap-3`}>
                <span className="text-2xl">{icon}</span>
                <p className="font-bold text-white text-sm">{title}</p>
                <p className="text-white/40 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FEATURES ═══════════════════════════════════════════════════════════ */}
      <section className="py-24 px-4 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#e87070] mb-3">
              What you can do
            </p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              Explore the Protocol
            </h2>
            <p className="text-white/40 mt-3 text-sm max-w-md mx-auto">
              Four modules work together to give token holders real power over
              the treasury, yield, and the companies built on top of WLF.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {FEATURES.map(({ step, to, icon, iconBg, label, desc, cta, accentColor, hoverBorder, hoverShadow }) => (
              <Link
                key={to}
                to={to}
                className={`group relative flex flex-col gap-5 p-6 rounded-2xl border border-white/[0.08] bg-[#161b27] transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl ${hoverBorder} ${hoverShadow}`}
              >
                {/* Step watermark */}
                <span className="absolute top-5 right-6 text-5xl font-black text-white/[0.04] select-none leading-none">
                  {step}
                </span>

                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${iconBg}`}>
                  {icon}
                </div>

                {/* Text */}
                <div className="flex-1">
                  <p className="font-bold text-white text-base mb-2">{label}</p>
                  <p className="text-white/40 text-sm leading-relaxed">{desc}</p>
                </div>

                {/* CTA */}
                <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${accentColor} group-hover:gap-2.5 transition-all`}>
                  {cta} <ArrowRight />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ═══════════════════════════════════════════════════════ */}
      <section className="py-24 px-4 border-t border-white/[0.06]">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#e87070] mb-3">
              Getting started
            </p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              How It Works
            </h2>
          </div>

          <div className="relative flex flex-col gap-0">
            {/* Connecting line */}
            <div className="absolute left-[23px] top-8 bottom-8 w-px bg-gradient-to-b from-yellow-400/50 via-emerald-400/50 to-[#e87070]/50 hidden sm:block" />

            {HOW_IT_WORKS.map(({ n, title, body, color }) => (
              <div key={n} className="flex gap-5 items-start py-6">
                <div className={`shrink-0 w-12 h-12 rounded-full ${color} bg-opacity-20 border-2 border-current flex items-center justify-center font-black text-lg relative z-10`}
                  style={{ color: color.replace("bg-", "").includes("[") ? "#e87070" : undefined }}
                >
                  <span className={color.includes("yellow") ? "text-yellow-400" : color.includes("emerald") ? "text-emerald-400" : "text-[#e87070]"}>
                    {n}
                  </span>
                </div>
                <div className="pt-1">
                  <p className="font-bold text-white text-base mb-1.5">{title}</p>
                  <p className="text-white/45 text-sm leading-relaxed max-w-lg">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ TOKENOMICS ═════════════════════════════════════════════════════════ */}
      <section className="py-24 px-4 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#e87070] mb-3">
              Token economics
            </p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              WLF at a Glance
            </h2>
            <p className="text-white/40 mt-3 text-sm max-w-md mx-auto">
              The WLF token is the single unit of account for governance, staking rewards,
              and employee compensation across the entire ecosystem.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TOKENOMICS.map(({ label, value }) => (
              <div key={label} className={`${theme.card} px-5 py-4 flex flex-col gap-1`}>
                <span className="text-xs text-white/35 font-medium uppercase tracking-wider">{label}</span>
                <span className="text-sm font-bold text-white leading-snug">{value}</span>
              </div>
            ))}
          </div>

          {/* DAO flow explainer */}
          <div className={`${theme.card} mt-6 p-6`}>
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-white/30 mb-4">Proposal lifecycle</p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {[
                { label: "Create", sub: "10 WLF fee" },
                { label: "Guardian approves", sub: "→ Active" },
                { label: "Voting (3 days)", sub: "50% quorum" },
                { label: "Queue", sub: "2-day timelock" },
                { label: "Execute", sub: "on-chain" },
              ].map(({ label, sub }, i) => (
                <div key={label} className="flex items-center gap-2">
                  {i > 0 && <span className="text-white/20">→</span>}
                  <div className="flex flex-col items-center px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                    <span className="font-semibold text-white/80 whitespace-nowrap">{label}</span>
                    <span className="text-[10px] text-white/35 mt-0.5 whitespace-nowrap">{sub}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ WHITE PAPER ════════════════════════════════════════════════════════ */}
      <section className="py-20 px-4 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-2xl border border-[#8e2421]/30 bg-[#8e2421]/[0.07] overflow-hidden px-8 py-10 flex flex-col sm:flex-row items-center gap-8">
            {/* Glow */}
            <div aria-hidden className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-[#8e2421]/20 blur-[80px] pointer-events-none" />

            {/* Icon */}
            <div className="shrink-0 w-16 h-16 rounded-2xl bg-[#8e2421]/20 border border-[#8e2421]/30 flex items-center justify-center text-3xl">
              📄
            </div>

            {/* Text */}
            <div className="flex-1 text-center sm:text-left">
              <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#e87070] mb-2">
                Documentation
              </p>
              <h3 className="text-xl sm:text-2xl font-black text-white mb-2">
                Read the White Paper
              </h3>
              <p className="text-white/45 text-sm leading-relaxed max-w-xl">
                Covers the full architecture, tokenomics, governance model, company management
                system, roadmap, and security design — v0.1.4.
              </p>
            </div>

            {/* CTAs */}
            <div className="relative z-10 flex flex-col sm:flex-row gap-3 shrink-0">
              <Link
                to="/whitepaper"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
                style={{ background: '#8e2421' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#a12c29')}
                onMouseLeave={e => (e.currentTarget.style.background = '#8e2421')}
              >
                Read Online <ArrowRight />
              </Link>
              <Link
                to="/whitepaper"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border border-white/[0.15] text-white/70 hover:text-white hover:border-white/30 transition-colors"
                state={{ print: true }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                Download PDF
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FINAL CTA ══════════════════════════════════════════════════════════ */}
      <section className="py-28 px-4 border-t border-white/[0.06]">
        <div className="max-w-2xl mx-auto text-center flex flex-col items-center gap-6">
          {/* Glow */}
          <div aria-hidden className="absolute w-[400px] h-[200px] rounded-full bg-[#8e2421]/12 blur-[100px] pointer-events-none" />

          <h2 className="relative text-4xl sm:text-5xl font-black tracking-tight">
            Ready to join the DAO?
          </h2>
          <p className="text-white/45 text-base leading-relaxed max-w-lg">
            Connect your wallet, grab some WLF, and start shaping the future of
            decentralized governance and on-chain business — one proposal at a time.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              to="/token-sale"
              className={`${theme.btnPrimary} px-8 py-3.5 text-base inline-flex items-center gap-2 rounded-xl`}
            >
              Buy WLF <ArrowRight />
            </Link>
            <Link
              to="/staking"
              className={`${theme.btnOutline} px-8 py-3.5 text-base inline-flex items-center gap-2 rounded-xl`}
            >
              Start Staking <ArrowRight />
            </Link>
          </div>

          {/* Quick nav pills */}
          <div className="flex flex-wrap gap-2 justify-center mt-2">
            {[
              { to: "/dao",             label: "DAO" },
              { to: "/staking",         label: "Staking" },
              { to: "/companies-house", label: "Companies" },
              { to: "/account",         label: "Account" },
              { to: "/whitepaper",      label: "White Paper" },
            ].map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="px-3.5 py-1.5 rounded-full text-xs font-medium text-white/50 border border-white/[0.10] hover:text-white hover:border-white/25 transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
