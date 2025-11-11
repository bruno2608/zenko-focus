import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { readOffline, writeOffline } from '../../frontend/src/lib/offline';

describe('offline storage helpers', () => {
  const key = 'test';

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns fallback when storage is unavailable', () => {
    const original = window.localStorage;
    // simulate storage not available by temporarily throwing when accessed
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('blocked');
      }
    });

    try {
      expect(readOffline(key, ['fallback'])).toEqual(['fallback']);
    } finally {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: original
      });
    }
  });

  it('returns fallback when persisted value is invalid JSON', () => {
    writeOffline(key, { value: 1 });
    const rawKey = `zenko-offline-${key}`;
    localStorage.setItem(rawKey, '{invalid json');

    expect(readOffline(key, { value: 2 })).toEqual({ value: 2 });
  });

  it('persists JSON serialized values with the zenko prefix', () => {
    writeOffline(key, { hello: 'world' });
    const rawKey = `zenko-offline-${key}`;
    const saved = localStorage.getItem(rawKey);

    expect(saved).toBe(JSON.stringify({ hello: 'world' }));
  });

  it('swallows write errors without throwing', () => {
    const setItem = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    expect(() => writeOffline(key, { boom: true })).not.toThrow();
    expect(setItem).toHaveBeenCalled();
  });
});
