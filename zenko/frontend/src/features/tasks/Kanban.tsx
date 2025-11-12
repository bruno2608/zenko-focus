import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { DragDropContext, Draggable, Droppable, type DropResult } from 'react-beautiful-dnd';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import { useTasks } from './hooks';
import { Task, TaskStatus } from './types';
import TaskForm from './TaskForm';
import OfflineNotice from '../../components/OfflineNotice';
import { isOfflineMode } from '../../lib/supabase';
import { useProfile } from '../profile/hooks';
import { useConnectivityStore } from '../../store/connectivity';
import { getLabelColors } from './labelColors';
import { useTasksStore, type LabelDefinition } from './store';
import createMousetrap from 'mousetrap';
import type { TaskPositionChange } from './api';

const columns: { key: TaskStatus; title: string; accent: string }[] = [
  {
    key: 'todo',
    title: 'A Fazer',
    accent: 'from-zenko-primary/10 to-zenko-secondary/10 dark:from-zenko-primary/20 dark:to-zenko-secondary/10'
  },
  {
    key: 'doing',
    title: 'Fazendo',
    accent: 'from-zenko-secondary/10 to-zenko-primary/5 dark:from-zenko-secondary/20 dark:to-zenko-primary/10'
  },
  {
    key: 'done',
    title: 'Concluídas',
    accent: 'from-zenko-accent/20 to-zenko-secondary/10 dark:from-zenko-accent/25 dark:to-zenko-secondary/15'
  }
];

const columnTitles: Record<TaskStatus, string> = {
  todo: 'A Fazer',
  doing: 'Fazendo',
  done: 'Concluídas'
};

const statusOrder: TaskStatus[] = ['todo', 'doing', 'done'];

const getAdjacentStatus = (current: TaskStatus, direction: 'next' | 'previous'): TaskStatus | null => {
  const index = statusOrder.indexOf(current);
  if (index === -1) return null;
  if (direction === 'next') {
    return statusOrder[index + 1] ?? null;
  }
  return statusOrder[index - 1] ?? null;
};

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
  const { profile } = useProfile();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [focusedColumn, setFocusedColumn] = useState<TaskStatus>('todo');
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<TaskStatus>('todo');
  const connectivityStatus = useConnectivityStore((state) => state.status);
  const showOffline = connectivityStatus === 'limited' || isOfflineMode(userId);
  const autoMoveToDone = profile?.auto_move_done ?? true;

  const labelDefinitionsList = useTasksStore((state) => state.labelsLibrary);
  const labelDefinitionMap = useMemo(() => {
    const map = new Map<string, LabelDefinition>();
    labelDefinitionsList.forEach((definition) => {
      map.set(definition.normalized, definition);
    });
    return map;
  }, [labelDefinitionsList]);

  const tasksById = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach((task) => {
      map.set(task.id, task);
    });
    return map;
  }, [tasks]);

  const columnsMap = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      todo: [],
      doing: [],
      done: []
    };
    tasks.forEach((task) => {
      map[task.status].push(task);
    });
    statusOrder.forEach((status) => {
      map[status].sort((a, b) => {
        if (a.sort_order !== b.sort_order) {
          return a.sort_order - b.sort_order;
        }
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    });
    return map;
  }, [tasks]);

  const columnsData = useMemo(() => {
    return columns.map((column) => ({
      ...column,
      tasks: columnsMap[column.key]
    }));
  }, [columnsMap]);

  const columnRefs = useRef<Record<TaskStatus, HTMLElement | null>>({
    todo: null,
    doing: null,
    done: null
  });

  const focusColumn = useCallback(
    (status: TaskStatus) => {
      setFocusedColumn(status);
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
    []
  );

  const ensureHighlight = useCallback(
    (nextColumn: TaskStatus) => {
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
    ensureHighlight(focusedColumn);
  }, [columnsMap, focusedColumn, ensureHighlight]);

  useEffect(() => {
    if (!highlightedTaskId) return;
    if (!tasksById.has(highlightedTaskId)) {
      setHighlightedTaskId(null);
    }
  }, [tasksById, highlightedTaskId]);

  useEffect(() => {
    const ref = columnRefs.current[focusedColumn];
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [focusedColumn]);

  const getNextSortOrder = useCallback(
    (status: TaskStatus) => columnsMap[status]?.length ?? 0,
    [columnsMap]
  );

  const openTask = useCallback((task: Task) => {
    setSelectedTask(task);
    setDraftStatus(task.status);
    setModalOpen(true);
    setFocusedColumn(task.status);
    setHighlightedTaskId(task.id);
  }, []);

  const openCreate = useCallback(
    (status: TaskStatus) => {
      setSelectedTask(null);
      setDraftStatus(status);
      setModalOpen(true);
      setFocusedColumn(status);
      ensureHighlight(status);
    },
    [ensureHighlight]
  );

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setSelectedTask(null);
  }, []);

  const placeTaskInStatus = useCallback(
    (task: Task, targetStatus: TaskStatus, position: 'start' | 'end' = 'end') => {
      if (task.status === targetStatus) {
        return;
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
      focusColumn(targetStatus);
      setHighlightedTaskId(task.id);
      setDraftStatus(targetStatus);
    },
    [columnsMap, focusColumn, reorderTasks]
  );

  const handleToggleComplete = useCallback(
    (task: Task, checked: boolean) => {
      if (checked) {
        placeTaskInStatus(task, 'done');
      } else {
        placeTaskInStatus(task, 'todo', 'start');
      }
    },
    [placeTaskInStatus]
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
    [placeTaskInStatus]
  );

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { destination, source, draggableId } = result;
      if (!destination) {
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
    [columnsMap, focusColumn, reorderTasks]
  );

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
      if (shouldIgnore(event) || modalOpen) return;
      event.preventDefault();
      openCreate(focusedColumn);
    };

    const handleEdit = (event: KeyboardEvent) => {
      if (shouldIgnore(event) || modalOpen) return;
      if (!highlightedTaskId) return;
      const task = tasksById.get(highlightedTaskId);
      if (!task) return;
      event.preventDefault();
      openTask(task);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (shouldIgnore(event)) return;
      if (!modalOpen) return;
      event.preventDefault();
      setModalOpen(false);
    };

    trap.bind('n', handleNew);
    trap.bind('e', handleEdit);
    trap.bind('esc', handleEscape);
    trap.bind('1', (event: KeyboardEvent) => {
      if (shouldIgnore(event)) return;
      event.preventDefault();
      focusColumn('todo');
    });
    trap.bind('2', (event: KeyboardEvent) => {
      if (shouldIgnore(event)) return;
      event.preventDefault();
      focusColumn('doing');
    });
    trap.bind('3', (event: KeyboardEvent) => {
      if (shouldIgnore(event)) return;
      event.preventDefault();
      focusColumn('done');
    });

    return () => {
      trap.destroy();
    };
  }, [focusColumn, focusedColumn, highlightedTaskId, modalOpen, openCreate, openTask, tasksById]);

  if (isLoading) {
    return <p className="text-sm text-slate-300">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      {showOffline ? <OfflineNotice feature="Tarefas" /> : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Quadro de tarefas</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">Arraste e solte para mover prioridades rapidamente.</p>
        </div>
        <Button
          onClick={() => {
            openCreate(focusedColumn);
          }}
        >
          Nova tarefa
        </Button>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-200">
        <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 backdrop-blur dark:border-white/10 dark:bg-white/5">
          <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Status</span>
          <Select
            className="w-28 min-w-[7rem] text-xs"
            value={filters.status}
            onChange={(e) => setFilter({ status: e.target.value as any })}
          >
            <option value="all">Todos</option>
            <option value="todo">A fazer</option>
            <option value="doing">Fazendo</option>
            <option value="done">Concluídos</option>
          </Select>
        </label>
        <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 backdrop-blur dark:border-white/10 dark:bg-white/5">
          <span className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Prazo</span>
          <Select
            className="w-28 min-w-[7rem] text-xs"
            value={filters.due}
            onChange={(e) => setFilter({ due: e.target.value as any })}
          >
            <option value="all">Todos</option>
            <option value="today">Hoje</option>
            <option value="week">Esta semana</option>
          </Select>
        </label>
      </div>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {columnsData.map((column) => (
            <Droppable droppableId={column.key} key={column.key}>
              {(provided, snapshot) => (
                <section
                  ref={(node) => {
                    provided.innerRef(node);
                    columnRefs.current[column.key] = node;
                  }}
                  {...provided.droppableProps}
                  className={`space-y-3 rounded-3xl border border-slate-200 bg-gradient-to-br p-4 backdrop-blur dark:border-white/5 ${
                    column.accent
                  } ${snapshot.isDraggingOver ? 'ring-2 ring-zenko-primary/60' : ''} ${
                    focusedColumn === column.key ? 'border-zenko-primary/40' : ''
                  }`}
                  role="region"
                  aria-labelledby={`column-${column.key}`}
                  aria-describedby={`column-${column.key}-meta`}
                  tabIndex={focusedColumn === column.key ? 0 : -1}
                  onFocus={() => {
                    focusColumn(column.key);
                  }}
                >
                  <header className="flex items-center justify-between">
                    <h3
                      id={`column-${column.key}`}
                      className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200"
                    >
                      {column.title}
                    </h3>
                    <span
                      id={`column-${column.key}-meta`}
                      className="rounded-full bg-zenko-primary/10 px-2 py-1 text-xs text-zenko-primary dark:bg-white/10"
                    >
                      {column.tasks.length}
                    </span>
                  </header>
                  <div className="space-y-3" role="list" aria-label={`Tarefas em ${column.title}`}>
                    {column.tasks.map((task, index) => {
                      const previousStatus = getAdjacentStatus(task.status, 'previous');
                      const nextStatus = getAdjacentStatus(task.status, 'next');
                      const nextStatusLabel = nextStatus ? columnTitles[nextStatus] : 'coluna final';
                      const ariaInstruction = nextStatus
                        ? `Pressione Enter ou Espaço para mover para ${nextStatusLabel}.`
                        : 'Esta tarefa está na última coluna.';

                      const checklistTotal = task.checklist.length;
                      const checklistDone = task.checklist.filter((item) => item.done).length;
                      const checklistPercentage = checklistTotal
                        ? Math.round((checklistDone / checklistTotal) * 100)
                        : 0;

                      return (
                        <Draggable draggableId={task.id} index={index} key={task.id}>
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className="space-y-2"
                              role="listitem"
                              aria-current={highlightedTaskId === task.id ? 'true' : undefined}
                            >
                              <Card
                                className={`cursor-grab overflow-hidden border-slate-200/80 bg-white/80 transition hover:-translate-y-0.5 hover:border-zenko-primary/40 dark:border-white/5 dark:bg-slate-900/70 ${
                                  dragSnapshot.isDragging ? 'border-zenko-primary/60 shadow-lg' : ''
                                } ${highlightedTaskId === task.id ? 'ring-2 ring-zenko-primary/60' : ''}`}
                                tabIndex={0}
                                aria-label={`Tarefa ${task.title}. Status atual: ${columnTitles[task.status]}. ${ariaInstruction}`}
                                onFocus={() => {
                                  setHighlightedTaskId(task.id);
                                  setFocusedColumn(task.status);
                                }}
                                onKeyDown={(event) => handleCardKeyDown(event, task)}
                                onClick={() => openTask(task)}
                              >
                                <div className="flex items-start gap-3">
                                  <label
                                    className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white/80 text-zenko-primary shadow-sm transition dark:border-white/20 dark:bg-white/10 ${
                                      autoMoveToDone ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-not-allowed opacity-50'
                                    }`}
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={task.status === 'done'}
                                      disabled={!autoMoveToDone}
                                      onChange={(event) => {
                                        event.stopPropagation();
                                        handleToggleComplete(task, event.target.checked);
                                      }}
                                      className="sr-only"
                                    />
                                    {task.status === 'done' ? (
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
                                        <path d="M5 13l4 4L19 7" />
                                      </svg>
                                    ) : null}
                                  </label>
                                  <div className="flex-1 min-w-0">
                                    {task.labels.length > 0 ? (
                                      <div className="mb-3 flex flex-wrap gap-1" aria-label="Etiquetas da tarefa">
                                        {task.labels.map((label, labelIndex) => {
                                          const normalized = label.toLocaleLowerCase();
                                          const definition = labelDefinitionMap.get(normalized);
                                          const colors = getLabelColors(label, {
                                            colorId: definition?.colorId,
                                            fallbackIndex: labelIndex
                                          });
                                          return (
                                            <span
                                              key={`${task.id}-label-${definition?.id ?? labelIndex}`}
                                              className="inline-flex items-center rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide shadow-sm"
                                              style={{
                                                backgroundColor: colors.background,
                                                color: colors.foreground
                                              }}
                                            >
                                              {definition?.value ?? label}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    ) : null}
                                    <h4 className="break-words text-base font-semibold leading-tight text-slate-900 dark:text-white">
                                      {task.title}
                                    </h4>
                                    {task.due_date && (
                                      <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-zenko-primary/10 px-3 py-1 text-[11px] font-medium text-zenko-primary">
                                        <svg
                                          className="h-3.5 w-3.5"
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
                                        Prazo: {new Date(task.due_date).toLocaleDateString('pt-BR')}
                                      </p>
                                    )}
                                    {checklistTotal > 0 ? (
                                      <div className="mt-3 space-y-2">
                                        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] font-medium text-slate-500 dark:text-slate-300">
                                          <span>Checklist</span>
                                          <span>
                                            {checklistDone}/{checklistTotal}
                                          </span>
                                        </div>
                                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                                          <div
                                            className={`h-1.5 rounded-full transition-all ${
                                              checklistDone === checklistTotal && checklistTotal > 0
                                                ? 'bg-emerald-500'
                                                : 'bg-zenko-primary'
                                            }`}
                                            style={{ width: `${checklistPercentage}%` }}
                                          />
                                        </div>
                                      </div>
                                    ) : null}
                                    <div className="mt-3 flex flex-wrap gap-2 md:hidden motion-reduce:flex motion-reduce:md:flex">
                                      <button
                                        type="button"
                                        className="flex-1 rounded-full border border-zenko-primary/40 bg-white/90 px-3 py-2 text-xs font-semibold text-zenko-primary shadow-sm transition hover:border-zenko-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/60 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900/70"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          if (previousStatus) {
                                            placeTaskInStatus(task, previousStatus, 'end');
                                          }
                                        }}
                                        disabled={!previousStatus}
                                        aria-label={`Mover ${task.title} para ${previousStatus ? columnTitles[previousStatus] : 'coluna anterior'}`}
                                      >
                                        Mover para coluna anterior
                                      </button>
                                      <button
                                        type="button"
                                        className="flex-1 rounded-full border border-zenko-primary/40 bg-white/90 px-3 py-2 text-xs font-semibold text-zenko-primary shadow-sm transition hover:border-zenko-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/60 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900/70"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          if (nextStatus) {
                                            placeTaskInStatus(task, nextStatus, 'end');
                                          }
                                        }}
                                        disabled={!nextStatus}
                                        aria-label={`Mover ${task.title} para ${nextStatus ? columnTitles[nextStatus] : 'coluna seguinte'}`}
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
                    {column.tasks.length === 0 && (
                      <p className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-center text-xs text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                        Arraste tarefas para esta coluna
                      </p>
                    )}
                  </div>
                </section>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={selectedTask ? 'Editar tarefa' : 'Nova tarefa'}
        description="Preencha os campos para atualizar sua produtividade."
      >
        <TaskForm
          task={selectedTask ?? undefined}
          onClose={closeModal}
          createTask={createTask}
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
