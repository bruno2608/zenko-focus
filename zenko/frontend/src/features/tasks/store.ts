import { create } from 'zustand';
import { TaskStatus } from './types';

type DueFilter = 'all' | 'today' | 'week';

interface TasksState {
  filters: {
    status: TaskStatus | 'all';
    due: DueFilter;
  };
  setFilter: (filter: Partial<TasksState['filters']>) => void;
}

export const useTasksStore = create<TasksState>((set) => ({
  filters: {
    status: 'all',
    due: 'all'
  },
  setFilter: (filter) =>
    set((state) => ({
      filters: { ...state.filters, ...filter }
    }))
}));
