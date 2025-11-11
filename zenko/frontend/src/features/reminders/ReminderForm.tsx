import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Button from '../../components/ui/Button';
import { Reminder, ReminderPayload } from './types';
import { toDatetimeLocal } from '../../lib/datetime';

const schema = z.object({
  title: z.string().min(1, 'Informe um título'),
  description: z.string().optional(),
  remind_at: z.string().min(1, 'Informe data e hora')
});

type FormValues = z.infer<typeof schema>;

interface Props {
  reminder?: Reminder;
  onClose: () => void;
  onCreate: (payload: ReminderPayload) => Promise<unknown>;
  onUpdate: (input: { id: string; payload: Partial<ReminderPayload> }) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  isCreatePending: boolean;
  isUpdatePending: boolean;
}

export default function ReminderForm({
  reminder,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
  isCreatePending,
  isUpdatePending
}: Props) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      remind_at: ''
    }
  });

  const fieldIds = useMemo(
    () => ({
      title: reminder ? 'reminder-title-edit' : 'reminder-title-new',
      description: reminder ? 'reminder-description-edit' : 'reminder-description-new',
      remindAt: reminder ? 'reminder-remind-at-edit' : 'reminder-remind-at-new'
    }),
    [reminder]
  );

  useEffect(() => {
    if (!reminder) return;
    reset({
      title: reminder.title,
      description: reminder.description ?? '',
      remind_at: toDatetimeLocal(reminder.remind_at)
    });
  }, [reminder, reset]);

  useEffect(() => {
    setSubmitError(null);
  }, [reminder]);

  const isSaving = reminder ? isUpdatePending : isCreatePending;

  const onSubmit = handleSubmit(async (data) => {
    setSubmitError(null);
    const payload = {
      title: data.title,
      description: data.description,
      remind_at: new Date(data.remind_at).toISOString()
    };
    try {
      if (reminder) {
        await onUpdate({ id: reminder.id, payload });
      } else {
        await onCreate(payload);
      }
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Não foi possível salvar o lembrete.');
    }
  });

  const handleDelete = async () => {
    if (!reminder) return;
    if (confirm('Excluir lembrete?')) {
      try {
        await onDelete(reminder.id);
        onClose();
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'Não foi possível remover o lembrete.');
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
      <div>
        <label
          htmlFor={fieldIds.remindAt}
          className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300"
        >
          Data e hora
        </label>
        <Input id={fieldIds.remindAt} type="datetime-local" {...register('remind_at')} />
        {errors.remind_at && <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">{errors.remind_at.message}</p>}
      </div>
      {submitError && (
        <p className="text-sm text-rose-600 dark:text-rose-300" role="alert">
          {submitError}
        </p>
      )}
      <div className="flex justify-end gap-2">
        {reminder && (
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
