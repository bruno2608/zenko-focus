import { create } from 'zustand';
import { ReactNode } from 'react';
import { generateId } from '../../lib/id';

interface Toast {
  id: string;
  title: string;
  description?: string;
  type?: 'success' | 'error' | 'info' | 'warning';
}

interface ToastState {
  toasts: Toast[];
  show: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (toast) =>
    set((state) => {
      const id = generateId();
      if (typeof window !== 'undefined') {
        window.setTimeout(() => {
          set((current) => ({
            toasts: current.toasts.filter((item) => item.id !== id)
          }));
        }, 4000);
      }

      const next = [...state.toasts, { ...toast, id }];
      if (next.length > 4) {
        next.shift();
      }

      return { toasts: next };
    }),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
}));

const typeStyles: Record<NonNullable<Toast['type']>, string> = {
  error:
    'border-red-400/60 bg-red-50 text-red-700 shadow-red-500/15 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-200',
  success:
    'border-emerald-400/60 bg-emerald-50 text-emerald-700 shadow-emerald-400/15 dark:border-zenko-accent/40 dark:bg-zenko-accent/20 dark:text-zenko-accent',
  info:
    'border-sky-400/60 bg-sky-50 text-sky-700 shadow-sky-400/15 dark:border-zenko-secondary/40 dark:bg-zenko-secondary/20 dark:text-zenko-secondary',
  warning:
    'border-amber-400/60 bg-amber-50 text-amber-700 shadow-amber-400/15 dark:border-amber-500/50 dark:bg-amber-500/20 dark:text-amber-200'
};

const iconPaths: Record<NonNullable<Toast['type']>, string> = {
  success: 'M5 13l4 4L19 7',
  error: 'M18 6L6 18M6 6l12 12',
  info: 'M12 8h.01M11 12h1v4h1',
  warning: 'M12 9v4m0 4h.01'
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <>
      {children}
      <div
        className="pointer-events-none fixed bottom-28 right-4 z-50 flex w-full max-w-xs flex-col gap-2 sm:bottom-8"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur transition-opacity focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-zenko-accent ${
              toast.type ? typeStyles[toast.type] : typeStyles.info
            }`}
          >
            <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/70 text-current shadow-inner dark:bg-white/10">
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {toast.type === 'info' ? <circle cx="12" cy="12" r="10" className="opacity-30" /> : null}
                <path d={iconPaths[toast.type ?? 'info']} />
              </svg>
            </span>
            <div className="flex-1">
              <strong className="block text-sm font-semibold leading-tight">{toast.title}</strong>
              {toast.description && (
                <span className="mt-0.5 block text-xs text-slate-700/80 dark:text-slate-200/70">{toast.description}</span>
              )}
            </div>
            <button
              type="button"
              aria-label="Fechar alerta"
              onClick={() => dismiss(toast.id)}
              className="pointer-events-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-slate-500 transition hover:bg-slate-500/10 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zenko-accent dark:text-slate-300 dark:hover:bg-slate-200/10 dark:hover:text-white"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
