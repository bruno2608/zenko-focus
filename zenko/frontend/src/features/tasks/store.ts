import { create } from 'zustand';
import { TaskStatus } from './types';

type DueFilter = 'all' | 'today' | 'week';

interface TasksState {
  filters: {
    status: TaskStatus | 'all';
    due: DueFilter;
    labels: string[];
  };
  labelsLibrary: string[];
  setFilter: (filter: Partial<TasksState['filters']>) => void;
  registerLabels: (labels: string[]) => void;
}

export const useTasksStore = create<TasksState>((set) => ({
  filters: {
    status: 'all',
    due: 'all',
    labels: []
  },
  labelsLibrary: [],
  setFilter: (filter) =>
    set((state) => ({
      filters: { ...state.filters, ...filter }
    })),
  registerLabels: (labels) =>
    set((state) => {
      if (!labels?.length) {
        return state;
      }

      const normalized = labels
        .map((label) => label.trim())
        .filter(Boolean)
        .map((label) => ({
          label,
          key: label.toLocaleLowerCase()
        }));

      if (normalized.length === 0) {
        return state;
      }

      const existingKeys = new Set(state.labelsLibrary.map((label) => label.toLocaleLowerCase()));
      let changed = false;
      const merged = [...state.labelsLibrary];

      normalized.forEach(({ label, key }) => {
        if (!existingKeys.has(key)) {
          existingKeys.add(key);
          merged.push(label);
          changed = true;
        }
      });

      if (!changed) {
        return state;
      }

      const sorted = merged.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      return { ...state, labelsLibrary: sorted };
    })
}));
