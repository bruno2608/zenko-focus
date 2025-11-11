import { useNotificationsStore } from '../lib/notifications';

export default function NotificationBanner() {
  const permission = useNotificationsStore((state) => state.permission);

  if (permission !== 'denied') {
    return null;
  }

  return (
    <div
      role="alert"
      className="mb-6 flex flex-col gap-3 rounded-3xl border border-amber-300/70 bg-amber-50/95 p-5 text-amber-900 shadow-sm backdrop-blur dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-100"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-200/80 text-amber-900 dark:bg-amber-500/30 dark:text-amber-100">
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m12 9-1 2h2l-1 2" />
            <path d="M10 3h4l1 3h3l-2 4 2 4h-3l-1 3h-4l-1-3H6l2-4-2-4h3z" />
            <path d="M5 21h14" />
          </svg>
        </span>
        <div>
          <p className="text-sm font-semibold">Notificações bloqueadas pelo navegador</p>
          <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200/90">
            O navegador está impedindo os alertas do Zenko. Reative as notificações permitindo o envio deste site nas
            configurações de privacidade.
          </p>
        </div>
      </div>
      <ul className="list-inside list-disc text-xs leading-relaxed text-amber-800/90 dark:text-amber-200/80">
        <li>No Chrome: clique no cadeado ao lado da barra de endereços e habilite “Notificações”.</li>
        <li>No Firefox ou Safari: abra Preferências &gt; Privacidade e segurança e ajuste as permissões do site.</li>
      </ul>
    </div>
  );
}
