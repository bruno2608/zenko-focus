import { useConnectivityStore } from '../store/connectivity';

export default function OfflineNotice({ feature }: { feature: string }) {
  const { lastError } = useConnectivityStore((state) => state);
  const hint =
    lastError ??
    'Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env e habilite "Enable anonymous sign-ins" para sincronizar.';

  return (
    <div
      className="inline-flex max-w-full items-center gap-2 rounded-full border border-amber-300/60 bg-amber-50/90 px-3 py-1.5 text-xs font-medium text-amber-700 shadow-sm ring-1 ring-inset ring-amber-300/30 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-100 dark:ring-amber-500/20"
      role="status"
      aria-live="polite"
      title={hint}
    >
      <span aria-hidden className="text-base leading-none">⚠️</span>
      <span className="truncate">
        Modo offline ativo — {feature} usa dados locais temporários.
      </span>
      <span className="sr-only">{hint}</span>
    </div>
  );
}
