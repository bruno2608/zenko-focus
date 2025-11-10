import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { usePomodoroStore } from './store';
import { scheduleNotification } from '../../lib/notifications';
import { useToastStore } from '../../components/ui/ToastProvider';
import { fetchTasks } from '../tasks/api';
import { Task } from '../tasks/types';

function useUserId() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);
  return userId;
}

async function createSession(userId: string, duration: number, taskId?: string) {
  const { data, error } = await supabase
    .from('pomodoro_sessions')
    .insert({ user_id: userId, duration_minutes: Math.round(duration / 60), task_id: taskId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function usePomodoro() {
  const userId = useUserId();
  const duration = usePomodoroStore((state) => state.duration);
  const remaining = usePomodoroStore((state) => state.remaining);
  const status = usePomodoroStore((state) => state.status);
  const mode = usePomodoroStore((state) => state.mode);
  const taskId = usePomodoroStore((state) => state.taskId);
  const start = usePomodoroStore((state) => state.start);
  const pause = usePomodoroStore((state) => state.pause);
  const reset = usePomodoroStore((state) => state.reset);
  const tick = usePomodoroStore((state) => state.tick);
  const setMode = usePomodoroStore((state) => state.setMode);
  const setTask = usePomodoroStore((state) => state.setTask);
  const addSession = usePomodoroStore((state) => state.addSession);

  const queryClient = useQueryClient();
  const toast = useToastStore((state) => state.show);
  const intervalRef = useRef<number | null>(null);

  const tasksQuery = useQuery<Task[]>({
    queryKey: ['tasks', userId],
    queryFn: () => fetchTasks(userId!),
    enabled: Boolean(userId)
  });

  const mutation = useMutation({
    mutationFn: (params: { duration: number; taskId?: string }) =>
      createSession(userId!, params.duration, params.taskId),
    onSuccess: (session) => {
      addSession({
        id: session.id,
        started_at: session.started_at,
        duration: session.duration_minutes,
        task_id: session.task_id ?? undefined
      });
      queryClient.invalidateQueries({ queryKey: ['dashboard', userId] });
      toast({ title: 'Pomodoro concluído', type: 'success' });
    },
    onError: (error: any) => toast({ title: 'Erro ao salvar', description: error.message, type: 'error' })
  });

  useEffect(() => {
    if (status === 'running' && intervalRef.current === null) {
      intervalRef.current = window.setInterval(() => {
        tick();
      }, 1000);
    }
    if (status !== 'running' && intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [status, tick]);

  useEffect(() => {
    if (remaining === 0 && status === 'idle') {
      scheduleNotification('Ciclo concluído 🎯', {
        body: 'Seu Pomodoro acabou! Hora de registrar e fazer uma pausa.'
      });
      mutation.mutate({ duration, taskId });
      reset();
    }
  }, [remaining, status, duration, taskId, mutation, reset]);

  return {
    duration,
    remaining,
    status,
    mode,
    taskId,
    start,
    pause,
    reset,
    tick,
    setMode,
    setTask,
    addSession,
    tasks: tasksQuery.data ?? [],
    isLoadingTasks: tasksQuery.isLoading,
    saveSession: mutation.mutate,
    isSaving: mutation.isLoading
  };
}
