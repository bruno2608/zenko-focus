export default function OfflineNotice({ feature }: { feature: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-zenko-primary/15 via-zenko-secondary/10 to-zenko-accent/10 p-5 backdrop-blur">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-zenko-primary">⚠️</span>
        <div className="space-y-1 text-sm text-slate-200">
          <h2 className="text-base font-semibold text-white">Modo offline ativo</h2>
          <p>
            Alguns recursos de {feature} estão usando dados locais temporários. Configure o Supabase no arquivo
            <code className="ml-1 rounded-md bg-black/40 px-1 py-px text-xs">.env</code> para habilitar sincronização em nuvem.
          </p>
        </div>
      </div>
    </div>
  );
}
