import '@testing-library/jest-dom';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  get length(): number {
    return this.store.size;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

const storage = new MemoryStorage();

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = storage;
}

if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = { localStorage: storage } as Window;
} else if (typeof globalThis.window.localStorage === 'undefined') {
  (globalThis.window as any).localStorage = storage;
}
