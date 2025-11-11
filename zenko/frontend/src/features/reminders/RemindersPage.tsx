import { useState } from 'react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import { useReminders } from './hooks';
import ReminderForm from './ReminderForm';
import { Reminder } from './types';
import OfflineNotice from '../../components/OfflineNotice';
import { OFFLINE_USER_ID, isSupabaseConfigured } from '../../lib/supabase';

const toggleClass = (active: boolean) =>
  `flex-1 rounded-2xl px-4 py-2 text-sm font-medium transition ${
    active
      ? 'bg-gradient-to-r from-zenko-primary/30 via-zenko-secondary/30 to-zenko-primary/20 text-white shadow-lg shadow-zenko-secondary/20'
      : 'text-slate-300 hover:text-white'
  }`;

export default function RemindersPage() {
  const {
    userId,
    upcoming,
    past,
    view,
    setView,
    isLoading,
    createReminder,
    updateReminder,
    deleteReminder
  } = useReminders();
  const [selected, setSelected] = useState<Reminder | undefined>();
  const [open, setOpen] = useState(false);

  const list = view === 'upcoming' ? upcoming : past;

  return (
    <div className="space-y-6">
      {!isSupabaseConfigured || userId === OFFLINE_USER_ID ? <OfflineNotice feature="Lembretes" /> : null}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Lembretes atentos</h2>
          <p className="text-sm text-slate-300">Configure alertas que chegam no horário certo.</p>
        </div>
        <Button
          onClick={() => {
            setSelected(undefined);
            setOpen(true);
          }}
        >
          Novo lembrete
        </Button>
      </header>
      <div className="flex items-center gap-2 rounded-3xl border border-white/10 bg-white/5 p-2 backdrop-blur">
        <button type="button" className={toggleClass(view === 'upcoming')} onClick={() => setView('upcoming')}>
          Próximos
        </button>
        <button type="button" className={toggleClass(view === 'past')} onClick={() => setView('past')}>
          Passados
        </button>
      </div>
      {isLoading && <p className="text-sm text-slate-300">Carregando...</p>}
      <div className="space-y-3">
        {list.map((reminder) => (
          <Card
            key={reminder.id}
            className="border-white/5 bg-slate-900/60 transition hover:-translate-y-0.5 hover:border-zenko-primary/40"
          >
            <button
              className="w-full text-left"
              onClick={() => {
                setSelected(reminder);
                setOpen(true);
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-white">{reminder.title}</h3>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    reminder.sent ? 'bg-emerald-400/20 text-emerald-300' : 'bg-zenko-primary/15 text-zenko-primary'
                  }`}
                >
                  {reminder.sent ? 'Enviado' : 'Pendente'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-300">{new Date(reminder.remind_at).toLocaleString('pt-BR')}</p>
              {reminder.description && <p className="mt-3 text-sm text-slate-200">{reminder.description}</p>}
            </button>
          </Card>
        ))}
        {list.length === 0 && (
          <p className="rounded-3xl border border-dashed border-white/10 bg-white/5 px-6 py-8 text-center text-sm text-slate-400">
            Nenhum lembrete nesta lista ainda.
          </p>
        )}
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
