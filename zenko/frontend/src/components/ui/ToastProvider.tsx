import { create } from 'zustand';
import { ReactNode } from 'react';
import { generateId } from '../../lib/id';

interface Toast {
  id: string;
  title: string;
  description?: string;
  type?: 'success' | 'error' | 'info';
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
    'border-red-400/50 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200',
  success:
    'border-emerald-400/50 bg-emerald-50 text-emerald-700 dark:border-zenko-accent/40 dark:bg-zenko-accent/15 dark:text-zenko-accent',
  info:
    'border-sky-400/50 bg-sky-50 text-sky-700 dark:border-zenko-secondary/40 dark:bg-zenko-secondary/15 dark:text-zenko-secondary'
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <>
      {children}
      <div
        className="pointer-events-none fixed bottom-28 right-4 z-50 flex w-full max-w-xs flex-col gap-2"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg shadow-slate-900/10 backdrop-blur transition-opacity focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-zenko-accent dark:shadow-zenko-secondary/10 ${
              toast.type ? typeStyles[toast.type] : typeStyles.info
            }`}
          >
            <div className="flex-1">
              <strong className="block text-sm font-semibold">{toast.title}</strong>
              {toast.description && (
                <span className="text-xs text-slate-600 dark:text-slate-200/80">{toast.description}</span>
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
