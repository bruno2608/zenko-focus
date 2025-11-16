import { Mindmap } from '../models/mindmapModel';

const STORAGE_KEY = 'zenko-mindmaps';

type StoredMindmap = Mindmap;

function read(): StoredMindmap[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as StoredMindmap[];
    return [];
  } catch (error) {
    console.warn('Não foi possível ler os mapas do localStorage', error);
    return [];
  }
}

function write(mindmaps: StoredMindmap[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mindmaps));
}

export async function listMindmaps(): Promise<StoredMindmap[]> {
  return read().sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getMindmap(id: string): Promise<StoredMindmap | null> {
  const found = read().find((item) => item.id === id);
  return found ?? null;
}

export async function saveMindmap(mindmap: StoredMindmap): Promise<StoredMindmap> {
  const existing = read();
  const next = existing.filter((item) => item.id !== mindmap.id);
  next.push({ ...mindmap, updatedAt: Date.now() });
  write(next);
  return mindmap;
}

export async function deleteMindmap(id: string): Promise<void> {
  const existing = read();
  write(existing.filter((item) => item.id !== id));
}

export async function upsertMindmaps(mindmaps: StoredMindmap[]): Promise<void> {
  write(mindmaps);
}
