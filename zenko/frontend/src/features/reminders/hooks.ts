import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { OFFLINE_USER_ID, isOfflineMode, supabase } from '../../lib/supabase';
import { useReminderStore } from './store';
import { useToastStore } from '../../components/ui/ToastProvider';
import { createReminder, deleteReminder, fetchReminders, updateReminder } from './api';
import { Reminder, ReminderPayload } from './types';
import { scheduleNotification } from '../../lib/notifications';
import { useSupabaseUserId } from '../../hooks/useSupabaseUser';

function scheduleReminderNotification(reminder: Reminder) {
  const remindAt = new Date(reminder.remind_at).getTime();
  const delay = remindAt - Date.now();
  if (delay > 0) {
    scheduleNotification(`Lembrete: ${reminder.title}`, { body: reminder.description }, delay);
  }
}

export function useReminders() {
  const userId = useSupabaseUserId();
  const queryClient = useQueryClient();
  const view = useReminderStore((state) => state.view);
  const setView = useReminderStore((state) => state.setView);
  const toast = useToastStore((state) => state.show);

  const query = useQuery<Reminder[]>({
    queryKey: ['reminders', userId],
    queryFn: () => fetchReminders(userId ?? OFFLINE_USER_ID),
    enabled: Boolean(userId)
  });

  useEffect(() => {
    if (!userId || isOfflineMode(userId)) return;
    const channel = supabase
      .channel('reminders-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reminders', filter: `user_id=eq.${userId}` },
        () => queryClient.invalidateQueries({ queryKey: ['reminders', userId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  const createMutation = useMutation({
    mutationFn: (payload: ReminderPayload) => createReminder(userId ?? OFFLINE_USER_ID, payload),
    onSuccess: (reminder) => {
      queryClient.setQueryData<Reminder[]>(['reminders', userId], (old) => (old ? [...old, reminder] : [reminder]));
      toast({ title: 'Lembrete criado', type: 'success' });
      scheduleReminderNotification(reminder);
    },
    onError: (error: any) => toast({ title: 'Erro ao criar', description: error.message, type: 'error' })
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ReminderPayload> }) =>
      updateReminder(id, payload, userId ?? OFFLINE_USER_ID),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders', userId] });
      toast({ title: 'Lembrete atualizado', type: 'success' });
    },
    onError: (error: any) => toast({ title: 'Erro ao atualizar', description: error.message, type: 'error' })
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteReminder(id, userId ?? OFFLINE_USER_ID),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders', userId] });
      toast({ title: 'Lembrete removido', type: 'success' });
    },
    onError: (error: any) => toast({ title: 'Erro ao remover', description: error.message, type: 'error' })
  });

  useEffect(() => {
    query.data?.filter((reminder) => !reminder.sent).forEach(scheduleReminderNotification);
  }, [query.data]);

  const reminders = query.data ?? [];
  const { upcoming, past } = useMemo(() => {
    const now = new Date();
    const buckets = reminders.reduce(
      (acc, reminder) => {
        const remindAt = new Date(reminder.remind_at);
        if (!reminder.sent && remindAt >= now) {
          acc.upcoming.push(reminder);
        } else {
          acc.past.push(reminder);
        }
        return acc;
      },
      { upcoming: [] as Reminder[], past: [] as Reminder[] }
    );

    return buckets;
  }, [reminders]);

  return {
    userId,
    reminders,
    upcoming,
    past,
    view,
    setView,
    createReminder: createMutation.mutateAsync,
    createReminderIsPending: createMutation.isPending,
    updateReminder: updateMutation.mutateAsync,
    updateReminderIsPending: updateMutation.isPending,
    deleteReminder: deleteMutation.mutateAsync,
    isLoading: query.isLoading
  };
}
