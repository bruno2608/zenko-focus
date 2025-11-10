export default function OfflineNotice({ feature }: { feature: string }) {
  return (
    <div className="rounded-xl border border-zenko-primary/40 bg-zenko-surface p-4 text-sm text-slate-200">
      <h2 className="text-lg font-semibold text-zenko-primary">Modo offline</h2>
      <p className="mt-2">
        Alguns recursos de {feature} estão funcionando com dados locais temporários. Configure o Supabase no
        arquivo <code className="rounded bg-black/40 px-1">.env</code> para desbloquear sincronização em nuvem.
      </p>
    </div>
  );
}
