import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
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

  const handleCustom = () => {
    const minutes = Number(prompt('Quantos minutos?'));
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    setMode('custom' as any, minutes * 60);
  };

  return (
    <div className="space-y-6">
      {!isSupabaseConfigured || userId === OFFLINE_USER_ID ? (
        <OfflineNotice feature="Pomodoro" />
      ) : null}
      <section className="space-y-4">
        <h1 className="text-xl font-semibold">Pomodoro</h1>
        <Card>
          <div className="flex flex-col items-center gap-4">
            <div className="mt-2 text-5xl font-bold text-zenko-primary">{formatTime(remaining)}</div>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
              {presets.map((preset) => (
                <Button
                  key={preset.mode}
                  variant="ghost"
                  className="border border-zenko-primary text-zenko-primary"
                  onClick={() => setMode(preset.mode as any, preset.duration)}
                >
                  {preset.label}
                </Button>
              ))}
              <Button className="bg-zenko-primary" onClick={handleCustom}>
                Custom
              </Button>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <label>Tarefa:</label>
              <select
                className="rounded-md bg-zenko-surface px-3 py-2"
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
              </select>
            </div>
            <div className="flex gap-3">
              {status !== 'running' ? (
                <Button onClick={start}>Iniciar</Button>
              ) : (
                <Button onClick={pause}>Pausar</Button>
              )}
              <Button variant="secondary" onClick={reset}>
                Resetar
              </Button>
            </div>
            <p className="text-xs text-slate-400">Duração configurada: {Math.round(duration / 60)} min</p>
          </div>
        </Card>
      </section>
      <PomodoroHistory />
    </div>
  );
}
