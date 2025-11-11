import { create } from 'zustand';
import { TaskStatus } from './types';
import { LabelColorId, trelloPalette } from './labelColors';

export interface LabelDefinition {
  id: string;
  value: string;
  normalized: string;
  colorId: LabelColorId;
}

type DueFilter = 'all' | 'today' | 'week';

interface TasksState {
  filters: {
    status: TaskStatus | 'all';
    due: DueFilter;
    labels: string[];
  };
  labelsLibrary: LabelDefinition[];
  labelColorCursor: number;
  setFilter: (filter: Partial<TasksState['filters']>) => void;
  registerLabels: (labels: string[]) => void;
  createLabel: (value: string, colorId: LabelColorId) => void;
  updateLabel: (id: string, updates: { value?: string; colorId?: LabelColorId }) => void;
  removeLabel: (id: string) => void;
}

function generateLabelId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try {
      return crypto.randomUUID();
    } catch (error) {
      // ignore and fallback to Math.random based id
    }
  }
  return `label-${Math.random().toString(36).slice(2, 10)}`;
}

function sortLabels(labels: LabelDefinition[]) {
  return [...labels].sort((a, b) => a.value.localeCompare(b.value, undefined, { sensitivity: 'base' }));
}

function normalizeLabelValue(value: string) {
  return value.trim().toLocaleLowerCase();
}

function createDefinition(value: string, colorId: LabelColorId): LabelDefinition {
  const trimmed = value.trim();
  return {
    id: generateLabelId(),
    value: trimmed,
    normalized: normalizeLabelValue(trimmed),
    colorId
  };
}

export const useTasksStore = create<TasksState>((set) => ({
  filters: {
    status: 'all',
    due: 'all',
    labels: []
  },
  labelsLibrary: [],
  labelColorCursor: 0,
  setFilter: (filter) =>
    set((state) => ({
      filters: { ...state.filters, ...filter }
    })),
  registerLabels: (labels) =>
    set((state) => {
      if (!labels?.length) {
        return state;
      }

      const normalized = labels
        .map((label) => label.trim())
        .filter(Boolean)
        .map((label) => ({
          value: label,
          normalized: normalizeLabelValue(label)
        }));

      if (normalized.length === 0) {
        return state;
      }

      const existing = new Map(state.labelsLibrary.map((definition) => [definition.normalized, definition]));
      let changed = false;
      let cursor = state.labelColorCursor;
      const merged = [...state.labelsLibrary];

      normalized.forEach(({ value, normalized: normalizedValue }) => {
        if (existing.has(normalizedValue)) {
          return;
        }
        const paletteIndex = cursor % trelloPalette.length;
        cursor += 1;
        const colorId = trelloPalette[paletteIndex]?.id ?? trelloPalette[0].id;
        const definition = createDefinition(value, colorId);
        merged.push(definition);
        existing.set(normalizedValue, definition);
        changed = true;
      });

      if (!changed) {
        return state;
      }

      const sorted = sortLabels(merged);
      return { ...state, labelsLibrary: sorted, labelColorCursor: cursor };
    }),
  createLabel: (value, colorId) =>
    set((state) => {
      const trimmed = value.trim();
      if (!trimmed) {
        return state;
      }

      const normalizedValue = normalizeLabelValue(trimmed);
      const existingIndex = state.labelsLibrary.findIndex(
        (item) => item.normalized === normalizedValue
      );

      if (existingIndex >= 0) {
        const current = state.labelsLibrary[existingIndex];
        const updated = [...state.labelsLibrary];
        updated[existingIndex] = {
          ...current,
          value: trimmed,
          colorId
        };
        return { ...state, labelsLibrary: sortLabels(updated) };
      }

      const next = [...state.labelsLibrary, createDefinition(trimmed, colorId)];
      return {
        ...state,
        labelsLibrary: sortLabels(next)
      };
    }),
  updateLabel: (id, updates) =>
    set((state) => {
      const index = state.labelsLibrary.findIndex((item) => item.id === id);
      if (index < 0) {
        return state;
      }

      const current = state.labelsLibrary[index];
      let nextValue = current.value;
      let nextNormalized = current.normalized;
      let nextColor = current.colorId;
      let hasChanges = false;

      if (typeof updates.value === 'string') {
        const trimmed = updates.value.trim();
        if (!trimmed) {
          return state;
        }
        const normalizedValue = normalizeLabelValue(trimmed);
        const duplicate = state.labelsLibrary.some(
          (item, itemIndex) => itemIndex !== index && item.normalized === normalizedValue
        );
        if (duplicate) {
          return state;
        }
        nextValue = trimmed;
        nextNormalized = normalizedValue;
        hasChanges = true;
      }

      if (updates.colorId && updates.colorId !== nextColor) {
        nextColor = updates.colorId;
        hasChanges = true;
      }

      if (!hasChanges) {
        return state;
      }

      const updated = [...state.labelsLibrary];
      updated[index] = {
        ...current,
        value: nextValue,
        normalized: nextNormalized,
        colorId: nextColor
      };

      return {
        ...state,
        labelsLibrary: sortLabels(updated)
      };
    }),
  removeLabel: (id) =>
    set((state) => {
      const filtered = state.labelsLibrary.filter((item) => item.id !== id);
      if (filtered.length === state.labelsLibrary.length) {
        return state;
      }
      return { ...state, labelsLibrary: filtered };
    })
}));
