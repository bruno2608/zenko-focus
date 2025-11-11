if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    }
  } as Storage;
}

import '@testing-library/jest-dom';
import { vi } from 'vitest';

const keyvalStore = new Map<string, any>();

vi.mock('idb-keyval', () => {
  return {
    get(key: string) {
      return Promise.resolve(keyvalStore.get(key));
    },
    set(key: string, value: any) {
      keyvalStore.set(key, value);
      return Promise.resolve();
    },
    del(key: string) {
      keyvalStore.delete(key);
      return Promise.resolve();
    }
  };
});

(globalThis as any).__clearKeyvalStore = () => keyvalStore.clear();
