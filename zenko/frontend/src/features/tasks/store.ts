import { create } from 'zustand';
import { Task, TaskStatus } from './types';

type DueFilter = 'all' | 'today' | 'week';

interface TasksState {
  tasks: Task[];
  filters: {
    status: TaskStatus | 'all';
    due: DueFilter;
  };
  setTasks: (tasks: Task[]) => void;
  setFilter: (filter: Partial<TasksState['filters']>) => void;
}

export const useTasksStore = create<TasksState>((set) => ({
  tasks: [],
  filters: {
    status: 'all',
    due: 'all'
  },
  setTasks: (tasks) => set(() => ({ tasks })),
  setFilter: (filter) =>
    set((state) => ({
      filters: { ...state.filters, ...filter }
    }))
}));
