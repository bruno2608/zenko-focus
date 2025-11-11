import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../frontend/src/lib/supabase', async () => {
  const actual = await vi.importActual<typeof import('../../frontend/src/lib/supabase')>(
    '../../frontend/src/lib/supabase'
  );
  return {
    ...actual,
    isOfflineMode: vi.fn().mockReturnValue(true)
  };
});

const { createTask, fetchTasks, updateTask, deleteTask } = await import(
  '../../frontend/src/features/tasks/api'
);

const STORAGE_KEY = 'zenko-offline-tasks';

describe('offline task queue', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores newly created tasks locally when offline', async () => {
    const task = await createTask('offline-user', {
      title: 'Offline',
      description: 'queued task',
      status: 'todo',
      labels: [],
      checklist: [],
      attachments: []
    });

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    expect(persisted).toHaveLength(1);
    expect(persisted[0].id).toBe(task.id);

    const fetched = await fetchTasks('offline-user');
    expect(fetched.map((t) => t.id)).toEqual([task.id]);
  });

  it('updates existing offline tasks in place', async () => {
    const task = await createTask('offline-user', {
      title: 'Offline',
      description: 'queued task',
      status: 'todo',
      labels: [],
      checklist: [],
      attachments: []
    });

    await updateTask(task.id, { title: 'Updated', status: 'doing' }, 'offline-user');

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    expect(persisted[0].title).toBe('Updated');
    expect(persisted[0].status).toBe('doing');
  });

  it('removes tasks from the offline queue when deleted', async () => {
    const task = await createTask('offline-user', {
      title: 'Offline',
      description: 'queued task',
      status: 'todo',
      labels: [],
      checklist: [],
      attachments: []
    });

    await deleteTask(task.id, 'offline-user');
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    expect(persisted).toHaveLength(0);
  });
});
