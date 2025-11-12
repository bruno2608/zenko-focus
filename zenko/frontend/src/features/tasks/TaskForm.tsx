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

function formatDisplayDateValue(value: string) {
  const date = parseDateInput(value);
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date);
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
  defaultStatus?: TaskStatus;
  getNextSortOrder?: (status: TaskStatus) => number;
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
  isUpdatePending,
  defaultStatus = 'todo',
  getNextSortOrder
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
  const [isDateEditorOpen, setDateEditorOpen] = useState(false);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const labelsSectionRef = useRef<HTMLDivElement | null>(null);
  const datesSectionRef = useRef<HTMLDivElement | null>(null);
  const descriptionSectionRef = useRef<HTMLDivElement | null>(null);
  const attachmentsSectionRef = useRef<HTMLDivElement | null>(null);
  const checklistSectionRef = useRef<HTMLDivElement | null>(null);
  const newChecklistInputRef = useRef<HTMLInputElement | null>(null);
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
      status: task?.status ?? defaultStatus,
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
        status: defaultStatus,
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
  }, [task, defaultStatus, reset, registerLabels]);

  useEffect(() => {
    if (!task) {
      setValue('status', defaultStatus);
    }
  }, [defaultStatus, setValue, task]);

  useEffect(() => {
    setSubmitError(null);
  }, [task]);

  useEffect(() => {
    register('description');
  }, [register]);

  useEffect(() => {
    if (errors.due_date || errors.due_time || errors.start_date) {
      setDateEditorOpen(true);
    }
  }, [errors.due_date, errors.due_time, errors.start_date]);

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
  const statusValue = (watch('status') ?? defaultStatus) as TaskStatus;
  const scrollToSection = useCallback((sectionRef: { current: HTMLElement | null }) => {
    const element = sectionRef.current;
    if (element && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);
  const focusChecklistInput = useCallback(() => {
    if (newChecklistInputRef.current) {
      newChecklistInputRef.current.focus();
    }
  }, []);
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
  const dueDateTimeTimestamp = useMemo(() => {
    if (!dueDateEnabled || !dueDateParsed) {
      return null;
    }
    const base = new Date(dueDateParsed);
    if (dueTimeValue) {
      const [hours, minutes] = dueTimeValue.split(':').map(Number);
      if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
        base.setHours(hours, minutes, 0, 0);
      }
    }
    return base.getTime();
  }, [dueDateEnabled, dueDateParsed, dueTimeValue]);
  const dueStatus = useMemo(() => {
    if (!dueDateTimeTimestamp) {
      return null;
    }
    const now = Date.now();
    if (dueDateTimeTimestamp < now) {
      return 'Atrasado';
    }
    if (dueDateTimeTimestamp - now <= 1000 * 60 * 60 * 24) {
      return 'Em breve';
    }
    return 'No prazo';
  }, [dueDateTimeTimestamp]);
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
  const filteredLabels = savedLabels;
  const isCreateSubmitting = isCreatePending;

  const checklistCompleted = sanitizedChecklist.filter((item) => item.done).length;
  const checklistTotal = sanitizedChecklist.length;
  const checklistProgress = checklistTotal === 0 ? 0 : Math.round((checklistCompleted / checklistTotal) * 100);
  const startDateSummary = useMemo(() => {
    if (!startDateEnabled || !startDateValue) {
      return null;
    }
    return formatDisplayDateValue(startDateValue);
  }, [startDateEnabled, startDateValue]);
  const dueDateSummary = useMemo(() => {
    if (!dueDateEnabled || !dueDateValue) {
      return null;
    }
    const formatted = formatDisplayDateValue(dueDateValue);
    if (!formatted) {
      return null;
    }
    return dueTimeValue ? `${formatted} às ${dueTimeValue}` : formatted;
  }, [dueDateEnabled, dueDateValue, dueTimeValue]);
  const dueReminderSummary = useMemo(() => {
    if (!dueDateEnabled || dueReminderValue === 'none') {
      return null;
    }
    return reminderLabels[dueReminderValue];
  }, [dueDateEnabled, dueReminderValue]);
  const dueRecurrenceSummary = useMemo(() => {
    if (!dueDateEnabled || dueRecurrenceValue === 'never') {
      return null;
    }
    return recurrenceLabels[dueRecurrenceValue];
  }, [dueDateEnabled, dueRecurrenceValue]);
  const hasDateSummary = Boolean(
    startDateSummary || dueDateSummary || dueReminderSummary || dueRecurrenceSummary
  );

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
    if (enabled) {
      setDateEditorOpen(true);
    }
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
    if (enabled) {
      setDateEditorOpen(true);
    }
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

  const formattingGroups = useMemo(
    () => [
      [
        {
          command: 'bold' as const,
          label: 'Negrito',
          icon: <span className="text-[15px] font-semibold leading-none">B</span>
        },
        {
          command: 'italic' as const,
          label: 'Itálico',
          icon: <span className="text-[15px] italic leading-none">I</span>
        },
        {
          command: 'underline' as const,
          label: 'Sublinhar',
          icon: <span className="text-[15px] underline decoration-2 underline-offset-2">U</span>
        },
        {
          command: 'strike' as const,
          label: 'Tachado',
          icon: <span className="text-[15px] leading-none line-through">S</span>
        }
      ],
      [
        {
          command: 'code' as const,
          label: 'Código inline',
          icon: (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <polyline points="8 7 4 12 8 17" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="16 7 20 12 16 17" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="11" y1="5" x2="13" y2="19" strokeLinecap="round" />
            </svg>
          )
        },
        {
          command: 'codeblock' as const,
          label: 'Bloco de código',
          icon: (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="4" y="6" width="16" height="12" rx="2" />
              <polyline points="9 10 7 12 9 14" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="15 10 17 12 15 14" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )
        },
        {
          command: 'link' as const,
          label: 'Link',
          icon: (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path
                d="M9.5 14.5l-1.5 1.5a3 3 0 104.24 4.24l1.64-1.64"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M14.5 9.5l1.5-1.5a3 3 0 10-4.24-4.24L10.12 5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <line x1="8.5" y1="15.5" x2="15.5" y2="8.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )
        }
      ],
      [
        {
          command: 'bullet' as const,
          label: 'Lista com marcadores',
          icon: (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="6" cy="7" r="1.4" fill="currentColor" stroke="none" />
              <circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none" />
              <circle cx="6" cy="17" r="1.4" fill="currentColor" stroke="none" />
              <line x1="10" y1="7" x2="19" y2="7" strokeLinecap="round" />
              <line x1="10" y1="12" x2="19" y2="12" strokeLinecap="round" />
              <line x1="10" y1="17" x2="19" y2="17" strokeLinecap="round" />
            </svg>
          )
        },
        {
          command: 'number' as const,
          label: 'Lista numerada',
          icon: (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <text x="4" y="8" fontSize="6" fontWeight="600" fill="currentColor">
                1
              </text>
              <text x="4" y="13" fontSize="6" fontWeight="600" fill="currentColor">
                2
              </text>
              <text x="4" y="18" fontSize="6" fontWeight="600" fill="currentColor">
                3
              </text>
              <line x1="10" y1="7" x2="19" y2="7" strokeLinecap="round" />
              <line x1="10" y1="12" x2="19" y2="12" strokeLinecap="round" />
              <line x1="10" y1="17" x2="19" y2="17" strokeLinecap="round" />
            </svg>
          )
        },
        {
          command: 'checklist' as const,
          label: 'Checklist',
          icon: (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="4" y="5" width="5" height="5" rx="1" />
              <polyline points="5.5 8 6.8 9.2 8.5 6.8" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="4" y="11" width="5" height="5" rx="1" />
              <rect x="4" y="17" width="5" height="5" rx="1" />
              <line x1="12" y1="7.5" x2="20" y2="7.5" strokeLinecap="round" />
              <line x1="12" y1="13.5" x2="20" y2="13.5" strokeLinecap="round" />
              <line x1="12" y1="19.5" x2="20" y2="19.5" strokeLinecap="round" />
            </svg>
          )
        },
        {
          command: 'quote' as const,
          label: 'Citação',
          icon: (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M9 7H7a3 3 0 00-3 3v3h4v-2H6v-1a1 1 0 011-1h2V7z" fill="currentColor" stroke="none" />
              <path d="M19 7h-2a3 3 0 00-3 3v3h4v-2h-2v-1a1 1 0 011-1h2V7z" fill="currentColor" stroke="none" />
            </svg>
          )
        },
        {
          command: 'divider' as const,
          label: 'Separador',
          icon: <span className="block h-[2px] w-6 rounded-full bg-current" />
        }
      ]
    ],
    []
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

    const resolvedSortOrder =
      typeof getNextSortOrder === 'function' ? getNextSortOrder(data.status) : undefined;

    if (!task && typeof resolvedSortOrder === 'number') {
      payload.sort_order = resolvedSortOrder;
    }
    if (task && data.status !== task.status && typeof resolvedSortOrder === 'number') {
      payload.sort_order = resolvedSortOrder;
    }

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
    <form className="space-y-5" onSubmit={onSubmit}>
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
            <input type="hidden" {...statusField} value={statusValue} />
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex-1 space-y-5">
          <section
            ref={labelsSectionRef}
            className="rounded-xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/40"
          >
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Etiquetas</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Use cores para sinalizar o contexto deste card.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLabelManagerOpen((open) => !open)}
                className="rounded-lg border border-slate-200/80 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/40 dark:border-white/20 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                aria-expanded={isLabelManagerOpen}
                aria-controls={fieldIds.labelManager}
              >
                {isLabelManagerOpen ? 'Fechar' : 'Gerenciar'}
              </button>
            </header>
            <input id={fieldIds.labels} type="hidden" {...register('labels')} />
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {labelPreview.length === 0 ? (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Nenhuma etiqueta aplicada.
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
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide shadow-sm"
                    style={{
                      backgroundColor: colors.background,
                      color: colors.foreground
                    }}
                  >
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: colors.foreground, opacity: 0.5 }}
                    />
                    <span className="max-w-[7rem] truncate">{displayValue}</span>
                    <button
                      type="button"
                      onClick={() => handleLabelToggle(displayValue)}
                      className="flex h-4 w-4 items-center justify-center rounded-full border text-[10px] leading-none transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
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
            </div>
            {isLabelManagerOpen ? (
              <div
                id={fieldIds.labelManager}
                className="mt-4 space-y-4 rounded-lg border border-slate-200/70 bg-white/70 p-3 shadow-inner dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Biblioteca de etiquetas
                  </p>
                  <button
                    type="button"
                    onClick={() => setLabelManagerOpen(false)}
                    className="rounded-md border border-slate-200/80 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/40 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                  >
                    Concluir
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Criar nova etiqueta</label>
                    <Input
                      value={newLabelName}
                      onChange={(event) => setNewLabelName(event.target.value)}
                      placeholder="Nome da etiqueta"
                    />
                    <div className="space-y-2">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Cor</p>
                      <LabelColorOptions selectedColorId={newLabelColor} onSelect={setNewLabelColor} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="secondary" onClick={() => handleCreateLabel(false)}>
                        Criar
                      </Button>
                      <Button type="button" onClick={() => handleCreateLabel(true)} disabled={!newLabelName.trim()}>
                        Criar e aplicar
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Etiquetas existentes</p>
                    <ul className="space-y-2">
                      {filteredLabels.length === 0 ? (
                        <li className="text-xs text-slate-500 dark:text-slate-400">
                          Você ainda não salvou etiquetas personalizadas.
                        </li>
                      ) : (
                        filteredLabels.map((label) => {
                          const colors = getLabelColors(label.value, {
                            colorId: label.colorId
                          });
                          const isApplied = selectedLabelKeys.has(label.normalized);
                          const isEditing = editingLabel?.id === label.id;
                          const trimmedValue = editingLabel?.value.trim() ?? '';
                          const hasDuplicate =
                            editingLabel && editingLabel.id === label.id
                              ? filteredLabels.some(
                                  (item) => item.id !== label.id && item.normalized === trimmedValue.toLocaleLowerCase()
                                )
                              : false;
                          return (
                            <li
                              key={label.id}
                              className="rounded-lg border border-slate-200/70 bg-white/80 p-2 dark:border-white/10 dark:bg-white/5"
                            >
                              {isEditing ? (
                                (() => {
                                  const colorsEdit = getLabelColors(editingLabel.value, {
                                    colorId: editingLabel.colorId
                                  });
                                  return (
                                    <div className="space-y-2">
                                      <Input
                                        value={editingLabel.value}
                                        onChange={(event) => handleLabelEditChange(event.target.value)}
                                      />
                                      <div className="space-y-1">
                                        <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
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
                                      <div
                                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide"
                                        style={{
                                          backgroundColor: colorsEdit.background,
                                          color: colorsEdit.foreground
                                        }}
                                      >
                                        <span
                                          className="inline-block h-1.5 w-1.5 rounded-full"
                                          style={{ backgroundColor: colorsEdit.foreground, opacity: 0.5 }}
                                        />
                                        {editingLabel.value || 'Pré-visualização'}
                                      </div>
                                    </div>
                                  );
                                })()
                              ) : (
                                <div className="flex flex-wrap items-center gap-2.5">
                                  <button
                                    type="button"
                                    onClick={() => handleLabelToggle(label.value)}
                                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/60 ${
                                      isApplied ? 'ring-2 ring-zenko-primary/70' : ''
                                    }`}
                                    style={{
                                      backgroundColor: colors.background,
                                      color: colors.foreground
                                    }}
                                  >
                                    <span
                                      className="inline-block h-1.5 w-1.5 rounded-full"
                                      style={{ backgroundColor: colors.foreground, opacity: 0.5 }}
                                    />
                                    {label.value}
                                  </button>
                                  <div className="ml-auto flex gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditingLabel(label)}
                                      className="rounded-full border border-slate-200/80 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/40 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-slate-100"
                                    >
                                      Editar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteLabel(label)}
                                      className="rounded-full border border-transparent bg-rose-100 px-2.5 py-1 text-[11px] font-medium text-rose-600 transition hover:bg-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/20"
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
              </div>
            ) : null}
          </section>
          <section
            ref={datesSectionRef}
            className="rounded-xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/40"
          >
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Datas</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Mantenha início, prazo, lembretes e recorrência organizados.
                </p>
                {isEditingTask ? (
                  <span
                    className={`mt-1 inline-flex text-[11px] font-semibold uppercase tracking-wide ${
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
              </div>
              <button
                type="button"
                onClick={() => {
                  setDateEditorOpen((open) => !open);
                  if (!isDateEditorOpen) {
                    scrollToSection(datesSectionRef);
                  }
                }}
                className="rounded-lg border border-slate-200/80 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/40 dark:border-white/20 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
              >
                {isDateEditorOpen ? 'Concluir' : 'Editar'}
              </button>
            </header>
            <div className="mt-3 flex flex-wrap gap-2">
              {startDateSummary ? (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100/80 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-white/10 dark:text-slate-200">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Início</span>
                  {startDateSummary}
                </span>
              ) : null}
              {dueDateSummary ? (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100/80 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-white/10 dark:text-slate-200">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Entrega</span>
                  {dueDateSummary}
                  {dueStatus ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        dueStatus === 'Atrasado'
                          ? 'bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-200'
                          : dueStatus === 'Em breve'
                            ? 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-200'
                            : 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200'
                      }`}
                    >
                      {dueStatus}
                    </span>
                  ) : null}
                </span>
              ) : null}
              {dueReminderSummary ? (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100/80 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-white/10 dark:text-slate-200">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Lembrete</span>
                  {dueReminderSummary}
                </span>
              ) : null}
              {dueRecurrenceSummary ? (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100/80 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-white/10 dark:text-slate-200">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">Recorrência</span>
                  {dueRecurrenceSummary}
                </span>
              ) : null}
              {!hasDateSummary ? (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Nenhuma data definida para este card.
                </span>
              ) : null}
            </div>
            {isDateEditorOpen ? (
              <div className="mt-4 space-y-4 border-t border-slate-200/70 pt-4 dark:border-white/10">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
                  <div className="rounded-lg border border-slate-200/70 bg-white/70 p-3 shadow-inner dark:border-white/10 dark:bg-white/5">
                    <div className="flex items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={() => shiftCalendarMonth(-1)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-transparent text-base text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/40 dark:text-slate-300 dark:hover:border-white/20 dark:hover:bg-white/10"
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
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-transparent text-base text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/40 dark:text-slate-300 dark:hover:border-white/20 dark:hover:bg-white/10"
                        aria-label="Próximo mês"
                      >
                        ›
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {weekDayLabels.map((weekday) => (
                        <span key={`weekday-${weekday}`}>{weekday}</span>
                      ))}
                    </div>
                    <div className="mt-1 grid grid-cols-7 gap-1 text-sm">
                      {calendarDays.map((day) => {
                        const isToday = day.iso === todayIso;
                        const isStart = startDateParsed && day.iso === formatDateInput(startDateParsed);
                        const isDue = dueDateParsed && day.iso === formatDateInput(dueDateParsed);
                        const isInRange = (() => {
                          if (startTimestamp === null || dueTimestamp === null) {
                            return false;
                          }
                          return day.timestamp >= startTimestamp && day.timestamp <= dueTimestamp;
                        })();
                        const dayLabel = day.date.toLocaleDateString('pt-BR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                          weekday: 'long'
                        });
                        const containerClasses = `relative flex items-center justify-center rounded-lg p-0.5 ${
                          isInRange && !isStart && !isDue ? 'bg-zenko-primary/10 dark:bg-zenko-primary/25' : ''
                        }`;
                        let buttonClasses =
                          'relative flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/40';
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
                                <span className="absolute -bottom-2 text-[8px] font-semibold uppercase tracking-wide text-white/90">
                                  Prazo
                                </span>
                              ) : null}
                              {isStart && !isDue ? (
                                <span className="absolute -bottom-2 text-[8px] font-semibold uppercase tracking-wide text-zenko-primary">
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
                        className="py-1.5 text-xs"
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
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(6rem,0.55fr)]">
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
                          className="py-1.5 text-xs"
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
                          className="py-1.5 text-xs"
                        />
                      </div>
                      {errors.due_date ? (
                        <p className="text-xs text-rose-500 dark:text-rose-300">{errors.due_date.message}</p>
                      ) : null}
                      {errors.due_time ? (
                        <p className="text-xs text-rose-500 dark:text-rose-300">{errors.due_time.message}</p>
                      ) : null}
                    </div>
                    <div className="grid gap-2.5 sm:grid-cols-2">
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
                          className="py-1.5 text-xs"
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
                          className="py-1.5 text-xs"
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
              </div>
            ) : null}
          </section>
          <section
            ref={descriptionSectionRef}
            className="rounded-xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/40"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Descrição</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Use Markdown para destacar detalhes como no Trello.
                </p>
              </div>
              {isEditingTask && descriptionDirty ? (
                <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                  Alterações não salvas
                </span>
              ) : null}
            </div>
            {!isEditingTask || isDescriptionEditing ? (
              <div className="mt-3 space-y-4">
                <div className="space-y-2">
                  {formattingGroups.map((group, groupIndex) => (
                    <div key={`format-group-${groupIndex}`} className="flex flex-wrap gap-2">
                      {group.map(({ command, label, icon }) => (
                        <button
                          key={command}
                          type="button"
                          onClick={() => handleFormatting(command)}
                          className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-zenko-primary/40 hover:text-zenko-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-zenko-primary/40 dark:hover:text-zenko-primary"
                          aria-label={label}
                          title={label}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  ))}
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
                {isEditingTask ? (
                  <div className="flex flex-wrap gap-2">
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
                  </div>
                ) : null}
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
          <section
            ref={attachmentsSectionRef}
            className="rounded-xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/40"
          >
            <AttachmentUploader
              attachments={attachments}
              onChange={(next) => {
                setValue('attachments', next, { shouldDirty: true });
                if (isEditingTask) {
                  runAutoSave({ attachments: next });
                }
              }}
            />
          </section>
          <section
            ref={checklistSectionRef}
            className="rounded-xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/40"
          >
            <header className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Checklist</p>
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
                ref={(element) => {
                  newChecklistInputRef.current = element;
                }}
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
        </div>
        <aside className="lg:w-64 space-y-4">
          <div className="rounded-xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/40">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Atalhos do card
            </p>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => {
                  scrollToSection(labelsSectionRef);
                  setLabelManagerOpen(true);
                }}
                className="flex w-full items-center justify-between rounded-lg bg-slate-100/80 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/40 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15"
              >
                <span>Etiquetas</span>
                <span aria-hidden>›</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDateEditorOpen(true);
                  scrollToSection(datesSectionRef);
                }}
                className="flex w-full items-center justify-between rounded-lg bg-slate-100/80 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/40 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15"
              >
                <span>Datas</span>
                <span aria-hidden>›</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  scrollToSection(descriptionSectionRef);
                  setDescriptionEditing(true);
                  setTimeout(() => {
                    descriptionTextareaRef.current?.focus();
                  }, 120);
                }}
                className="flex w-full items-center justify-between rounded-lg bg-slate-100/80 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/40 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15"
              >
                <span>Descrição</span>
                <span aria-hidden>›</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  scrollToSection(checklistSectionRef);
                  setTimeout(() => {
                    focusChecklistInput();
                  }, 120);
                }}
                className="flex w-full items-center justify-between rounded-lg bg-slate-100/80 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/40 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15"
              >
                <span>Checklist</span>
                <span aria-hidden>›</span>
              </button>
              <button
                type="button"
                onClick={() => scrollToSection(attachmentsSectionRef)}
                className="flex w-full items-center justify-between rounded-lg bg-slate-100/80 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/40 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15"
              >
                <span>Anexos</span>
                <span aria-hidden>›</span>
              </button>
            </div>
          </div>
        </aside>
      </div>
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
