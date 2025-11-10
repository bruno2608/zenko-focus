import { supabase } from '../../lib/supabase';

export async function fetchKpis(userId: string) {
  const [tasksRes, pomoRes, remRes] = await Promise.all([
    supabase.from('v_task_counts').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('v_pomodoro_today').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('v_reminders_today').select('*').eq('user_id', userId).maybeSingle()
  ]);

  return {
    tasks: tasksRes.data ?? { todo: 0, doing: 0, done: 0, total: 0 },
    pomodoro: pomoRes.data ?? { minutes_today: 0, sessions_today: 0 },
    reminders: remRes.data ?? { active_today: 0 }
  };
}

export async function fetchTaskStatusDistribution(userId: string) {
  const { data, error } = await supabase
    .from('tasks')
    .select('status')
    .eq('user_id', userId);
  if (error) throw error;
  const counts: Record<string, number> = { todo: 0, doing: 0, done: 0 };
  data?.forEach((task: any) => {
    counts[task.status] = (counts[task.status] ?? 0) + 1;
  });
  return Object.entries(counts).map(([status, value]) => ({ status, value }));
}

export async function fetchTasksCompletedByDay(userId: string) {
  const { data, error } = await supabase
    .from('tasks')
    .select('updated_at')
    .eq('user_id', userId)
    .eq('status', 'done')
    .gte('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
  if (error) throw error;
  const counts: Record<string, number> = {};
  data?.forEach((task: any) => {
    const day = new Date(task.updated_at).toISOString().slice(0, 10);
    counts[day] = (counts[day] ?? 0) + 1;
  });
  const days = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toISOString().slice(0, 10);
    return { day: key, count: counts[key] ?? 0 };
  });
  return days;
}
