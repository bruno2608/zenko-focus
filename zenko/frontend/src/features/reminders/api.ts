import { supabase } from '../../lib/supabase';
import { Reminder, ReminderPayload } from './types';

export async function fetchReminders(userId: string) {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('user_id', userId)
    .order('remind_at', { ascending: true });
  if (error) throw error;
  return data as Reminder[];
}

export async function createReminder(userId: string, payload: ReminderPayload) {
  const { data, error } = await supabase
    .from('reminders')
    .insert({ ...payload, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data as Reminder;
}

export async function updateReminder(id: string, payload: Partial<ReminderPayload>) {
  const { data, error } = await supabase
    .from('reminders')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Reminder;
}

export async function deleteReminder(id: string) {
  const { error } = await supabase.from('reminders').delete().eq('id', id);
  if (error) throw error;
}
