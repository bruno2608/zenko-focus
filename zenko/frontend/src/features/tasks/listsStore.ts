import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { generateId } from '../../lib/id';
import type { TaskStatus } from './types';

export interface TaskList {
  id: TaskStatus;
  name: string;
  order: number;
}

const DEFAULT_LISTS: TaskList[] = [
  { id: 'todo', name: 'A Fazer', order: 0 },
  { id: 'doing', name: 'Fazendo', order: 1 },
  { id: 'done', name: 'Concluídas', order: 2 }
];

function fallbackTitle(status: TaskStatus) {
  return status
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function sortAndNormalize(lists: TaskList[]) {
  return [...lists]
    .sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
    })
    .map((list, index) => ({ ...list, order: index }));
}

function ensureDefaultLists(lists: TaskList[]) {
  const map = new Map(lists.map((list) => [list.id, list]));
  let changed = false;

  DEFAULT_LISTS.forEach((defaultList) => {
    if (!map.has(defaultList.id)) {
      map.set(defaultList.id, { ...defaultList });
      changed = true;
    }
  });

  if (!changed) {
    return sortAndNormalize(lists);
  }

  return sortAndNormalize(Array.from(map.values()));
}

interface TaskListsState {
  lists: TaskList[];
  ensureStatuses: (statuses: TaskStatus[]) => void;
  addList: (
    title: string
  ) => { list: TaskList; created: boolean } | null;
  getListTitle: (status: TaskStatus) => string;
  getStatusOrder: () => TaskStatus[];
  reorderLists: (sourceIndex: number, destinationIndex: number) => void;
}

const noopStorage: Storage = {
  get length() {
    return 0;
  },
  key: () => null,
  clear: () => {},
  getItem: () => null,
  removeItem: () => {},
  setItem: () => {}
};

export const useTaskListsStore = create(
  persist<TaskListsState>(
    (set, get) => ({
      lists: DEFAULT_LISTS,
      ensureStatuses: (statuses) => {
        if (!Array.isArray(statuses) || statuses.length === 0) {
          set((state) => {
            const normalized = ensureDefaultLists(state.lists);
            const unchanged =
              normalized.length === state.lists.length &&
              normalized.every((item, index) => {
                const current = state.lists[index];
                return (
                  current &&
                  current.id === item.id &&
                  current.name === item.name &&
                  current.order === item.order
                );
              });
            if (unchanged) {
              return state;
            }
            return { ...state, lists: normalized };
          });
          return;
        }

        set((state) => {
          const current = new Map(state.lists.map((list) => [list.id, list]));
          let changed = false;

          DEFAULT_LISTS.forEach((defaultList) => {
            if (!current.has(defaultList.id)) {
              current.set(defaultList.id, { ...defaultList });
              changed = true;
            }
          });

          statuses.forEach((status) => {
            const trimmed = `${status}`.trim();
            if (!trimmed) {
              return;
            }
            if (current.has(trimmed)) {
              return;
            }
            current.set(trimmed, {
              id: trimmed,
              name: fallbackTitle(trimmed),
              order: current.size
            });
            changed = true;
          });

          const normalized = sortAndNormalize(Array.from(current.values()));
          if (!changed) {
            const unchanged =
              normalized.length === state.lists.length &&
              normalized.every((item, index) => {
                const existing = state.lists[index];
                return (
                  existing &&
                  existing.id === item.id &&
                  existing.name === item.name &&
                  existing.order === item.order
                );
              });
            if (unchanged) {
              return state;
            }
          }

          return { ...state, lists: normalized };
        });
      },
      addList: (title) => {
        const trimmed = title.trim();
        if (!trimmed) {
          return null;
        }
        let created = false;
        let target: TaskList | null = null;
        set((state) => {
          const existing = state.lists.find(
            (list) => list.name.localeCompare(trimmed, 'pt-BR', { sensitivity: 'base' }) === 0
          );
          if (existing) {
            target = existing;
            return state;
          }
          const list: TaskList = {
            id: `list-${generateId()}`,
            name: trimmed,
            order: state.lists.length
          };
          target = list;
          created = true;
          return { ...state, lists: sortAndNormalize([...state.lists, list]) };
        });
        if (!target) {
          return null;
        }
        return { list: target, created };
      },
      reorderLists: (sourceIndex, destinationIndex) => {
        if (sourceIndex === destinationIndex) {
          return;
        }
        set((state) => {
          const isValidSource = sourceIndex >= 0 && sourceIndex < state.lists.length;
          const isValidDestination = destinationIndex >= 0 && destinationIndex <= state.lists.length;
          if (!isValidSource || !isValidDestination) {
            return state;
          }
          const reordered = [...state.lists];
          const [moved] = reordered.splice(sourceIndex, 1);
          if (!moved) {
            return state;
          }
          reordered.splice(destinationIndex, 0, moved);
          const normalized = reordered.map((list, index) => ({ ...list, order: index }));
          const unchanged = normalized.every((list, index) => {
            const current = state.lists[index];
            return (
              current &&
              current.id === list.id &&
              current.name === list.name &&
              current.order === list.order
            );
          });
          if (unchanged) {
            return state;
          }
          return { ...state, lists: normalized };
        });
      },
      getListTitle: (status) => {
        const target = get().lists.find((list) => list.id === status);
        if (target) {
          return target.name;
        }
        return fallbackTitle(status);
      },
      getStatusOrder: () => get().lists.map((list) => list.id)
    }),
    {
      name: 'zenko-task-lists',
      version: 1,
      storage: createJSONStorage(() => (typeof window === 'undefined' ? noopStorage : window.localStorage)),
      migrate: (state) => {
        if (!state || typeof state !== 'object') {
          return { lists: DEFAULT_LISTS } as TaskListsState;
        }
        const lists = Array.isArray((state as TaskListsState).lists)
          ? ensureDefaultLists((state as TaskListsState).lists)
          : DEFAULT_LISTS;
        return {
          ...(state as TaskListsState),
          lists
        };
      }
    }
  )
);

export function getOrderedStatusesSnapshot(): TaskStatus[] {
  const { lists } = useTaskListsStore.getState();
  if (!lists || lists.length === 0) {
    return DEFAULT_LISTS.map((list) => list.id);
  }
  return lists.map((list) => list.id);
}

export function getListTitleSnapshot(status: TaskStatus) {
  const { lists } = useTaskListsStore.getState();
  const target = lists.find((list) => list.id === status);
  if (target) {
    return target.name;
  }
  return fallbackTitle(status);
}

export { DEFAULT_LISTS };
