import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { ChecklistItem, Task, TaskPayload } from './types';
import AttachmentUploader from './AttachmentUploader';

const futureDateMessage = 'Use uma data a partir de hoje';

function parseDateInput(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if ([year, month, day].some((part) => Number.isNaN(part))) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}

const schema = z.object({
  title: z.string().min(1, 'Título obrigatório'),
  description: z.string().optional(),
  due_date: z
    .string()
    .optional()
    .superRefine((value, ctx) => {
      if (!value) return;
      const dueDate = parseDateInput(value);
      if (!dueDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: futureDateMessage });
        return;
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dueDate < today) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: futureDateMessage });
      }
    }),
  labels: z.string().optional(),
  status: z.enum(['todo', 'doing', 'done'])
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
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(task?.checklist ?? []);
  const [newChecklistText, setNewChecklistText] = useState('');
  const {
    register,
    handleSubmit,
    setValue,
    reset,
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
      attachments: []
    }
  });

  const fieldIds = useMemo(
    () => ({
      title: task ? 'task-title-edit' : 'task-title-new',
      description: task ? 'task-description-edit' : 'task-description-new',
      dueDate: task ? 'task-due-date-edit' : 'task-due-date-new',
      status: task ? 'task-status-edit' : 'task-status-new',
      labels: task ? 'task-labels-edit' : 'task-labels-new'
    }),
    [task]
  );

  useEffect(() => {
    if (!task) {
      reset({
        title: '',
        description: '',
        due_date: '',
        labels: '',
        status: 'todo',
        attachments: []
      });
      setChecklistItems([]);
      setNewChecklistText('');
      return;
    }
    reset({
      title: task.title,
      description: task.description ?? '',
      due_date: task.due_date ? task.due_date.slice(0, 10) : '',
      labels: task.labels.join(', '),
      status: task.status,
      attachments: task.attachments
    });
    setChecklistItems(task.checklist ?? []);
    setNewChecklistText('');
  }, [task, reset]);

  useEffect(() => {
    setSubmitError(null);
  }, [task]);

  const sanitizedChecklist = useMemo(() => {
    return checklistItems
      .map((item) => ({
        text: item.text.trim(),
        done: item.done
      }))
      .filter((item) => item.text.length > 0);
  }, [checklistItems]);

  const attachments = watch('attachments') ?? [];
  const isSaving = task ? isUpdatePending : isCreatePending;

  const checklistCompleted = sanitizedChecklist.filter((item) => item.done).length;
  const checklistTotal = sanitizedChecklist.length;
  const checklistProgress = checklistTotal === 0 ? 0 : Math.round((checklistCompleted / checklistTotal) * 100);

  const handleAddChecklistItem = () => {
    const trimmed = newChecklistText.trim();
    if (!trimmed) {
      return;
    }
    setChecklistItems((items) => [...items, { text: trimmed, done: false }]);
    setNewChecklistText('');
  };

  const handleChecklistToggle = (index: number, done: boolean) => {
    setChecklistItems((items) =>
      items.map((item, itemIndex) => (itemIndex === index ? { ...item, done } : item))
    );
  };

  const handleChecklistTextChange = (index: number, text: string) => {
    setChecklistItems((items) =>
      items.map((item, itemIndex) => (itemIndex === index ? { ...item, text } : item))
    );
  };

  const handleChecklistRemove = (index: number) => {
    setChecklistItems((items) => items.filter((_, itemIndex) => itemIndex !== index));
  };

  const onSubmit = handleSubmit(async (data) => {
    setSubmitError(null);
    const description = data.description?.trim() ? data.description : undefined;
    const dueDateValue = data.due_date
      ? data.due_date
      : task
        ? null
        : undefined;
    const payload = {
      title: data.title,
      description,
      due_date: dueDateValue,
      labels: data.labels?.split(',').map((label) => label.trim()).filter(Boolean) ?? [],
      status: data.status,
      checklist: sanitizedChecklist,
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
      <section className="rounded-3xl border border-slate-200 bg-white/60 p-4 shadow-inner dark:border-white/10 dark:bg-white/5">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Checklist</p>
            <p className="text-xs text-slate-500 dark:text-slate-300">
              {checklistCompleted}/{checklistTotal} itens concluídos
            </p>
          </div>
          {checklistTotal > 0 ? (
            <span className="rounded-full bg-zenko-primary/10 px-3 py-1 text-xs font-semibold text-zenko-primary dark:bg-white/10">
              {checklistProgress}%
            </span>
          ) : null}
        </header>
        {checklistTotal > 0 ? (
          <div className="mt-3 h-2 rounded-full bg-slate-200 dark:bg-white/10">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-zenko-primary to-zenko-secondary transition-all"
              style={{ width: `${checklistProgress}%` }}
            />
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Organize suas etapas adicionando itens abaixo. Cada item pode ser marcado como concluído.
          </p>
        )}
        <ul className="mt-4 space-y-2">
          {checklistItems.map((item, index) => (
            <li
              key={`checklist-item-${index}`}
              className="group flex items-start gap-3 rounded-2xl bg-white/80 px-3 py-2 shadow-sm transition hover:bg-white dark:bg-white/5 dark:hover:bg-white/10"
            >
              <label className="relative mt-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded border border-slate-300 bg-white text-zenko-primary shadow-sm transition dark:border-white/20 dark:bg-white/10">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={item.done}
                  onChange={(event) => handleChecklistToggle(index, event.target.checked)}
                />
                <span
                  className={`pointer-events-none text-xs font-semibold transition-opacity ${
                    item.done ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  ✓
                </span>
              </label>
              <div className="flex-1 space-y-1">
                <Input
                  value={item.text}
                  onChange={(event) => handleChecklistTextChange(index, event.target.value)}
                  className={`w-full border-transparent bg-transparent px-0 text-sm font-medium text-slate-700 shadow-none focus:border-zenko-primary/40 focus:ring-0 dark:text-slate-200 ${
                    item.done ? 'line-through opacity-75' : ''
                  }`}
                />
              </div>
              <button
                type="button"
                onClick={() => handleChecklistRemove(index)}
                className="mt-1 inline-flex rounded-full border border-transparent bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-rose-100 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/50 dark:bg-white/5 dark:hover:bg-rose-500/10 dark:hover:text-rose-200"
                aria-label={`Remover item ${item.text}`}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={newChecklistText}
            onChange={(event) => setNewChecklistText(event.target.value)}
            placeholder="Adicionar um item..."
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleAddChecklistItem();
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            className="border-none bg-gradient-to-r from-zenko-primary to-zenko-secondary text-white hover:from-zenko-primary/90 hover:to-zenko-secondary/90"
            onClick={handleAddChecklistItem}
            disabled={!newChecklistText.trim()}
          >
            Adicionar item
          </Button>
        </div>
      </section>
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
