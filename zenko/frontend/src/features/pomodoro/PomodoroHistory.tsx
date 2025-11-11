import { useEffect } from 'react';
import Card from '../../components/ui/Card';
import { getCurrentUser, isOfflineMode, supabase } from '../../lib/supabase';
import { usePomodoroStore } from './store';
import { readOffline, type OfflineResource } from '../../lib/offline';

const POMODORO_RESOURCE: OfflineResource = 'pomodoro_sessions';
const OFFLINE_SESSIONS_KEY = 'all';

export default function PomodoroHistory() {
  const history = usePomodoroStore((state) => state.history);
  const setHistory = usePomodoroStore((state) => state.setHistory);

  useEffect(() => {
    let active = true;
    if (isOfflineMode()) {
      readOffline<any[]>(POMODORO_RESOURCE, OFFLINE_SESSIONS_KEY, [])
        .then((offline) => {
          if (!active) return;
          setHistory(
            offline.map((session) => ({
              id: session.id,
              started_at: session.started_at,
              duration: session.duration_minutes,
              task_id: session.task_id ?? undefined
            }))
          );
        })
        .catch((error) => {
          console.warn('Não foi possível carregar o histórico offline de Pomodoro.', error);
        });
      return () => {
        active = false;
      };
    }

    (async () => {
      if (isOfflineMode()) return;
      const user = await getCurrentUser();
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('pomodoro_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('started_at', { ascending: false })
          .limit(10);
        if (error) throw error;
        if (data && active) {
          setHistory(
            data.map((session) => ({
              id: session.id,
              started_at: session.started_at,
              duration: session.duration_minutes,
              task_id: session.task_id ?? undefined
            }))
          );
        }
      } catch (error) {
        console.warn('Não foi possível carregar o histórico de Pomodoros.', error);
      }
    })();
    return () => {
      active = false;
    };
  }, [setHistory]);

  return (
    <Card className="border-slate-200/80 bg-white/90 dark:border-white/5 dark:bg-slate-900/60">
      <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Histórico recente</h2>
      <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-200">
        {history.length === 0 && <li className="text-slate-500 dark:text-slate-400">Nenhum ciclo concluído hoje.</li>}
        {history.map((session) => (
          <li
            key={session.id}
            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 dark:border-white/10 dark:bg-white/5"
          >
            <span>{new Date(session.started_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            <span className="text-zenko-primary">{session.duration} min</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
