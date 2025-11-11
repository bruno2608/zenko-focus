import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { Task, TaskPayload } from './types';
import AttachmentUploader from './AttachmentUploader';

const schema = z.object({
  title: z.string().min(1, 'Título obrigatório'),
  description: z.string().optional(),
  due_date: z.string().optional(),
  labels: z.string().optional(),
  status: z.enum(['todo', 'doing', 'done']),
  checklist: z.string().optional()
});

type FormData = z.infer<typeof schema> & { attachments?: { name: string; url: string }[] };

interface Props {
  task?: Task;
  onClose: () => void;
  createTask: (payload: TaskPayload) => Promise<unknown>;
  updateTask: (input: { id: string; payload: Partial<TaskPayload> }) => Promise<unknown>;
  deleteTask: (id: string) => Promise<unknown>;
  isCreatePending: boolean;
  isUpdatePending: boolean;
}

export default function TaskForm({
  task,
  onClose,
  createTask,
  updateTask,
  deleteTask,
  isCreatePending,
  isUpdatePending
}: Props) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    watch
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      due_date: '',
      labels: '',
      status: 'todo',
      checklist: '',
      attachments: []
    }
  });

  const fieldIds = useMemo(
    () => ({
      title: task ? 'task-title-edit' : 'task-title-new',
      description: task ? 'task-description-edit' : 'task-description-new',
      dueDate: task ? 'task-due-date-edit' : 'task-due-date-new',
      status: task ? 'task-status-edit' : 'task-status-new',
      labels: task ? 'task-labels-edit' : 'task-labels-new',
      checklist: task ? 'task-checklist-edit' : 'task-checklist-new'
    }),
    [task]
  );

  useEffect(() => {
    if (!task) return;
    setValue('title', task.title);
    setValue('description', task.description ?? '');
    setValue('due_date', task.due_date ? task.due_date.slice(0, 10) : '');
    setValue('labels', task.labels.join(', '));
    setValue('status', task.status);
    setValue('checklist', task.checklist.map((item) => `${item.done ? '[x]' : '[ ]'} ${item.text}`).join('\n'));
    setValue('attachments', task.attachments);
  }, [task, setValue]);

  useEffect(() => {
    setSubmitError(null);
  }, [task]);

  const attachments = watch('attachments') ?? [];
  const isSaving = task ? isUpdatePending : isCreatePending;

  const onSubmit = handleSubmit(async (data) => {
    setSubmitError(null);
    const payload = {
      title: data.title,
      description: data.description,
      due_date: data.due_date ? new Date(data.due_date).toISOString() : null,
      labels: data.labels?.split(',').map((label) => label.trim()).filter(Boolean) ?? [],
      status: data.status,
      checklist:
        data.checklist
          ?.split('\n')
          .filter(Boolean)
          .map((line) => ({
            text: line.replace(/^\[(x| )\]\s?/, ''),
            done: line.startsWith('[x]')
          })) ?? [],
      attachments
    };

    try {
      if (task) {
        await updateTask({ id: task.id, payload });
      } else {
        await createTask(payload);
      }
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Não foi possível salvar a tarefa.');
    }
  });

  const handleDelete = async () => {
    if (!task) return;
    if (confirm('Deseja excluir esta tarefa?')) {
      try {
        await deleteTask(task.id);
        onClose();
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'Não foi possível remover a tarefa.');
      }
    }
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div>
        <label
          htmlFor={fieldIds.title}
          className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300"
        >
          Título
        </label>
        <Input id={fieldIds.title} {...register('title')} />
        {errors.title && <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">{errors.title.message}</p>}
      </div>
      <div>
        <label
          htmlFor={fieldIds.description}
          className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300"
        >
          Descrição
        </label>
        <Textarea id={fieldIds.description} rows={3} {...register('description')} />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label
            htmlFor={fieldIds.dueDate}
            className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300"
          >
            Prazo
          </label>
          <Input id={fieldIds.dueDate} type="date" {...register('due_date')} />
        </div>
        <div>
          <label
            htmlFor={fieldIds.status}
            className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300"
          >
            Status
          </label>
          <Select id={fieldIds.status} {...register('status')}>
            <option value="todo">A fazer</option>
            <option value="doing">Fazendo</option>
            <option value="done">Concluída</option>
          </Select>
        </div>
      </div>
      <div>
        <label
          htmlFor={fieldIds.labels}
          className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300"
        >
          Etiquetas (separadas por vírgula)
        </label>
        <Input id={fieldIds.labels} {...register('labels')} />
      </div>
      <div>
        <label
          htmlFor={fieldIds.checklist}
          className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300"
        >
          Checklist (uma linha por item)
        </label>
        <Textarea id={fieldIds.checklist} rows={4} {...register('checklist')} />
      </div>
      <AttachmentUploader attachments={attachments} onChange={(next) => setValue('attachments', next)} />
      {submitError && (
        <p className="text-sm text-rose-600 dark:text-rose-300" role="alert">
          {submitError}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {task && (
          <Button
            type="button"
            variant="secondary"
            className="border-none bg-gradient-to-r from-rose-500 to-red-500 text-white hover:from-rose-400 hover:to-red-400"
            onClick={handleDelete}
            disabled={isSaving}
          >
            Excluir
          </Button>
        )}
        <Button type="submit" isLoading={isSaving} disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}
