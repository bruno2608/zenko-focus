import { del, get, set } from 'idb-keyval';
import { generateId } from './id';
import { readOffline, writeOffline } from './offline';
import { OFFLINE_USER_ID, supabase } from './supabase';

export type OfflineTable = 'tasks' | 'reminders' | 'pomodoro_sessions';
export type OfflineMutationType = 'insert' | 'update' | 'delete';

export type OfflineMutation = {
  id: string;
  table: OfflineTable;
  type: OfflineMutationType;
  primaryKey: string;
  payload: Record<string, any>;
  timestamp: number;
  updatedAt?: string;
};

const QUEUE_KEY = 'offline-sync-queue';
const OFFLINE_CACHE_KEYS: Record<OfflineTable, string> = {
  tasks: 'tasks',
  reminders: 'reminders',
  pomodoro_sessions: 'pomodoro-sessions'
};

const DEFAULT_RETRY_DELAYS = [0, 1000, 3000, 5000];

function nowTimestamp() {
  return Date.now();
}

function cloneMutation(mutation: OfflineMutation): OfflineMutation {
  return {
    ...mutation,
    payload: { ...mutation.payload }
  };
}

async function readQueue(): Promise<OfflineMutation[]> {
  try {
    const queue = (await get<OfflineMutation[]>(QUEUE_KEY)) ?? [];
    return queue.map(cloneMutation);
  } catch (error) {
    console.warn('Falha ao ler fila offline. Reiniciando fila.', error);
    await del(QUEUE_KEY);
    return [];
  }
}

async function persistQueue(queue: OfflineMutation[]) {
  if (queue.length === 0) {
    await del(QUEUE_KEY);
    return;
  }
  await set(QUEUE_KEY, queue.map(cloneMutation));
}

function normalizePayload(payload: Record<string, any>, userId: string) {
  if (!payload) return {} as Record<string, any>;
  const normalized = { ...payload };
  if ('user_id' in normalized && normalized.user_id === OFFLINE_USER_ID) {
    normalized.user_id = userId;
  }
  return normalized;
}

async function sleep(ms: number) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function toDate(value?: string) {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

async function fetchRemoteUpdatedAt(table: OfflineTable, id: string) {
  const { data, error } = await supabase
    .from(table)
    .select('updated_at')
    .eq('id', id)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  return data?.updated_at ?? null;
}

async function applyMutation(mutation: OfflineMutation, userId: string) {
  const payload = normalizePayload(mutation.payload, userId);
  if (mutation.table === 'tasks' && mutation.type !== 'delete' && mutation.updatedAt) {
    const remoteUpdatedAt = await fetchRemoteUpdatedAt(mutation.table, mutation.primaryKey);
    const remoteTime = toDate(remoteUpdatedAt);
    const localTime = toDate(mutation.updatedAt);
    if (remoteTime !== null && localTime !== null && remoteTime > localTime) {
      return 'skipped' as const;
    }
  }

  switch (mutation.type) {
    case 'insert': {
      const { error } = await supabase
        .from(mutation.table)
        .upsert(payload, { onConflict: 'id' });
      if (error) throw error;
      return 'applied' as const;
    }
    case 'update': {
      const { error } = await supabase
        .from(mutation.table)
        .update(payload)
        .eq('id', mutation.primaryKey);
      if (error) throw error;
      return 'applied' as const;
    }
    case 'delete': {
      const { error } = await supabase.from(mutation.table).delete().eq('id', mutation.primaryKey);
      if (error && error.code !== 'PGRST116') throw error;
      return 'applied' as const;
    }
    default:
      return 'skipped' as const;
  }
}

async function cleanupOfflineCaches(mutations: OfflineMutation[]) {
  const byTable = new Map<OfflineTable, Set<string>>();
  for (const mutation of mutations) {
    const set = byTable.get(mutation.table) ?? new Set<string>();
    set.add(mutation.primaryKey);
    byTable.set(mutation.table, set);
  }

  for (const [table, ids] of byTable) {
    const key = OFFLINE_CACHE_KEYS[table];
    if (!key) continue;
    const records = readOffline<any[]>(key, []);
    const filtered = records.filter((record) => !ids.has(record.id));
    writeOffline(key, filtered);
  }
}

export type QueueMutationInput = {
  table: OfflineTable;
  type: OfflineMutationType;
  primaryKey: string;
  payload: Record<string, any>;
  updatedAt?: string;
  timestamp?: number;
};

export async function queueMutation(input: QueueMutationInput) {
  const timestamp = input.timestamp ?? nowTimestamp();
  const mutation: OfflineMutation = {
    id: generateId(),
    table: input.table,
    type: input.type,
    primaryKey: input.primaryKey,
    payload: { ...input.payload },
    timestamp,
    updatedAt: input.updatedAt
  };

  const queue = await readQueue();
  const filtered = queue.filter((entry) => {
    if (entry.table !== mutation.table) return true;
    if (entry.primaryKey !== mutation.primaryKey) return true;
    if (mutation.type === 'delete') return false;
    if (mutation.type === 'update' && entry.type === 'update') return false;
    if (mutation.type === 'insert') return false;
    return true;
  });

  filtered.push(mutation);
  filtered.sort((a, b) => a.timestamp - b.timestamp);
  await persistQueue(filtered);
  return mutation;
}

export type FlushOptions = {
  retryDelays?: number[];
  currentUserId?: string | null;
};

export type FlushResult = {
  applied: OfflineMutation[];
  skipped: OfflineMutation[];
  pending: OfflineMutation[];
  userId: string | null;
};

function getStoredUserId() {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage?.getItem('zenko-last-user-id') ?? null;
  } catch (error) {
    console.warn('Não foi possível acessar o último usuário conhecido.', error);
    return null;
  }
}

export async function flush(options: FlushOptions = {}): Promise<FlushResult> {
  const queue = await readQueue();
  if (queue.length === 0) {
    return { applied: [], skipped: [], pending: [], userId: null };
  }

  let userId = options.currentUserId ?? null;
  if (!userId) {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      userId = data.user?.id ?? null;
    } catch (error) {
      console.warn('Não foi possível recuperar o usuário atual para sincronização.', error);
      userId = null;
    }
  }

  if (!userId) {
    userId = getStoredUserId();
  }

  if (!userId) {
    return { applied: [], skipped: [], pending: queue, userId: null };
  }

  const retryDelays = options.retryDelays ?? DEFAULT_RETRY_DELAYS;
  const remaining: OfflineMutation[] = [];
  const applied: OfflineMutation[] = [];
  const skipped: OfflineMutation[] = [];

  for (const mutation of queue) {
    let success = false;
    let lastError: unknown = null;

    for (const delay of retryDelays) {
      try {
        await sleep(delay);
        const status = await applyMutation(mutation, userId);
        if (status === 'applied') {
          applied.push(mutation);
        } else {
          skipped.push(mutation);
        }
        success = true;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!success) {
      console.warn('Falha ao aplicar mutação offline. Mantendo na fila.', lastError);
      remaining.push(mutation);
    }
  }

  await persistQueue(remaining);

  const processed = [...applied, ...skipped];
  if (processed.length > 0) {
    await cleanupOfflineCaches(processed);
  }

  return { applied, skipped, pending: remaining, userId };
}

export async function getQueuedMutations() {
  return readQueue();
}

export async function clearQueuedMutations() {
  await persistQueue([]);
}
