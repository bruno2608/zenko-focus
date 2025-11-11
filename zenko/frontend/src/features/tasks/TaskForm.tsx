import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { ChecklistItem, Task, TaskPayload } from './types';
import AttachmentUploader from './AttachmentUploader';
import { getLabelColors, parseLabels } from './labelColors';
import { useTasksStore } from './store';

const futureDateMessage = 'Use uma data a partir de hoje';

type ChecklistEntry = ChecklistItem & { clientId: string };

let checklistIdCounter = 0;

const generateChecklistId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try {
      return crypto.randomUUID();
    } catch (error) {
      // ignore and fallback to counter-based id
    }
  }
  checklistIdCounter += 1;
  return `checklist-${Date.now()}-${checklistIdCounter}`;
};

const toChecklistEntries = (items: ChecklistItem[] = []): ChecklistEntry[] =>
  items.map((item) => ({ ...item, clientId: generateChecklistId() }));

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
  const [checklistItems, setChecklistItems] = useState<ChecklistEntry[]>(() => toChecklistEntries(task?.checklist));
  const [newChecklistText, setNewChecklistText] = useState('');
  const [draggingChecklistId, setDraggingChecklistId] = useState<string | null>(null);
  const [checklistDropTarget, setChecklistDropTarget] = useState<
    | {
        id: string | null;
        position: 'before' | 'after';
      }
    | null
  >(null);
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
      setDraggingChecklistId(null);
      setChecklistDropTarget(null);
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
    setChecklistItems(toChecklistEntries(task.checklist ?? []));
    setNewChecklistText('');
    setDraggingChecklistId(null);
    setChecklistDropTarget(null);
    if (task.labels.length > 0) {
      registerLabels(task.labels);
    }
  }, [task, reset, registerLabels]);

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
  const labelInput = watch('labels') ?? '';
  const labelPreview = useMemo(() => parseLabels(labelInput), [labelInput]);
  const savedLabels = useTasksStore((state) => state.labelsLibrary);
  const registerLabels = useTasksStore((state) => state.registerLabels);
  const labelSuggestions = useMemo(() => {
    if (savedLabels.length === 0) {
      return [] as string[];
    }
    const used = new Set(labelPreview.map((label) => label.toLocaleLowerCase()));
    return savedLabels.filter((label) => !used.has(label.toLocaleLowerCase()));
  }, [labelPreview, savedLabels]);
  const isSaving = task ? isUpdatePending : isCreatePending;

  const checklistCompleted = sanitizedChecklist.filter((item) => item.done).length;
  const checklistTotal = sanitizedChecklist.length;
  const checklistProgress = checklistTotal === 0 ? 0 : Math.round((checklistCompleted / checklistTotal) * 100);

  const handleAddChecklistItem = () => {
    const trimmed = newChecklistText.trim();
    if (!trimmed) {
      return;
    }
    setChecklistItems((items) => [
      ...items,
      {
        clientId: generateChecklistId(),
        text: trimmed,
        done: false
      }
    ]);
    setNewChecklistText('');
  };

  const handleChecklistToggle = (id: string, done: boolean) => {
    setChecklistItems((items) =>
      items.map((item) => (item.clientId === id ? { ...item, done } : item))
    );
  };

  const handleChecklistTextChange = (id: string, text: string) => {
    setChecklistItems((items) =>
      items.map((item) => (item.clientId === id ? { ...item, text } : item))
    );
  };

  const handleChecklistRemove = (id: string) => {
    setChecklistItems((items) => items.filter((item) => item.clientId !== id));
    setChecklistDropTarget((current) => {
      if (current?.id === id) {
        return null;
      }
      return current;
    });
  };

  const reorderChecklistItems = useCallback(
    (itemId: string, targetId: string | null, position: 'before' | 'after') => {
      if (!itemId) return;
      setChecklistItems((items) => {
        const currentIndex = items.findIndex((item) => item.clientId === itemId);
        if (currentIndex === -1) return items;

        const updated = [...items];
        const [moved] = updated.splice(currentIndex, 1);

        if (!targetId) {
          updated.push(moved);
          return updated;
        }

        if (targetId === itemId) {
          updated.splice(currentIndex, 0, moved);
          return updated;
        }

        const targetIndex = updated.findIndex((item) => item.clientId === targetId);
        if (targetIndex === -1) {
          updated.splice(currentIndex, 0, moved);
          return items;
        }

        const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
        updated.splice(insertIndex, 0, moved);
        return updated;
      });
    },
    []
  );

  const handleChecklistDragStart = (
    event: ReactDragEvent<HTMLButtonElement>,
    itemId: string
  ) => {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', itemId);
    setDraggingChecklistId(itemId);
    setChecklistDropTarget(null);
  };

  const handleChecklistDragOver = (
    event: ReactDragEvent<HTMLLIElement>,
    itemId: string
  ) => {
    if (!draggingChecklistId || draggingChecklistId === itemId) {
      return;
    }
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const isBefore = event.clientY < rect.top + rect.height / 2;
    setChecklistDropTarget({ id: itemId, position: isBefore ? 'before' : 'after' });
    event.dataTransfer.dropEffect = 'move';
  };

  const handleChecklistDrop = (event: ReactDragEvent, itemId: string | null) => {
    if (!draggingChecklistId) return;
    event.preventDefault();
    const resolvedTarget =
      checklistDropTarget && (itemId === null || checklistDropTarget.id === itemId)
        ? checklistDropTarget
        : itemId
        ? { id: itemId, position: 'after' as const }
        : { id: null, position: 'after' as const };
    reorderChecklistItems(draggingChecklistId, resolvedTarget.id, resolvedTarget.position);
    setDraggingChecklistId(null);
    setChecklistDropTarget(null);
  };

  const handleChecklistDragEnd = () => {
    setDraggingChecklistId(null);
    setChecklistDropTarget(null);
  };

  const handleLabelSuggestionSelect = (label: string) => {
    const current = parseLabels(labelInput);
    const exists = current.some((item) => item.toLocaleLowerCase() === label.toLocaleLowerCase());
    if (exists) {
      return;
    }
    const next = [...current, label];
    setValue('labels', next.join(', '), { shouldDirty: true, shouldValidate: true });
  };

  const onSubmit = handleSubmit(async (data) => {
    setSubmitError(null);
    const description = data.description?.trim() ? data.description : undefined;
    const dueDateValue = data.due_date
      ? data.due_date
      : task
        ? null
        : undefined;
    const labels = parseLabels(data.labels);
    const payload = {
      title: data.title,
      description,
      due_date: dueDateValue,
      labels,
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
      registerLabels(labels);
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
        {labelSuggestions.length > 0 ? (
          <div className="mt-2 space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Etiquetas salvas
            </p>
            <div className="flex flex-wrap gap-2">
              {labelSuggestions.map((label) => {
                const colors = getLabelColors(label);
                return (
                  <button
                    key={`suggestion-${label}`}
                    type="button"
                    onClick={() => handleLabelSuggestionSelect(label)}
                    className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide shadow-sm transition hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/60"
                    style={{
                      backgroundColor: colors.background,
                      color: colors.foreground
                    }}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: colors.foreground, opacity: 0.5 }}
                    />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        {labelPreview.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {labelPreview.map((label, index) => {
              const colors = getLabelColors(label, index);
              return (
                <span
                  key={`${label}-${index}`}
                  className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide shadow-sm"
                  style={{
                    backgroundColor: colors.background,
                    color: colors.foreground
                  }}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: colors.foreground, opacity: 0.5 }}
                  />
                  {label}
                </span>
              );
            })}
          </div>
        ) : null}
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
        <ul
          className="mt-4 space-y-2"
          onDragOver={(event) => {
            if (!draggingChecklistId) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            if (checklistItems.length === 0) {
              setChecklistDropTarget({ id: null, position: 'after' });
            }
          }}
          onDrop={(event) => handleChecklistDrop(event, null)}
        >
          {checklistItems.map((item) => {
            const isDragging = draggingChecklistId === item.clientId;
            const showBefore =
              checklistDropTarget?.id === item.clientId &&
              checklistDropTarget.position === 'before';
            const showAfter =
              checklistDropTarget?.id === item.clientId &&
              checklistDropTarget.position === 'after';

            return (
            <li
              key={item.clientId}
              className={`group relative flex items-start gap-3 rounded-2xl bg-white/80 px-3 py-2 shadow-sm transition hover:bg-white dark:bg-white/5 dark:hover:bg-white/10 ${
                isDragging ? 'opacity-60' : ''
              }`}
              onDragOver={(event) => handleChecklistDragOver(event, item.clientId)}
              onDrop={(event) => handleChecklistDrop(event, item.clientId)}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute left-3 right-3 h-1 rounded-full bg-zenko-primary/60 transition-opacity ${
                  showBefore ? 'top-0 -translate-y-1/2 opacity-100' : 'opacity-0'
                }`}
              />
              <button
                type="button"
                draggable
                onDragStart={(event) => handleChecklistDragStart(event, item.clientId)}
                onDragEnd={handleChecklistDragEnd}
                aria-label="Reordenar item do checklist"
                className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-transparent bg-slate-100 text-lg leading-none text-slate-400 transition hover:bg-slate-200 hover:text-slate-600 active:cursor-grabbing active:bg-slate-200 dark:bg-white/10 dark:text-slate-500 dark:hover:bg-white/20 dark:hover:text-slate-200"
              >
                <span aria-hidden="true">⋮⋮</span>
              </button>
              <label className="relative mt-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded border border-slate-300 bg-white text-zenko-primary shadow-sm transition dark:border-white/20 dark:bg-white/10">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={item.done}
                  onChange={(event) => handleChecklistToggle(item.clientId, event.target.checked)}
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
                  onChange={(event) => handleChecklistTextChange(item.clientId, event.target.value)}
                  className={`w-full border-transparent bg-transparent px-0 text-sm font-medium text-slate-700 shadow-none focus:border-zenko-primary/40 focus:ring-0 dark:text-slate-200 ${
                    item.done ? 'line-through opacity-75' : ''
                  }`}
                />
              </div>
              <button
                type="button"
                onClick={() => handleChecklistRemove(item.clientId)}
                className="mt-1 inline-flex rounded-full border border-transparent bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-rose-100 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/50 dark:bg-white/5 dark:hover:bg-rose-500/10 dark:hover:text-rose-200"
                aria-label={`Remover item ${item.text}`}
              >
                Remover
              </button>
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute left-3 right-3 h-1 rounded-full bg-zenko-primary/60 transition-opacity ${
                  showAfter ? 'bottom-0 translate-y-1/2 opacity-100' : 'opacity-0'
                }`}
              />
            </li>
          );
          })}
          {checklistDropTarget?.id === null && (
            <li className="relative flex items-center justify-center rounded-2xl border border-dashed border-zenko-primary/40 bg-white/60 py-3 text-xs font-medium text-zenko-primary dark:border-white/10 dark:bg-white/10">
              Solte aqui para posicionar ao final
            </li>
          )}
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
