export default function OfflineNotice({ feature }: { feature: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-zenko-primary/5 via-zenko-secondary/5 to-zenko-accent/5 p-5 backdrop-blur dark:border-white/10 dark:from-zenko-primary/15 dark:via-zenko-secondary/10 dark:to-zenko-accent/10">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-zenko-primary shadow-sm dark:bg-white/10">⚠️</span>
        <div className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Modo offline ativo</h2>
          <p>
            Alguns recursos de {feature} estão usando dados locais temporários. Configure o Supabase no arquivo
            <code className="ml-1 rounded-md bg-slate-200 px-1 py-px text-xs text-slate-700 dark:bg-black/40 dark:text-slate-200">.env</code> para habilitar sincronização em nuvem.
          </p>
        </div>
      </div>
    </div>
  );
}
