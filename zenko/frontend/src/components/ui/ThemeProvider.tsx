import { ReactNode, useEffect } from 'react';
import { useThemeStore } from '../../store/theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.dataset.theme = theme;
    root.style.setProperty('color-scheme', theme);
  }, [theme]);

  return <>{children}</>;
}
