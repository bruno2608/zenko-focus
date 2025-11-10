import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import Card from '../../components/ui/Card';
import { supabase } from '../../lib/supabase';
import { fetchKpis, fetchTaskStatusDistribution, fetchTasksCompletedByDay } from './api';

const COLORS = ['#38bdf8', '#94a3b8', '#22d3ee'];

function useUserId() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);
  return userId;
}

export default function DashboardPage() {
  const userId = useUserId();
  const queryClient = useQueryClient();

  const kpiQuery = useQuery({
    queryKey: ['dashboard', userId],
    queryFn: () => fetchKpis(userId!),
    enabled: Boolean(userId)
  });

  const statusQuery = useQuery({
    queryKey: ['dashboard-status', userId],
    queryFn: () => fetchTaskStatusDistribution(userId!),
    enabled: Boolean(userId)
  });

  const doneQuery = useQuery({
    queryKey: ['dashboard-done', userId],
    queryFn: () => fetchTasksCompletedByDay(userId!),
    enabled: Boolean(userId)
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('dashboard-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['dashboard', userId] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-status', userId] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-done', userId] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pomodoro_sessions', filter: `user_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['dashboard', userId] });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reminders', filter: `user_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['dashboard', userId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  if (kpiQuery.isLoading) {
    return <p>Carregando dashboard...</p>;
  }

  const kpis = kpiQuery.data ?? { tasks: { total: 0, done: 0, todo: 0, doing: 0 }, pomodoro: { minutes_today: 0, sessions_today: 0 }, reminders: { active_today: 0 } };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <h2 className="text-sm text-slate-400">Tarefas</h2>
          <p className="text-2xl font-bold">{kpis.tasks.total}</p>
          <p className="text-xs text-slate-300">{kpis.tasks.done} concluídas</p>
        </Card>
        <Card>
          <h2 className="text-sm text-slate-400">Pomodoros (hoje)</h2>
          <p className="text-2xl font-bold">{kpis.pomodoro.minutes_today} min</p>
          <p className="text-xs text-slate-300">{kpis.pomodoro.sessions_today} sessões</p>
        </Card>
        <Card>
          <h2 className="text-sm text-slate-400">Lembretes ativos hoje</h2>
          <p className="text-2xl font-bold">{kpis.reminders.active_today}</p>
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Distribuição de status</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie dataKey="value" data={statusQuery.data ?? []} innerRadius={50} outerRadius={90} label>
                  {(statusQuery.data ?? []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h2 className="mb-2 text-sm font-semibold">Conclusões por dia</h2>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={doneQuery.data ?? []}>
                <XAxis dataKey="day" tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} />
                <YAxis allowDecimals={false} />
                <Tooltip labelFormatter={(value) => new Date(value as string).toLocaleDateString('pt-BR')} />
                <Bar dataKey="count" fill="#38bdf8" radius={6} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
