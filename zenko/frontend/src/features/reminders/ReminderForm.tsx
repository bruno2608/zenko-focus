import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Button from '../../components/ui/Button';
import { Reminder, ReminderPayload } from './types';
import { toDatetimeLocal } from '../../lib/datetime';

const futureDateMessage = 'Use uma data a partir de hoje';

const schema = z.object({
  title: z.string().min(1, 'Informe um título'),
  description: z.string().optional(),
  remind_at: z
    .string()
    .min(1, 'Informe data e hora')
    .superRefine((value, ctx) => {
      if (!value) return;
      const result = z.coerce.date().safeParse(value);
      if (!result.success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: futureDateMessage });
        return;
      }
      if (result.data < new Date()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: futureDateMessage });
      }
    })
});

type FormValues = z.infer<typeof schema>;

interface Props {
  reminder?: Reminder;
  onClose: () => void;
  onCreate: (payload: ReminderPayload) => Promise<unknown>;
  onUpdate: (input: { id: string; payload: Partial<ReminderPayload> }) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}

export default function ReminderForm({ reminder, onClose, onCreate, onUpdate, onDelete }: Props) {
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

  useEffect(() => {
    if (!reminder) return;
    reset({
      title: reminder.title,
      description: reminder.description ?? '',
      remind_at: toDatetimeLocal(reminder.remind_at)
    });
  }, [reminder, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const description = data.description ? data.description : undefined;
    const remindAtResult = z.coerce.date().safeParse(data.remind_at);
    if (!remindAtResult.success) {
      return;
    }
    const payload = {
      title: data.title,
      description,
      remind_at: remindAtResult.data.toISOString()
    };
    if (reminder) {
      await onUpdate({ id: reminder.id, payload });
    } else {
      await onCreate(payload);
    }
    onClose();
  });

  const handleDelete = async () => {
    if (!reminder) return;
    if (confirm('Excluir lembrete?')) {
      await onDelete(reminder.id);
      onClose();
    }
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div>
        <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Título</label>
        <Input {...register('title')} />
        {errors.title && <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">{errors.title.message}</p>}
      </div>
      <div>
        <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Descrição</label>
        <Textarea rows={3} {...register('description', { setValueAs: (value) => (value === '' ? undefined : value) })} />
      </div>
      <div>
        <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500 dark:text-slate-300">Data e hora</label>
        <Input type="datetime-local" {...register('remind_at')} />
        {errors.remind_at && <p className="mt-1 text-xs text-rose-600 dark:text-rose-300">{errors.remind_at.message}</p>}
      </div>
      <div className="flex justify-end gap-2">
        {reminder && (
          <Button
            type="button"
            variant="secondary"
            className="border-none bg-gradient-to-r from-rose-500 to-red-500 text-white hover:from-rose-400 hover:to-red-400"
            onClick={handleDelete}
          >
            Excluir
          </Button>
        )}
        <Button type="submit">Salvar</Button>
      </div>
    </form>
  );
}
