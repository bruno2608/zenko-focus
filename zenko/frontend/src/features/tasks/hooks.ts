import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { OFFLINE_USER_ID, isOfflineMode, supabase } from '../../lib/supabase';
import { useToastStore } from '../../components/ui/ToastProvider';
import { useTasksStore } from './store';
import { useTaskListsStore } from './listsStore';
import { Task, TaskPayload, TaskStatus } from './types';
import {
  createTask,
  deleteTask,
  fetchTasks,
  updateTask,
  updateTaskPositions,
  updateTaskStatus,
  type TaskPositionChange
} from './api';
import { useSupabaseUserId } from '../../hooks/useSupabaseUser';

export function useTasks() {
  const userId = useSupabaseUserId();
  const setFilter = useTasksStore((state) => state.setFilter);
  const filters = useTasksStore((state) => state.filters);
  const registerLabels = useTasksStore((state) => state.registerLabels);
  const ensureTaskLists = useTaskListsStore((state) => state.ensureStatuses);
  const getListTitle = useTaskListsStore((state) => state.getListTitle);
  const toast = useToastStore((state) => state.show);
  const queryClient = useQueryClient();
  const recentMutationsRef = useRef<Map<string, number>>(new Map());

  const markLocalMutation = (id: string | undefined | null) => {
    if (!id) return;
    const map = recentMutationsRef.current;
    const now = Date.now();
    map.set(id, now);
    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        const value = map.get(id);
        if (value && Date.now() - value >= 3500) {
          map.delete(id);
        }
      }, 4000);
    }
  };

  const query = useQuery<Task[]>({
    queryKey: ['tasks', userId],
    queryFn: () => fetchTasks(userId ?? OFFLINE_USER_ID),
    enabled: Boolean(userId),
    staleTime: 5_000
  });

  useEffect(() => {
    if (query.data) {
      ensureTaskLists(query.data.map((task) => task.status));
    }
  }, [ensureTaskLists, query.data]);

  useEffect(() => {
    if (!userId || isOfflineMode(userId)) return;
    const channel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` },
        (payload) => {
          const now = Date.now();
          for (const [id, timestamp] of recentMutationsRef.current.entries()) {
            if (now - timestamp > 3500) {
              recentMutationsRef.current.delete(id);
            }
          }
          queryClient.invalidateQueries({ queryKey: ['tasks', userId] });
          const id = (payload.new as Task | null)?.id ?? (payload.old as Task | null)?.id;
          if (id && recentMutationsRef.current.has(id)) {
            return;
          }
          if (payload.eventType === 'INSERT') {
            const created = payload.new as Task;
            ensureTaskLists([created.status]);
            toast({ title: 'Nova tarefa criada', description: created?.title, type: 'info' });
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Task;
            const previous = payload.old as Task | null;
            if (previous && updated.status !== previous.status) {
              ensureTaskLists([updated.status]);
              toast({
                title: 'Tarefa movida',
                description: `${updated.title} agora está em ${getListTitle(updated.status)}.`,
                type: 'info'
              });
            } else {
              toast({ title: 'Tarefa atualizada', description: updated?.title, type: 'info' });
            }
          } else if (payload.eventType === 'DELETE') {
            const removed = payload.old as Task | null;
            toast({ title: 'Tarefa removida', description: removed?.title, type: 'warning' });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [ensureTaskLists, getListTitle, queryClient, userId]);

  const createMutation = useMutation({
    mutationFn: (payload: TaskPayload) => createTask(userId ?? OFFLINE_USER_ID, payload),
    onSuccess: (task, variables) => {
      queryClient.setQueryData<Task[]>(['tasks', userId], (old) => (old ? [...old, task] : [task]));
      registerLabels(variables.labels ?? task.labels ?? []);
      ensureTaskLists([task.status]);
      toast({ title: 'Tarefa criada', type: 'success' });
      markLocalMutation(task.id);
    },
    onError: (error: any) => toast({ title: 'Erro ao criar', description: error.message, type: 'error' })
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<TaskPayload> }) =>
      updateTask(id, payload, userId ?? OFFLINE_USER_ID),
    onSuccess: (result, { id, payload }) => {
      if (payload.labels) {
        registerLabels(payload.labels);
      }
      if (payload.status) {
        ensureTaskLists([payload.status]);
      }
      queryClient.invalidateQueries({ queryKey: ['tasks', userId] });
      toast({ title: 'Tarefa atualizada', type: 'success' });
      markLocalMutation(result?.id ?? id);
    },
    onError: (error: any) => toast({ title: 'Erro ao atualizar', description: error.message, type: 'error' })
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTask(id, userId ?? OFFLINE_USER_ID),
    onSuccess: (_result, id) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', userId] });
      toast({ title: 'Tarefa removida', type: 'success' });
      markLocalMutation(id);
    },
    onError: (error: any) => toast({ title: 'Erro ao remover', description: error.message, type: 'error' })
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      updateTaskStatus(id, status, userId ?? OFFLINE_USER_ID),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', userId] });
      const prevTasks = queryClient.getQueryData<Task[]>(['tasks', userId]);
      queryClient.setQueryData<Task[]>(['tasks', userId], (old) =>
        old?.map((task) => (task.id === id ? { ...task, status } : task)) ?? []
      );
      return { prevTasks };
    },
    onSuccess: (_result, { id, status }) => {
      ensureTaskLists([status]);
      markLocalMutation(id);
    },
    onError: (_error, _variables, context) => {
      if (context?.prevTasks) queryClient.setQueryData(['tasks', userId], context.prevTasks);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', userId] });
    }
  });

  const reorderMutation = useMutation({
    mutationFn: ({ changes }: { changes: TaskPositionChange[] }) =>
      updateTaskPositions(changes, userId ?? OFFLINE_USER_ID),
    onMutate: async ({ changes }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', userId] });
      const prevTasks = queryClient.getQueryData<Task[]>(['tasks', userId]);
      queryClient.setQueryData<Task[]>(['tasks', userId], (old) => {
        if (!old) return [];
        const map = new Map(changes.map((change) => [change.id, change]));
        return old.map((task) => {
          const change = map.get(task.id);
          if (!change) return task;
          return { ...task, status: change.status, sort_order: change.sort_order };
        });
      });
      return { prevTasks };
    },
    onError: (_error, _variables, context) => {
      if (context?.prevTasks) {
        queryClient.setQueryData(['tasks', userId], context.prevTasks);
      }
    },
    onSuccess: (_result, { changes }) => {
      changes.forEach((change) => markLocalMutation(change.id));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', userId] });
    }
  });

  const filteredTasks = useMemo(() => {
    if (!query.data) {
      return [] as Task[];
    }

    return query.data.filter((task) => {
      if (filters.status !== 'all' && task.status !== filters.status) return false;
      if (filters.labels.length > 0) {
        const normalized = new Set(filters.labels.map((label) => label.toLocaleLowerCase()));
        const hasMatch = task.labels.some((label) => normalized.has(label.toLocaleLowerCase()));
        if (!hasMatch) return false;
      }
      if (filters.due === 'today') {
        const today = new Date().toISOString().slice(0, 10);
        return task.due_date?.slice(0, 10) === today;
      }
      if (filters.due === 'week') {
        const now = new Date();
        const endWeek = new Date(now);
        endWeek.setDate(now.getDate() + 7);
        const dueDate = task.due_date ? new Date(task.due_date) : null;
        if (!dueDate) return false;
        return dueDate >= now && dueDate <= endWeek;
      }
      return true;
    });
  }, [filters, query.data]);

  useEffect(() => {
    if (!query.data) return;
    const collected = new Set<string>();
    query.data.forEach((task) => {
      task.labels.forEach((label) => {
        if (label.trim()) {
          collected.add(label);
        }
      });
    });
    registerLabels(Array.from(collected));
  }, [query.data, registerLabels]);

  const pendingTaskIds = useMemo(() => {
    const pending = new Set<string>();
    if (statusMutation.isPending && statusMutation.variables?.id) {
      pending.add(statusMutation.variables.id);
    }
    if (reorderMutation.isPending) {
      reorderMutation.variables?.changes.forEach((change) => pending.add(change.id));
    }
    if (updateMutation.isPending && updateMutation.variables?.id) {
      pending.add(updateMutation.variables.id);
    }
    return pending;
  }, [
    reorderMutation.isPending,
    reorderMutation.variables,
    statusMutation.isPending,
    statusMutation.variables,
    updateMutation.isPending,
    updateMutation.variables
  ]);

  return {
    userId,
    tasks: filteredTasks,
    isLoading: query.isLoading,
    createTask: createMutation.mutateAsync,
    createTaskIsPending: createMutation.isPending,
    updateTask: updateMutation.mutateAsync,
    updateTaskIsPending: updateMutation.isPending,
    deleteTask: deleteMutation.mutateAsync,
    updateStatus: statusMutation.mutateAsync,
    reorderTasks: (changes: TaskPositionChange[]) => reorderMutation.mutateAsync({ changes }),
    reorderTasksIsPending: reorderMutation.isPending,
    updateStatusIsPending: statusMutation.isPending,
    pendingTaskIds,
    filters,
    setFilter
  };
}
