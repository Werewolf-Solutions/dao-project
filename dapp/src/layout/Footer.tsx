import { useTheme } from '@/contexts/ThemeContext';

export default function Footer() {
  const { theme } = useTheme();

  return (
    <footer className={`fixed bottom-0 inset-x-0 z-40 ${theme.footer}`}>
      <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between">
        <p className={`text-xs ${theme.textMuted}`}>
          &copy; {new Date().getFullYear()} WLF DAO DApp
        </p>
        <div className="flex gap-4">
          <a
            href="https://discord.gg/DVDtsbHp"
            target="_blank"
            rel="noopener noreferrer"
            className={`text-xs ${theme.textMuted} hover:text-white transition-colors`}
          >
            <i className="fab fa-discord mr-1" />Discord
          </a>
          <a
            href="https://github.com/Werewolf-Solutions/dao-project"
            target="_blank"
            rel="noopener noreferrer"
            className={`text-xs ${theme.textMuted} hover:text-white transition-colors`}
          >
            <i className="fab fa-github mr-1" />GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
