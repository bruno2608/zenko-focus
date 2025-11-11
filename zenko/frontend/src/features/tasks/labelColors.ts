const palette = [
  { background: '#0079bf', foreground: '#f8fafc' },
  { background: '#d29034', foreground: '#fff7ed' },
  { background: '#519839', foreground: '#ecfdf5' },
  { background: '#b04632', foreground: '#fff1f2' },
  { background: '#89609e', foreground: '#f5f3ff' },
  { background: '#cd5a91', foreground: '#fdf2f8' },
  { background: '#4bbf6b', foreground: '#ecfdf3' },
  { background: '#00aecc', foreground: '#f0f9ff' }
];

const fallback = palette[0];

export function getLabelColors(label: string, index = 0) {
  const normalized = label.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }

  const paletteIndex = Math.abs(hash + index) % palette.length;
  return palette[paletteIndex] ?? fallback;
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
