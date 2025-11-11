import { useEffect, useState } from 'react';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Button from '../../components/ui/Button';
import Switch from '../../components/ui/Switch';
import OfflineNotice from '../../components/OfflineNotice';
import { isSupabaseConfigured, OFFLINE_USER_ID } from '../../lib/supabase';
import { useProfile } from './hooks';

export default function ProfilePage() {
  const { profile, isLoading, isSaving, updateProfile, userId } = useProfile();
  const [fullName, setFullName] = useState('');
  const [focusArea, setFocusArea] = useState('');
  const [objectives, setObjectives] = useState('');
  const [themePreference, setThemePreference] = useState<'light' | 'dark'>('dark');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoMoveDone, setAutoMoveDone] = useState(true);
  const [pomodoroSound, setPomodoroSound] = useState(true);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name);
    setFocusArea(profile.focus_area);
    setObjectives(profile.objectives);
    setThemePreference(profile.theme_preference);
    setNotificationsEnabled(profile.notifications_enabled);
    setAutoMoveDone(profile.auto_move_done);
    setPomodoroSound(profile.pomodoro_sound);
  }, [profile]);

  if (isLoading || !profile) {
    return (
      <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
        <Card className="animate-pulse h-64 bg-white/40 dark:bg-slate-900/40" />
        <Card className="animate-pulse h-64 bg-white/40 dark:bg-slate-900/40" />
      </div>
    );
  }

  const handleSave = async () => {
    await updateProfile({
      full_name: fullName,
      focus_area: focusArea,
      objectives,
      theme_preference: themePreference,
      notifications_enabled: notificationsEnabled,
      auto_move_done: autoMoveDone,
      pomodoro_sound: pomodoroSound
    });
  };

  return (
    <div className="space-y-6">
      {!isSupabaseConfigured || userId === OFFLINE_USER_ID ? <OfflineNotice feature="Perfil" /> : null}
      <header>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Perfil e preferências</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Ajuste suas informações pessoais e como o Zenko deve se comportar durante o foco.
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[1.7fr,1fr]">
        <Card className="space-y-6 p-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Informações pessoais</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Essas informações aparecem nas mensagens e resumos personalizados.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">
                Nome completo
              </span>
              <Input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Seu nome" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">
                Área de estudo ou foco
              </span>
              <Input
                value={focusArea}
                onChange={(event) => setFocusArea(event.target.value)}
                placeholder="Ex.: Engenharia de Software"
              />
            </label>
          </div>
          <label className="text-sm">
            <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">
              Objetivos principais
            </span>
            <Textarea
              rows={4}
              value={objectives}
              onChange={(event) => setObjectives(event.target.value)}
              placeholder="Descreva metas que quer alcançar com o Zenko"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar alterações'}
            </Button>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Última atualização em {new Date(profile.updated_at).toLocaleDateString('pt-BR')}
            </span>
          </div>
        </Card>
        <div className="space-y-6">
          <Card className="space-y-4 p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-zenko-primary to-zenko-secondary text-lg font-semibold text-white">
                {fullName ? fullName.charAt(0).toUpperCase() : 'Z'}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-300">Identidade visual</p>
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white">{fullName || 'Produtividade Zenko'}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Personalize trocando cor ou foto futuramente.</p>
              </div>
            </div>
          </Card>
          <Card className="space-y-5 p-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Preferências</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Defina como o app deve reagir em lembretes, drag-and-drop e ciclos Pomodoro.
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
          <Card className="space-y-4 p-6">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Conquistas recentes</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Continue completando tarefas e ciclos Pomodoro para desbloquear novos badges.
              </p>
            </div>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <Achievement label="Primeira semana" description="Você manteve sua rotina ativa por 7 dias seguidos." />
              <Achievement label="Focado" description="Concluiu 5 ciclos Pomodoro em um único dia." />
              <Achievement label="Organizador" description="Moveu tarefas entre as colunas 20 vezes." />
            </ul>
          </Card>
        </div>
      </div>
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
}

function PreferenceToggle({ label, description, checked, onCheckedChange, trueLabel, falseLabel }: PreferenceToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200/80 bg-white/70 p-4 backdrop-blur dark:border-white/10 dark:bg-white/5">
      <div>
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{label}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <div className="flex items-center gap-3">
        {falseLabel ? <span className="text-xs text-slate-500 dark:text-slate-400">{falseLabel}</span> : null}
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
        {trueLabel ? <span className="text-xs text-slate-500 dark:text-slate-400">{trueLabel}</span> : null}
      </div>
    </div>
  );
}

function Achievement({ label, description }: { label: string; description: string }) {
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-100">
      <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-sm font-semibold text-white">
        ✓
      </div>
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-emerald-800/80 dark:text-emerald-100/80">{description}</p>
      </div>
    </li>
  );
}
