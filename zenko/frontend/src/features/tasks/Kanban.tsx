import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { DragDropContext, Draggable, Droppable, type DropResult } from 'react-beautiful-dnd';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import { useTasks } from './hooks';
import { Task, TaskPayload, TaskStatus } from './types';
import TaskForm from './TaskForm';
import OfflineNotice from '../../components/OfflineNotice';
import { isOfflineMode } from '../../lib/supabase';
import { useProfile } from '../profile/hooks';
import { useConnectivityStore } from '../../store/connectivity';
import { getLabelColors } from './labelColors';
import { useTasksStore, type LabelDefinition } from './store';
import createMousetrap from 'mousetrap';
import type { TaskPositionChange } from './api';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useToastStore } from '../../components/ui/ToastProvider';
import { useTaskListsStore, DEFAULT_LISTS } from './listsStore';

const COLUMN_ACCENT =
  'from-slate-200/70 via-slate-200/40 to-slate-200/20 dark:from-white/15 dark:via-white/10 dark:to-white/5';

function useLabelDefinitionMap() {
  const labelsLibrary = useTasksStore((state) => state.labelsLibrary);
  return useMemo(() => {
    const map = new Map<string, LabelDefinition>();
    labelsLibrary.forEach((definition) => {
      map.set(definition.normalized, definition);
    });
    return map;
  }, [labelsLibrary]);
}

function arrayMove<T>(items: T[], from: number, to: number) {
  const list = [...items];
  const startIndex = from < 0 ? list.length + from : from;
  let endIndex = to < 0 ? list.length + to : to;
  if (startIndex < 0 || startIndex >= list.length) {
    return list;
  }
  const [item] = list.splice(startIndex, 1);
  if (endIndex < 0) {
    endIndex = 0;
  }
  if (endIndex >= list.length) {
    list.push(item);
  } else {
    list.splice(endIndex, 0, item);
  }
  return list;
}

function BoardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="h-7 w-48 rounded-xl bg-slate-200/80 dark:bg-slate-700/60 animate-pulse" />
        <div className="h-4 w-72 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 animate-pulse" />
      </div>
      <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-3">
        {DEFAULT_LISTS.map((column) => (
          <div
            key={`skeleton-${column.id}`}
            className="w-[272px] flex-none rounded-[22px] border border-slate-200/70 bg-white/70 p-3 backdrop-blur dark:border-white/10 dark:bg-slate-900/60"
          >
            <div className="mb-3 h-5 w-24 rounded-lg bg-slate-200/90 dark:bg-slate-800/80 animate-pulse" />
            <div className="space-y-2.5">
              {[0, 1, 2].map((item) => (
                <div
                  key={`skeleton-card-${column.key}-${item}`}
                  className="h-20 rounded-xl bg-slate-100/90 shadow-inner animate-pulse dark:bg-slate-800/70"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Kanban() {
  const {
    tasks,
    isLoading,
    reorderTasks,
    filters,
    setFilter,
    userId,
    createTask,
    updateTask,
    deleteTask,
    createTaskIsPending,
    updateTaskIsPending
  } = useTasks();
  const lists = useTaskListsStore((state) => state.lists);
  const ensureTaskLists = useTaskListsStore((state) => state.ensureStatuses);
  const addList = useTaskListsStore((state) => state.addList);
  const reorderLists = useTaskListsStore((state) => state.reorderLists);
  const getListTitle = useTaskListsStore((state) => state.getListTitle);
  const { profile } = useProfile();
  const params = useParams<{ taskId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToastStore((state) => state.show);
  const rawTaskParam = params.taskId ?? null;
  const isCreateRoute = rawTaskParam === 'new' || location.pathname.endsWith('/task/new');
  const selectedTaskId = !rawTaskParam || isCreateRoute ? null : rawTaskParam;
  const isModalVisible = isCreateRoute || Boolean(rawTaskParam);
  const connectivityStatus = useConnectivityStore((state) => state.status);
  const showOffline = connectivityStatus === 'limited' || isOfflineMode(userId);
  const autoMoveToDone = profile?.auto_move_done ?? true;
  const labelDefinitionMap = useLabelDefinitionMap();
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const creationTimeouts = useRef<Map<string, number>>(new Map());
  const addListInputRef = useRef<HTMLInputElement | null>(null);

  const statusOrder = useMemo(() => lists.map((list) => list.id), [lists]);
  const columnTitleMap = useMemo(() => {
    const map: Record<TaskStatus, string> = {};
    lists.forEach((list) => {
      map[list.id] = list.name;
    });
    return map;
  }, [lists]);
  const todoStatus = useMemo(
    () => statusOrder.find((status) => status === 'todo') ?? statusOrder[0] ?? 'todo',
    [statusOrder]
  );
  const doneStatus = useMemo(
    () => statusOrder.find((status) => status === 'done') ?? statusOrder[statusOrder.length - 1] ?? null,
    [statusOrder]
  );
  const defaultStatus = useMemo(() => todoStatus ?? statusOrder[0] ?? 'todo', [statusOrder, todoStatus]);
  const [focusedColumn, setFocusedColumn] = useState<TaskStatus | null>(null);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<TaskStatus>(defaultStatus);
  const [recentlyCreatedMap, setRecentlyCreatedMap] = useState<Record<string, true>>({});
  const [openMenuTaskId, setOpenMenuTaskId] = useState<string | null>(null);
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const tasksById = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach((task) => {
      map.set(task.id, task);
    });
    return map;
  }, [tasks]);

  const selectedTask = selectedTaskId ? tasksById.get(selectedTaskId) ?? null : null;
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const draftStatusFromQuery = searchParams.get('status');

  const columnsMap = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {};

    statusOrder.forEach((status) => {
      map[status] = [];
    });

    tasks.forEach((task) => {
      if (!map[task.status]) {
        map[task.status] = [];
      }
      map[task.status].push(task);
    });

    Object.keys(map).forEach((status) => {
      map[status]?.sort((a, b) => {
        if (a.sort_order !== b.sort_order) {
          return a.sort_order - b.sort_order;
        }
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    });

    return map;
  }, [statusOrder, tasks]);

  const columnsData = useMemo(() => {
    return lists.map((column) => ({
      key: column.id,
      title: column.name,
      accent: COLUMN_ACCENT,
      tasks: columnsMap[column.id] ?? []
    }));
  }, [columnsMap, lists]);

  const isMutationPending = createTaskIsPending || updateTaskIsPending;

  const columnRefs = useRef<Record<string, HTMLElement | null>>({});

  const focusColumn = useCallback(
    (status: TaskStatus) => {
      setFocusedColumn(status);
      if (!statusOrder.includes(status)) {
        return;
      }
      const node = columnRefs.current[status];
      if (node && typeof window !== 'undefined') {
        const target = node;
        window.requestAnimationFrame(() => {
          if (typeof document !== 'undefined' && target && document.activeElement !== target) {
            target.focus();
          }
        });
      }
    },
    [statusOrder]
  );

  const getAdjacentStatus = useCallback(
    (current: TaskStatus, direction: 'next' | 'previous'): TaskStatus | null => {
      const index = statusOrder.indexOf(current);
      if (index === -1) return null;
      if (direction === 'next') {
        return statusOrder[index + 1] ?? null;
      }
      return statusOrder[index - 1] ?? null;
    },
    [statusOrder]
  );

  const ensureHighlight = useCallback(
    (nextColumn: TaskStatus | null) => {
      if (!nextColumn) {
        setHighlightedTaskId(null);
        return;
      }
      const list = columnsMap[nextColumn];
      if (!list) {
        setHighlightedTaskId(null);
        return;
      }
      setHighlightedTaskId((current) => {
        if (current && list.some((task) => task.id === current)) {
          return current;
        }
        return list[0]?.id ?? null;
      });
    },
    [columnsMap]
  );

  useEffect(() => {
    ensureTaskLists(tasks.map((task) => task.status));
  }, [ensureTaskLists, tasks]);

  useEffect(() => {
    setDraftStatus((current) => (statusOrder.includes(current) ? current : defaultStatus));
  }, [defaultStatus, statusOrder]);

  useEffect(() => {
    setFocusedColumn((current) => {
      if (current && statusOrder.includes(current)) {
        return current;
      }
      return statusOrder.includes(defaultStatus) ? defaultStatus : current;
    });
  }, [defaultStatus, statusOrder]);

  useEffect(() => {
    ensureHighlight(focusedColumn);
  }, [columnsMap, focusedColumn, ensureHighlight]);

  useEffect(() => {
    if (!focusedColumn) return;
    if (!statusOrder.includes(focusedColumn)) return;
    const node = columnRefs.current[focusedColumn];
    if (node && typeof document !== 'undefined' && document.activeElement !== node) {
      node.focus();
    }
  }, [focusedColumn, statusOrder]);

  useEffect(() => {
    if (isAddingList && addListInputRef.current) {
      addListInputRef.current.focus();
      addListInputRef.current.select();
    }
  }, [isAddingList]);

  useEffect(() => {
    if (selectedTask) {
      setDraftStatus(selectedTask.status);
      setFocusedColumn(selectedTask.status);
    }
  }, [selectedTask]);

  useEffect(() => {
    if (!selectedTaskId || isLoading) {
      return;
    }
    if (!tasksById.has(selectedTaskId)) {
      toast({ title: 'Tarefa não encontrada', type: 'warning' });
      navigate('/', { replace: true });
    }
  }, [isLoading, navigate, selectedTaskId, tasksById, toast]);

  useEffect(() => {
    if (!isCreateRoute) {
      return;
    }
    if (draftStatusFromQuery) {
      const status = draftStatusFromQuery as TaskStatus;
      if (statusOrder.includes(status)) {
        setDraftStatus(status);
        setFocusedColumn(status);
      }
    }
  }, [draftStatusFromQuery, isCreateRoute, statusOrder]);

  useEffect(() => {
    if (filters.status !== 'all' && !statusOrder.includes(filters.status as TaskStatus)) {
      setFilter({ status: 'all' });
    }
  }, [filters.status, setFilter, statusOrder]);

  useEffect(() => {
    if (!highlightedTaskId) return;
    if (!tasksById.has(highlightedTaskId)) {
      setHighlightedTaskId(null);
    }
  }, [tasksById, highlightedTaskId]);

  useEffect(() => {
    if (!focusedColumn) return;
    const ref = columnRefs.current[focusedColumn];
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [focusedColumn]);

  const getNextSortOrder = useCallback(
    (status: TaskStatus) => columnsMap[status]?.length ?? 0,
    [columnsMap]
  );

  const openTask = useCallback(
    (task: Task) => {
      navigate(`/task/${task.id}`, { state: { fromBoard: true } });
      setDraftStatus(task.status);
      setFocusedColumn(task.status);
      setHighlightedTaskId(task.id);
    },
    [navigate]
  );

  const openCreate = useCallback(
    (status: TaskStatus) => {
      setDraftStatus(status);
      setFocusedColumn(status);
      ensureHighlight(status);
      const nextSearch = new URLSearchParams();
      nextSearch.set('status', status);
      navigate(`/task/new?${nextSearch.toString()}`, { state: { fromBoard: true } });
    },
    [ensureHighlight, navigate]
  );

  const closeModal = useCallback(() => {
    setDraftStatus(defaultStatus);
    setOpenMenuTaskId(null);
    setFocusedColumn(defaultStatus);
    const state = location.state as { fromBoard?: boolean } | null;
    if (state?.fromBoard) {
      navigate(-1);
    } else {
      navigate('/', { replace: true });
    }
  }, [defaultStatus, location.state, navigate]);

  const placeTaskInStatus = useCallback(
    (task: Task, targetStatus: TaskStatus, position: 'start' | 'end' = 'end') => {
      if (task.status === targetStatus) {
        return;
      }
      if (!statusOrder.includes(targetStatus)) {
        ensureTaskLists([targetStatus]);
      }
      const sourceTasks = columnsMap[task.status] ?? [];
      const destinationTasks = columnsMap[targetStatus] ?? [];
      const sourceIds = sourceTasks.map((item) => item.id).filter((id) => id !== task.id);
      const destinationIds = destinationTasks.map((item) => item.id);
      if (position === 'start') {
        destinationIds.unshift(task.id);
      } else {
        destinationIds.push(task.id);
      }
      const updates: TaskPositionChange[] = [
        ...sourceIds.map((id, index) => ({ id, status: task.status, sort_order: index })),
        ...destinationIds.map((id, index) => ({ id, status: targetStatus, sort_order: index }))
      ];
      reorderTasks(updates);
      if (statusOrder.includes(targetStatus)) {
        focusColumn(targetStatus);
      }
      setHighlightedTaskId(task.id);
      setDraftStatus(targetStatus);
    },
    [columnsMap, ensureTaskLists, focusColumn, reorderTasks, statusOrder]
  );

  const handleToggleComplete = useCallback(
    (task: Task, checked: boolean) => {
      if (checked && doneStatus) {
        placeTaskInStatus(task, doneStatus);
      } else if (!checked && todoStatus) {
        placeTaskInStatus(task, todoStatus, 'start');
      }
    },
    [doneStatus, placeTaskInStatus, todoStatus]
  );

  const handleCardKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>, task: Task) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      event.preventDefault();
      const nextStatus = getAdjacentStatus(task.status, 'next');
      if (nextStatus) {
        placeTaskInStatus(task, nextStatus);
      }
    },
    [getAdjacentStatus, placeTaskInStatus]
  );

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { destination, source, draggableId, type } = result;
      if (!destination) {
        return;
      }
      if (type === 'COLUMN') {
        if (source.index === destination.index) {
          return;
        }
        const movedColumnId = statusOrder[source.index] ?? (draggableId.replace(/^column-/, '') as TaskStatus);
        reorderLists(source.index, destination.index);
        if (movedColumnId) {
          focusColumn(movedColumnId);
          ensureHighlight(movedColumnId);
          setDraftStatus(movedColumnId);
        }
        return;
      }
      const sourceStatus = source.droppableId as TaskStatus;
      const destinationStatus = destination.droppableId as TaskStatus;
      if (!sourceStatus || !destinationStatus) {
        return;
      }
      if (sourceStatus === destinationStatus && source.index === destination.index) {
        return;
      }
      const sourceTasks = columnsMap[sourceStatus] ?? [];
      const destinationTasks = columnsMap[destinationStatus] ?? [];
      const updates: TaskPositionChange[] = [];
      if (sourceStatus === destinationStatus) {
        const ids = sourceTasks.map((task) => task.id);
        const moved = arrayMove(ids, source.index, destination.index);
        moved.forEach((id, index) => {
          updates.push({ id, status: destinationStatus, sort_order: index });
        });
      } else {
        const sourceIds = sourceTasks.map((task) => task.id).filter((id, index) => index !== source.index);
        const destinationIds = destinationTasks.map((task) => task.id);
        destinationIds.splice(destination.index, 0, draggableId);
        sourceIds.forEach((id, index) => {
          updates.push({ id, status: sourceStatus, sort_order: index });
        });
        destinationIds.forEach((id, index) => {
          updates.push({ id, status: destinationStatus, sort_order: index });
        });
      }
      if (updates.length > 0) {
        reorderTasks(updates);
        focusColumn(destinationStatus);
        setHighlightedTaskId(draggableId);
        setDraftStatus(destinationStatus);
      }
    },
    [columnsMap, ensureHighlight, focusColumn, reorderLists, reorderTasks, statusOrder]
  );

  const handleSubmitNewList = useCallback(() => {
    const result = addList(newListTitle);
    if (!result) {
      toast({ title: 'Informe um nome para a lista', type: 'warning' });
      return;
    }
    const { list, created } = result;
    if (created) {
      toast({ title: 'Lista criada', description: list.name, type: 'success' });
      setNewListTitle('');
      setIsAddingList(false);
    } else {
      toast({ title: 'Lista já existe', description: list.name, type: 'info' });
    }
    focusColumn(list.id);
    ensureHighlight(list.id);
    setDraftStatus(list.id);
    if (!created && addListInputRef.current) {
      addListInputRef.current.select();
    }
  }, [addList, addListInputRef, ensureHighlight, focusColumn, newListTitle, toast]);

  const handleCancelNewList = useCallback(() => {
    setIsAddingList(false);
    setNewListTitle('');
  }, []);

  useEffect(() => {
    if (!openMenuTaskId) return;
    const handlePointer = (event: MouseEvent | TouchEvent) => {
      const ref = menuRefs.current[openMenuTaskId];
      if (!ref) return;
      if (!ref.contains(event.target as Node)) {
        setOpenMenuTaskId(null);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenuTaskId(null);
      }
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('touchstart', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('touchstart', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [openMenuTaskId]);

  useEffect(() => {
    if (!openMenuTaskId) return;
    if (!tasksById.has(openMenuTaskId)) {
      setOpenMenuTaskId(null);
    }
  }, [openMenuTaskId, tasksById]);

  useEffect(() => {
    setRecentlyCreatedMap((current) => {
      const next = { ...current };
      let changed = false;
      Object.keys(next).forEach((id) => {
        if (!tasksById.has(id)) {
          delete next[id];
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [tasksById]);

  const handleCreateTaskAndHighlight = useCallback(
    async (payload: TaskPayload) => {
      const created = (await createTask(payload)) as Task;
      if (created?.id) {
        setRecentlyCreatedMap((current) => ({ ...current, [created.id]: true }));
        if (typeof window !== 'undefined') {
          const timeoutId = window.setTimeout(() => {
            setRecentlyCreatedMap((current) => {
              if (!current[created.id]) {
                return current;
              }
              const next = { ...current };
              delete next[created.id];
              return next;
            });
            creationTimeouts.current.delete(created.id);
          }, 2000);
          creationTimeouts.current.set(created.id, timeoutId);
        }
        setHighlightedTaskId(created.id);
        focusColumn(created.status);
      }
      return created;
    },
    [createTask, focusColumn]
  );

  useEffect(() => {
    return () => {
      creationTimeouts.current.forEach((timeoutId) => {
        if (typeof window !== 'undefined') {
          window.clearTimeout(timeoutId);
        }
      });
      creationTimeouts.current.clear();
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const trap = createMousetrap();
    const shouldIgnore = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return false;
      const tagName = target.tagName;
      return (
        target.isContentEditable ||
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT'
      );
    };

    const handleNew = (event: KeyboardEvent) => {
      if (shouldIgnore(event) || isModalVisible) return;
      event.preventDefault();
      openCreate(focusedColumn ?? defaultStatus);
    };

    const handleEdit = (event: KeyboardEvent) => {
      if (shouldIgnore(event) || isModalVisible) return;
      if (!highlightedTaskId) return;
      const task = tasksById.get(highlightedTaskId);
      if (!task) return;
      event.preventDefault();
      openTask(task);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (shouldIgnore(event)) return;
      if (!isModalVisible) return;
      event.preventDefault();
      closeModal();
    };

    trap.bind('n', handleNew);
    trap.bind('e', handleEdit);
    trap.bind('esc', handleEscape);
    trap.bind('1', (event: KeyboardEvent) => {
      if (shouldIgnore(event)) return;
      const status = statusOrder[0];
      if (!status) return;
      event.preventDefault();
      focusColumn(status);
    });
    trap.bind('2', (event: KeyboardEvent) => {
      if (shouldIgnore(event)) return;
      const status = statusOrder[1];
      if (!status) return;
      event.preventDefault();
      focusColumn(status);
    });
    trap.bind('3', (event: KeyboardEvent) => {
      if (shouldIgnore(event)) return;
      const status = statusOrder[2];
      if (!status) return;
      event.preventDefault();
      focusColumn(status);
    });

    return () => {
      trap.destroy();
    };
  }, [
    closeModal,
    focusColumn,
    focusedColumn,
    highlightedTaskId,
    isModalVisible,
    openCreate,
    openTask,
    defaultStatus,
    statusOrder,
    tasksById
  ]);

  if (isLoading && tasks.length === 0) {
    return <BoardSkeleton />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-hidden" aria-live="polite">
      {showOffline ? (
        <div className="flex-shrink-0">
          <OfflineNotice feature="Tarefas" />
        </div>
      ) : null}
      {isMutationPending ? (
        <div
          className="pointer-events-none fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/20 bg-slate-900/85 px-4 py-2 text-xs font-medium text-white shadow-xl backdrop-blur dark:border-white/10 dark:bg-slate-800/85"
          role="status"
          aria-live="polite"
        >
          <svg
            className="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" className="opacity-40" />
            <path d="M4 12a8 8 0 018-8" className="opacity-90" />
          </svg>
          Salvando alterações...
        </div>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between flex-shrink-0">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Quadro de tarefas</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">Arraste e solte para mover prioridades rapidamente.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2.5 text-[11px] text-slate-600 dark:text-slate-200 flex-shrink-0">
        <label className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-2.5 py-1.5 backdrop-blur dark:border-white/10 dark:bg-white/5">
          <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Status</span>
          <Select
            className="w-28 min-w-[7rem] text-[11px]"
            value={filters.status}
            onChange={(e) => setFilter({ status: e.target.value as any })}
          >
            <option value="all">Todos</option>
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-2.5 py-1.5 backdrop-blur dark:border-white/10 dark:bg-white/5">
          <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Prazo</span>
          <Select
            className="w-28 min-w-[7rem] text-[11px]"
            value={filters.due}
            onChange={(e) => setFilter({ due: e.target.value as any })}
          >
            <option value="all">Todos</option>
            <option value="today">Hoje</option>
            <option value="week">Esta semana</option>
          </Select>
        </label>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="board-columns" direction="horizontal" type="COLUMN">
            {(boardProvided) => (
              <div
                ref={boardProvided.innerRef}
                {...boardProvided.droppableProps}
                className="flex h-full min-h-0 snap-x snap-mandatory gap-2.5 overflow-x-auto overflow-y-hidden pb-3 md:snap-none"
              >
                {columnsData.map((column, columnIndex) => (
                  <Draggable draggableId={`column-${column.key}`} index={columnIndex} key={column.key}>
                    {(columnProvided, columnSnapshot) => {
                      const isFocused = focusedColumn === column.key;
                      const columnTabIndex = focusedColumn ? (isFocused ? 0 : -1) : 0;

                      return (
                        <section
                          ref={(node) => {
                            columnProvided.innerRef(node);
                            columnRefs.current[column.key] = node;
                          }}
                          {...columnProvided.draggableProps}
                          className={`group relative flex h-full min-h-[20rem] w-[272px] flex-none snap-start flex-col rounded-[20px] bg-gradient-to-br p-[1px] transition-transform transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/60 ${column.accent} ${columnSnapshot.isDragging ? 'scale-[1.01]' : ''}`}
                          role="region"
                          aria-labelledby={`column-${column.key}`}
                          aria-describedby={`column-${column.key}-meta`}
                          tabIndex={columnTabIndex}
                          onFocus={() => {
                            focusColumn(column.key);
                          }}
                        >
                          <Droppable droppableId={column.key} type="TASK">
                            {(taskProvided, taskSnapshot) => {
                              const highlightClasses = taskSnapshot.isDraggingOver
                                ? 'ring-2 ring-zenko-primary/60 shadow-xl'
                                : isFocused
                                  ? 'border-zenko-primary/40 ring-1 ring-zenko-primary/25 shadow-lg'
                                  : 'shadow-[0_18px_40px_-22px_rgba(15,23,42,0.12)] dark:shadow-[0_18px_40px_-32px_rgba(15,23,42,0.8)]';

                              return (
                                <div
                                  ref={(node) => {
                                    taskProvided.innerRef(node);
                                  }}
                                  {...taskProvided.droppableProps}
                                  className={`flex h-full min-h-0 flex-col overflow-hidden rounded-[14px] border border-slate-200/70 bg-white/95 p-2 backdrop-blur dark:border-white/10 dark:bg-slate-900/70 ${highlightClasses}`}
                                >
                                  <header
                                    className={`flex items-center justify-between ${columnSnapshot.isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                                    {...columnProvided.dragHandleProps}
                                    title="Arraste para reorganizar a lista"
                                  >
                                    <h3
                                      id={`column-${column.key}`}
                                      className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 dark:text-slate-200"
                                    >
                                      {column.title}
                                    </h3>
                                    <span className="sr-only">Arraste para reorganizar a lista</span>
                                    <span
                                      id={`column-${column.key}-meta`}
                                      className="rounded-full bg-zenko-primary/10 px-1.5 py-0.5 text-[11px] text-zenko-primary dark:bg-white/10"
                                    >
                                      {column.tasks.length}
                                    </span>
                                  </header>
                                  <div
                                    className="mt-1.5 flex-1 min-h-0 space-y-1.5 overflow-y-auto pr-1"
                                    role="list"
                                    aria-label={`Tarefas em ${column.title}`}
                                  >
                                    {column.tasks.map((task, index) => {
                      const previousStatus = getAdjacentStatus(task.status, 'previous');
                      const nextStatus = getAdjacentStatus(task.status, 'next');
                      const nextStatusLabel = nextStatus ? getListTitle(nextStatus) : 'coluna final';
                      const ariaInstruction = nextStatus
                        ? `Pressione Enter ou Espaço para mover para ${nextStatusLabel}.`
                        : 'Esta tarefa está na última coluna.';

                      const checklistTotal = task.checklist.length;
                      const checklistDone = task.checklist.filter((item) => item.done).length;
                      const checklistPercentage = checklistTotal
                        ? Math.round((checklistDone / checklistTotal) * 100)
                        : 0;
                      const isRecentlyCreated = Boolean(recentlyCreatedMap[task.id]);
                      const isMenuOpen = openMenuTaskId === task.id;

                      return (
                        <Draggable draggableId={task.id} index={index} key={task.id}>
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className="space-y-1.5"
                              role="listitem"
                              aria-current={highlightedTaskId === task.id ? 'true' : undefined}
                            >
                              <Card
                                variant="board"
                                className={`group cursor-grab overflow-hidden border-slate-200/70 bg-white/90 transition-all hover:-translate-y-0.5 hover:border-zenko-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zenko-primary/60 dark:border-white/5 dark:bg-slate-900/70 ${
                                  dragSnapshot.isDragging ? 'border-zenko-primary/60 shadow-lg' : ''
                                } ${
                                  highlightedTaskId === task.id
                                    ? 'ring-2 ring-inset ring-zenko-primary/60'
                                    : isRecentlyCreated
                                      ? 'animate-taskHighlight ring-2 ring-inset ring-zenko-primary/30'
                                      : ''
                                }`}
                                tabIndex={0}
                                aria-label={`Tarefa ${task.title}. Status atual: ${getListTitle(task.status)}. ${ariaInstruction}`}
                                onFocus={() => {
                                  setHighlightedTaskId(task.id);
                                  setFocusedColumn(task.status);
                                }}
                                onKeyDown={(event) => handleCardKeyDown(event, task)}
                                onClick={() => openTask(task)}
                              >
                                <div className="grid grid-cols-[auto,1fr] items-start gap-1.5">
                                  <label
                                    className={`mt-0 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-zenko-primary shadow-sm transition focus-within:ring-2 focus-within:ring-zenko-primary/50 dark:border-white/20 dark:bg-white/10 ${
                                      autoMoveToDone ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-not-allowed opacity-50'
                                    }`}
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <input
                                      type="checkbox"
                                      aria-label={
                                        doneStatus && task.status === doneStatus
                                          ? 'Marcar tarefa como pendente'
                                          : 'Marcar tarefa como concluída'
                                      }
                                      checked={doneStatus ? task.status === doneStatus : false}
                                      disabled={!autoMoveToDone}
                                      onChange={(event) => {
                                        event.stopPropagation();
                                        handleToggleComplete(task, event.target.checked);
                                      }}
                                      className="sr-only"
                                    />
                                    {doneStatus && task.status === doneStatus ? (
                                      <svg
                                        className="h-3.5 w-3.5"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        aria-hidden="true"
                                      >
                                        <path d="M5 13l4 4L19 7" />
                                      </svg>
                                    ) : null}
                                  </label>
                                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                    <div className="flex flex-wrap items-start justify-between gap-x-1.5 gap-y-1">
                                      <div
                                        className="flex min-w-0 flex-1 flex-wrap gap-0.5"
                                        aria-label={task.labels.length > 0 ? 'Etiquetas da tarefa' : undefined}
                                      >
                                        {task.labels.length === 0 ? (
                                          <span className="sr-only">Sem etiquetas</span>
                                        ) : (
                                          task.labels.map((label, labelIndex) => {
                                            const normalized = label.toLocaleLowerCase();
                                            const definition = labelDefinitionMap.get(normalized);
                                            const colors = getLabelColors(label, {
                                              colorId: definition?.colorId,
                                              fallbackIndex: labelIndex
                                            });
                                            return (
                                              <span
                                                key={`${task.id}-label-${definition?.id ?? labelIndex}`}
                                                className="inline-flex h-2 w-10 items-center rounded-sm border border-black/10 shadow-sm dark:border-white/20"
                                                style={{
                                                  backgroundColor: colors.background
                                                }}
                                                title={definition?.value ?? label}
                                              >
                                                <span className="sr-only">{definition?.value ?? label}</span>
                                              </span>
                                            );
                                          })
                                        )}
                                      </div>
                                      <div
                                        className="relative flex-shrink-0 self-start"
                                        ref={(node) => {
                                          if (node) {
                                            menuRefs.current[task.id] = node;
                                          } else {
                                            delete menuRefs.current[task.id];
                                          }
                                        }}
                                      >
                                        <button
                                          type="button"
                                          className={`h-8 w-8 rounded-full border border-transparent bg-transparent text-slate-500 opacity-0 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/60 focus-visible:opacity-100 focus-visible:border-zenko-primary/40 focus-visible:bg-white/70 group-focus-within:opacity-100 group-hover:opacity-100 group-hover:border-slate-200/60 group-hover:bg-white/70 group-hover:text-slate-600 hover:border-zenko-primary/30 hover:bg-white/70 hover:text-zenko-primary dark:text-slate-300 dark:hover:border-white/20 dark:hover:bg-slate-900/60 dark:hover:text-white dark:group-hover:border-white/20 dark:group-hover:bg-slate-900/60 dark:group-hover:text-white ${
                                            isMenuOpen ? 'opacity-100 border-zenko-primary/40 bg-white/70 text-zenko-primary dark:bg-slate-900/70' : ''
                                          }`}
                                          aria-haspopup="menu"
                                          aria-expanded={isMenuOpen}
                                          aria-controls={`task-menu-${task.id}`}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            setOpenMenuTaskId((current) => (current === task.id ? null : task.id));
                                          }}
                                          title="Ações rápidas"
                                        >
                                          <span className="sr-only">Abrir ações rápidas para {task.title}</span>
                                          <svg
                                            className="mx-auto h-3.5 w-3.5"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            aria-hidden="true"
                                          >
                                            <circle cx="5" cy="12" r="1" />
                                            <circle cx="12" cy="12" r="1" />
                                            <circle cx="19" cy="12" r="1" />
                                          </svg>
                                        </button>
                                        <div
                                          id={`task-menu-${task.id}`}
                                          role="menu"
                                          className={`absolute right-0 top-9 z-30 w-48 rounded-xl border border-slate-200 bg-white/95 p-1.5 text-xs shadow-2xl transition focus:outline-none dark:border-white/10 dark:bg-slate-900/95 ${
                                            isMenuOpen
                                              ? 'visible translate-y-0 opacity-100'
                                              : 'invisible pointer-events-none -translate-y-1 opacity-0'
                                          }`}
                                        >
                                          <button
                                            type="button"
                                            role="menuitem"
                                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-slate-700 transition hover:bg-zenko-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/60 dark:text-slate-200 dark:hover:bg-white/10"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              setOpenMenuTaskId(null);
                                              openTask(task);
                                            }}
                                            autoFocus={isMenuOpen}
                                          >
                                            <svg
                                              className="h-4 w-4"
                                              viewBox="0 0 24 24"
                                              fill="none"
                                              stroke="currentColor"
                                              strokeWidth="2"
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              aria-hidden="true"
                                            >
                                              <path d="M12 20h9" />
                                              <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
                                            </svg>
                                            Editar tarefa
                                          </button>
                                          {nextStatus ? (
                                            <button
                                              type="button"
                                              role="menuitem"
                                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-slate-700 transition hover:bg-zenko-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/60 dark:text-slate-200 dark:hover:bg-white/10"
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                setOpenMenuTaskId(null);
                                                placeTaskInStatus(task, nextStatus, 'end');
                                              }}
                                            >
                                              <svg
                                                className="h-4 w-4"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                aria-hidden="true"
                                              >
                                                <path d="M5 12h14" />
                                                <path d="M12 5l7 7-7 7" />
                                              </svg>
                                              Mover para {getListTitle(nextStatus)}
                                            </button>
                                          ) : null}
                                          {previousStatus ? (
                                            <button
                                              type="button"
                                              role="menuitem"
                                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-slate-700 transition hover:bg-zenko-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/60 dark:text-slate-200 dark:hover:bg-white/10"
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                setOpenMenuTaskId(null);
                                                placeTaskInStatus(task, previousStatus, 'end');
                                              }}
                                            >
                                              <svg
                                                className="h-4 w-4"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                aria-hidden="true"
                                              >
                                                <path d="M19 12H5" />
                                                <path d="M12 19l-7-7 7-7" />
                                              </svg>
                                              Mover para {getListTitle(previousStatus)}
                                            </button>
                                          ) : null}
                                          <button
                                            type="button"
                                            role="menuitem"
                                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-semibold text-rose-600 transition hover:bg-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60 dark:text-rose-300 dark:hover:bg-rose-400/10"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              setOpenMenuTaskId(null);
                                              void deleteTask(task.id);
                                            }}
                                          >
                                            <svg
                                              className="h-4 w-4"
                                              viewBox="0 0 24 24"
                                              fill="none"
                                              stroke="currentColor"
                                              strokeWidth="2"
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              aria-hidden="true"
                                            >
                                              <polyline points="3 6 5 6 21 6" />
                                              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                                              <path d="M10 11v6" />
                                              <path d="M14 11v6" />
                                              <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                                            </svg>
                                            Excluir tarefa
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="space-y-1">
                                      <h4 className="break-words text-[12px] font-semibold leading-[16px] text-slate-900 dark:text-white">
                                        {task.title}
                                      </h4>
                                      {task.due_date ? (
                                        <p className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full bg-zenko-primary/10 px-2 py-0.5 text-[10px] font-medium text-zenko-primary dark:bg-zenko-primary/15">
                                          <svg
                                            className="h-3 w-3"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            aria-hidden="true"
                                          >
                                            <path d="M4 7h16" />
                                            <path d="M10 11h4" />
                                            <rect x="3" y="4" width="18" height="18" rx="2" />
                                          </svg>
                                          <span className="block max-w-full truncate">Prazo: {new Date(task.due_date).toLocaleDateString('pt-BR')}</span>
                                        </p>
                                      ) : null}
                                      {checklistTotal > 0 ? (
                                        <div className="space-y-1">
                                          <div className="flex flex-wrap items-center justify-between gap-x-1.5 gap-y-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-300">
                                            <span>Checklist</span>
                                            <span>
                                              {checklistDone}/{checklistTotal}
                                            </span>
                                          </div>
                                          <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                                            <div
                                              className={`h-1 rounded-full transition-all ${
                                                checklistDone === checklistTotal && checklistTotal > 0
                                                  ? 'bg-emerald-500'
                                                  : 'bg-zenko-primary'
                                              }`}
                                              style={{ width: `${checklistPercentage}%` }}
                                            />
                                          </div>
                                        </div>
                                      ) : null}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 md:hidden motion-reduce:flex motion-reduce:md:flex">
                                      <button
                                        type="button"
                                        className="flex-1 rounded-full border border-zenko-primary/40 bg-white/90 px-4 py-2 text-xs font-semibold text-zenko-primary shadow-sm transition hover:border-zenko-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/60 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900/70 min-h-[44px]"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          if (previousStatus) {
                                            placeTaskInStatus(task, previousStatus, 'end');
                                          }
                                        }}
                                        disabled={!previousStatus}
                                        aria-label={`Mover ${task.title} para ${
                                          previousStatus ? getListTitle(previousStatus) : 'coluna anterior'
                                        }`}
                                      >
                                        Mover para coluna anterior
                                      </button>
                                      <button
                                        type="button"
                                        className="flex-1 rounded-full border border-zenko-primary/40 bg-white/90 px-4 py-2 text-xs font-semibold text-zenko-primary shadow-sm transition hover:border-zenko-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/60 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900/70 min-h-[44px]"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          if (nextStatus) {
                                            placeTaskInStatus(task, nextStatus, 'end');
                                          }
                                        }}
                                        disabled={!nextStatus}
                                        aria-label={`Mover ${task.title} para ${
                                          nextStatus ? getListTitle(nextStatus) : 'coluna seguinte'
                                        }`}
                                      >
                                        Mover para próxima coluna
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </Card>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                          {column.tasks.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-slate-200 bg-white/70 px-3 py-3 text-center text-[11px] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                              Arraste tarefas para esta coluna
                            </p>
                          ) : null}
                                    {taskProvided.placeholder}
                                  </div>
                                  <button
                                    type="button"
                                    className="mt-2 inline-flex w-full min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300/80 bg-white/70 px-3 py-2 text-[12px] font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-white/90 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-white/15 dark:bg-white/10 dark:text-slate-200 dark:hover:border-white/25 dark:hover:bg-white/15 dark:hover:text-white dark:focus-visible:ring-offset-slate-950"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openCreate(column.key);
                                    }}
                                    title="Adicionar nova tarefa"
                                    aria-label={`Adicionar tarefa na coluna ${column.title}`}
                                  >
                                    <span className="text-sm leading-none">+</span>
                                    <span>Adicionar tarefa</span>
                                  </button>
                                </div>
                              );
                            }}
                          </Droppable>
                        </section>
                      );
                    }}
                  </Draggable>
                ))}
                {boardProvided.placeholder}
                <div className="w-[272px] flex-none self-start">
                  {isAddingList ? (
                    <div className="rounded-xl border border-slate-300/80 bg-white/80 p-3 shadow-sm backdrop-blur dark:border-white/15 dark:bg-white/10">
                      <label htmlFor="board-new-list" className="sr-only">
                        Nome da lista
                      </label>
                      <input
                        id="board-new-list"
                        ref={addListInputRef}
                        value={newListTitle}
                        onChange={(event) => setNewListTitle(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            handleSubmitNewList();
                          }
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            handleCancelNewList();
                          }
                        }}
                        placeholder="Nova lista"
                        className="w-full rounded-lg border border-slate-300/80 bg-white/95 px-2.5 py-2 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-zenko-primary/50 focus:ring-2 focus:ring-zenko-primary/40 dark:border-white/15 dark:bg-slate-900/70 dark:text-white"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button type="button" variant="primary" onClick={handleSubmitNewList}>
                          Adicionar lista
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-sm"
                          onClick={handleCancelNewList}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300/80 bg-white/60 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-white/80 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-white/15 dark:bg-white/10 dark:text-slate-200 dark:hover:border-white/25 dark:hover:bg-white/15 dark:hover:text-white dark:focus-visible:ring-offset-slate-950"
                      onClick={() => {
                        setIsAddingList(true);
                        setNewListTitle('');
                      }}
                      title="Adicionar outra lista"
                      aria-expanded={isAddingList}
                      aria-controls="board-new-list"
                    >
                      <span className="text-sm leading-none">+</span>
                      <span>Adicionar outra lista</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
      <Button
        className="fixed bottom-6 right-6 z-30 shadow-lg shadow-zenko-primary/40 sm:hidden"
        onClick={() => openCreate(focusedColumn ?? defaultStatus)}
        title="Adicionar nova tarefa"
        aria-label="Adicionar nova tarefa"
      >
        + Nova tarefa
      </Button>
      <Modal
        open={isModalVisible}
        onClose={closeModal}
        onBack={closeModal}
        backLabel="Voltar para o quadro"
        title={selectedTask ? 'Editar tarefa' : 'Nova tarefa'}
        description={
          selectedTask
            ? 'Atualize os detalhes da tarefa selecionada.'
            : 'Preencha os campos para criar sua próxima tarefa.'
        }
      >
        <TaskForm
          task={selectedTask ?? undefined}
          onClose={closeModal}
          createTask={handleCreateTaskAndHighlight}
          updateTask={updateTask}
          deleteTask={deleteTask}
          isCreatePending={createTaskIsPending}
          isUpdatePending={updateTaskIsPending}
          defaultStatus={draftStatus}
          getNextSortOrder={getNextSortOrder}
        />
      </Modal>
    </div>
  );
}
