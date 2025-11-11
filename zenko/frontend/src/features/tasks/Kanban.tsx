import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  TouchEvent as ReactTouchEvent
} from 'react';
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

export default function Kanban() {
  const {
    tasks,
    isLoading,
    updateStatus,
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
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ column: TaskStatus; beforeId: string | null } | null>(null);
  const [ordering, setOrdering] = useState<Record<TaskStatus, string[]>>({
    todo: [],
    doing: [],
    done: []
  });
  const connectivityStatus = useConnectivityStore((state) => state.status);
  const virtualDragRef = useRef<{
    taskId: string;
    pointerId: number | null;
    startX: number;
    startY: number;
    hasMoved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const showOffline = connectivityStatus === 'limited' || isOfflineMode(userId);

  const autoMoveToDone = profile?.auto_move_done ?? true;
  const labelDefinitions = useTasksStore((state) => state.labelsLibrary);
  const labelDefinitionMap = useMemo(() => {
    const map = new Map<string, LabelDefinition>();
    labelDefinitions.forEach((definition) => {
      map.set(definition.normalized, definition);
    });
    return map;
  }, [labelDefinitions]);

  useEffect(() => {
    setOrdering((prev) => {
      let changed = false;
      const next: Record<TaskStatus, string[]> = { ...prev };

      statusOrder.forEach((status) => {
        const columnTasks = tasks.filter((task) => task.status === status);
        const existing = prev[status] ?? [];
        const known = existing.filter((id) => columnTasks.some((task) => task.id === id));
        const missing = columnTasks
          .map((task) => task.id)
          .filter((id) => !known.includes(id));

        const missingSorted = missing
          .map((id) => columnTasks.find((task) => task.id === id)!)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .map((task) => task.id);

        const merged = [...known, ...missingSorted];
        const previous = prev[status] ?? [];
        if (merged.length !== previous.length || merged.some((value, index) => value !== previous[index])) {
          next[status] = merged;
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [tasks]);

  const columnsData = useMemo(() => {
    return columns.map((column) => {
      const columnTasks = tasks.filter((task) => task.status === column.key);
      const order = ordering[column.key] ?? [];
      const sorted = [...columnTasks].sort((a, b) => {
        const indexA = order.indexOf(a.id);
        const indexB = order.indexOf(b.id);
        if (indexA === -1 && indexB === -1) {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });

      return {
        ...column,
        tasks: sorted
      };
    });
  }, [ordering, tasks]);

  const handleDrop = (taskId: string, status: TaskStatus) => {
    if (!taskId) return;
    const task = tasks.find((item) => item.id === taskId);
    if (!task) {
      setDropTarget(null);
      return;
    }

    const beforeId = dropTarget?.column === status ? dropTarget.beforeId : null;

    if (task.status === status) {
      reorderTask(taskId, status, beforeId);
      setDropTarget(null);
      return;
    }

    reorderTask(taskId, status, beforeId);
    updateStatus({ id: taskId, status });
    setDropTarget(null);
  };

  const moveTask = useCallback(
    (task: Task, direction: 'next' | 'previous') => {
      const nextStatus = getAdjacentStatus(task.status, direction);
      if (!nextStatus) return;
      updateStatus({ id: task.id, status: nextStatus });
    },
    [updateStatus]
  );

  const reorderTask = useCallback((taskId: string, targetStatus: TaskStatus, beforeId: string | null) => {
    setOrdering((prev) => {
      const next: Record<TaskStatus, string[]> = {
        todo: [...(prev.todo ?? [])],
        doing: [...(prev.doing ?? [])],
        done: [...(prev.done ?? [])]
      };

      statusOrder.forEach((status) => {
        next[status] = next[status].filter((id) => id !== taskId);
      });

      const baseList = next[targetStatus] ?? [];
      const sanitized = baseList.filter((id) => id !== taskId);
      const insertIndex = beforeId ? sanitized.indexOf(beforeId) : sanitized.length;
      if (insertIndex === -1) {
        sanitized.push(taskId);
      } else {
        sanitized.splice(insertIndex, 0, taskId);
      }
      next[targetStatus] = sanitized;

      return next;
    });
  }, []);

  const startVirtualDrag = useCallback((taskId: string, pointerId: number | null, startX: number, startY: number) => {
    virtualDragRef.current = {
      taskId,
      pointerId,
      startX,
      startY,
      hasMoved: false
    };
  }, []);

  const finishVirtualDrag = useCallback(() => {
    virtualDragRef.current = null;
    setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
    setDropTarget(null);
  }, []);

  const processVirtualDrag = useCallback(
    (task: Task, clientX: number, clientY: number) => {
      const drag = virtualDragRef.current;
      if (!drag || drag.taskId !== task.id || drag.hasMoved) {
        return;
      }

      const deltaX = clientX - drag.startX;
      const deltaY = clientY - drag.startY;

      if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY)) {
        return;
      }

      const direction: 'next' | 'previous' = primaryDelta > 0 ? 'next' : 'previous';
      const targetStatus = getAdjacentStatus(task.status, direction);
      if (!targetStatus) {
        finishVirtualDrag();
        return;
      }

      drag.hasMoved = true;
      suppressClickRef.current = true;
      moveTask(task, direction);
    },
    [finishVirtualDrag, moveTask]
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, task: Task) => {
      if (event.pointerType === 'mouse') {
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      startVirtualDrag(task.id, event.pointerId, event.clientX, event.clientY);
    },
    [startVirtualDrag]
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, task: Task) => {
      const drag = virtualDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }

      processVirtualDrag(task, event.clientX, event.clientY);
    },
    [processVirtualDrag]
  );

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = virtualDragRef.current;
    if (drag && drag.pointerId === event.pointerId) {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // ignore when pointer capture is not set
      }
      finishVirtualDrag();
      setDropTarget(null);
    }
  }, [finishVirtualDrag]);

  const handleTouchStart = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>, task: Task) => {
      const touch = event.touches[0];
      if (!touch) return;
      startVirtualDrag(task.id, touch.identifier, touch.clientX, touch.clientY);
    },
    [startVirtualDrag]
  );

  const handleTouchMove = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>, task: Task) => {
      const drag = virtualDragRef.current;
      if (!drag) return;
      const touch = Array.from(event.touches).find((item) => item.identifier === drag.pointerId) ?? event.touches[0];
      if (!touch || drag.taskId !== task.id) {
        return;
      }
      processVirtualDrag(task, touch.clientX, touch.clientY);
    },
    [processVirtualDrag]
  );

  const handleTouchEnd = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    const drag = virtualDragRef.current;
    if (!drag) return;
    const touch = Array.from(event.changedTouches).find((item) => item.identifier === drag.pointerId);
    if (touch || drag.pointerId === null) {
      finishVirtualDrag();
      setDropTarget(null);
    }
  }, [finishVirtualDrag]);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>, task: Task) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }

      event.preventDefault();
      const nextStatus = getAdjacentStatus(task.status, 'next');
      if (nextStatus) {
        moveTask(task, 'next');
      }
    },
    [moveTask]
  );

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
        <Button onClick={() => {
          setSelectedTask(null);
          setModalOpen(true);
        }}>
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {columnsData.map((column) => (
          <section
            key={column.key}
            onDragOver={(event) => {
              event.preventDefault();
              setDropTarget((current) =>
                current?.column === column.key && current.beforeId === null
                  ? current
                  : { column: column.key, beforeId: null }
              );
              event.dataTransfer.dropEffect = 'move';
            }}
            onDragLeave={(event) => {
              const related = event.relatedTarget as Node | null;
              if (!related || !event.currentTarget.contains(related)) {
                setDropTarget(null);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              const taskId =
                event.dataTransfer.getData('application/task-id') ||
                event.dataTransfer.getData('text/plain');
              handleDrop(taskId, column.key);
              setDraggingId(null);
              setDropTarget(null);
            }}
            className={`space-y-3 rounded-3xl border border-slate-200 bg-gradient-to-br p-4 backdrop-blur dark:border-white/5 ${column.accent}`}
          >
            <header className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200">{column.title}</h3>
              <span className="rounded-full bg-zenko-primary/10 px-2 py-1 text-xs text-zenko-primary dark:bg-white/10">{column.tasks.length}</span>
            </header>
            <div className="space-y-3">
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

                const isDropBefore = dropTarget?.column === column.key && dropTarget.beforeId === task.id;
                const isLast = index === column.tasks.length - 1;

                return (
                  <div key={task.id} className="space-y-2">
                    {isDropBefore ? <div className="h-0.5 rounded-full bg-zenko-primary/60" aria-hidden /> : null}
                    <Card
                      className={`cursor-grab overflow-hidden border-slate-200/80 bg-white/80 transition hover:-translate-y-0.5 hover:border-zenko-primary/40 dark:border-white/5 dark:bg-slate-900/70 ${
                        draggingId === task.id ? 'border-zenko-primary/60 shadow-lg' : ''
                      }`}
                      data-task-id={task.id}
                      data-status={task.status}
                      draggable
                      tabIndex={0}
                      aria-label={`Tarefa ${task.title}. Status atual: ${columnTitles[task.status]}. ${ariaInstruction}`}
                      onPointerDown={(event) => handlePointerDown(event, task)}
                      onPointerMove={(event) => handlePointerMove(event, task)}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                      onTouchStart={(event) => handleTouchStart(event, task)}
                      onTouchMove={(event) => handleTouchMove(event, task)}
                      onTouchEnd={handleTouchEnd}
                      onTouchCancel={handleTouchEnd}
                      onKeyDown={(event) => handleKeyDown(event, task)}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('application/task-id', task.id);
                        event.dataTransfer.setData('text/plain', task.id);
                        setDraggingId(task.id);
                        setDropTarget(null);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        if (!draggingId || draggingId === task.id) {
                          return;
                        }
                        const bounds = event.currentTarget.getBoundingClientRect();
                        const offsetY = event.clientY - bounds.top;
                        const shouldInsertBefore = offsetY < bounds.height / 2;
                        if (shouldInsertBefore) {
                          setDropTarget((current) =>
                            current?.column === column.key && current.beforeId === task.id
                              ? current
                              : { column: column.key, beforeId: task.id }
                          );
                        } else {
                          const nextTask = column.tasks[index + 1];
                          setDropTarget({ column: column.key, beforeId: nextTask ? nextTask.id : null });
                        }
                        event.dataTransfer.dropEffect = 'move';
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDropTarget(null);
                      }}
                      onClick={() => {
                        if (suppressClickRef.current) {
                          suppressClickRef.current = false;
                          return;
                        }
                        setSelectedTask(task);
                        setModalOpen(true);
                      }}
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
                              const checked = event.target.checked;
                              if (checked) {
                                updateStatus({ id: task.id, status: 'done' });
                              } else {
                                updateStatus({ id: task.id, status: 'todo' });
                              }
                            }}
                            className="peer sr-only"
                          />
                          <span
                            className={`pointer-events-none text-xs font-semibold transition-opacity ${
                              task.status === 'done' ? 'opacity-100' : 'opacity-0'
                            }`}
                          >
                            ✓
                          </span>
                        </label>
                        <div className="flex-1 min-w-0">
                          {task.labels.length > 0 ? (
                            <div className="mb-3 flex flex-wrap gap-1" aria-label="Etiquetas da tarefa">
                              {task.labels.map((label, index) => {
                                const normalized = label.toLocaleLowerCase();
                                const definition = labelDefinitionMap.get(normalized);
                                const colors = getLabelColors(label, {
                                  colorId: definition?.colorId,
                                  fallbackIndex: index
                                });
                                return (
                                  <span
                                    key={`${task.id}-label-${definition?.id ?? index}`}
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
                                moveTask(task, 'previous');
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
                                moveTask(task, 'next');
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
                    {dropTarget?.column === column.key && dropTarget.beforeId === null && isLast ? (
                      <div className="h-0.5 rounded-full bg-zenko-primary/60" aria-hidden />
                    ) : null}
                  </div>
                );
              })}
              {column.tasks.length === 0 && (
                <div className="space-y-2">
                  {dropTarget?.column === column.key ? (
                    <div className="h-0.5 rounded-full bg-zenko-primary/60" aria-hidden />
                  ) : null}
                  <p className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-center text-xs text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                    Arraste tarefas para esta coluna
                  </p>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
      <Modal title={selectedTask ? 'Editar tarefa' : 'Nova tarefa'} open={modalOpen} onClose={() => setModalOpen(false)}>
        <TaskForm
          task={selectedTask ?? undefined}
          onClose={() => setModalOpen(false)}
          createTask={createTask}
          updateTask={updateTask}
          deleteTask={deleteTask}
          isCreatePending={createTaskIsPending}
          isUpdatePending={updateTaskIsPending}
        />
      </Modal>
    </div>
  );
}
