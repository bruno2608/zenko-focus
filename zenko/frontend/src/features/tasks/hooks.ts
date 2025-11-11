import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { OFFLINE_USER_ID, isOfflineMode, supabase } from '../../lib/supabase';
import { useToastStore } from '../../components/ui/ToastProvider';
import { useTasksStore } from './store';
import { Task, TaskPayload, TaskStatus } from './types';
import { createTask, deleteTask, fetchTasks, updateTask, updateTaskStatus } from './api';
import { useSupabaseUserId } from '../../hooks/useSupabaseUser';

export function useTasks() {
  const userId = useSupabaseUserId();
  const setFilter = useTasksStore((state) => state.setFilter);
  const filters = useTasksStore((state) => state.filters);
  const toast = useToastStore((state) => state.show);
  const queryClient = useQueryClient();

  const query = useQuery<Task[]>({
    queryKey: ['tasks', userId],
    queryFn: () => fetchTasks(userId ?? OFFLINE_USER_ID),
    enabled: Boolean(userId),
    staleTime: 5_000
  });

  useEffect(() => {
    if (!userId || isOfflineMode(userId)) return;
    const channel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['tasks', userId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  const createMutation = useMutation({
    mutationFn: (payload: TaskPayload) => createTask(userId ?? OFFLINE_USER_ID, payload),
    onSuccess: (task) => {
      queryClient.setQueryData<Task[]>(['tasks', userId], (old) => (old ? [...old, task] : [task]));
      toast({ title: 'Tarefa criada', type: 'success' });
    },
    onError: (error: any) => toast({ title: 'Erro ao criar', description: error.message, type: 'error' })
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<TaskPayload> }) =>
      updateTask(id, payload, userId ?? OFFLINE_USER_ID),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', userId] });
      toast({ title: 'Tarefa atualizada', type: 'success' });
    },
    onError: (error: any) => toast({ title: 'Erro ao atualizar', description: error.message, type: 'error' })
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTask(id, userId ?? OFFLINE_USER_ID),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', userId] });
      toast({ title: 'Tarefa removida', type: 'success' });
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
    onError: (_error, _variables, context) => {
      if (context?.prevTasks) queryClient.setQueryData(['tasks', userId], context.prevTasks);
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
    filters,
    setFilter
  };
}
