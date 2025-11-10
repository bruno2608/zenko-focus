import { useState } from 'react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import { useReminders } from './hooks';
import ReminderForm from './ReminderForm';
import { Reminder } from './types';

export default function RemindersPage() {
  const { upcoming, past, view, setView, isLoading, createReminder, updateReminder, deleteReminder } = useReminders();
  const [selected, setSelected] = useState<Reminder | undefined>();
  const [open, setOpen] = useState(false);

  const list = view === 'upcoming' ? upcoming : past;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Lembretes</h1>
        <Button
          onClick={() => {
            setSelected(undefined);
            setOpen(true);
          }}
        >
          Novo lembrete
        </Button>
      </header>
      <div className="flex gap-2 text-xs">
        <Button
          variant={view === 'upcoming' ? 'primary' : 'secondary'}
          className="px-3 py-1"
          onClick={() => setView('upcoming')}
        >
          Próximos
        </Button>
        <Button variant={view === 'past' ? 'primary' : 'secondary'} className="px-3 py-1" onClick={() => setView('past')}>
          Passados
        </Button>
      </div>
      {isLoading && <p>Carregando...</p>}
      <div className="space-y-3">
        {list.map((reminder) => (
          <Card key={reminder.id}>
            <button
              className="w-full text-left"
              onClick={() => {
                setSelected(reminder);
                setOpen(true);
              }}
            >
              <h3 className="font-semibold">{reminder.title}</h3>
              <p className="text-xs text-slate-300">
                {new Date(reminder.remind_at).toLocaleString('pt-BR')} • {reminder.sent ? 'Enviado' : 'Pendente'}
              </p>
              {reminder.description && <p className="mt-1 text-sm text-slate-200">{reminder.description}</p>}
            </button>
          </Card>
        ))}
        {list.length === 0 && <p className="text-sm text-slate-400">Nenhum lembrete nesta lista.</p>}
      </div>
      <Modal title={selected ? 'Editar lembrete' : 'Novo lembrete'} open={open} onClose={() => setOpen(false)}>
        <ReminderForm
          reminder={selected}
          onClose={() => setOpen(false)}
          onCreate={createReminder}
          onUpdate={updateReminder}
          onDelete={deleteReminder}
        />
      </Modal>
    </div>
  );
}
