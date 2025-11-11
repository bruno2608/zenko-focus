import { useMemo, useState } from 'react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import { useTasks } from './hooks';
import { Task, TaskStatus } from './types';
import TaskForm from './TaskForm';
import OfflineNotice from '../../components/OfflineNotice';
import { OFFLINE_USER_ID, isSupabaseConfigured } from '../../lib/supabase';

const columns: { key: TaskStatus; title: string; accent: string }[] = [
  { key: 'todo', title: 'A Fazer', accent: 'from-zenko-primary/20 to-zenko-secondary/10' },
  { key: 'doing', title: 'Fazendo', accent: 'from-zenko-secondary/20 to-zenko-primary/10' },
  { key: 'done', title: 'Concluídas', accent: 'from-emerald-400/10 to-zenko-primary/10' }
];

const selectClass =
  'rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-zenko-primary/60 backdrop-blur';

export default function Kanban() {
  const { tasks, isLoading, updateStatus, filters, setFilter, userId } = useTasks();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

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
      {!isSupabaseConfigured || userId === OFFLINE_USER_ID ? <OfflineNotice feature="Tarefas" /> : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Quadro de tarefas</h2>
          <p className="text-sm text-slate-300">Arraste e solte para mover prioridades rapidamente.</p>
        </div>
        <Button onClick={() => {
          setSelectedTask(null);
          setModalOpen(true);
        }}>
          Nova tarefa
        </Button>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-slate-200">
        <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur">
          <span className="text-xs uppercase tracking-wide text-slate-300">Status</span>
          <select
            className={selectClass}
            value={filters.status}
            onChange={(e) => setFilter({ status: e.target.value as any })}
          >
            <option value="all">Todos</option>
            <option value="todo">A fazer</option>
            <option value="doing">Fazendo</option>
            <option value="done">Concluídos</option>
          </select>
        </label>
        <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur">
          <span className="text-xs uppercase tracking-wide text-slate-300">Prazo</span>
          <select
            className={selectClass}
            value={filters.due}
            onChange={(e) => setFilter({ due: e.target.value as any })}
          >
            <option value="all">Todos</option>
            <option value="today">Hoje</option>
            <option value="week">Esta semana</option>
          </select>
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
            className={`space-y-3 rounded-3xl border border-white/5 bg-gradient-to-br ${column.accent} p-4 backdrop-blur`}
          >
            <header className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">{column.title}</h3>
              <span className="rounded-full bg-white/10 px-2 py-1 text-xs text-zenko-primary">{column.tasks.length}</span>
            </header>
            <div className="space-y-3">
              {column.tasks.map((task) => (
                <Card
                  key={task.id}
                  className={`cursor-grab border-white/5 bg-slate-900/70 transition hover:-translate-y-0.5 hover:border-zenko-primary/40 ${
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
                >
                  <button
                    className="w-full text-left"
                    onClick={() => {
                      setSelectedTask(task);
                      setModalOpen(true);
                    }}
                  >
                    <h4 className="text-base font-semibold text-white">{task.title}</h4>
                    {task.due_date && (
                      <p className="mt-1 text-xs text-zenko-primary">
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
                  </button>
                </Card>
              ))}
              {column.tasks.length === 0 && (
                <p className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-center text-xs text-slate-400">
                  Arraste tarefas para esta coluna
                </p>
              )}
            </div>
          </section>
        ))}
      </div>
      <Modal title={selectedTask ? 'Editar tarefa' : 'Nova tarefa'} open={modalOpen} onClose={() => setModalOpen(false)}>
        <TaskForm task={selectedTask ?? undefined} onClose={() => setModalOpen(false)} />
      </Modal>
    </div>
  );
}
