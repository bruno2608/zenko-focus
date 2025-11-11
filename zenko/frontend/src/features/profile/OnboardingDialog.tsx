import { FormEvent, useEffect, useState } from 'react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

interface OnboardingDialogProps {
  open: boolean;
  initialName?: string;
  loading?: boolean;
  onSubmit: (payload: { full_name: string }) => Promise<void>;
}

export default function OnboardingDialog({
  open,
  initialName = '',
  loading = false,
  onSubmit
}: OnboardingDialogProps) {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  if (!open) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit({ full_name: name.trim() });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 px-4 backdrop-blur">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950/80 p-8 text-slate-100 shadow-[0_25px_80px_-25px_rgba(15,23,42,0.8)]">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-zenko-primary to-zenko-secondary text-white">
            <span className="text-2xl font-semibold">Z</span>
          </div>
          <h2 className="text-2xl font-semibold">Bem-vindo ao Zenko Focus</h2>
          <p className="mt-2 text-sm text-slate-300">
            Personalize sua experiência e receba recomendações alinhadas aos seus objetivos.
          </p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-left text-sm">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Qual é o seu nome?</span>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Digite seu nome"
              required
            />
          </label>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Salvando...' : 'Começar jornada'}
          </Button>
        </form>
      </div>
    </div>
  );
}
