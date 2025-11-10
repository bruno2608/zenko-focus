import { useEffect } from 'react';
import Card from '../../components/ui/Card';
import { getCurrentUser, supabase } from '../../lib/supabase';
import { usePomodoroStore } from './store';

export default function PomodoroHistory() {
  const history = usePomodoroStore((state) => state.history);
  const setHistory = usePomodoroStore((state) => state.setHistory);

  useEffect(() => {
    let active = true;
    (async () => {
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
    <Card>
      <h2 className="mb-3 text-lg font-semibold">Histórico recente</h2>
      <ul className="space-y-2 text-sm">
        {history.length === 0 && <li>Nenhum ciclo concluído hoje.</li>}
        {history.map((session) => (
          <li key={session.id} className="flex items-center justify-between">
            <span>{new Date(session.started_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            <span className="text-zenko-primary">{session.duration} min</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
