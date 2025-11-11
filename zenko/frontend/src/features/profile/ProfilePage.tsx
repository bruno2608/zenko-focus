import { useEffect, useState } from 'react';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Button from '../../components/ui/Button';
import OfflineNotice from '../../components/OfflineNotice';
import { isOfflineMode } from '../../lib/supabase';
import { useProfile } from './hooks';
import { useConnectivityStore } from '../../store/connectivity';

export default function ProfilePage() {
  const { profile, isLoading, isSaving, updateProfile, userId } = useProfile();
  const [fullName, setFullName] = useState('');
  const [focusArea, setFocusArea] = useState('');
  const [objectives, setObjectives] = useState('');

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name);
    setFocusArea(profile.focus_area);
    setObjectives(profile.objectives);
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
      objectives
    });
  };

  const connectivityStatus = useConnectivityStore((state) => state.status);
  const showOffline = connectivityStatus === 'limited' || isOfflineMode(userId);

  return (
    <div className="space-y-6">
      {showOffline ? <OfflineNotice feature="Perfil" /> : null}
      <header>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Perfil</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Ajuste suas informações pessoais que aparecem em mensagens e resumos do Zenko.
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

function Achievement({ label, description }: { label: string; description: string }) {
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-zenko-secondary/30 bg-zenko-secondary/10 p-3 text-zenko-secondary dark:border-zenko-secondary/30 dark:bg-zenko-secondary/15 dark:text-white">
      <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-zenko-primary to-zenko-secondary text-sm font-semibold text-white">
        ✓
      </div>
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-zenko-secondary/80 dark:text-zenko-primary/70">{description}</p>
      </div>
    </li>
  );
}
