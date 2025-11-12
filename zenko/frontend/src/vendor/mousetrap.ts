export type MousetrapHandler = (event: KeyboardEvent) => void;

const KEY_ALIASES: Record<string, string> = {
  esc: 'escape',
  escape: 'escape',
  enter: 'enter',
  return: 'enter',
  space: ' ',
  spacebar: ' '
};

function normalizeKey(input: string) {
  const lower = input.length === 1 ? input.toLowerCase() : input.toLowerCase();
  return KEY_ALIASES[lower] ?? lower;
}

class SimpleMousetrap {
  private handlers = new Map<string, Set<MousetrapHandler>>();
  private listener: ((event: KeyboardEvent) => void) | null = null;
  private target: Document | HTMLElement | null = null;

  constructor(target?: Document | HTMLElement | null) {
    if (typeof document === 'undefined') {
      return;
    }
    this.target = target ?? document;
    this.listener = (event: KeyboardEvent) => {
      const key = normalizeKey(event.key === ' ' ? ' ' : event.key);
      const exact = this.handlers.get(key);
      if (exact) {
        exact.forEach((handler) => handler(event));
      }
      const lower = key.toLowerCase();
      if (lower !== key) {
        const fallback = this.handlers.get(lower);
        fallback?.forEach((handler) => handler(event));
      }
    };
    this.target.addEventListener('keydown', this.listener);
  }

  bind(keys: string | string[], handler: MousetrapHandler) {
    if (!this.listener) return;
    const list = Array.isArray(keys) ? keys : [keys];
    list.forEach((key) => {
      const normalized = normalizeKey(key);
      if (!this.handlers.has(normalized)) {
        this.handlers.set(normalized, new Set());
      }
      this.handlers.get(normalized)!.add(handler);
    });
  }

  unbind(keys: string | string[], handler?: MousetrapHandler) {
    if (!this.listener) return;
    const list = Array.isArray(keys) ? keys : [keys];
    list.forEach((key) => {
      const normalized = normalizeKey(key);
      const bucket = this.handlers.get(normalized);
      if (!bucket) return;
      if (handler) {
        bucket.delete(handler);
      } else {
        bucket.clear();
      }
      if (bucket.size === 0) {
        this.handlers.delete(normalized);
      }
    });
  }

  reset() {
    this.handlers.clear();
  }

  destroy() {
    if (this.listener && this.target) {
      this.target.removeEventListener('keydown', this.listener);
    }
    this.handlers.clear();
    this.listener = null;
    this.target = null;
  }
}

export type MousetrapInstance = SimpleMousetrap;

export default function createMousetrap(target?: Document | HTMLElement | null) {
  return new SimpleMousetrap(target ?? (typeof document !== 'undefined' ? document : null));
}
