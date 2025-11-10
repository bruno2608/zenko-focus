import { useMemo, useState } from 'react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import { useTasks } from './hooks';
import { Task, TaskStatus } from './types';
import TaskForm from './TaskForm';

const columns: { key: TaskStatus; title: string }[] = [
  { key: 'todo', title: 'A Fazer' },
  { key: 'doing', title: 'Fazendo' },
  { key: 'done', title: 'Feito' }
];

export default function Kanban() {
  const { tasks, isLoading, updateStatus, filters, setFilter } = useTasks();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const columnsData = useMemo(() => {
    return columns.map((column) => ({
      ...column,
      tasks: tasks.filter((task) => task.status === column.key)
    }));
  }, [tasks]);

  const handleDrop = (taskId: string, status: TaskStatus) => {
    updateStatus({ id: taskId, status });
  };

  if (isLoading) {
    return <p>Carregando...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Tarefas</h1>
        <Button onClick={() => { setSelectedTask(null); setModalOpen(true); }}>Nova tarefa</Button>
      </div>
      <div className="flex gap-2 text-xs text-slate-200">
        <label className="flex items-center gap-2">
          Status
          <select
            className="rounded-md bg-zenko-surface px-2 py-1"
            value={filters.status}
            onChange={(e) => setFilter({ status: e.target.value as any })}
          >
            <option value="all">Todos</option>
            <option value="todo">A fazer</option>
            <option value="doing">Fazendo</option>
            <option value="done">Concluídos</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          Prazo
          <select
            className="rounded-md bg-zenko-surface px-2 py-1"
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
              const taskId = event.dataTransfer.getData('task');
              handleDrop(taskId, column.key);
            }}
            className="space-y-3 rounded-xl border border-slate-700 bg-zenko-surface p-4"
          >
            <header className="flex items-center justify-between">
              <h2 className="font-semibold">{column.title}</h2>
              <span className="text-xs text-slate-400">{column.tasks.length}</span>
            </header>
            <div className="space-y-3">
              {column.tasks.map((task) => (
                <Card
                  key={task.id}
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData('task', task.id)}
                >
                  <button className="w-full text-left" onClick={() => { setSelectedTask(task); setModalOpen(true); }}>
                    <h3 className="font-semibold">{task.title}</h3>
                    {task.due_date && (
                      <p className="text-xs text-zenko-primary">Prazo: {new Date(task.due_date).toLocaleDateString('pt-BR')}</p>
                    )}
                    {task.labels.length > 0 && (
                      <p className="mt-2 flex flex-wrap gap-1">
                        {task.labels.map((label) => (
                          <span key={label} className="rounded-full bg-zenko-primary/10 px-2 py-1 text-[10px] text-zenko-primary">
                            {label}
                          </span>
                        ))}
                      </p>
                    )}
                  </button>
                </Card>
              ))}
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
