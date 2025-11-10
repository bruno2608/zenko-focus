import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useReminderStore } from './store';
import { useToastStore } from '../../components/ui/ToastProvider';
import { createReminder, deleteReminder, fetchReminders, updateReminder } from './api';
import { Reminder, ReminderPayload } from './types';
import { scheduleNotification } from '../../lib/notifications';

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

function scheduleReminderNotification(reminder: Reminder) {
  const remindAt = new Date(reminder.remind_at).getTime();
  const delay = remindAt - Date.now();
  if (delay > 0) {
    scheduleNotification(`Lembrete: ${reminder.title}`, { body: reminder.description }, delay);
  }
}

export function useReminders() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const setReminders = useReminderStore((state) => state.setReminders);
  const view = useReminderStore((state) => state.view);
  const setView = useReminderStore((state) => state.setView);
  const toast = useToastStore((state) => state.show);

  const query = useQuery<Reminder[]>({
    queryKey: ['reminders', userId],
    queryFn: () => fetchReminders(userId!),
    enabled: Boolean(userId)
  });

  useEffect(() => {
    if (query.data) {
      setReminders(query.data);
    }
  }, [query.data, setReminders]);

  useEffect(() => {
    if (!userId) return;
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
    mutationFn: (payload: ReminderPayload) => createReminder(userId!, payload),
    onSuccess: (reminder) => {
      queryClient.setQueryData<Reminder[]>(['reminders', userId], (old) => (old ? [...old, reminder] : [reminder]));
      toast({ title: 'Lembrete criado', type: 'success' });
      scheduleReminderNotification(reminder);
    },
    onError: (error: any) => toast({ title: 'Erro ao criar', description: error.message, type: 'error' })
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ReminderPayload> }) => updateReminder(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders', userId] });
      toast({ title: 'Lembrete atualizado', type: 'success' });
    },
    onError: (error: any) => toast({ title: 'Erro ao atualizar', description: error.message, type: 'error' })
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteReminder(id),
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
  const upcoming = reminders.filter((reminder) => !reminder.sent && new Date(reminder.remind_at) >= new Date());
  const past = reminders.filter((reminder) => reminder.sent || new Date(reminder.remind_at) < new Date());

  return {
    reminders,
    upcoming,
    past,
    view,
    setView,
    createReminder: createMutation.mutateAsync,
    updateReminder: updateMutation.mutateAsync,
    deleteReminder: deleteMutation.mutateAsync,
    isLoading: query.isLoading
  };
}
