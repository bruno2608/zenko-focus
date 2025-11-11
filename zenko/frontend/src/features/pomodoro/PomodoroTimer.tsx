import { FormEvent, useState } from 'react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Select from '../../components/ui/Select';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { usePomodoro } from './hooks';
import PomodoroHistory from './PomodoroHistory';
import OfflineNotice from '../../components/OfflineNotice';
import { OFFLINE_USER_ID, isSupabaseConfigured } from '../../lib/supabase';

const presets = [
  { label: '25 min foco', mode: 'focus', duration: 25 * 60 },
  { label: '10 min pausa', mode: 'short-break', duration: 10 * 60 },
  { label: '5 min respiro', mode: 'long-break', duration: 5 * 60 }
];

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

export default function PomodoroTimer() {
  const {
    userId,
    duration,
    remaining,
    status,
    setMode,
    start,
    pause,
    reset,
    setTask,
    taskId,
    tasks,
    isLoadingTasks
  } = usePomodoro();

  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('25');

  const openCustomModal = () => {
    setCustomMinutes(String(Math.max(1, Math.round(duration / 60))));
    setIsCustomOpen(true);
  };

  const closeCustomModal = () => setIsCustomOpen(false);

  const handleCustomSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const minutes = Number(customMinutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return;
    }
    setMode('custom' as any, minutes * 60);
    setIsCustomOpen(false);
  };

  return (
    <div className="space-y-6">
      {!isSupabaseConfigured || userId === OFFLINE_USER_ID ? <OfflineNotice feature="Pomodoro" /> : null}
      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Timer inteligente</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">Acelere seus ciclos com presets refinados e notificações pontuais.</p>
          </div>
          <Button variant="secondary" onClick={openCustomModal}>
            Tempo customizado
          </Button>
        </div>
        <Card className="flex flex-col items-center gap-6 border-slate-200/70 bg-white/90 py-8 text-center dark:border-white/5 dark:bg-slate-900/70">
          <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs uppercase tracking-wide text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-slate-300">
            {status === 'running' ? 'Em foco' : status === 'paused' ? 'Pausado' : 'Pronto'}
          </div>
          <div className="text-6xl font-semibold text-slate-900 drop-shadow-[0_10px_25px_rgba(56,189,248,0.35)] dark:text-white dark:drop-shadow-[0_10px_25px_rgba(56,189,248,0.45)]">
            {formatTime(remaining)}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
            {presets.map((preset) => (
              <Button
                key={preset.mode}
                variant="secondary"
                className="px-4 py-2"
                onClick={() => setMode(preset.mode as any, preset.duration)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
            <label className="text-slate-600 dark:text-slate-300">Tarefa vinculada:</label>
            <Select
              className="min-w-[160px] text-sm"
              value={taskId ?? ''}
              onChange={(e) => setTask(e.target.value || undefined)}
            >
              <option value="">Sem vínculo</option>
              {isLoadingTasks && <option>Carregando...</option>}
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-3">
            {status !== 'running' ? (
              <Button className="px-6" onClick={start}>
                Iniciar
              </Button>
            ) : (
              <Button className="px-6" onClick={pause}>
                Pausar
              </Button>
            )}
            <Button variant="secondary" className="px-6" onClick={reset}>
              Resetar
            </Button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Duração configurada: {Math.round(duration / 60)} min</p>
        </Card>
      </section>
      <Modal title="Configurar tempo personalizado" open={isCustomOpen} onClose={closeCustomModal}>
        <form className="space-y-6" onSubmit={handleCustomSubmit}>
          <div className="space-y-2">
            <label htmlFor="custom-minutes" className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Defina a duração em minutos
            </label>
            <Input
              id="custom-minutes"
              type="number"
              min={1}
              step={1}
              required
              value={customMinutes}
              onChange={(event) => setCustomMinutes(event.target.value)}
              className="text-lg"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Personalize ciclos específicos para sprints maiores ou revisões rápidas.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={closeCustomModal}>
              Cancelar
            </Button>
            <Button type="submit">Aplicar</Button>
          </div>
        </form>
      </Modal>
      <PomodoroHistory />
    </div>
  );
}
