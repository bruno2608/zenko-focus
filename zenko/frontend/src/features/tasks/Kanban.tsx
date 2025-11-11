import { useMemo, useState } from 'react';
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
  const connectivityStatus = useConnectivityStore((state) => state.status);
  const showOffline = connectivityStatus === 'limited' || isOfflineMode(userId);

  const autoMoveToDone = profile?.auto_move_done ?? true;

  const columnsData = useMemo(() => {
    return columns.map((column) => ({
      ...column,
      tasks: tasks.filter((task) => task.status === column.key)
    }));
  }, [tasks]);

  const handleDrop = (taskId: string, status: TaskStatus) => {
    if (!taskId) return;
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.status === status) {
      return;
    }
    updateStatus({ id: taskId, status });
  };

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
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const taskId =
                event.dataTransfer.getData('application/task-id') ||
                event.dataTransfer.getData('text/plain');
              handleDrop(taskId, column.key);
              setDraggingId(null);
            }}
            className={`space-y-3 rounded-3xl border border-slate-200 bg-gradient-to-br p-4 backdrop-blur dark:border-white/5 ${column.accent}`}
          >
            <header className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200">{column.title}</h3>
              <span className="rounded-full bg-zenko-primary/10 px-2 py-1 text-xs text-zenko-primary dark:bg-white/10">{column.tasks.length}</span>
            </header>
            <div className="space-y-3">
              {column.tasks.map((task) => (
                <Card
                  key={task.id}
                  className={`cursor-grab border-slate-200/80 bg-white/80 transition hover:-translate-y-0.5 hover:border-zenko-primary/40 dark:border-white/5 dark:bg-slate-900/70 ${
                    draggingId === task.id ? 'border-zenko-primary/60 shadow-lg' : ''
                  }`}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('application/task-id', task.id);
                    event.dataTransfer.setData('text/plain', task.id);
                    setDraggingId(task.id);
                  }}
                  onDragEnd={() => setDraggingId(null)}
                  onClick={() => {
                    setSelectedTask(task);
                    setModalOpen(true);
                  }}
                >
                  <div className="flex items-start gap-3">
                    <label
                      className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white/80 text-zenko-primary shadow-sm transition dark:border-white/20 dark:bg-white/10 ${
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
                    <div className="flex-1">
                      <h4 className="text-base font-semibold text-slate-900 dark:text-white">{task.title}</h4>
                      {task.description ? (
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{task.description}</p>
                      ) : null}
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
                      {task.labels.length > 0 && (
                        <p className="mt-3 flex flex-wrap gap-2">
                          {task.labels.map((label) => (
                            <span
                              key={label}
                              className="rounded-full bg-zenko-primary/10 px-3 py-1 text-[11px] font-medium text-zenko-primary"
                            >
                              {label}
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
              {column.tasks.length === 0 && (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-4 py-6 text-center text-xs text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                  Arraste tarefas para esta coluna
                </p>
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
