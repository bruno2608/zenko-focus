import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Button from '../../components/ui/Button';
import { Reminder, ReminderPayload } from './types';

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
      remind_at: reminder.remind_at.slice(0, 16)
    });
  }, [reminder, reset]);

  const onSubmit = handleSubmit(async (data) => {
    const payload = {
      title: data.title,
      description: data.description,
      remind_at: new Date(data.remind_at).toISOString()
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
        <label className="text-sm">Título</label>
        <Input {...register('title')} />
        {errors.title && <p className="text-xs text-red-400">{errors.title.message}</p>}
      </div>
      <div>
        <label className="text-sm">Descrição</label>
        <Textarea rows={3} {...register('description')} />
      </div>
      <div>
        <label className="text-sm">Data e hora</label>
        <Input type="datetime-local" {...register('remind_at')} />
        {errors.remind_at && <p className="text-xs text-red-400">{errors.remind_at.message}</p>}
      </div>
      <div className="flex justify-end gap-2">
        {reminder && (
          <Button type="button" variant="secondary" className="!bg-red-500" onClick={handleDelete}>
            Excluir
          </Button>
        )}
        <Button type="submit">Salvar</Button>
      </div>
    </form>
  );
}
