import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'zenko-theme';

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

interface ThemeState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const initialTheme = getInitialTheme();

if (typeof document !== 'undefined') {
  document.documentElement.classList.toggle('dark', initialTheme === 'dark');
  document.documentElement.dataset.theme = initialTheme;
  document.documentElement.style.setProperty('color-scheme', initialTheme);
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initialTheme,
  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, theme);
    }
    set({ theme });
  },
  toggleTheme: () =>
    set((state) => {
      const nextTheme: ThemeMode = state.theme === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, nextTheme);
      }
      return { theme: nextTheme };
    })
}));
