import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { OFFLINE_USER_ID, isOfflineMode, supabase } from '../../lib/supabase';
import { usePomodoroStore } from './store';
import { scheduleNotification } from '../../lib/notifications';
import { useToastStore } from '../../components/ui/ToastProvider';
import { Task } from '../tasks/types';
import { useSupabaseUserId } from '../../hooks/useSupabaseUser';
import { readOffline, writeOffline, type OfflineResource } from '../../lib/offline';
import { generateId } from '../../lib/id';

const POMODORO_RESOURCE: OfflineResource = 'pomodoro_sessions';
const OFFLINE_SESSIONS_KEY = 'all';
const MAX_OFFLINE_SESSIONS = 50;

async function saveOfflineSession(duration: number, taskId?: string) {
  const sessions = await readOffline<any[]>(POMODORO_RESOURCE, OFFLINE_SESSIONS_KEY, []);
  const session = {
    id: generateId(),
    user_id: OFFLINE_USER_ID,
    duration_minutes: Math.round(duration / 60),
    task_id: taskId ?? null,
    started_at: new Date().toISOString()
  };
  const next = [session, ...sessions];
  await writeOffline(POMODORO_RESOURCE, OFFLINE_SESSIONS_KEY, next.slice(0, MAX_OFFLINE_SESSIONS));
  return session;
}

async function createSession(userId: string, duration: number, taskId?: string) {
  if (isOfflineMode(userId)) {
    return saveOfflineSession(duration, taskId);
  }
  const { data, error } = await supabase
    .from('pomodoro_sessions')
    .insert({ user_id: userId, duration_minutes: Math.round(duration / 60), task_id: taskId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

function useCachedTasks(userId?: string | null) {
  const queryClient = useQueryClient();
  const subscribe = (onStoreChange: () => void) => {
    if (!userId) {
      return () => {};
    }

    return queryClient.getQueryCache().subscribe((event) => {
      const queryKey = event?.query?.queryKey;
      if (queryKey && queryKey[0] === 'tasks' && queryKey[1] === userId) {
        onStoreChange();
      }
    });
  };

  const getSnapshot = () => {
    if (!userId) {
      return [] as Task[];
    }
    return queryClient.getQueryData<Task[]>(['tasks', userId]) ?? [];
  };

  const tasks = useSyncExternalStore(subscribe, getSnapshot, () => [] as Task[]);
  const state = userId ? queryClient.getQueryState<Task[]>(['tasks', userId]) : undefined;
  const isLoading = Boolean(userId) && state?.fetchStatus === 'fetching' && !state?.data;

  return { tasks, isLoading };
}

export function usePomodoro() {
  const userId = useSupabaseUserId();
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
  const { tasks, isLoading: isLoadingTasks } = useCachedTasks(userId);

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
    userId,
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
    tasks,
    isLoadingTasks,
    saveSession: mutation.mutate,
    isSaving: mutation.isLoading
  };
}
