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

export function ToastProvider({ children }: { children: ReactNode }) {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  useEffect(() => {
    const timers = toasts.map((toast) =>
      setTimeout(() => dismiss(toast.id), 4000)
    );
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [toasts, dismiss]);

  return (
    <>
      {children}
      <div className="fixed bottom-24 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`min-w-[200px] rounded-lg border px-4 py-3 shadow-lg ${
              toast.type === 'error'
                ? 'border-red-500 bg-red-500/20'
                : toast.type === 'success'
                ? 'border-emerald-500 bg-emerald-500/20'
                : 'border-zenko-primary bg-zenko-primary/20'
            }`}
          >
            <strong className="block text-sm font-semibold">{toast.title}</strong>
            {toast.description && <span className="text-xs text-slate-200">{toast.description}</span>}
          </div>
        ))}
      </div>
    </>
  );
}
