import { create } from 'zustand';
import { Reminder } from './types';

type ReminderView = 'upcoming' | 'past';

interface ReminderState {
  reminders: Reminder[];
  view: ReminderView;
  setReminders: (reminders: Reminder[]) => void;
  setView: (view: ReminderView) => void;
}

export const useReminderStore = create<ReminderState>((set) => ({
  reminders: [],
  view: 'upcoming',
  setReminders: (reminders) => set({ reminders }),
  setView: (view) => set({ view })
}));
