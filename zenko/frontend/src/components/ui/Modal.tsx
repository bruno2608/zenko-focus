import { ReactNode } from 'react';
import Button from './Button';

interface ModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export default function Modal({ title, open, onClose, children }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-[0_25px_60px_-15px_rgba(15,23,42,0.8)] backdrop-blur">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="text-xs text-slate-400">Preencha os campos para atualizar sua produtividade.</p>
          </div>
          <Button variant="ghost" className="text-2xl leading-none text-slate-400 hover:text-white" onClick={onClose}>
            ×
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
