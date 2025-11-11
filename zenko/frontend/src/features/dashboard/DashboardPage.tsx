import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import Card from '../../components/ui/Card';
import { isOfflineMode, supabase } from '../../lib/supabase';
import { fetchKpis, fetchTaskStatusDistribution, fetchTasksCompletedByDay } from './api';
import { useSupabaseUserId } from '../../hooks/useSupabaseUser';
import OfflineNotice from '../../components/OfflineNotice';
import { useThemeStore } from '../../store/theme';
import { useConnectivityStore } from '../../store/connectivity';

const COLORS = ['#38bdf8', '#6366f1', '#22d3ee'];

export default function DashboardPage() {
  const userId = useSupabaseUserId();
  const theme = useThemeStore((state) => state.theme);
  const queryClient = useQueryClient();
  const connectivityStatus = useConnectivityStore((state) => state.status);
  const showOffline = connectivityStatus === 'limited' || isOfflineMode(userId);

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
    if (!userId || isOfflineMode(userId)) return;
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
    return <p className="text-sm text-slate-600 dark:text-slate-300">Carregando dashboard...</p>;
  }

  const kpis =
    kpiQuery.data ?? {
      tasks: { total: 0, done: 0, todo: 0, doing: 0 },
      pomodoro: { minutes_today: 0, sessions_today: 0 },
      reminders: { active_today: 0 }
    };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Painel em tempo real</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">Acompanhe resultados das suas ações sem precisar atualizar a página.</p>
        </div>
      </div>
      {showOffline ? <OfflineNotice feature="Dashboard" /> : null}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-slate-200/80 bg-gradient-to-br from-zenko-primary/10 via-transparent to-zenko-secondary/10 dark:border-white/5 dark:from-zenko-primary/20 dark:to-zenko-secondary/20">
          <h3 className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Tarefas totais</h3>
          <p className="mt-3 text-3xl font-semibold text-slate-900 dark:text-white">{kpis.tasks.total}</p>
          <p className="text-xs text-slate-600 dark:text-slate-300">{kpis.tasks.done} concluídas • {kpis.tasks.todo} pendentes</p>
        </Card>
        <Card className="border-slate-200/80 bg-gradient-to-br from-emerald-300/20 via-transparent to-zenko-primary/10 dark:border-white/5 dark:from-emerald-400/15 dark:to-zenko-primary/10">
          <h3 className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Pomodoro hoje</h3>
          <p className="mt-3 text-3xl font-semibold text-slate-900 dark:text-white">{kpis.pomodoro.minutes_today} min</p>
          <p className="text-xs text-slate-600 dark:text-slate-300">{kpis.pomodoro.sessions_today} sessões completadas</p>
        </Card>
        <Card className="border-slate-200/80 bg-gradient-to-br from-zenko-secondary/10 via-transparent to-zenko-primary/10 dark:border-white/5 dark:from-zenko-secondary/20 dark:to-zenko-primary/15">
          <h3 className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Lembretes ativos</h3>
          <p className="mt-3 text-3xl font-semibold text-slate-900 dark:text-white">{kpis.reminders.active_today}</p>
          <p className="text-xs text-slate-600 dark:text-slate-300">Pendentes para hoje</p>
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="border-slate-200/80 bg-white/90 dark:border-white/5 dark:bg-slate-900/60">
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Distribuição de status</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <PieChart>
                <Pie dataKey="value" data={statusQuery.data ?? []} innerRadius={50} outerRadius={90} label>
                  {(statusQuery.data ?? []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: theme === 'dark' ? '#0f172a' : '#ffffff',
                    borderRadius: 16,
                    border: theme === 'dark' ? '1px solid rgba(148, 163, 184, 0.2)' : '1px solid rgba(148, 163, 184, 0.4)',
                    color: theme === 'dark' ? '#e2e8f0' : '#0f172a'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="border-slate-200/80 bg-white/90 dark:border-white/5 dark:bg-slate-900/60">
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Conclusões por dia</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={doneQuery.data ?? []}>
                <XAxis
                  dataKey="day"
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                  }
                  stroke={theme === 'dark' ? '#94a3b8' : '#64748b'}
                />
                <YAxis allowDecimals={false} stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} />
                <Tooltip
                  labelFormatter={(value) => new Date(value as string).toLocaleDateString('pt-BR')}
                  contentStyle={{
                    background: theme === 'dark' ? '#0f172a' : '#ffffff',
                    borderRadius: 16,
                    border: theme === 'dark' ? '1px solid rgba(148, 163, 184, 0.2)' : '1px solid rgba(148, 163, 184, 0.4)',
                    color: theme === 'dark' ? '#e2e8f0' : '#0f172a'
                  }}
                />
                <Bar dataKey="count" radius={8} fill="url(#barGradient)" />
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
