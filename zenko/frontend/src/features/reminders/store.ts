import { create } from 'zustand';
type ReminderView = 'upcoming' | 'past';

interface ReminderState {
  view: ReminderView;
  setView: (view: ReminderView) => void;
}

export const useReminderStore = create<ReminderState>((set) => ({
  view: 'upcoming',
  setView: (view) => set({ view })
}));
