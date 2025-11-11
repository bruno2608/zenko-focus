const STORAGE_PREFIX = 'zenko-offline-';

function getStorage() {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage;
  } catch (error) {
    console.warn('Armazenamento local indisponível.', error);
    return null;
  }
}

export function readOffline<T>(key: string, fallback: T): T {
  const storage = getStorage();
  if (!storage) return fallback;
  const raw = storage.getItem(`${STORAGE_PREFIX}${key}`);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn('Falha ao ler dados offline, usando padrão.', error);
    return fallback;
  }
}

export function writeOffline<T>(key: string, value: T) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
  } catch (error) {
    console.warn('Não foi possível persistir dados offline.', error);
  }
}
