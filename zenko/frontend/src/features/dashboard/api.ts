import { isOfflineMode, supabase } from '../../lib/supabase';
import { readOffline } from '../../lib/offline';
import { OFFLINE_TASKS_KEY } from '../tasks/offlineRepository';
import { OFFLINE_SESSIONS_KEY } from '../pomodoro/offlineRepository';
import { OFFLINE_REMINDERS_KEY } from '../reminders/offlineRepository';

export async function fetchKpis(userId: string) {
  if (isOfflineMode(userId)) {
    const tasks = readOffline<any[]>(OFFLINE_TASKS_KEY, []);
    const sessions = readOffline<any[]>(OFFLINE_SESSIONS_KEY, []);
    const reminders = readOffline<any[]>(OFFLINE_REMINDERS_KEY, []);

    const counts = tasks.reduce(
      (acc, task) => {
        acc.total += 1;
        acc[task.status] = (acc[task.status] ?? 0) + 1;
        return acc;
      },
      { total: 0, todo: 0, doing: 0, done: 0 } as Record<string, number>
    );

    const today = new Date().toISOString().slice(0, 10);
    const todaySessions = sessions.filter((session) => session.started_at?.slice(0, 10) === today);
    const minutesToday = todaySessions.reduce((acc, session) => acc + (session.duration_minutes ?? 0), 0);

    const remindersToday = reminders.filter((reminder) => {
      const date = reminder.remind_at?.slice(0, 10);
      return date === today && !reminder.sent;
    });

    return {
      tasks: counts,
      pomodoro: { minutes_today: minutesToday, sessions_today: todaySessions.length },
      reminders: { active_today: remindersToday.length }
    };
  }
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
  if (isOfflineMode(userId)) {
    const tasks = readOffline<any[]>(OFFLINE_TASKS_KEY, []);
    const counts: Record<string, number> = { todo: 0, doing: 0, done: 0 };
    tasks.forEach((task) => {
      counts[task.status] = (counts[task.status] ?? 0) + 1;
    });
    return Object.entries(counts).map(([status, value]) => ({ status, value }));
  }
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
  if (isOfflineMode(userId)) {
    const tasks = readOffline<any[]>(OFFLINE_TASKS_KEY, []);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 6);
    const counts: Record<string, number> = {};
    tasks
      .filter((task) => task.status === 'done')
      .forEach((task) => {
        const day = new Date(task.updated_at ?? task.created_at).toISOString().slice(0, 10);
        if (new Date(day) >= cutoff) {
          counts[day] = (counts[day] ?? 0) + 1;
        }
      });
    const days = Array.from({ length: 7 }).map((_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      const key = date.toISOString().slice(0, 10);
      return { day: key, count: counts[key] ?? 0 };
    });
    return days;
  }
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
