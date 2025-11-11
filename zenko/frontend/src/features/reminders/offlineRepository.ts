import { readOffline, writeOffline } from '../../lib/offline';
import { Reminder } from './types';

export const OFFLINE_REMINDERS_KEY = 'reminders';

export function loadOfflineReminders() {
  return readOffline<Reminder[]>(OFFLINE_REMINDERS_KEY, []);
}

export function persistOfflineReminders(reminders: Reminder[]) {
  writeOffline(OFFLINE_REMINDERS_KEY, reminders);
}
