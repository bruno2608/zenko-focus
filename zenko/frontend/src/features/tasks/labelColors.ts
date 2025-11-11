export const trelloPalette = [
  { id: 'green', background: '#61bd4f', foreground: '#0b2814' },
  { id: 'yellow', background: '#f2d600', foreground: '#4d3b00' },
  { id: 'orange', background: '#ff9f1a', foreground: '#482300' },
  { id: 'red', background: '#eb5a46', foreground: '#2f0c07' },
  { id: 'purple', background: '#c377e0', foreground: '#2e0436' },
  { id: 'blue', background: '#0079bf', foreground: '#f1f5f9' },
  { id: 'sky', background: '#00c2e0', foreground: '#013a46' },
  { id: 'lime', background: '#51e898', foreground: '#0b3218' },
  { id: 'pink', background: '#ff78cb', foreground: '#461032' },
  { id: 'black', background: '#344563', foreground: '#f8fafc' }
] as const;

export type LabelColorId = (typeof trelloPalette)[number]['id'];

const paletteById = new Map(trelloPalette.map((entry) => [entry.id, entry]));

const fallback = trelloPalette[0];

export function getLabelColors(
  label: string,
  options: { colorId?: LabelColorId; fallbackIndex?: number } = {}
) {
  if (options.colorId) {
    const resolved = paletteById.get(options.colorId);
    if (resolved) {
      return resolved;
    }
  }

  const normalized = label.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }

  const indexOffset = options.fallbackIndex ?? 0;
  const paletteIndex = Math.abs(hash + indexOffset) % trelloPalette.length;
  return trelloPalette[paletteIndex] ?? fallback;
}

export function getColorFromId(colorId: LabelColorId) {
  return paletteById.get(colorId) ?? fallback;
}

export function parseLabels(input: string | undefined | null): string[] {
  if (!input) {
    return [];
  }

  return input
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean);
}
