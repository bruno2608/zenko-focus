import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Mindmap,
  MindmapNode,
  MindmapTemplateId,
  addChildNode,
  addSiblingNode,
  createMindmapFromTemplate,
  removeNode,
  updateNodePosition,
  updateNodeStyle,
  updateNodeText
} from '../models/mindmapModel';
import { deleteMindmap, getMindmap, listMindmaps, saveMindmap } from '../storage/mindmapStorage';

interface UseMindmapOptions {
  autoSaveDelay?: number;
}

export function useMindmap(options: UseMindmapOptions = {}) {
  const { autoSaveDelay = 800 } = options;
  const [mindmaps, setMindmaps] = useState<Mindmap[]>([]);
  const [currentMindmap, setCurrentMindmap] = useState<Mindmap | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setIsLoading(true);
        const maps = await listMindmaps();
        setMindmaps(maps);
      } catch (err) {
        console.error(err);
        setError('Não foi possível carregar os mapas.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const selectMindmap = useCallback(async (id: string) => {
    const map = await getMindmap(id);
    setCurrentMindmap(map ?? null);
  }, []);

  const createMindmap = useCallback(
    async (template: MindmapTemplateId, title?: string) => {
      const map = createMindmapFromTemplate(template, title);
      await saveMindmap(map);
      setMindmaps((prev) => [map, ...prev.filter((item) => item.id !== map.id)]);
      setCurrentMindmap(map);
      return map;
    },
    []
  );

  const updateMindmap = useCallback((updater: (map: Mindmap) => Mindmap) => {
    setCurrentMindmap((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      return { ...next, updatedAt: Date.now() };
    });
  }, []);

  const removeMindmap = useCallback(async (id: string) => {
    await deleteMindmap(id);
    setMindmaps((prev) => prev.filter((item) => item.id !== id));
    setCurrentMindmap((prev) => (prev?.id === id ? null : prev));
  }, []);

  useEffect(() => {
    if (!currentMindmap) return;
    setMindmaps((prev) => {
      const next = prev.filter((item) => item.id !== currentMindmap.id);
      return [currentMindmap, ...next];
    });

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      if (controller.signal.aborted) return;
      setIsSaving(true);
      await saveMindmap(currentMindmap);
      setIsSaving(false);
    }, autoSaveDelay);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [autoSaveDelay, currentMindmap]);

  const changeText = useCallback(
    (nodeId: string, text: string) => {
      updateMindmap((map) => updateNodeText(map, nodeId, text));
    },
    [updateMindmap]
  );

  const changePosition = useCallback(
    (nodeId: string, position: { x: number; y: number }) => {
      updateMindmap((map) => updateNodePosition(map, nodeId, position));
    },
    [updateMindmap]
  );

  const changeStyle = useCallback(
    (nodeId: string, updates: Partial<Pick<MindmapNode, 'color' | 'icon'>>) => {
      updateMindmap((map) => updateNodeStyle(map, nodeId, updates));
    },
    [updateMindmap]
  );

  const addChild = useCallback(
    (parentId: string) => updateMindmap((map) => addChildNode(map, parentId)),
    [updateMindmap]
  );

  const addSibling = useCallback(
    (siblingId: string) => updateMindmap((map) => addSiblingNode(map, siblingId)),
    [updateMindmap]
  );

  const remove = useCallback((nodeId: string) => updateMindmap((map) => removeNode(map, nodeId)), [updateMindmap]);

  const metadata = useMemo(
    () => ({
      total: mindmaps.length,
      lastUpdated: mindmaps[0]?.updatedAt ?? null
    }),
    [mindmaps]
  );

  return {
    mindmaps,
    currentMindmap,
    selectMindmap,
    createMindmap,
    updateMindmap,
    changeText,
    changePosition,
    changeStyle,
    addChild,
    addSibling,
    remove,
    removeMindmap,
    isLoading,
    isSaving,
    error,
    metadata
  };
}
