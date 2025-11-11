import { createStore, del, get, set, type Store } from 'idb-keyval';

export type OfflineResource = 'tasks' | 'reminders' | 'pomodoro_sessions' | 'profiles';

const DB_NAME = 'zenko-offline';
const STORE_NAME = 'data';

let store: Store | null = null;

function hasIndexedDb() {
  return typeof indexedDB !== 'undefined';
}

function getStore() {
  if (!hasIndexedDb()) {
    return null;
  }
  if (!store) {
    store = createStore(DB_NAME, STORE_NAME);
  }
  return store;
}

function buildKey(resource: OfflineResource, key: string) {
  return `${resource}:${key}`;
}

function isQuotaExceededError(error: unknown) {
  if (!error) return false;
  if (error instanceof DOMException) {
    return error.name === 'QuotaExceededError' || error.code === 22;
  }
  if (typeof error === 'object' && 'name' in (error as any)) {
    return (error as any).name === 'QuotaExceededError';
  }
  return false;
}

function isMissingStoreError(error: unknown) {
  return error instanceof DOMException && error.name === 'NotFoundError';
}

function deleteDatabase() {
  if (!hasIndexedDb()) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onblocked = () => resolve();
    request.onerror = () => {
      const reason = request.error ?? new Error('Failed to delete offline database');
      reject(reason);
    };
  });
}

async function recreateStore() {
  try {
    await deleteDatabase();
  } catch (error) {
    console.warn('Falha ao reinicializar armazenamento offline.', error);
  }
  store = null;
  return getStore();
}

export class OfflineStorageError extends Error {
  constructor(
    message: string,
    public readonly reason: 'unavailable' | 'quota_exceeded' | 'unknown',
    options?: { cause?: unknown }
  ) {
    super(message);
    this.name = 'OfflineStorageError';
    if (options?.cause) {
      Object.defineProperty(this, 'cause', {
        value: options.cause,
        enumerable: false,
        configurable: true
      });
    }
  }
}

export async function readOffline<T>(resource: OfflineResource, key: string, fallback: T): Promise<T> {
  let targetStore = getStore();
  if (!targetStore) {
    return fallback;
  }
  try {
    const value = await get(buildKey(resource, key), targetStore);
    return (value as T | undefined) ?? fallback;
  } catch (error) {
    if (isMissingStoreError(error)) {
      const recreated = await recreateStore();
      if (recreated) {
        try {
          const value = await get(buildKey(resource, key), recreated);
          return (value as T | undefined) ?? fallback;
        } catch (retryError) {
          console.warn('Falha ao ler dados offline após recriação do store, usando padrão.', retryError);
          return fallback;
        }
      }
    }
    console.warn('Falha ao ler dados offline, usando padrão.', error);
    return fallback;
  }
}

export async function writeOffline<T>(resource: OfflineResource, key: string, value: T): Promise<void> {
  let targetStore = getStore();
  if (!targetStore) {
    throw new OfflineStorageError('Armazenamento offline indisponível.', 'unavailable');
  }
  try {
    await set(buildKey(resource, key), value, targetStore);
  } catch (error) {
    if (isMissingStoreError(error)) {
      const recreated = await recreateStore();
      if (recreated) {
        try {
          await set(buildKey(resource, key), value, recreated);
          return;
        } catch (retryError) {
          throw new OfflineStorageError('Não foi possível persistir dados offline.', 'unknown', {
            cause: retryError
          });
        }
      }
    }
    if (isQuotaExceededError(error)) {
      throw new OfflineStorageError('Limite de armazenamento offline atingido.', 'quota_exceeded', { cause: error });
    }
    throw new OfflineStorageError('Não foi possível persistir dados offline.', 'unknown', { cause: error });
  }
}

export async function removeOffline(resource: OfflineResource, key: string): Promise<void> {
  const store = getStore();
  if (!store) {
    return;
  }
  try {
    await del(buildKey(resource, key), store);
  } catch (error) {
    console.warn('Não foi possível remover dado offline.', error);
  }
}
