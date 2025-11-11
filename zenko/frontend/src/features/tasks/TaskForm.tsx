import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent as ReactChangeEvent, DragEvent as ReactDragEvent } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { ChecklistItem, Task, TaskPayload, TaskStatus } from './types';
import AttachmentUploader from './AttachmentUploader';
import { getLabelColors, parseLabels, trelloPalette, type LabelColorId } from './labelColors';
import { type LabelDefinition, useTasksStore } from './store';

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

const dueReminderOptions = ['none', 'at_time', '5m', '10m', '1h', '1d', '2d'] as const;
const dueRecurrenceOptions = ['never', 'daily', 'weekly', 'monthly'] as const;

type DueReminderOption = (typeof dueReminderOptions)[number];
type DueRecurrenceOption = (typeof dueRecurrenceOptions)[number];
type CalendarCursor = { year: number; month: number };
interface CalendarDay {
  iso: string;
  day: number;
  inCurrentMonth: boolean;
  timestamp: number;
  date: Date;
}
type FormatCommand =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'code'
  | 'codeblock'
  | 'link'
  | 'bullet'
  | 'number'
  | 'checklist'
  | 'quote'
  | 'divider';

const reminderLabels: Record<DueReminderOption, string> = {
  none: 'Nenhum',
  at_time: 'No horário',
  '5m': '5 minutos antes',
  '10m': '10 minutos antes',
  '1h': '1 hora antes',
  '1d': '1 dia antes',
  '2d': '2 dias antes'
};

const recurrenceLabels: Record<DueRecurrenceOption, string> = {
  never: 'Nunca',
  daily: 'Diariamente',
  weekly: 'Semanalmente',
  monthly: 'Mensalmente'
};

const monthLabels = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro'
];

const weekDayLabels = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildCalendarDays(cursor: CalendarCursor): CalendarDay[] {
  const { year, month } = cursor;
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const firstVisible = new Date(year, month, 1 - startWeekday);

  const days: CalendarDay[] = [];
  for (let index = 0; index < 42; index += 1) {
    const current = new Date(firstVisible);
    current.setDate(firstVisible.getDate() + index);
    current.setHours(0, 0, 0, 0);
    days.push({
      iso: formatDateInput(current),
      day: current.getDate(),
      inCurrentMonth: current.getMonth() === month,
      timestamp: current.getTime(),
      date: current
    });
  }
  return days;
}

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

function toTimeInput(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 5);
}

function normalizeDueTime(value?: string | null) {
  if (!value) return null;
  if (value.length >= 8) {
    return value.slice(0, 8);
  }
  if (value.length === 5) {
    return `${value}:00`;
  }
  if (value.length === 4) {
    return `${value}:00`;
  }
  return null;
}

const sanitizeChecklistItems = (items: ChecklistEntry[]) =>
  items
    .map((item) => ({
      text: item.text.trim(),
      done: item.done
    }))
    .filter((item) => item.text.length > 0);

const schema = z
  .object({
    title: z.string().min(1, 'Título obrigatório'),
    description: z.string().optional(),
    due_date: z.string().optional(),
    start_date: z.string().optional(),
    due_time: z.string().optional(),
    due_reminder: z.enum(dueReminderOptions).optional(),
    due_recurrence: z.enum(dueRecurrenceOptions).optional(),
    labels: z.string().optional(),
    status: z.enum(['todo', 'doing', 'done'])
  })
  .superRefine((data, ctx) => {
    if (data.due_time) {
      const normalized = normalizeDueTime(data.due_time);
      if (!normalized) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe um horário válido (HH:MM).',
          path: ['due_time']
        });
      }
      if (!data.due_date) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Defina uma data antes de informar o horário.',
          path: ['due_date']
        });
      }
    }

    if (data.due_date) {
      const dueDate = parseDateInput(data.due_date);
      if (!dueDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: futureDateMessage,
          path: ['due_date']
        });
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (dueDate < today) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: futureDateMessage,
            path: ['due_date']
          });
        }
      }
    }

    if (data.start_date) {
      const startDate = parseDateInput(data.start_date);
      if (!startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Informe uma data inicial válida.',
          path: ['start_date']
        });
      } else if (data.due_date) {
        const dueDate = parseDateInput(data.due_date);
        if (dueDate && startDate > dueDate) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'A data de início deve ser anterior ao prazo.',
            path: ['start_date']
          });
        }
      }
    }
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

function LabelColorOptions({
  selectedColorId,
  onSelect
}: {
  selectedColorId: LabelColorId;
  onSelect: (colorId: LabelColorId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {trelloPalette.map((option) => {
        const isSelected = selectedColorId === option.id;
        return (
          <button
            key={`palette-${option.id}`}
            type="button"
            onClick={() => onSelect(option.id)}
            className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/60 ${
              isSelected
                ? 'border-slate-900/70 dark:border-white'
                : 'border-transparent hover:border-slate-900/40 dark:hover:border-white/40'
            }`}
            style={{ backgroundColor: option.background }}
            aria-pressed={isSelected}
            aria-label={`Selecionar cor ${option.id}`}
          >
            {isSelected ? <span className="block h-2 w-2 rounded-full bg-white/90" /> : null}
          </button>
        );
      })}
    </div>
  );
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
  const [isLabelManagerOpen, setLabelManagerOpen] = useState(false);
  const [labelSearch, setLabelSearch] = useState('');
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState<LabelColorId>(trelloPalette[0].id);
  const [editingLabel, setEditingLabel] = useState<{
    id: string;
    value: string;
    colorId: LabelColorId;
  } | null>(null);
  const [calendarCursor, setCalendarCursor] = useState<CalendarCursor>(() => {
    const dueInput = task?.due_date ? task.due_date.slice(0, 10) : '';
    const startInput = task?.start_date ? task.start_date.slice(0, 10) : '';
    const dueDate = dueInput ? parseDateInput(dueInput) : null;
    const startDate = startInput ? parseDateInput(startInput) : null;
    const base = dueDate ?? startDate ?? new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });
  const [calendarTarget, setCalendarTarget] = useState<'due' | 'start'>(() =>
    task?.due_date ? 'due' : task?.start_date ? 'start' : 'due'
  );
  const [startDateEnabled, setStartDateEnabled] = useState(Boolean(task?.start_date));
  const [dueDateEnabled, setDueDateEnabled] = useState(Boolean(task?.due_date));
  const [descriptionDraft, setDescriptionDraft] = useState(task?.description ?? '');
  const [isDescriptionEditing, setDescriptionEditing] = useState(!task || !(task?.description?.trim()));
  const [descriptionDirty, setDescriptionDirty] = useState(false);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isEditingTask = Boolean(task);
  const [isAutoSaving, setAutoSaving] = useState(false);
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null);
  const autoSaveQueue = useRef(Promise.resolve());
  const mountedRef = useRef(true);
  const checklistSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTaskIdRef = useRef<string | null>(task?.id ?? null);
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    getValues,
    formState: { errors },
    watch
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      due_date: '',
      start_date: '',
      due_time: '',
      due_reminder: 'none',
      due_recurrence: 'never',
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
      labels: task ? 'task-labels-edit' : 'task-labels-new',
      labelManager: task ? 'task-label-manager-edit' : 'task-label-manager-new'
    }),
    [task]
  );

  const savedLabels = useTasksStore((state) => state.labelsLibrary);
  const registerLabels = useTasksStore((state) => state.registerLabels);
  const createLabelDefinition = useTasksStore((state) => state.createLabel);
  const updateLabelDefinition = useTasksStore((state) => state.updateLabel);
  const removeLabelDefinition = useTasksStore((state) => state.removeLabel);

  useEffect(() => {
    if (!task) {
      reset({
        title: '',
        description: '',
        due_date: '',
        start_date: '',
        due_time: '',
        due_reminder: 'none',
        due_recurrence: 'never',
        labels: '',
        status: 'todo',
        attachments: []
      });
      setChecklistItems([]);
      setNewChecklistText('');
      setDraggingChecklistId(null);
      setChecklistDropTarget(null);
      setStartDateEnabled(false);
      setDueDateEnabled(false);
      const today = new Date();
      setCalendarCursor({ year: today.getFullYear(), month: today.getMonth() });
      setCalendarTarget('due');
      return;
    }
    reset({
      title: task.title,
      description: task.description ?? '',
      due_date: task.due_date ? task.due_date.slice(0, 10) : '',
      start_date: task.start_date ? task.start_date.slice(0, 10) : '',
      due_time: toTimeInput(task.due_time),
      due_reminder: (task.due_reminder as DueReminderOption) ?? 'none',
      due_recurrence: (task.due_recurrence as DueRecurrenceOption) ?? 'never',
      labels: task.labels.join(', '),
      status: task.status,
      attachments: task.attachments
    });
    setChecklistItems(toChecklistEntries(task.checklist ?? []));
    setNewChecklistText('');
    setDraggingChecklistId(null);
    setChecklistDropTarget(null);
    setStartDateEnabled(Boolean(task.start_date));
    setDueDateEnabled(Boolean(task.due_date));
    const dueInput = task.due_date ? task.due_date.slice(0, 10) : '';
    const startInput = task.start_date ? task.start_date.slice(0, 10) : '';
    const dueDate = dueInput ? parseDateInput(dueInput) : null;
    const startDate = startInput ? parseDateInput(startInput) : null;
    const base = dueDate ?? startDate ?? new Date();
    setCalendarCursor({ year: base.getFullYear(), month: base.getMonth() });
    setCalendarTarget(task.due_date ? 'due' : task.start_date ? 'start' : 'due');
    if (task.labels.length > 0) {
      registerLabels(task.labels);
    }
  }, [task, reset, registerLabels]);

  useEffect(() => {
    setSubmitError(null);
  }, [task]);

  useEffect(() => {
    register('description');
  }, [register]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (checklistSaveTimeout.current) {
        clearTimeout(checklistSaveTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    const currentId = task?.id ?? null;
    if (lastTaskIdRef.current !== currentId) {
      lastTaskIdRef.current = currentId;
      setDescriptionDraft(task?.description ?? '');
      setDescriptionEditing(!task || !(task?.description && task.description.trim().length > 0));
      setDescriptionDirty(false);
      return;
    }

    if (!descriptionDirty && !isDescriptionEditing) {
      setDescriptionDraft(task?.description ?? '');
    }
  }, [task, descriptionDirty, isDescriptionEditing]);

  const sanitizedChecklist = useMemo(() => sanitizeChecklistItems(checklistItems), [checklistItems]);

  const attachments = watch('attachments') ?? [];
  const labelInput = watch('labels') ?? '';
  const startDateValue = watch('start_date') ?? '';
  const dueDateValue = watch('due_date') ?? '';
  const dueTimeValue = watch('due_time') ?? '';
  const dueReminderValue = (watch('due_reminder') as DueReminderOption | undefined) ?? 'none';
  const dueRecurrenceValue = (watch('due_recurrence') as DueRecurrenceOption | undefined) ?? 'never';
  const titleValue = watch('title') ?? '';
  const statusValue = watch('status') ?? 'todo';
  const calendarDays = useMemo(() => buildCalendarDays(calendarCursor), [calendarCursor]);
  const calendarHeading = useMemo(() => {
    const monthName = monthLabels[calendarCursor.month] ?? '';
    const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    return `${capitalized} ${calendarCursor.year}`;
  }, [calendarCursor]);
  const todayIso = useMemo(() => formatDateInput(new Date()), []);
  const startDateParsed = useMemo(() => parseDateInput(startDateValue), [startDateValue]);
  const dueDateParsed = useMemo(() => parseDateInput(dueDateValue), [dueDateValue]);
  const startTimestamp = startDateParsed?.getTime() ?? null;
  const dueTimestamp = dueDateParsed?.getTime() ?? null;
  const startDateField = register('start_date');
  const dueDateField = register('due_date');
  const dueTimeField = register('due_time');
  const reminderField = register('due_reminder');
  const recurrenceField = register('due_recurrence');
  const titleField = register('title');
  const statusField = register('status');
  const labelPreview = useMemo(() => parseLabels(labelInput), [labelInput]);
  const labelMap = useMemo(() => {
    const map = new Map<string, LabelDefinition>();
    savedLabels.forEach((definition) => {
      map.set(definition.normalized, definition);
    });
    return map;
  }, [savedLabels]);
  const selectedLabelKeys = useMemo(
    () => new Set(labelPreview.map((label) => label.toLocaleLowerCase())),
    [labelPreview]
  );
  const filteredLabels = useMemo(() => {
    const query = labelSearch.trim().toLocaleLowerCase();
    if (!query) {
      return savedLabels;
    }
    return savedLabels.filter((label) => label.value.toLocaleLowerCase().includes(query));
  }, [labelSearch, savedLabels]);
  const isCreateSubmitting = isCreatePending;

  const checklistCompleted = sanitizedChecklist.filter((item) => item.done).length;
  const checklistTotal = sanitizedChecklist.length;
  const checklistProgress = checklistTotal === 0 ? 0 : Math.round((checklistCompleted / checklistTotal) * 100);

  useEffect(() => {
    const dueDate = parseDateInput(dueDateValue);
    if (dueDate) {
      setCalendarCursor((prev) => {
        if (prev.year === dueDate.getFullYear() && prev.month === dueDate.getMonth()) {
          return prev;
        }
        return { year: dueDate.getFullYear(), month: dueDate.getMonth() };
      });
      return;
    }
    const startDate = parseDateInput(startDateValue);
    if (startDate) {
      setCalendarCursor((prev) => {
        if (prev.year === startDate.getFullYear() && prev.month === startDate.getMonth()) {
          return prev;
        }
        return { year: startDate.getFullYear(), month: startDate.getMonth() };
      });
    }
  }, [dueDateValue, startDateValue]);

  useEffect(() => {
    if (calendarTarget === 'start' && !startDateEnabled) {
      setCalendarTarget('due');
      return;
    }
    if (calendarTarget === 'due' && !dueDateEnabled && startDateEnabled) {
      setCalendarTarget('start');
    }
  }, [calendarTarget, startDateEnabled, dueDateEnabled]);

  const runAutoSave = useCallback(
    (updates: Partial<TaskPayload>) => {
      if (!task) return Promise.resolve();
      const entries = Object.entries(updates).filter(([, value]) => value !== undefined);
      if (entries.length === 0) {
        return Promise.resolve();
      }

      const payload: Partial<TaskPayload> = {};
      entries.forEach(([key, value]) => {
        if (key === 'due_time') {
          if (typeof value === 'string' && value.length > 0) {
            payload.due_time = normalizeDueTime(value) ?? null;
          } else {
            payload.due_time = (value ?? null) as string | null;
          }
          return;
        }
        (payload as Record<string, unknown>)[key] = value;
      });

      autoSaveQueue.current = autoSaveQueue.current
        .catch(() => undefined)
        .then(async () => {
          if (!mountedRef.current) return;
          setAutoSaving(true);
          setAutoSaveError(null);
          try {
            await updateTask({ id: task.id, payload });
          } catch (error) {
            if (!mountedRef.current) return;
            setAutoSaveError(
              error instanceof Error
                ? error.message
                : 'Não foi possível salvar automaticamente.'
            );
            throw error;
          } finally {
            if (mountedRef.current) {
              setAutoSaving(false);
            }
          }
        });

      return autoSaveQueue.current;
    },
    [task, updateTask]
  );

  const scheduleChecklistSave = useCallback(
    (items: ChecklistEntry[], immediate = false) => {
      if (!task) return;
      if (checklistSaveTimeout.current) {
        clearTimeout(checklistSaveTimeout.current);
        checklistSaveTimeout.current = null;
      }

      const payload = sanitizeChecklistItems(items);
      if (immediate) {
        runAutoSave({ checklist: payload });
        return;
      }

      checklistSaveTimeout.current = setTimeout(() => {
        runAutoSave({ checklist: payload });
      }, 600);
    },
    [task, runAutoSave]
  );

  const handleStartDateToggle = (enabled: boolean) => {
    setStartDateEnabled(enabled);
    if (!enabled) {
      setValue('start_date', '', { shouldDirty: true, shouldValidate: true });
      if (calendarTarget === 'start') {
        if (dueDateEnabled) {
          const dueDate = parseDateInput(dueDateValue);
          if (dueDate) {
            setCalendarCursor({ year: dueDate.getFullYear(), month: dueDate.getMonth() });
          }
        } else {
          const today = new Date();
          setCalendarCursor({ year: today.getFullYear(), month: today.getMonth() });
        }
        setCalendarTarget('due');
      }
      return;
    }

    if (!dueDateEnabled) {
      const startDate = parseDateInput(startDateValue) ?? new Date();
      setCalendarCursor({ year: startDate.getFullYear(), month: startDate.getMonth() });
      setCalendarTarget('start');
    }
  };

  const handleDueDateToggle = (enabled: boolean) => {
    setDueDateEnabled(enabled);
    if (!enabled) {
      setValue('due_date', '', { shouldDirty: true, shouldValidate: true });
      setValue('due_time', '', { shouldDirty: true, shouldValidate: true });
      setValue('due_reminder', 'none', { shouldDirty: true });
      setValue('due_recurrence', 'never', { shouldDirty: true });
      if (calendarTarget === 'due') {
        if (startDateEnabled) {
          const startDate = parseDateInput(startDateValue);
          if (startDate) {
            setCalendarCursor({ year: startDate.getFullYear(), month: startDate.getMonth() });
            setCalendarTarget('start');
            return;
          }
        }
        const today = new Date();
        setCalendarCursor({ year: today.getFullYear(), month: today.getMonth() });
        setCalendarTarget('due');
      }
      return;
    }

    const dueDate = parseDateInput(dueDateValue) ?? new Date();
    setCalendarCursor({ year: dueDate.getFullYear(), month: dueDate.getMonth() });
    setCalendarTarget('due');
  };

  const handleDueSave = async () => {
    if (!isEditingTask) {
      return;
    }

    const rawStart = startDateEnabled ? startDateValue.trim() : '';
    const rawDue = dueDateEnabled ? dueDateValue.trim() : '';
    const rawTime = dueDateEnabled ? dueTimeValue.trim() : '';
    const reminder = dueDateEnabled ? dueReminderValue : 'none';
    const recurrence = dueDateEnabled ? dueRecurrenceValue : 'never';

    await runAutoSave({
      start_date: rawStart || null,
      due_date: rawDue || null,
      due_time: rawTime || null,
      due_reminder: dueDateEnabled ? reminder : null,
      due_recurrence: dueDateEnabled ? recurrence : null
    });
  };

  const handleDueClear = () => {
    setStartDateEnabled(false);
    setDueDateEnabled(false);
    setValue('start_date', '', { shouldDirty: true });
    setValue('due_date', '', { shouldDirty: true });
    setValue('due_time', '', { shouldDirty: true });
    setValue('due_reminder', 'none', { shouldDirty: true });
    setValue('due_recurrence', 'never', { shouldDirty: true });
    const today = new Date();
    setCalendarCursor({ year: today.getFullYear(), month: today.getMonth() });
    setCalendarTarget('due');

    if (isEditingTask) {
      runAutoSave({
        start_date: null,
        due_date: null,
        due_time: null,
        due_reminder: null,
        due_recurrence: null
      });
    }
  };

  const shiftCalendarMonth = useCallback((offset: number) => {
    setCalendarCursor((prev) => {
      const base = new Date(prev.year, prev.month + offset, 1);
      return { year: base.getFullYear(), month: base.getMonth() };
    });
  }, []);

  const handleCalendarSelect = useCallback(
    (iso: string) => {
      const selectedDate = parseDateInput(iso);
      if (!selectedDate) {
        return;
      }

      if (calendarTarget === 'start') {
        if (!startDateEnabled) {
          setStartDateEnabled(true);
        }
        setValue('start_date', iso, { shouldDirty: true, shouldValidate: true });
        const dueDate = parseDateInput(dueDateValue);
        if (dueDate && selectedDate > dueDate) {
          if (!dueDateEnabled) {
            setDueDateEnabled(true);
          }
          setValue('due_date', iso, { shouldDirty: true, shouldValidate: true });
        }
        return;
      }

      if (!dueDateEnabled) {
        setDueDateEnabled(true);
      }
      setValue('due_date', iso, { shouldDirty: true, shouldValidate: true });
      const startDate = parseDateInput(startDateValue);
      if (startDate && startDate > selectedDate) {
        if (!startDateEnabled) {
          setStartDateEnabled(true);
        }
        setValue('start_date', iso, { shouldDirty: true, shouldValidate: true });
      }
    },
    [calendarTarget, dueDateEnabled, dueDateValue, setValue, startDateEnabled, startDateValue]
  );

  const updateDescriptionDraft = useCallback(
    (next: string) => {
      setDescriptionDraft(next);
      setDescriptionDirty(true);
      if (!isEditingTask) {
        setValue('description', next, { shouldDirty: true });
      }
    },
    [isEditingTask, setValue]
  );

  const handleDescriptionChange = useCallback(
    (event: ReactChangeEvent<HTMLTextAreaElement>) => {
      updateDescriptionDraft(event.target.value);
    },
    [updateDescriptionDraft]
  );

  const handleFormatting = useCallback(
    (command: FormatCommand) => {
      const textarea = descriptionTextareaRef.current;
      if (!textarea) return;

      const { selectionStart, selectionEnd, value } = textarea;
      const selected = value.slice(selectionStart, selectionEnd);
      const before = value.slice(0, selectionStart);
      const after = value.slice(selectionEnd);

      let insert = '';
      let cursorStart = selectionStart;
      let cursorEnd = selectionEnd;

      const wrap = (prefix: string, suffix: string, placeholder = 'texto') => {
        const content = selected || placeholder;
        insert = `${prefix}${content}${suffix}`;
        cursorStart = selectionStart + prefix.length;
        cursorEnd = cursorStart + content.length;
      };

      switch (command) {
        case 'bold':
          wrap('**', '**');
          break;
        case 'italic':
          wrap('_', '_');
          break;
        case 'underline':
          wrap('<u>', '</u>');
          break;
        case 'strike':
          wrap('~~', '~~');
          break;
        case 'code':
          wrap('`', '`');
          break;
        case 'codeblock': {
          const content = selected || 'código';
          insert = "\n\n```\n" + content + "\n```\n";
          cursorStart = selectionStart + 5;
          cursorEnd = cursorStart + content.length;
          break;
        }
        case 'link': {
          const text = selected || 'texto';
          const url = 'https://';
          insert = `[${text}](${url})`;
          cursorStart = selectionStart + text.length + 3;
          cursorEnd = cursorStart + url.length;
          break;
        }
        case 'bullet': {
          if (!selected) {
            insert = '- ';
            cursorStart = cursorEnd = selectionStart + insert.length;
          } else {
            insert = selected
              .split('\n')
              .map((line) => `- ${line}`)
              .join('\n');
            cursorStart = selectionStart;
            cursorEnd = selectionStart + insert.length;
          }
          break;
        }
        case 'number': {
          if (!selected) {
            insert = '1. ';
            cursorStart = cursorEnd = selectionStart + insert.length;
          } else {
            insert = selected
              .split('\n')
              .map((line, index) => `${index + 1}. ${line}`)
              .join('\n');
            cursorStart = selectionStart;
            cursorEnd = selectionStart + insert.length;
          }
          break;
        }
        case 'checklist': {
          if (!selected) {
            insert = '- [ ] ';
            cursorStart = cursorEnd = selectionStart + insert.length;
          } else {
            insert = selected
              .split('\n')
              .map((line) => `- [ ] ${line}`)
              .join('\n');
            cursorStart = selectionStart;
            cursorEnd = selectionStart + insert.length;
          }
          break;
        }
        case 'quote': {
          insert = selected
            ? selected
                .split('\n')
                .map((line) => `> ${line}`)
                .join('\n')
            : '> ';
          cursorStart = selected ? selectionStart : selectionStart + 2;
          cursorEnd = selected ? cursorStart + insert.length : cursorStart;
          break;
        }
        case 'divider': {
          insert = `${selected ? '' : '\n'}---\n`;
          cursorStart = cursorEnd = selectionStart + insert.length;
          break;
        }
        default:
          return;
      }

      const nextValue = `${before}${insert}${after}`;
      updateDescriptionDraft(nextValue);

      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(cursorStart, cursorEnd);
      });
    },
    [updateDescriptionDraft]
  );

  const handleDescriptionSave = useCallback(async () => {
    if (!isEditingTask) {
      return;
    }
    const normalized = descriptionDraft.trim().length > 0 ? descriptionDraft : '';
    try {
      await runAutoSave({ description: normalized });
      setDescriptionDraft(normalized);
      setDescriptionDirty(false);
      setDescriptionEditing(false);
    } catch (error) {
      // runAutoSave already surfaces the error via autoSaveError
    }
  }, [descriptionDraft, isEditingTask, runAutoSave]);

  const handleDescriptionCancel = useCallback(() => {
    if (!task) {
      setDescriptionDraft('');
      setValue('description', '', { shouldDirty: false });
      setDescriptionDirty(false);
      setDescriptionEditing(true);
      return;
    }
    setDescriptionDraft(task.description ?? '');
    setDescriptionDirty(false);
    setDescriptionEditing(false);
  }, [setValue, task]);

  const handleAddChecklistItem = () => {
    const trimmed = newChecklistText.trim();
    if (!trimmed) {
      return;
    }
    setChecklistItems((items) => {
      const next = [
        ...items,
        {
          clientId: generateChecklistId(),
          text: trimmed,
          done: false
        }
      ];
      if (isEditingTask) {
        scheduleChecklistSave(next);
      }
      return next;
    });
    setNewChecklistText('');
  };

  const handleChecklistToggle = (id: string, done: boolean) => {
    setChecklistItems((items) => {
      const next = items.map((item) => (item.clientId === id ? { ...item, done } : item));
      if (isEditingTask) {
        scheduleChecklistSave(next, true);
      }
      return next;
    });
  };

  const handleChecklistTextChange = (id: string, text: string) => {
    setChecklistItems((items) => {
      const next = items.map((item) => (item.clientId === id ? { ...item, text } : item));
      if (isEditingTask) {
        scheduleChecklistSave(next);
      }
      return next;
    });
  };

  const handleChecklistRemove = (id: string) => {
    setChecklistItems((items) => {
      const next = items.filter((item) => item.clientId !== id);
      if (isEditingTask) {
        scheduleChecklistSave(next, true);
      }
      return next;
    });
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
          if (isEditingTask) {
            scheduleChecklistSave(updated, true);
          }
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
        if (isEditingTask) {
          scheduleChecklistSave(updated, true);
        }
        return updated;
      });
    },
    [isEditingTask, scheduleChecklistSave]
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

  const updateLabelsField = useCallback(
    (labels: string[], persist = false) => {
      setValue('labels', labels.join(', '), { shouldDirty: true, shouldValidate: true });
      if (persist && isEditingTask) {
        runAutoSave({ labels });
      }
    },
    [isEditingTask, runAutoSave, setValue]
  );

  const applyLabel = useCallback(
    (label: string, persist = true) => {
      const normalized = label.toLocaleLowerCase();
      const current = parseLabels(labelInput);
      if (current.some((item) => item.toLocaleLowerCase() === normalized)) {
        return;
      }
      updateLabelsField([...current, label], persist);
    },
    [labelInput, updateLabelsField]
  );

  const handleLabelToggle = useCallback(
    (label: string) => {
      const normalized = label.toLocaleLowerCase();
      const current = parseLabels(labelInput);
      const exists = current.some((item) => item.toLocaleLowerCase() === normalized);
      const next = exists
        ? current.filter((item) => item.toLocaleLowerCase() !== normalized)
        : [...current, label];
      updateLabelsField(next, true);
    },
    [labelInput, updateLabelsField]
  );

  const handleCreateLabel = useCallback(
    (applyToTask: boolean) => {
      const trimmed = newLabelName.trim();
      if (!trimmed) {
        return;
      }
      createLabelDefinition(trimmed, newLabelColor);
      setNewLabelName('');
      setLabelSearch('');
      if (applyToTask) {
        applyLabel(trimmed);
      }
    },
    [applyLabel, createLabelDefinition, newLabelColor, newLabelName]
  );

  const handleStartEditingLabel = useCallback((definition: LabelDefinition) => {
    setEditingLabel({ id: definition.id, value: definition.value, colorId: definition.colorId });
  }, []);

  const handleLabelEditChange = useCallback((value: string) => {
    setEditingLabel((prev) => (prev ? { ...prev, value } : prev));
  }, []);

  const handleLabelEditColorChange = useCallback((colorId: LabelColorId) => {
    setEditingLabel((prev) => (prev ? { ...prev, colorId } : prev));
  }, []);

  const handleCancelLabelEdit = useCallback(() => {
    setEditingLabel(null);
  }, []);

  const handleSaveLabelEdit = useCallback(() => {
    if (!editingLabel) {
      return;
    }
    const trimmed = editingLabel.value.trim();
    if (!trimmed) {
      return;
    }
    const normalized = trimmed.toLocaleLowerCase();
    const duplicate = savedLabels.some(
      (item) => item.id !== editingLabel.id && item.normalized === normalized
    );
    if (duplicate) {
      return;
    }
    const currentDefinition = savedLabels.find((item) => item.id === editingLabel.id);
    updateLabelDefinition(editingLabel.id, { value: trimmed, colorId: editingLabel.colorId });
    setEditingLabel(null);
    if (currentDefinition && currentDefinition.value !== trimmed) {
      const current = parseLabels(labelInput);
      const next = current.map((label) =>
        label.toLocaleLowerCase() === currentDefinition.normalized ? trimmed : label
      );
      updateLabelsField(next, true);
    }
  }, [editingLabel, labelInput, savedLabels, updateLabelDefinition, updateLabelsField]);

  const handleDeleteLabel = useCallback(
    (definition: LabelDefinition) => {
      setEditingLabel((currentEditing) =>
        currentEditing?.id === definition.id ? null : currentEditing
      );
      removeLabelDefinition(definition.id);
      const current = parseLabels(labelInput);
      const next = current.filter((label) => label.toLocaleLowerCase() !== definition.normalized);
      if (next.length !== current.length) {
        updateLabelsField(next, true);
      }
    },
    [labelInput, removeLabelDefinition, updateLabelsField]
  );

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

  const updateLabelsField = useCallback(
    (labels: string[]) => {
      setValue('labels', labels.join(', '), { shouldDirty: true, shouldValidate: true });
    },
    [setValue]
  );

  const applyLabel = useCallback(
    (label: string) => {
      const normalized = label.toLocaleLowerCase();
      const current = parseLabels(labelInput);
      if (current.some((item) => item.toLocaleLowerCase() === normalized)) {
        return;
      }
      updateLabelsField([...current, label]);
    },
    [labelInput, updateLabelsField]
  );

  const handleLabelToggle = useCallback(
    (label: string) => {
      const normalized = label.toLocaleLowerCase();
      const current = parseLabels(labelInput);
      const exists = current.some((item) => item.toLocaleLowerCase() === normalized);
      const next = exists
        ? current.filter((item) => item.toLocaleLowerCase() !== normalized)
        : [...current, label];
      updateLabelsField(next);
    },
    [labelInput, updateLabelsField]
  );

  const handleCreateLabel = useCallback(
    (applyToTask: boolean) => {
      const trimmed = newLabelName.trim();
      if (!trimmed) {
        return;
      }
      createLabelDefinition(trimmed, newLabelColor);
      setNewLabelName('');
      setLabelSearch('');
      if (applyToTask) {
        applyLabel(trimmed);
      }
    },
    [applyLabel, createLabelDefinition, newLabelColor, newLabelName]
  );

  const handleStartEditingLabel = useCallback((definition: LabelDefinition) => {
    setEditingLabel({ id: definition.id, value: definition.value, colorId: definition.colorId });
  }, []);

  const handleLabelEditChange = useCallback((value: string) => {
    setEditingLabel((prev) => (prev ? { ...prev, value } : prev));
  }, []);

  const handleLabelEditColorChange = useCallback((colorId: LabelColorId) => {
    setEditingLabel((prev) => (prev ? { ...prev, colorId } : prev));
  }, []);

  const handleCancelLabelEdit = useCallback(() => {
    setEditingLabel(null);
  }, []);

  const handleSaveLabelEdit = useCallback(() => {
    if (!editingLabel) {
      return;
    }
    const trimmed = editingLabel.value.trim();
    if (!trimmed) {
      return;
    }
    const normalized = trimmed.toLocaleLowerCase();
    const duplicate = savedLabels.some(
      (item) => item.id !== editingLabel.id && item.normalized === normalized
    );
    if (duplicate) {
      return;
    }
    const currentDefinition = savedLabels.find((item) => item.id === editingLabel.id);
    updateLabelDefinition(editingLabel.id, { value: trimmed, colorId: editingLabel.colorId });
    setEditingLabel(null);
    if (currentDefinition && currentDefinition.value !== trimmed) {
      const current = parseLabels(labelInput);
      const next = current.map((label) =>
        label.toLocaleLowerCase() === currentDefinition.normalized ? trimmed : label
      );
      updateLabelsField(next);
    }
  }, [editingLabel, labelInput, savedLabels, updateLabelDefinition, updateLabelsField]);

  const handleDeleteLabel = useCallback(
    (definition: LabelDefinition) => {
      setEditingLabel((currentEditing) =>
        currentEditing?.id === definition.id ? null : currentEditing
      );
      removeLabelDefinition(definition.id);
      const current = parseLabels(labelInput);
      const next = current.filter((label) => label.toLocaleLowerCase() !== definition.normalized);
      if (next.length !== current.length) {
        updateLabelsField(next);
      }
    },
    [labelInput, removeLabelDefinition, updateLabelsField]
  );

  const onSubmit = handleSubmit(async (data) => {
    setSubmitError(null);
    const labels = parseLabels(data.labels);
    const descriptionValue = descriptionDraft.trim().length > 0 ? descriptionDraft : undefined;
    const startDateInput = data.start_date?.trim();
    const dueDateInput = data.due_date?.trim();
    const dueTimeInput = data.due_time?.trim();

    const startDatePayload = startDateInput
      ? startDateInput
      : task
        ? null
        : undefined;
    const dueDatePayload = dueDateInput
      ? dueDateInput
      : task
        ? null
        : undefined;
    const dueTimePayload = dueTimeInput
      ? normalizeDueTime(dueTimeInput)
      : task
        ? null
        : undefined;

    const reminderPayload = dueDateInput
      ? data.due_reminder ?? 'none'
      : task
        ? null
        : undefined;
    const recurrencePayload = dueDateInput
      ? data.due_recurrence ?? 'never'
      : task
        ? null
        : undefined;

    const payload: TaskPayload = {
      title: data.title,
      description: descriptionValue,
      status: data.status,
      labels,
      checklist: sanitizedChecklist,
      attachments
    };

    if (startDatePayload !== undefined) {
      payload.start_date = startDatePayload;
    }
    if (dueDatePayload !== undefined) {
      payload.due_date = dueDatePayload;
    }
    if (dueTimePayload !== undefined) {
      payload.due_time = dueTimePayload;
    }
    if (reminderPayload !== undefined) {
      payload.due_reminder = reminderPayload;
    }
    if (recurrencePayload !== undefined) {
      payload.due_recurrence = recurrencePayload;
    }

    try {
      if (task) {
        await updateTask({ id: task.id, payload });
      } else {
        await createTask(payload);
        setDescriptionDirty(false);
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
        <Input
          id={fieldIds.title}
          name={titleField.name}
          ref={titleField.ref}
          value={titleValue}
          onChange={(event) => setValue('title', event.target.value, { shouldDirty: true })}
          onBlur={(event) => {
            titleField.onBlur(event);
            const trimmed = event.target.value.trim();
            if (trimmed !== event.target.value) {
              setValue('title', trimmed, { shouldDirty: true });
            }
            if (isEditingTask && trimmed && trimmed !== (task?.title ?? '')) {
              runAutoSave({ title: trimmed });
            }
          }}
        />
        {errors.title && <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">{errors.title.message}</p>}
      </div>
      <section className="rounded-3xl border border-slate-200 bg-white/60 p-4 shadow-inner dark:border-white/10 dark:bg-white/5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Descrição</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Use Markdown para formatar detalhes, listas e destaques como no Trello.
            </p>
          </div>
          {isEditingTask && descriptionDirty ? (
            <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
              Alterações não salvas
            </span>
          ) : null}
        </div>
        {!isEditingTask || isDescriptionEditing ? (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleFormatting('bold')}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/15"
              >
                Negrito
              </button>
              <button
                type="button"
                onClick={() => handleFormatting('italic')}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/15"
              >
                Itálico
              </button>
              <button
                type="button"
                onClick={() => handleFormatting('underline')}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/15"
              >
                Sublinhado
              </button>
              <button
                type="button"
                onClick={() => handleFormatting('strike')}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/15"
              >
                Tachado
              </button>
              <button
                type="button"
                onClick={() => handleFormatting('code')}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/15"
              >
                Código
              </button>
              <button
                type="button"
                onClick={() => handleFormatting('codeblock')}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/15"
              >
                Bloco
              </button>
              <button
                type="button"
                onClick={() => handleFormatting('link')}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/15"
              >
                Link
              </button>
              <button
                type="button"
                onClick={() => handleFormatting('bullet')}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/15"
              >
                Lista
              </button>
              <button
                type="button"
                onClick={() => handleFormatting('number')}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/15"
              >
                Numerada
              </button>
              <button
                type="button"
                onClick={() => handleFormatting('checklist')}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/15"
              >
                Checklist
              </button>
              <button
                type="button"
                onClick={() => handleFormatting('quote')}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/15"
              >
                Citação
              </button>
              <button
                type="button"
                onClick={() => handleFormatting('divider')}
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/15"
              >
                Separador
              </button>
            </div>
            <Textarea
              id={fieldIds.description}
              ref={(element) => {
                descriptionTextareaRef.current = element;
              }}
              rows={8}
              value={descriptionDraft}
              onChange={handleDescriptionChange}
              placeholder="Descreva o contexto, critérios e próximos passos..."
              className="min-h-[8rem]"
            />
            <div className="flex flex-wrap gap-2">
              {isEditingTask ? (
                <>
                  <Button
                    type="button"
                    onClick={handleDescriptionSave}
                    disabled={isAutoSaving || !descriptionDirty}
                  >
                    Salvar
                  </Button>
                  <Button type="button" variant="secondary" onClick={handleDescriptionCancel}>
                    Descartar alterações
                  </Button>
                </>
              ) : null}
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.open(
                      'https://support.atlassian.com/trello/docs/format-your-text-with-markdown/',
                      '_blank'
                    );
                  }
                }}
              >
                Ajuda para formatação
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {descriptionDraft ? (
              <>
                <div className="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white/70 p-4 text-sm text-slate-700 shadow-inner dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                  {descriptionDraft}
                </div>
                <Button type="button" variant="secondary" onClick={() => setDescriptionEditing(true)}>
                  Editar descrição
                </Button>
              </>
            ) : (
              <Button type="button" variant="secondary" onClick={() => setDescriptionEditing(true)}>
                Adicionar uma descrição
              </Button>
            )}
          </div>
        )}
      </section>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white/60 p-4 shadow-inner dark:border-white/10 dark:bg-white/5">
          <header className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Datas</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Controle início, prazo, lembretes e recorrência como no Trello.
              </p>
            </div>
            {isEditingTask ? (
              <span
                className={`text-[11px] font-semibold uppercase tracking-wide ${
                  autoSaveError
                    ? 'text-rose-500 dark:text-rose-300'
                    : isAutoSaving
                      ? 'text-zenko-primary'
                      : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {autoSaveError ? 'Erro ao salvar' : isAutoSaving ? 'Salvando...' : 'Atualizado'}
              </span>
            ) : null}
          </header>
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-white/10">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => shiftCalendarMonth(-1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-lg text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/40 dark:text-slate-300 dark:hover:border-white/20 dark:hover:bg-white/10"
                  aria-label="Mês anterior"
                >
                  ‹
                </button>
                <div className="text-center">
                  <p className="text-sm font-semibold capitalize text-slate-700 dark:text-slate-200">{calendarHeading}</p>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Escolha um dia para aplicar ao card.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => shiftCalendarMonth(1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-lg text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/40 dark:text-slate-300 dark:hover:border-white/20 dark:hover:bg-white/10"
                  aria-label="Próximo mês"
                >
                  ›
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 rounded-full bg-slate-100/80 p-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-inner dark:bg-white/10 dark:text-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      handleDueDateToggle(true);
                      setCalendarTarget('due');
                    }}
                    className={`rounded-full px-3 py-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/40 ${
                      calendarTarget === 'due'
                        ? 'bg-white text-zenko-primary shadow-sm dark:bg-white/90 dark:text-slate-900'
                        : 'text-slate-600 hover:bg-white/70 dark:text-slate-200 dark:hover:bg-white/20'
                    }`}
                    aria-pressed={calendarTarget === 'due'}
                  >
                    Prazo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleStartDateToggle(true);
                      setCalendarTarget('start');
                    }}
                    className={`rounded-full px-3 py-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/40 ${
                      calendarTarget === 'start'
                        ? 'bg-white text-zenko-primary shadow-sm dark:bg-white/90 dark:text-slate-900'
                        : 'text-slate-600 hover:bg-white/70 dark:text-slate-200 dark:hover:bg-white/20'
                    }`}
                    aria-pressed={calendarTarget === 'start'}
                  >
                    Início
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    setCalendarCursor({ year: today.getFullYear(), month: today.getMonth() });
                  }}
                  className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/40 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/15"
                >
                  Hoje
                </button>
              </div>
              <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {weekDayLabels.map((label) => (
                  <span key={`weekday-${label}`} className="py-1">
                    {label}
                  </span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {calendarDays.map((day) => {
                  const isStart = Boolean(startDateValue) && day.iso === startDateValue;
                  const isDue = Boolean(dueDateValue) && day.iso === dueDateValue;
                  const isInRange =
                    startTimestamp !== null &&
                    dueTimestamp !== null &&
                    startTimestamp < dueTimestamp &&
                    day.timestamp > startTimestamp &&
                    day.timestamp < dueTimestamp;
                  const isToday = day.iso === todayIso;
                  const dayLabel = day.date.toLocaleDateString('pt-BR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    weekday: 'long'
                  });
                  const containerClasses = `relative flex items-center justify-center rounded-lg p-1 ${
                    isInRange && !isStart && !isDue ? 'bg-zenko-primary/10 dark:bg-zenko-primary/25' : ''
                  }`;
                  let buttonClasses =
                    'relative flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/40';
                  if (isDue) {
                    buttonClasses +=
                      ' bg-gradient-to-br from-zenko-primary to-zenko-secondary text-white shadow-lg shadow-zenko-primary/20';
                  } else if (isStart) {
                    buttonClasses +=
                      ' border-2 border-zenko-primary/70 bg-white text-zenko-primary dark:border-zenko-primary/50 dark:bg-slate-900/60 dark:text-zenko-primary/70';
                  } else if (!day.inCurrentMonth) {
                    buttonClasses += ' text-slate-400/80 dark:text-slate-500';
                  } else {
                    buttonClasses += ' text-slate-600 dark:text-slate-200';
                  }
                  if (isToday && !isDue && !isStart) {
                    buttonClasses += ' border border-zenko-primary/40';
                  }
                  return (
                    <div key={`${day.iso}-${day.inCurrentMonth ? 'current' : 'adjacent'}`} className={containerClasses}>
                      <button
                        type="button"
                        onClick={() => handleCalendarSelect(day.iso)}
                        className={buttonClasses}
                        aria-label={dayLabel}
                        aria-pressed={isStart || isDue}
                        aria-current={isToday ? 'date' : undefined}
                      >
                        {day.day}
                        {isDue ? (
                          <span className="absolute -bottom-2 text-[9px] font-semibold uppercase tracking-wide text-white/90">
                            Prazo
                          </span>
                        ) : null}
                        {isStart && !isDue ? (
                          <span className="absolute -bottom-2 text-[9px] font-semibold uppercase tracking-wide text-zenko-primary">
                            Início
                          </span>
                        ) : null}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-200">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-zenko-primary focus:ring-zenko-primary/50 dark:border-white/30"
                    checked={startDateEnabled}
                    onChange={(event) => handleStartDateToggle(event.target.checked)}
                  />
                  Data de início
                </label>
                <Input
                  id={`${fieldIds.dueDate}-start`}
                  name={startDateField.name}
                  ref={startDateField.ref}
                  onBlur={startDateField.onBlur}
                  type="date"
                  value={startDateValue}
                  onChange={(event) => setValue('start_date', event.target.value, { shouldDirty: true })}
                  disabled={!startDateEnabled}
                  aria-label="Data de início"
                />
                {errors.start_date ? (
                  <p className="text-xs text-rose-500 dark:text-rose-300">{errors.start_date.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-200">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-zenko-primary focus:ring-zenko-primary/50 dark:border-white/30"
                    checked={dueDateEnabled}
                    onChange={(event) => handleDueDateToggle(event.target.checked)}
                  />
                  Data de entrega
                </label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,0.6fr)]">
                  <Input
                    id={fieldIds.dueDate}
                    name={dueDateField.name}
                    ref={dueDateField.ref}
                    onBlur={dueDateField.onBlur}
                    type="date"
                    value={dueDateValue}
                    onChange={(event) => setValue('due_date', event.target.value, { shouldDirty: true })}
                    disabled={!dueDateEnabled}
                    aria-label="Data de entrega"
                  />
                  <Input
                    id={`${fieldIds.dueDate}-time`}
                    name={dueTimeField.name}
                    ref={dueTimeField.ref}
                    onBlur={dueTimeField.onBlur}
                    type="time"
                    value={dueTimeValue}
                    onChange={(event) => setValue('due_time', event.target.value, { shouldDirty: true })}
                    disabled={!dueDateEnabled}
                    aria-label="Horário de entrega"
                  />
                </div>
                {errors.due_date ? (
                  <p className="text-xs text-rose-500 dark:text-rose-300">{errors.due_date.message}</p>
                ) : null}
                {errors.due_time ? (
                  <p className="text-xs text-rose-500 dark:text-rose-300">{errors.due_time.message}</p>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Recorrência
                  </label>
                  <Select
                    id={`${fieldIds.dueDate}-recurrence`}
                    name={recurrenceField.name}
                    ref={recurrenceField.ref}
                    onBlur={recurrenceField.onBlur}
                    value={dueRecurrenceValue}
                    onChange={(event) => {
                      const value = event.target.value as DueRecurrenceOption;
                      setValue('due_recurrence', value, { shouldDirty: true });
                    }}
                    disabled={!dueDateEnabled}
                  >
                    {dueRecurrenceOptions.map((option) => (
                      <option key={option} value={option}>
                        {recurrenceLabels[option]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Definir lembrete
                  </label>
                  <Select
                    id={`${fieldIds.dueDate}-reminder`}
                    name={reminderField.name}
                    ref={reminderField.ref}
                    onBlur={reminderField.onBlur}
                    value={dueReminderValue}
                    onChange={(event) => {
                      const value = event.target.value as DueReminderOption;
                      setValue('due_reminder', value, { shouldDirty: true });
                    }}
                    disabled={!dueDateEnabled}
                  >
                    {dueReminderOptions.map((option) => (
                      <option key={option} value={option}>
                        {reminderLabels[option]}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={handleDueSave}
                  disabled={!isEditingTask || isAutoSaving}
                  className="bg-gradient-to-r from-zenko-primary to-zenko-secondary text-white hover:from-zenko-primary/90 hover:to-zenko-secondary/90"
                >
                  Salvar
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleDueClear}
                  disabled={(!startDateEnabled && !dueDateEnabled) || isAutoSaving}
                >
                  Remover
                </Button>
              </div>
            </div>
          </div>
        </section>
        <div>
          <label
            htmlFor={fieldIds.status}
            className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300"
          >
            Status
          </label>
          <Select
            id={fieldIds.status}
            name={statusField.name}
            ref={statusField.ref}
            value={statusValue}
            onBlur={statusField.onBlur}
            onChange={(event) => {
              const value = event.target.value as TaskStatus;
              setValue('status', value, { shouldDirty: true });
              if (isEditingTask && value !== (task?.status ?? 'todo')) {
                runAutoSave({ status: value });
              }
            }}
          >
            <option value="todo">A fazer</option>
            <option value="doing">Fazendo</option>
            <option value="done">Concluída</option>
          </Select>
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">
          Etiquetas
        </p>
        <input id={fieldIds.labels} type="hidden" {...register('labels')} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {labelPreview.length === 0 ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Nenhuma etiqueta selecionada.
            </span>
          ) : null}
          {labelPreview.map((label, index) => {
            const normalized = label.toLocaleLowerCase();
            const definition = labelMap.get(normalized);
            const colors = getLabelColors(label, {
              colorId: definition?.colorId,
              fallbackIndex: index
            });
            const displayValue = definition?.value ?? label;
            return (
              <span
                key={`${definition?.id ?? label}-${index}`}
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
                <span className="max-w-[8rem] truncate">{displayValue}</span>
                <button
                  type="button"
                  onClick={() => handleLabelToggle(displayValue)}
                  className="flex h-4 w-4 items-center justify-center rounded-full border text-xs leading-none transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                  style={{
                    color: colors.foreground,
                    borderColor: `${colors.foreground}55`,
                    backgroundColor: `${colors.foreground}1a`
                  }}
                >
                  <span aria-hidden>×</span>
                  <span className="sr-only">Remover etiqueta {displayValue}</span>
                </button>
              </span>
            );
          })}
          <button
            type="button"
            onClick={() => setLabelManagerOpen((open) => !open)}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-lg font-semibold text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/50 dark:border-white/10 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/20"
            aria-label={
              isLabelManagerOpen ? 'Fechar gerenciador de etiquetas' : 'Adicionar ou gerenciar etiquetas'
            }
            aria-expanded={isLabelManagerOpen}
            aria-controls={fieldIds.labelManager}
          >
            <span aria-hidden>+</span>
          </button>
        </div>
        {isLabelManagerOpen ? (
          <div
            id={fieldIds.labelManager}
            className="mt-3 space-y-4 rounded-2xl border border-slate-200 bg-white/60 p-4 shadow-inner dark:border-white/10 dark:bg-white/5"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Gerenciador de etiquetas
              </p>
              <button
                type="button"
                onClick={() => setLabelManagerOpen(false)}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/50 dark:border-white/10 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/20"
              >
                Fechar
              </button>
            </div>
            <div>
              <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500" htmlFor="task-label-search">
                Buscar etiquetas
              </label>
              <Input
                id="task-label-search"
                value={labelSearch}
                onChange={(event) => setLabelSearch(event.target.value)}
                placeholder="Digite para filtrar..."
              />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Nova etiqueta
              </p>
              <div className="mt-2 space-y-3">
                <Input
                  value={newLabelName}
                  onChange={(event) => setNewLabelName(event.target.value)}
                  placeholder="Nome da etiqueta"
                />
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Cor
                  </p>
                  <LabelColorOptions
                    selectedColorId={newLabelColor}
                    onSelect={(colorId) => setNewLabelColor(colorId)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!newLabelName.trim()}
                    onClick={() => handleCreateLabel(false)}
                  >
                    Criar
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!newLabelName.trim()}
                    onClick={() => handleCreateLabel(true)}
                  >
                    Criar e aplicar
                  </Button>
                </div>
              </div>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Etiquetas disponíveis
              </p>
              <ul className="mt-3 space-y-3">
                {filteredLabels.length === 0 ? (
                  <li className="text-xs text-slate-500 dark:text-slate-400">
                    Nenhuma etiqueta encontrada.
                  </li>
                ) : (
                  filteredLabels.map((label) => {
                    const colors = getLabelColors(label.value, { colorId: label.colorId });
                    const isApplied = selectedLabelKeys.has(label.normalized);
                    const isEditing = editingLabel?.id === label.id;
                    return (
                      <li
                        key={label.id}
                        className="rounded-2xl border border-slate-200 bg-white/60 p-3 shadow-sm dark:border-white/10 dark:bg-white/10"
                      >
                        {isEditing && editingLabel ? (
                          (() => {
                            const trimmedValue = editingLabel.value.trim();
                            const normalizedValue = trimmedValue.toLocaleLowerCase();
                            const hasDuplicate =
                              trimmedValue.length > 0 &&
                              savedLabels.some(
                                (item) => item.id !== editingLabel.id && item.normalized === normalizedValue
                              );
                            return (
                              <div className="space-y-3">
                                <Input
                                  value={editingLabel.value}
                                  onChange={(event) => handleLabelEditChange(event.target.value)}
                                />
                                <div className="space-y-2">
                                  <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                    Cor
                                  </p>
                                  <LabelColorOptions
                                    selectedColorId={editingLabel.colorId}
                                    onSelect={handleLabelEditColorChange}
                                  />
                                </div>
                                {trimmedValue.length === 0 ? (
                                  <p className="text-xs text-rose-500 dark:text-rose-300">
                                    Informe um nome para salvar a etiqueta.
                                  </p>
                                ) : null}
                                {hasDuplicate ? (
                                  <p className="text-xs text-rose-500 dark:text-rose-300">
                                    Já existe uma etiqueta com este nome.
                                  </p>
                                ) : null}
                                <div className="flex flex-wrap gap-2">
                                  <Button type="button" variant="secondary" onClick={handleCancelLabelEdit}>
                                    Cancelar
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={handleSaveLabelEdit}
                                    disabled={trimmedValue.length === 0 || hasDuplicate}
                                  >
                                    Salvar
                                  </Button>
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleLabelToggle(label.value)}
                              className={`inline-flex items-center gap-2 rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-wide transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/60 ${
                                isApplied ? 'ring-2 ring-zenko-primary/70' : ''
                              }`}
                              style={{
                                backgroundColor: colors.background,
                                color: colors.foreground
                              }}
                            >
                              <span
                                className="inline-block h-2 w-2 rounded-full"
                                style={{ backgroundColor: colors.foreground, opacity: 0.5 }}
                              />
                              {label.value}
                            </button>
                            <div className="ml-auto flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleStartEditingLabel(label)}
                                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/50 dark:border-white/10 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20 dark:hover:text-slate-100"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteLabel(label)}
                                className="rounded-full border border-transparent bg-rose-100 px-3 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/20"
                              >
                                Remover
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
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
      <AttachmentUploader
        attachments={attachments}
        onChange={(next) => {
          setValue('attachments', next, { shouldDirty: true });
          if (isEditingTask) {
            runAutoSave({ attachments: next });
          }
        }}
      />
      {submitError && (
        <p className="text-sm text-rose-600 dark:text-rose-300" role="alert">
          {submitError}
        </p>
      )}
      {autoSaveError && isEditingTask ? (
        <p className="text-sm text-rose-600 dark:text-rose-300" role="alert">
          {autoSaveError}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        {isEditingTask ? (
          <>
            <Button
              type="button"
              variant="secondary"
              className="border-none bg-gradient-to-r from-rose-500 to-red-500 text-white hover:from-rose-400 hover:to-red-400"
              onClick={handleDelete}
              disabled={isUpdatePending || isAutoSaving}
            >
              Excluir
            </Button>
            <Button type="button" onClick={onClose} disabled={isUpdatePending && !autoSaveError}>
              Fechar
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="secondary" onClick={onClose} disabled={isCreateSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isCreateSubmitting} disabled={isCreateSubmitting}>
              {isCreateSubmitting ? 'Salvando...' : 'Criar tarefa'}
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
