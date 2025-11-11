import Button from './Button';
import { useThemeStore } from '../../store/theme';

export default function ThemeToggle() {
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

  const isDark = theme === 'dark';

  return (
    <Button
      variant="secondary"
      type="button"
      className="flex items-center gap-2 px-3 py-2 text-xs"
      onClick={toggleTheme}
      aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-2xl bg-zenko-primary/10 text-zenko-primary dark:bg-white/10">
        {isDark ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 3v2" strokeLinecap="round" />
            <path d="M18.364 5.636 16.95 7.05" strokeLinecap="round" />
            <path d="M21 12h-2" strokeLinecap="round" />
            <path d="M18.364 18.364 16.95 16.95" strokeLinecap="round" />
            <path d="M12 19v2" strokeLinecap="round" />
            <path d="M7.05 16.95 5.636 18.364" strokeLinecap="round" />
            <path d="M5 12H3" strokeLinecap="round" />
            <path d="M7.05 7.05 5.636 5.636" strokeLinecap="round" />
            <circle cx="12" cy="12" r="4" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path
              d="M21 12.79A9 9 0 0 1 12.21 3 7 7 0 1 0 21 12.79Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      {isDark ? 'Modo claro' : 'Modo escuro'}
    </Button>
  );
}
