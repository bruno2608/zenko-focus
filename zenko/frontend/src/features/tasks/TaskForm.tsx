import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Input from '../../components/ui/Input';
import Textarea from '../../components/ui/Textarea';
import Button from '../../components/ui/Button';
import { useTasks } from './hooks';
import { Task } from './types';
import AttachmentUploader from './AttachmentUploader';

const schema = z.object({
  title: z.string().min(1, 'Título obrigatório'),
  description: z.string().optional(),
  due_date: z.string().optional(),
  labels: z.string().optional(),
  status: z.enum(['todo', 'doing', 'done']),
  checklist: z
    .string()
    .optional()
});

type FormData = z.infer<typeof schema> & { attachments?: { name: string; url: string }[] };

export default function TaskForm({ task, onClose }: { task?: Task; onClose: () => void }) {
  const { createTask, updateTask, deleteTask } = useTasks();
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

  const attachments = watch('attachments') ?? [];

  const onSubmit = handleSubmit(async (data) => {
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

    if (task) {
      await updateTask({ id: task.id, payload });
    } else {
      await createTask(payload);
    }
    onClose();
  });

  const handleDelete = async () => {
    if (!task) return;
    if (confirm('Deseja excluir esta tarefa?')) {
      await deleteTask(task.id);
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm">Prazo</label>
          <Input type="date" {...register('due_date')} />
        </div>
        <div>
          <label className="text-sm">Status</label>
          <select className="w-full rounded-md bg-zenko-surface px-3 py-2" {...register('status')}>
            <option value="todo">A fazer</option>
            <option value="doing">Fazendo</option>
            <option value="done">Concluída</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-sm">Etiquetas (separadas por vírgula)</label>
        <Input {...register('labels')} />
      </div>
      <div>
        <label className="text-sm">Checklist (uma linha por item, use [x] para concluído)</label>
        <Textarea rows={4} {...register('checklist')} />
      </div>
      <AttachmentUploader
        attachments={attachments}
        onChange={(next) => setValue('attachments', next)}
      />
      <div className="flex justify-end gap-2">
        {task && (
          <Button type="button" variant="secondary" className="!bg-red-500" onClick={handleDelete}>
            Excluir
          </Button>
        )}
        <Button type="submit">Salvar</Button>
      </div>
    </form>
  );
}
