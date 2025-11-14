import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/supabase', () => {
  const queryBuilder = {
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null }),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockResolvedValue({ data: null })
  };

  return {
    OFFLINE_USER_ID: 'offline-user',
    isOfflineMode: vi.fn(() => true),
    supabase: {
      from: vi.fn(() => queryBuilder),
      storage: {
        from: vi.fn(() => ({
          upload: vi.fn(),
          getPublicUrl: vi.fn(() => ({ data: { publicUrl: '' } }))
        }))
      }
    }
  };
});

vi.mock('../../../lib/id', () => {
  let counter = 0;
  return {
    generateId: vi.fn(() => `test-id-${++counter}`)
  };
});

vi.mock('../../../lib/offline', () => {
  const store = new Map<string, unknown>();
  const clone = <T>(value: T): T =>
    value === undefined ? value : JSON.parse(JSON.stringify(value));

  class OfflineStorageError extends Error {
    public readonly reason: 'unavailable' | 'quota_exceeded' | 'unknown';

    constructor(message: string, reason: 'unavailable' | 'quota_exceeded' | 'unknown', options?: { cause?: unknown }) {
      super(message);
      this.name = 'OfflineStorageError';
      this.reason = reason;
      if (options?.cause) {
        Object.defineProperty(this, 'cause', {
          value: options.cause,
          enumerable: false,
          configurable: true
        });
      }
    }
  }

  return {
    OfflineStorageError,
    readOffline: vi.fn(async (resource: string, key: string, fallback: unknown) => {
      const stored = store.get(`${resource}:${key}`);
      if (typeof stored === 'undefined') {
        return clone(fallback);
      }
      return clone(stored);
    }),
    writeOffline: vi.fn(async (resource: string, key: string, value: unknown) => {
      store.set(`${resource}:${key}`, clone(value));
    }),
    removeOffline: vi.fn(async (resource: string, key: string) => {
      store.delete(`${resource}:${key}`);
    }),
    __reset: () => store.clear()
  };
});

import type { Task, TaskStatus } from '../types';
import { createTask, fetchTasks, updateTaskPositions } from '../api';
import { DEFAULT_LISTS, useTaskListsStore } from '../listsStore';
import * as offline from '../../../lib/offline';

const OFFLINE_USER = 'offline-user';
const resetOffline = (offline as unknown as { __reset: () => void }).__reset;

async function snapshotTasks() {
  const tasks = await fetchTasks(OFFLINE_USER);
  const statuses = new Set<TaskStatus | string>(DEFAULT_LISTS.map((list) => list.id));
  tasks.forEach((task) => statuses.add(task.status));

  const byStatus: Record<string, string[]> = {};
  statuses.forEach((status) => {
    const ordered = tasks
      .filter((task) => task.status === status)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((task) => task.id);
    byStatus[status] = ordered;
  });

  return { tasks, byStatus };
}

function assertOrderIntegrity(tasks: Task[]) {
  const unique = new Set(tasks.map((task) => task.id));
  expect(unique.size).toBe(tasks.length);

  const grouped = new Map<TaskStatus, Task[]>();
  tasks.forEach((task) => {
    const current = grouped.get(task.status) ?? [];
    current.push(task);
    grouped.set(task.status, current);
  });

  grouped.forEach((list) => {
    const ordered = [...list].sort((a, b) => a.sort_order - b.sort_order);
    ordered.forEach((task, index) => {
      expect(task.sort_order).toBe(index);
    });
  });
}

function resetListsStore() {
  const initialLists = DEFAULT_LISTS.map((list, index) => ({ ...list, order: index }));
  useTaskListsStore.setState({ lists: initialLists });
  const persist = (useTaskListsStore as unknown as { persist?: { clearStorage?: () => void } }).persist;
  persist?.clearStorage?.();
}

async function createCard(title: string, status: TaskStatus) {
  return createTask(OFFLINE_USER, {
    title,
    status,
    labels: [],
    checklist: [],
    attachments: []
  });
}

beforeAll(() => {
  if (!URL.createObjectURL) {
    URL.createObjectURL = () => 'blob:mock-url';
  }
});

beforeEach(() => {
  resetOffline?.();
  resetListsStore();
});

afterEach(() => {
  vi.clearAllMocks();
  resetListsStore();
});

describe('Listas', () => {
  it('cria uma lista vazia com identificador único', () => {
    const { addList } = useTaskListsStore.getState();
    const result = addList('Planejamento');

    expect(result).not.toBeNull();
    expect(result?.created).toBe(true);
    expect(result?.list.name).toBe('Planejamento');

    const { lists } = useTaskListsStore.getState();
    expect(lists).toHaveLength(DEFAULT_LISTS.length + 1);
    const ids = new Set(lists.map((list) => list.id));
    expect(ids.size).toBe(lists.length);
    expect(lists.at(-1)?.order).toBe(lists.length - 1);
  });

  it('garante listas padrão e cria colunas ausentes ao sincronizar status', () => {
    const { ensureStatuses } = useTaskListsStore.getState();
    ensureStatuses(['todo', 'review', 'done']);

    const { lists } = useTaskListsStore.getState();
    expect(lists.map((list) => list.id)).toEqual(['todo', 'doing', 'done', 'review']);
  });

  it('reordena listas trocando posições e normaliza a propriedade order', () => {
    const { reorderLists } = useTaskListsStore.getState();
    reorderLists(0, 2);

    const { lists } = useTaskListsStore.getState();
    expect(lists.map((list) => list.id)).toEqual(['doing', 'done', 'todo']);
    lists.forEach((list, index) => {
      expect(list.order).toBe(index);
    });
  });

  it('move uma lista para o final do conjunto', () => {
    const { reorderLists } = useTaskListsStore.getState();
    reorderLists(1, useTaskListsStore.getState().lists.length);

    const { lists } = useTaskListsStore.getState();
    expect(lists.map((list) => list.id)).toEqual(['todo', 'done', 'doing']);
    expect(lists.at(-1)?.id).toBe('doing');
  });

  it('ignora tentativas de mover listas com índices inválidos', () => {
    const { reorderLists } = useTaskListsStore.getState();
    reorderLists(-1, 1);
    reorderLists(0, 99);

    const { lists } = useTaskListsStore.getState();
    expect(lists.map((list) => list.id)).toEqual(['todo', 'doing', 'done']);
  });
});

describe('Cards', () => {
  it('cria um card e o adiciona à lista informada', async () => {
    const card = await createCard('Planejar release', 'todo');
    const snapshot = await snapshotTasks();

    expect(snapshot.byStatus.todo).toEqual([card.id]);
    assertOrderIntegrity(snapshot.tasks);
  });

  it('move o card para outra lista mantendo a ordem original', async () => {
    const primeiro = await createCard('Escrever documentação', 'todo');
    const segundo = await createCard('Preparar slides', 'todo');
    const terceiro = await createCard('Revisar código', 'doing');

    await updateTaskPositions(
      [
        { id: segundo.id, status: 'todo', sort_order: 0 },
        { id: terceiro.id, status: 'doing', sort_order: 0 },
        { id: primeiro.id, status: 'doing', sort_order: 1 }
      ],
      OFFLINE_USER
    );

    const snapshot = await snapshotTasks();
    expect(snapshot.byStatus.todo).toEqual([segundo.id]);
    expect(snapshot.byStatus.doing).toEqual([terceiro.id, primeiro.id]);
    assertOrderIntegrity(snapshot.tasks);
  });

  it('reordena um card dentro da mesma lista movendo-o para cima e para baixo', async () => {
    const a = await createCard('Analisar logs', 'todo');
    const b = await createCard('Configurar CI', 'todo');
    const c = await createCard('Publicar release', 'todo');

    await updateTaskPositions(
      [
        { id: c.id, status: 'todo', sort_order: 0 },
        { id: a.id, status: 'todo', sort_order: 1 },
        { id: b.id, status: 'todo', sort_order: 2 }
      ],
      OFFLINE_USER
    );

    let snapshot = await snapshotTasks();
    expect(snapshot.byStatus.todo).toEqual([c.id, a.id, b.id]);
    assertOrderIntegrity(snapshot.tasks);

    await updateTaskPositions(
      [
        { id: a.id, status: 'todo', sort_order: 0 },
        { id: b.id, status: 'todo', sort_order: 1 },
        { id: c.id, status: 'todo', sort_order: 2 }
      ],
      OFFLINE_USER
    );

    snapshot = await snapshotTasks();
    expect(snapshot.byStatus.todo).toEqual([a.id, b.id, c.id]);
    assertOrderIntegrity(snapshot.tasks);
  });

  it('posiciona um card no topo e no final da lista', async () => {
    const primeiro = await createCard('Definir escopo', 'todo');
    const segundo = await createCard('Criar wireframes', 'todo');

    await updateTaskPositions(
      [
        { id: segundo.id, status: 'todo', sort_order: 0 },
        { id: primeiro.id, status: 'todo', sort_order: 1 }
      ],
      OFFLINE_USER
    );

    let snapshot = await snapshotTasks();
    expect(snapshot.byStatus.todo).toEqual([segundo.id, primeiro.id]);
    assertOrderIntegrity(snapshot.tasks);

    await updateTaskPositions(
      [
        { id: primeiro.id, status: 'todo', sort_order: 0 },
        { id: segundo.id, status: 'todo', sort_order: 1 }
      ],
      OFFLINE_USER
    );

    snapshot = await snapshotTasks();
    expect(snapshot.byStatus.todo).toEqual([primeiro.id, segundo.id]);
    assertOrderIntegrity(snapshot.tasks);
  });

  it('ignora tentativas de mover cards inexistentes mantendo os dados', async () => {
    const primeiro = await createCard('Refinar backlog', 'todo');
    const segundo = await createCard('Priorizar épicos', 'todo');

    await updateTaskPositions(
      [{ id: 'card-inexistente', status: 'doing', sort_order: 0 }],
      OFFLINE_USER
    );

    const snapshot = await snapshotTasks();
    expect(snapshot.byStatus.todo).toEqual([primeiro.id, segundo.id]);
    expect(snapshot.byStatus.doing).toEqual([]);
    assertOrderIntegrity(snapshot.tasks);
  });

  it('move múltiplos cards ao mesmo tempo mantendo consistência', async () => {
    const todoUm = await createCard('Especificar requisitos', 'todo');
    const todoDois = await createCard('Estimar esforço', 'todo');
    const doingUm = await createCard('Desenvolver feature', 'doing');
    const doingDois = await createCard('Criar testes', 'doing');

    await updateTaskPositions(
      [
        { id: todoDois.id, status: 'todo', sort_order: 0 },
        { id: doingDois.id, status: 'todo', sort_order: 1 },
        { id: doingUm.id, status: 'doing', sort_order: 0 },
        { id: todoUm.id, status: 'doing', sort_order: 1 }
      ],
      OFFLINE_USER
    );

    const snapshot = await snapshotTasks();
    expect(snapshot.byStatus.todo).toEqual([todoDois.id, doingDois.id]);
    expect(snapshot.byStatus.doing).toEqual([doingUm.id, todoUm.id]);
    assertOrderIntegrity(snapshot.tasks);
  });

  it('permite mover cards para uma nova lista, preservando referências válidas', async () => {
    const card = await createCard('Aprovar orçamento', 'todo');

    await updateTaskPositions(
      [{ id: card.id, status: 'aprovacao', sort_order: 0 }],
      OFFLINE_USER
    );

    const snapshot = await snapshotTasks();
    expect(snapshot.byStatus.aprovacao).toEqual([card.id]);
    assertOrderIntegrity(snapshot.tasks);
  });
});
