import { isOfflineMode, supabase } from '../../lib/supabase';
import { Reminder, ReminderPayload } from './types';
import { readOffline, writeOffline, type OfflineResource } from '../../lib/offline';
import { generateId } from '../../lib/id';

const REMINDERS_RESOURCE: OfflineResource = 'reminders';
const OFFLINE_REMINDERS_KEY = 'all';

function loadOfflineReminders() {
  return readOffline<Reminder[]>(REMINDERS_RESOURCE, OFFLINE_REMINDERS_KEY, []);
}

function persistOfflineReminders(reminders: Reminder[]) {
  return writeOffline(REMINDERS_RESOURCE, OFFLINE_REMINDERS_KEY, reminders);
}

export async function fetchReminders(userId: string) {
  if (isOfflineMode(userId)) {
    return loadOfflineReminders();
  }
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('user_id', userId)
    .order('remind_at', { ascending: true });
  if (error) throw error;
  return data as Reminder[];
}

export async function createReminder(userId: string, payload: ReminderPayload) {
  if (isOfflineMode(userId)) {
    const reminder: Reminder = {
      id: generateId(),
      user_id: userId,
      title: payload.title,
      description: payload.description,
      remind_at: payload.remind_at,
      sent: payload.sent ?? false,
      created_at: new Date().toISOString()
    };
    const reminders = await loadOfflineReminders();
    await persistOfflineReminders([...reminders, reminder]);
    return reminder;
  }
  const { data, error } = await supabase
    .from('reminders')
    .insert({ ...payload, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data as Reminder;
}

export async function updateReminder(id: string, payload: Partial<ReminderPayload>, userId?: string) {
  if (isOfflineMode(userId)) {
    const reminders = await loadOfflineReminders();
    const updated = reminders.map((reminder) =>
      reminder.id === id
        ? {
            ...reminder,
            ...payload,
            sent: payload.sent ?? reminder.sent,
            remind_at: payload.remind_at ?? reminder.remind_at,
            title: payload.title ?? reminder.title,
            description: payload.description ?? reminder.description
          }
        : reminder
    );
    await persistOfflineReminders(updated);
    const next = updated.find((reminder) => reminder.id === id);
    if (!next) throw new Error('Lembrete não encontrado offline.');
    return next;
  }
  const { data, error } = await supabase
    .from('reminders')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Reminder;
}

export async function deleteReminder(id: string, userId?: string) {
  if (isOfflineMode(userId)) {
    const reminders = (await loadOfflineReminders()).filter((reminder) => reminder.id !== id);
    await persistOfflineReminders(reminders);
    return;
  }
  const { error } = await supabase.from('reminders').delete().eq('id', id);
  if (error) throw error;
}
