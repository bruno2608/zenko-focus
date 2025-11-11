import { createStore, del, get, set, type Store } from 'idb-keyval';

export type OfflineResource = 'tasks' | 'reminders' | 'pomodoro_sessions' | 'profiles';

const DB_NAME = 'zenko-offline';

const stores = new Map<OfflineResource, Store>();

function hasIndexedDb() {
  return typeof indexedDB !== 'undefined';
}

function getStore(resource: OfflineResource) {
  if (!hasIndexedDb()) {
    return null;
  }
  if (!stores.has(resource)) {
    stores.set(resource, createStore(DB_NAME, resource));
  }
  return stores.get(resource)!;
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

export async function readOffline<T>(resource: OfflineResource, key: string, fallback: T): Promise<T> {
  const store = getStore(resource);
  if (!store) {
    return fallback;
  }
  try {
    const value = await get(key, store);
    return (value as T | undefined) ?? fallback;
  } catch (error) {
    console.warn('Falha ao ler dados offline, usando padrão.', error);
    return fallback;
  }
}

export async function writeOffline<T>(resource: OfflineResource, key: string, value: T): Promise<void> {
  const store = getStore(resource);
  if (!store) {
    throw new OfflineStorageError('Armazenamento offline indisponível.', 'unavailable');
  }
  try {
    await set(key, value, store);
  } catch (error) {
    if (isQuotaExceededError(error)) {
      throw new OfflineStorageError('Limite de armazenamento offline atingido.', 'quota_exceeded', { cause: error });
    }
    throw new OfflineStorageError('Não foi possível persistir dados offline.', 'unknown', { cause: error });
  }
}

export async function removeOffline(resource: OfflineResource, key: string): Promise<void> {
  const store = getStore(resource);
  if (!store) {
    return;
  }
  try {
    await del(key, store);
  } catch (error) {
    console.warn('Não foi possível remover dado offline.', error);
  }
}
