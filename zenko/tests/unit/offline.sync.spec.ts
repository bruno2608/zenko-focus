import { beforeEach, describe, expect, it, vi } from 'vitest';
import { writeOffline, readOffline } from '../../frontend/src/lib/offline';

const tables: Record<string, Map<string, any>> = {
  tasks: new Map(),
  reminders: new Map(),
  pomodoro_sessions: new Map()
};

vi.mock('../../frontend/src/lib/supabase', () => {
  return {
    OFFLINE_USER_ID: 'offline-user',
    isSupabaseConfigured: true,
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null })
      },
      from(table: string) {
        const store = tables[table] ?? new Map<string, any>();
        tables[table] = store;
        return {
          select() {
            return {
              eq(_column: string, value: string) {
                return {
                  maybeSingle: () => Promise.resolve({ data: store.get(value) ?? null, error: null })
                };
              }
            };
          },
          upsert(payload: any) {
            const rows = Array.isArray(payload) ? payload : [payload];
            rows.forEach((row) => {
              store.set(row.id, row);
            });
            return Promise.resolve({ data: rows, error: null });
          },
          update(payload: any) {
            return {
              eq(_column: string, value: string) {
                const current = store.get(value) ?? {};
                const next = { ...current, ...payload };
                store.set(value, next);
                return Promise.resolve({ data: next, error: null });
              }
            };
          },
          delete() {
            return {
              eq(_column: string, value: string) {
                store.delete(value);
                return Promise.resolve({ error: null });
              }
            };
          }
        };
      }
    }
  };
});

const offlineSyncModule = await import('../../frontend/src/lib/offlineSync');
const { queueMutation, getQueuedMutations, clearQueuedMutations, flush } = offlineSyncModule;

describe('offline synchronization queue', () => {
  beforeEach(async () => {
    await clearQueuedMutations();
    Object.values(tables).forEach((store) => store.clear());
    localStorage.clear();
    (globalThis as any).__clearKeyvalStore?.();
    writeOffline('tasks', []);
    writeOffline('reminders', []);
    writeOffline('pomodoro-sessions', []);
  });

  it('queues mutations in IndexedDB', async () => {
    const task = {
      id: 'task-1',
      user_id: 'offline-user',
      title: 'Test',
      status: 'todo',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await queueMutation({
      table: 'tasks',
      type: 'insert',
      primaryKey: task.id,
      payload: task,
      updatedAt: task.updated_at,
      timestamp: 1
    });
    const queue = await getQueuedMutations();
    expect(queue).toHaveLength(1);
    expect(queue[0].table).toBe('tasks');
    expect(queue[0].primaryKey).toBe(task.id);
  });

  it('flushes mutations and clears offline caches', async () => {
    const now = new Date().toISOString();
    const task = {
      id: 'task-2',
      user_id: 'offline-user',
      title: 'Offline task',
      status: 'todo',
      created_at: now,
      updated_at: now
    };
    writeOffline('tasks', [task]);
    await queueMutation({
      table: 'tasks',
      type: 'insert',
      primaryKey: task.id,
      payload: task,
      updatedAt: task.updated_at,
      timestamp: 1
    });

    const reminder = {
      id: 'rem-1',
      user_id: 'offline-user',
      title: 'Offline reminder',
      description: 'remember',
      remind_at: now,
      sent: false,
      created_at: now
    };
    writeOffline('reminders', [reminder]);
    await queueMutation({
      table: 'reminders',
      type: 'insert',
      primaryKey: reminder.id,
      payload: reminder,
      timestamp: 2
    });

    const result = await flush({ retryDelays: [0], currentUserId: 'user-123' });
    expect(result.applied).toHaveLength(2);
    expect(result.pending).toHaveLength(0);
    const queue = await getQueuedMutations();
    expect(queue).toHaveLength(0);
    expect(readOffline<any[]>('tasks', []).length).toBe(0);
    expect(readOffline<any[]>('reminders', []).length).toBe(0);
    expect(tables.tasks.get('task-2')?.user_id).toBe('user-123');
  });
});
