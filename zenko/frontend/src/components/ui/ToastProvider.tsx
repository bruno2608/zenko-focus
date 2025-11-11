import { create } from 'zustand';
import { ReactNode, useEffect } from 'react';
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
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: generateId() }]
    })),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
}));

const typeStyles: Record<NonNullable<Toast['type']>, string> = {
  error:
    'border-red-400/50 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200',
  success:
    'border-emerald-400/50 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100',
  info:
    'border-sky-400/50 bg-sky-50 text-sky-700 dark:border-zenko-primary/40 dark:bg-zenko-primary/10 dark:text-zenko-primary'
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  useEffect(() => {
    const timers = toasts.map((toast) => setTimeout(() => dismiss(toast.id), 4000));
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [toasts, dismiss]);

  return (
    <>
      {children}
      <div className="pointer-events-none fixed bottom-28 right-4 z-50 flex w-full max-w-xs flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-lg shadow-slate-900/10 backdrop-blur dark:shadow-zenko-secondary/10 ${
              toast.type ? typeStyles[toast.type] : typeStyles.info
            }`}
          >
            <strong className="block text-sm font-semibold">{toast.title}</strong>
            {toast.description && (
              <span className="text-xs text-slate-600 dark:text-slate-200/80">{toast.description}</span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
