import { Link, useLocation } from 'react-router-dom';
import { theme } from '@/contexts/ThemeContext';

const TABS = [
  { to: '/token-sale',      label: 'Sale',      icon: 'fa-coins' },
  { to: '/dao',             label: 'DAO',       icon: 'fa-landmark' },
  { to: '/staking',         label: 'Staking',   icon: 'fa-seedling' },
  { to: '/companies-house', label: 'Companies', icon: 'fa-building' },
];

export default function MobileNav() {
  const { pathname } = useLocation();
  return (
    <nav className={`fixed inset-x-0 bottom-0 z-50 md:hidden ${theme.footer} h-16`}>
      <div className="flex h-full">
        {TABS.map(({ to, label, icon }) => {
          const active = pathname === to || pathname.startsWith(to + '/');
          return (
            <Link
              key={to}
              to={to}
              className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors"
              style={{ color: active ? '#8e2421' : 'rgba(255,255,255,0.45)' }}
            >
              <i className={`fa-solid ${icon} text-lg`} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
