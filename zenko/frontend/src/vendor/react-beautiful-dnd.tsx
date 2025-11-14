import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent as ReactDragEvent,
  type ReactNode
} from 'react';

export interface DraggableLocation {
  droppableId: string;
  index: number;
}

export interface DropResult {
  draggableId: string;
  source: DraggableLocation;
  destination: DraggableLocation | null;
  type: string;
}

interface DragDropContextProps {
  onDragEnd: (result: DropResult) => void;
  children: ReactNode;
}

interface ActiveDrag {
  draggableId: string;
  source: DraggableLocation;
  type: string;
}

interface InternalDndContext {
  startDrag: (active: ActiveDrag) => void;
  updateOver: (location: DraggableLocation | null) => void;
  finishDrag: (destination: DraggableLocation | null) => void;
  clearDrag: () => void;
  activeId: string | null;
  activeType: string | null;
  over: DraggableLocation | null;
}

interface DroppableRegistryItem {
  index: number;
  element: HTMLElement | null;
}

interface DroppableContextValue {
  droppableId: string;
  type: string;
  registerItem: (id: string, index: number, element: HTMLElement | null) => void;
  unregisterItem: (id: string) => void;
  getCount: () => number;
}

interface DroppableProvided {
  innerRef: (element: HTMLElement | null) => void;
  droppableProps: {
    onDragOver: (event: ReactDragEvent) => void;
    onDragEnter: (event: ReactDragEvent) => void;
    onDrop: (event: ReactDragEvent) => void;
  };
  placeholder: ReactNode;
}

interface DroppableSnapshot {
  isDraggingOver: boolean;
}

interface DraggableProvided {
  innerRef: (element: HTMLElement | null) => void;
  draggableProps: {
    draggable: boolean;
    onDragStart: (event: ReactDragEvent) => void;
    onDragEnd: (event: ReactDragEvent) => void;
    onDragOver: (event: ReactDragEvent) => void;
    onDragEnter: (event: ReactDragEvent) => void;
    style?: CSSProperties;
  };
  dragHandleProps: Record<string, never>;
}

interface DraggableSnapshot {
  isDragging: boolean;
}

type DroppableRender = (provided: DroppableProvided, snapshot: DroppableSnapshot) => ReactNode;
type DraggableRender = (provided: DraggableProvided, snapshot: DraggableSnapshot) => ReactNode;

const DndContext = createContext<InternalDndContext | null>(null);
const DroppableContext = createContext<DroppableContextValue | null>(null);

export function DragDropContext({ onDragEnd, children }: DragDropContextProps) {
  const activeRef = useRef<ActiveDrag | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [over, setOver] = useState<DraggableLocation | null>(null);

  const startDrag = useCallback((active: ActiveDrag) => {
    activeRef.current = active;
    setActiveId(active.draggableId);
    setActiveType(active.type);
    setOver(active.source);
  }, []);

  const clearDrag = useCallback(() => {
    activeRef.current = null;
    setActiveId(null);
    setActiveType(null);
    setOver(null);
  }, []);

  const finishDrag = useCallback(
    (destination: DraggableLocation | null) => {
      const active = activeRef.current;
      if (!active) {
        clearDrag();
        return;
      }
      onDragEnd({
        draggableId: active.draggableId,
        source: active.source,
        destination,
        type: active.type
      });
      clearDrag();
    },
    [clearDrag, onDragEnd]
  );

  const value = useMemo<InternalDndContext>(
    () => ({
      startDrag,
      updateOver: setOver,
      finishDrag,
      clearDrag,
      activeId,
      activeType,
      over
    }),
    [activeId, activeType, finishDrag, over, startDrag]
  );

  return <DndContext.Provider value={value}>{children}</DndContext.Provider>;
}

export function Droppable({
  droppableId,
  type = 'DEFAULT',
  direction: _direction = 'vertical',
  children
}: {
  droppableId: string;
  type?: string;
  direction?: 'horizontal' | 'vertical';
  children: DroppableRender;
}) {
  const context = useContext(DndContext);
  if (!context) {
    throw new Error('Droppable must be used within a DragDropContext.');
  }

  const itemsRef = useRef<Map<string, DroppableRegistryItem>>(new Map());
  const containerRef = useRef<HTMLElement | null>(null);

  const registerItem = useCallback((id: string, index: number, element: HTMLElement | null) => {
    itemsRef.current.set(id, { index, element });
  }, []);

  const unregisterItem = useCallback((id: string) => {
    itemsRef.current.delete(id);
  }, []);

  const getCount = useCallback(() => itemsRef.current.size, []);

  const handleDragOver = useCallback(
    (event: ReactDragEvent) => {
      event.preventDefault();
      if (context.activeType && context.activeType !== type) {
        return;
      }
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
      const current = context.over;
      if (!current || current.droppableId !== droppableId) {
        context.updateOver({ droppableId, index: itemsRef.current.size });
      }
    },
    [context, droppableId, type]
  );

  const handleDragEnter = useCallback(
    (event: ReactDragEvent) => {
      event.preventDefault();
      if (context.activeType && context.activeType !== type) {
        return;
      }
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
      context.updateOver({ droppableId, index: itemsRef.current.size });
    },
    [context, droppableId, type]
  );

  const handleDrop = useCallback(
    (event: ReactDragEvent) => {
      event.preventDefault();
      if (context.activeType && context.activeType !== type) {
        return;
      }
      const destination =
        context.over && context.over.droppableId === droppableId
          ? context.over
          : { droppableId, index: itemsRef.current.size };
      context.finishDrag(destination);
    },
    [context, droppableId, type]
  );

  useEffect(() => {
    return () => {
      itemsRef.current.clear();
    };
  }, []);

  const provided: DroppableProvided = {
    innerRef: (element) => {
      containerRef.current = element;
    },
    droppableProps: {
      onDragOver: handleDragOver,
      onDragEnter: handleDragEnter,
      onDrop: handleDrop
    },
    placeholder: null
  };

  const snapshot: DroppableSnapshot = {
    isDraggingOver: context.over?.droppableId === droppableId
  };

  const droppableValue = useMemo<DroppableContextValue>(
    () => ({ droppableId, type, registerItem, unregisterItem, getCount }),
    [droppableId, getCount, registerItem, unregisterItem, type]
  );

  return (
    <DroppableContext.Provider value={droppableValue}>{children(provided, snapshot)}</DroppableContext.Provider>
  );
}

export function Draggable({
  draggableId,
  index,
  children
}: {
  draggableId: string;
  index: number;
  children: DraggableRender;
}) {
  const context = useContext(DndContext);
  const droppable = useContext(DroppableContext);

  if (!context) {
    throw new Error('Draggable must be used within a DragDropContext.');
  }
  if (!droppable) {
    throw new Error('Draggable must be nested inside a Droppable.');
  }

  const elementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    droppable.registerItem(draggableId, index, elementRef.current);
    return () => {
      droppable.unregisterItem(draggableId);
    };
  }, [draggableId, droppable, index]);

  const handleDragStart = useCallback(
    (event: ReactDragEvent) => {
      event.stopPropagation();
      event.dataTransfer?.setData('text/plain', draggableId);
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
      }
      context.startDrag({
        draggableId,
        source: { droppableId: droppable.droppableId, index },
        type: droppable.type
      });
    },
    [context, draggableId, droppable.droppableId, droppable.type, index]
  );

  const handleDragEnd = useCallback(
    (event: ReactDragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      context.finishDrag(context.over ?? null);
    },
    [context]
  );

  const handleDragOver = useCallback(
    (event: ReactDragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (context.activeType && context.activeType !== droppable.type) {
        return;
      }
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
      context.updateOver({ droppableId: droppable.droppableId, index });
    },
    [context, droppable.droppableId, droppable.type, index]
  );

  const handleDragEnter = useCallback(
    (event: ReactDragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (context.activeType && context.activeType !== droppable.type) {
        return;
      }
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
      context.updateOver({ droppableId: droppable.droppableId, index });
    },
    [context, droppable.droppableId, droppable.type, index]
  );

  const provided: DraggableProvided = {
    innerRef: (element) => {
      elementRef.current = element;
      if (element) {
        element.setAttribute('draggable', 'true');
      }
    },
    draggableProps: {
      draggable: true,
      onDragStart: handleDragStart,
      onDragEnd: handleDragEnd,
      onDragOver: handleDragOver,
      onDragEnter: handleDragEnter
    },
    dragHandleProps: {}
  };

  const snapshot: DraggableSnapshot = {
    isDragging: context.activeId === draggableId
  };

  return children(provided, snapshot);
}
