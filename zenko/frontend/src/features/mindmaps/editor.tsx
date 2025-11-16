import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Mindmap, MindmapNode, MINDMAP_TEMPLATES } from './models/mindmapModel';
import { useMindmap } from './hooks/useMindmap';

const colorOptions = ['#8b5cf6', '#60a5fa', '#34d399', '#fb7185', '#fbbf24', '#f472b6', '#38bdf8'];
const iconOptions = ['💡', '✅', '⭐️', '🔥', '📌', '🎯', '🚀', '🧠'];

type Viewport = { zoom: number; panX: number; panY: number };

function getNodeCenter(node: MindmapNode, viewport: Viewport) {
  return {
    x: (node.position.x + viewport.panX) * viewport.zoom + 120 * viewport.zoom,
    y: (node.position.y + viewport.panY) * viewport.zoom + 40 * viewport.zoom
  };
}

function NodeCard({
  node,
  onDrag,
  onChangeText,
  onAddChild,
  onAddSibling,
  onChangeStyle,
  onRemove,
  isRoot,
  viewport,
  canvasRect
}: {
  node: MindmapNode;
  viewport: Viewport;
  canvasRect: DOMRect | null;
  onDrag: (id: string, position: { x: number; y: number }) => void;
  onChangeText: (id: string, text: string) => void;
  onAddChild: (id: string) => void;
  onAddSibling: (id: string) => void;
  onChangeStyle: (id: string, updates: Partial<Pick<MindmapNode, 'color' | 'icon'>>) => void;
  onRemove: (id: string) => void;
  isRoot: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const offset = useRef({ x: 0, y: 0 });

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canvasRect) return;
    const worldX = (event.clientX - canvasRect.left) / viewport.zoom - viewport.panX;
    const worldY = (event.clientY - canvasRect.top) / viewport.zoom - viewport.panY;
    offset.current = { x: worldX - node.position.x, y: worldY - node.position.y };
    setDragging(true);
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || !canvasRect) return;
    const worldX = (event.clientX - canvasRect.left) / viewport.zoom - viewport.panX;
    const worldY = (event.clientY - canvasRect.top) / viewport.zoom - viewport.panY;
    onDrag(node.id, { x: worldX - offset.current.x, y: worldY - offset.current.y });
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    setDragging(false);
    (event.target as HTMLElement).releasePointerCapture(event.pointerId);
  };

  const cardStyle: CSSProperties = {
    transform: `translate(${(node.position.x + viewport.panX) * viewport.zoom}px, ${(node.position.y + viewport.panY) * viewport.zoom}px) scale(${viewport.zoom})`,
    transformOrigin: 'top left',
    background: node.color,
    boxShadow: '0 18px 42px -24px rgba(15,23,42,0.35)'
  };

  return (
    <div
      className="absolute flex min-w-[200px] max-w-[260px] flex-col rounded-2xl px-4 py-3 text-slate-900 shadow-lg backdrop-blur"
      style={cardStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className="flex items-center justify-between gap-2">
        <input
          value={node.text}
          onChange={(event) => onChangeText(node.id, event.target.value)}
          className="w-full bg-transparent text-base font-semibold text-white placeholder:text-white/70 focus:outline-none"
          aria-label="Editar texto do nó"
        />
        {node.icon && <span className="text-lg">{node.icon}</span>}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/90">
        <button
          type="button"
          onClick={() => onAddChild(node.id)}
          className="rounded-full bg-white/25 px-3 py-1 font-semibold backdrop-blur hover:bg-white/35"
        >
          + Subtópico
        </button>
        {!isRoot && (
          <button
            type="button"
            onClick={() => onAddSibling(node.id)}
            className="rounded-full bg-white/20 px-3 py-1 font-semibold backdrop-blur hover:bg-white/30"
          >
            + Irmão
          </button>
        )}
        {!isRoot && (
          <button
            type="button"
            onClick={() => onRemove(node.id)}
            className="rounded-full bg-white/15 px-2 py-1 font-semibold text-white/80 backdrop-blur hover:bg-white/25"
          >
            Remover
          </button>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/90">
        <div className="flex items-center gap-1">
          {colorOptions.map((color) => (
            <button
              key={color}
              onClick={() => onChangeStyle(node.id, { color })}
              className={`h-6 w-6 rounded-full border border-white/40 transition hover:scale-105 ${color === node.color ? 'ring-2 ring-white/80 ring-offset-2 ring-offset-white/20' : ''}`}
              style={{ background: color }}
              aria-label={`Alterar cor para ${color}`}
            />
          ))}
        </div>
        <select
          value={node.icon ?? ''}
          onChange={(event) => onChangeStyle(node.id, { icon: event.target.value || undefined })}
          className="rounded-xl bg-white/20 px-2 py-1 text-xs font-semibold text-white focus:outline-none"
        >
          <option value="">Sem ícone</option>
          {iconOptions.map((icon) => (
            <option key={icon} value={icon}>
              {icon}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function useCanvasRect(containerRef: React.RefObject<HTMLDivElement>) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      const bounds = containerRef.current?.getBoundingClientRect();
      if (bounds) setRect(bounds);
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [containerRef]);

  return rect;
}

function createEdgePath(from: { x: number; y: number }, to: { x: number; y: number }) {
  const midX = (from.x + to.x) / 2;
  return `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
}

function buildSvgFromMindmap(map: Mindmap) {
  const nodes = Object.values(map.nodes);
  const padding = 80;
  const xs = nodes.map((node) => node.position.x);
  const ys = nodes.map((node) => node.position.y);
  const minX = Math.min(...xs, 0) - padding;
  const maxX = Math.max(...xs, 300) + padding;
  const minY = Math.min(...ys, 0) - padding;
  const maxY = Math.max(...ys, 300) + padding;
  const width = maxX - minX;
  const height = maxY - minY;

  const nodeRects = nodes
    .map(
      (node) =>
        `<g transform="translate(${node.position.x - minX}, ${node.position.y - minY})">
          <rect rx="16" ry="16" width="240" height="96" fill="${node.color}" opacity="0.92" />
          <text x="16" y="40" font-size="16" font-family="Inter, sans-serif" fill="white" font-weight="700">${node.text}</text>
          ${node.icon ? `<text x="16" y="70" font-size="18">${node.icon}</text>` : ''}
        </g>`
    )
    .join('');

  const edges = nodes
    .flatMap((node) => node.children.map((childId) => ({ parent: node, child: map.nodes[childId] })))
    .filter((pair) => Boolean(pair.child))
    .map(({ parent, child }) => {
      const from = { x: parent.position.x - minX + 120, y: parent.position.y - minY + 48 };
      const to = { x: child!.position.x - minX + 120, y: child!.position.y - minY + 48 };
      const midX = (from.x + to.x) / 2;
      const path = `M ${from.x} ${from.y} C ${midX} ${from.y} ${midX} ${to.y} ${to.x} ${to.y}`;
      return `<path d="${path}" stroke="#0f172a" stroke-opacity="0.22" stroke-width="3" fill="none" />`;
    })
    .join('');

  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="12" stdDeviation="18" flood-color="#0f172a" flood-opacity="0.18" />
      </filter>
    </defs>
    <g filter="url(#shadow)">
      ${edges}
      ${nodeRects}
    </g>
  </svg>`, width, height };
}

async function downloadImageFromSvg(map: Mindmap) {
  const { svg, width, height } = buildSvgFromMindmap(map);
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  await new Promise((resolve) => {
    img.onload = resolve;
    img.src = url;
  });

  ctx.drawImage(img, 0, 0);
  const png = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = png;
  link.download = `${map.title || 'mapa-mental'}.png`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function MindmapEditor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const {
    currentMindmap,
    selectMindmap,
    changeText,
    changeStyle,
    addChild,
    addSibling,
    changePosition,
    remove,
    isSaving,
    updateMindmap
  } = useMindmap();
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewport = useRef<Viewport>({ zoom: 1, panX: 200, panY: 200 });
  const [renderKey, setRenderKey] = useState(0);
  const canvasRect = useCanvasRect(canvasRef);

  useEffect(() => {
    if (id) {
      selectMindmap(id);
    }
  }, [id, selectMindmap]);

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.08 : 0.08;
      const nextZoom = Math.min(1.6, Math.max(0.6, viewport.current.zoom + delta));
      viewport.current = { ...viewport.current, zoom: nextZoom };
      setRenderKey((key) => key + 1);
    };

    const element = canvasRef.current;
    element?.addEventListener('wheel', handleWheel, { passive: false });
    return () => element?.removeEventListener('wheel', handleWheel);
  }, []);

  const nodes = useMemo(() => Object.values(currentMindmap?.nodes ?? {}), [currentMindmap]);
  const edges = useMemo(
    () =>
      nodes.flatMap((node) =>
        node.children.map((childId) => ({
          id: `${node.id}-${childId}`,
          source: node,
          target: currentMindmap?.nodes[childId]
        }))
      ),
    [currentMindmap?.nodes, nodes]
  );

  const centerMap = () => {
    if (!canvasRect || nodes.length === 0) return;
    const bounds = nodes.reduce(
      (acc, node) => {
        return {
          minX: Math.min(acc.minX, node.position.x),
          maxX: Math.max(acc.maxX, node.position.x),
          minY: Math.min(acc.minY, node.position.y),
          maxY: Math.max(acc.maxY, node.position.y)
        };
      },
      { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
    );

    const width = bounds.maxX - bounds.minX + 240;
    const height = bounds.maxY - bounds.minY + 140;
    const panX = canvasRect.width / 2 / viewport.current.zoom - (bounds.minX + width / 2 - 120);
    const panY = canvasRect.height / 2 / viewport.current.zoom - (bounds.minY + height / 2 - 60);
    viewport.current = { ...viewport.current, panX, panY };
    setRenderKey((key) => key + 1);
  };

  const handleExportJson = () => {
    if (!currentMindmap) return;
    const blob = new Blob([JSON.stringify(currentMindmap, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${currentMindmap.title || 'mapa-mental'}.json`;
    link.click();
  };

  const handleExportImage = async () => {
    if (!currentMindmap) return;
    await downloadImageFromSvg(currentMindmap);
  };

  const handleNodeTextChange = (nodeId: string, text: string) => {
    if (!currentMindmap) return;
    if (nodeId === currentMindmap.rootId) {
      updateMindmap((map) => ({
        ...map,
        title: text,
        nodes: {
          ...map.nodes,
          [nodeId]: { ...map.nodes[nodeId], text }
        }
      }));
      return;
    }
    changeText(nodeId, text);
  };

  const toggleFullscreen = () => {
    const element = canvasRef.current;
    if (!element) return;
    if (!document.fullscreenElement) {
      element.requestFullscreen().catch(() => {
        /* noop */
      });
    } else {
      document.exitFullscreen().catch(() => {
        /* noop */
      });
    }
  };

  if (!currentMindmap) {
    return (
      <div className="flex h-full items-center justify-center rounded-3xl border border-slate-200 bg-white/60 p-8 text-center shadow-lg dark:border-white/10 dark:bg-white/5">
        <div className="space-y-3">
          <p className="text-lg font-semibold text-slate-800 dark:text-white">Selecione um mapa mental</p>
          <p className="text-sm text-slate-500">Nenhum mapa encontrado com esse identificador.</p>
          <Button onClick={() => navigate('/mindmaps')}>Voltar</Button>
        </div>
      </div>
    );
  }

  const template = MINDMAP_TEMPLATES.find((item) => item.id === currentMindmap.template);

  return (
    <div className="flex h-full flex-col gap-4 pb-10">
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.25)] backdrop-blur dark:border-white/10 dark:bg-white/5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/mindmaps"
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-white/10 dark:text-white"
            aria-label="Voltar para o dashboard de mapas"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Editor visual</p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={currentMindmap.title}
                onChange={(event) =>
                  updateMindmap((map) => {
                    const value = event.target.value;
                    const root = map.nodes[map.rootId];
                    return {
                      ...map,
                      title: value,
                      nodes: {
                        ...map.nodes,
                        [map.rootId]: { ...root, text: value }
                      }
                    };
                  })
                }
                className="w-full min-w-[220px] rounded-2xl border-slate-200 bg-white px-3 py-2 text-base font-semibold shadow-sm dark:border-white/10 dark:bg-slate-900"
              />
              {template && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-white/70">
                  {template.name}
                </span>
              )}
              {isSaving && <span className="text-xs text-zenko-primary">Salvando...</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={centerMap} className="rounded-xl text-sm">
            Centralizar
          </Button>
          <Button variant="secondary" onClick={() => handleExportImage()} className="rounded-xl text-sm">
            Exportar imagem
          </Button>
          <Button variant="secondary" onClick={handleExportJson} className="rounded-xl text-sm">
            Exportar JSON
          </Button>
          <Button variant="ghost" onClick={toggleFullscreen} className="rounded-xl text-sm text-zenko-primary">
            Fullscreen
          </Button>
        </div>
      </div>

      <div className="relative h-[70vh] min-h-[520px] overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100 shadow-inner dark:border-white/10 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(15,23,42,0.08)_1px,_transparent_0)] bg-[length:28px_28px] opacity-60" />
        <div className="absolute left-6 top-4 z-10 flex flex-wrap items-center gap-2 rounded-full bg-white/90 px-3 py-2 shadow-lg backdrop-blur dark:bg-slate-900/90">
          <button
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-slate-800 dark:text-white"
            onClick={() => {
              const zoom = Math.min(1.6, viewport.current.zoom + 0.1);
              viewport.current = { ...viewport.current, zoom };
              setRenderKey((key) => key + 1);
            }}
          >
            + Zoom
          </button>
          <button
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-slate-800 dark:text-white"
            onClick={() => {
              const zoom = Math.max(0.5, viewport.current.zoom - 0.1);
              viewport.current = { ...viewport.current, zoom };
              setRenderKey((key) => key + 1);
            }}
          >
            - Zoom
          </button>
          <button
            className="rounded-full border border-zenko-primary/30 bg-zenko-primary/10 px-3 py-1 text-xs font-semibold text-zenko-primary shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            onClick={() => addChild(currentMindmap.rootId)}
          >
            Novo nó
          </button>
        </div>

        <div ref={canvasRef} key={renderKey} className="relative h-full w-full overflow-hidden">
          <svg className="absolute inset-0 h-full w-full" aria-hidden>
            {edges.map((edge) => {
              if (!edge.target) return null;
              const from = getNodeCenter(edge.source, viewport.current);
              const to = getNodeCenter(edge.target, viewport.current);
              const d = createEdgePath(from, to);
              return <path key={edge.id} d={d} stroke="#0f172a" strokeWidth={2.6} strokeOpacity={0.2} fill="none" />;
            })}
          </svg>
          {nodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              viewport={viewport.current}
              canvasRect={canvasRect}
              onDrag={(id, position) => changePosition(id, position)}
              onChangeText={handleNodeTextChange}
              onAddChild={addChild}
              onAddSibling={addSibling}
              onChangeStyle={changeStyle}
              onRemove={remove}
              isRoot={node.id === currentMindmap.rootId}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
