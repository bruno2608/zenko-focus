import { useEffect, useState } from 'react';
import Card from '../../components/ui/Card';
import OfflineNotice from '../../components/OfflineNotice';
import Switch from '../../components/ui/Switch';
import { useProfile } from '../profile/hooks';
import { useNotificationsStore } from '../../lib/notifications';
import { useConnectivityStore } from '../../store/connectivity';
import { isOfflineMode } from '../../lib/supabase';

export default function PreferencesPage() {
  const { profile, isLoading, updateProfile, userId } = useProfile();
  const notificationPermission = useNotificationsStore((state) => state.permission);
  const [themePreference, setThemePreference] = useState<'light' | 'dark'>('dark');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoMoveDone, setAutoMoveDone] = useState(true);
  const [pomodoroSound, setPomodoroSound] = useState(true);

  useEffect(() => {
    if (!profile) return;
    setThemePreference(profile.theme_preference);
    setNotificationsEnabled(profile.notifications_enabled);
    setAutoMoveDone(profile.auto_move_done);
    setPomodoroSound(profile.pomodoro_sound);
  }, [profile]);

  if (isLoading || !profile) {
    return <Card className="h-64 animate-pulse bg-white/40 dark:bg-slate-900/40" />;
  }

  const connectivityStatus = useConnectivityStore((state) => state.status);
  const showOffline = connectivityStatus === 'limited' || isOfflineMode(userId);
  const notificationsBlocked = notificationPermission === 'denied';
  const notificationsTooltip = notificationsBlocked
    ? 'As notificações foram bloqueadas no navegador. Permita novamente nas configurações do site.'
    : undefined;

  return (
    <div className="space-y-6">
      {showOffline ? <OfflineNotice feature="Preferências" /> : null}
      <header>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Preferências</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Defina como o Zenko deve se comportar com notificações, fluxo de tarefas e aparência.
        </p>
      </header>
      <Card className="space-y-5 p-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Ajustes principais</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Personalize notificações, movimentação automática de tarefas e o tema do aplicativo.
          </p>
        </div>
        <div className="space-y-4">
          <PreferenceToggle
            label="Notificações ativas"
            description="Receba alertas de lembretes e fim de ciclo Pomodoro."
            checked={notificationsEnabled}
            onCheckedChange={async (checked) => {
              setNotificationsEnabled(checked);
              await updateProfile({ notifications_enabled: checked });
            }}
            disabled={notificationsBlocked}
            disabledReason={notificationsTooltip}
          />
          <PreferenceToggle
            label="Mover automaticamente ao concluir"
            description="Ao marcar uma tarefa como concluída ela vai direto para a coluna verde."
            checked={autoMoveDone}
            onCheckedChange={async (checked) => {
              setAutoMoveDone(checked);
              await updateProfile({ auto_move_done: checked });
            }}
          />
          <PreferenceToggle
            label="Som ao finalizar Pomodoro"
            description="Em breve você poderá personalizar o alerta sonoro dos ciclos."
            checked={pomodoroSound}
            onCheckedChange={async (checked) => {
              setPomodoroSound(checked);
              await updateProfile({ pomodoro_sound: checked });
            }}
          />
          <PreferenceToggle
            label="Tema do aplicativo"
            description="Ajuste rapidamente entre claro e escuro."
            checked={themePreference === 'dark'}
            onCheckedChange={async (checked) => {
              const nextTheme = checked ? 'dark' : 'light';
              setThemePreference(nextTheme);
              await updateProfile({ theme_preference: nextTheme });
            }}
            trueLabel="Escuro"
            falseLabel="Claro"
          />
        </div>
      </Card>
    </div>
  );
}

interface PreferenceToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => Promise<void>;
  trueLabel?: string;
  falseLabel?: string;
  disabled?: boolean;
  disabledReason?: string;
}

function PreferenceToggle({
  label,
  description,
  checked,
  onCheckedChange,
  trueLabel,
  falseLabel,
  disabled = false,
  disabledReason
}: PreferenceToggleProps) {
  const handleChange = async (next: boolean) => {
    if (disabled) return;
    await onCheckedChange(next);
  };

  return (
    <div
      data-preference-toggle={label}
      className={`flex items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white/70 p-4 backdrop-blur transition-opacity dark:border-white/10 dark:bg-white/5 ${
        disabled ? 'opacity-70' : ''
      }`}
      aria-disabled={disabled}
    >
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{label}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
        {disabled && disabledReason ? (
          <p className="text-xs font-medium text-amber-700 dark:text-amber-300">{disabledReason}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        {falseLabel ? <span className="text-xs text-slate-500 dark:text-slate-400">{falseLabel}</span> : null}
        <Switch
          checked={checked}
          onCheckedChange={handleChange}
          disabled={disabled}
          title={disabled ? disabledReason : undefined}
        />
        {trueLabel ? <span className="text-xs text-slate-500 dark:text-slate-400">{trueLabel}</span> : null}
      </div>
    </div>
  );
}
