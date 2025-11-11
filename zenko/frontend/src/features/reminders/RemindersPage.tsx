import { useState } from 'react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import { useReminders } from './hooks';
import ReminderForm from './ReminderForm';
import { Reminder } from './types';
import OfflineNotice from '../../components/OfflineNotice';
import { isOfflineMode } from '../../lib/supabase';
import { useConnectivityStore } from '../../store/connectivity';

const toggleClass = (active: boolean) =>
  `flex-1 rounded-2xl px-4 py-2 text-sm font-medium transition ${
    active
      ? 'bg-gradient-to-r from-zenko-primary/10 via-zenko-secondary/10 to-zenko-primary/5 text-zenko-primary shadow-sm dark:from-zenko-primary/30 dark:via-zenko-secondary/30 dark:to-zenko-primary/20 dark:text-white dark:shadow-zenko-secondary/20'
      : 'text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
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
    createReminderIsPending,
    updateReminder,
    updateReminderIsPending,
    deleteReminder
  } = useReminders();
  const [selected, setSelected] = useState<Reminder | undefined>();
  const [open, setOpen] = useState(false);

  const status = useConnectivityStore((state) => state.status);
  const showOffline = status === 'limited' || isOfflineMode(userId);
  const list = view === 'upcoming' ? upcoming : past;

  return (
    <div className="space-y-6">
      {showOffline ? <OfflineNotice feature="Lembretes" /> : null}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Lembretes atentos</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">Configure alertas que chegam no horário certo.</p>
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
      <div className="flex items-center gap-2 rounded-3xl border border-slate-200 bg-white/80 p-2 backdrop-blur dark:border-white/10 dark:bg-white/5">
        <button type="button" className={toggleClass(view === 'upcoming')} onClick={() => setView('upcoming')}>
          Próximos
        </button>
        <button type="button" className={toggleClass(view === 'past')} onClick={() => setView('past')}>
          Passados
        </button>
      </div>
      {isLoading && <p className="text-sm text-slate-600 dark:text-slate-300">Carregando...</p>}
      <div className="space-y-3">
        {list.map((reminder) => (
          <Card
            key={reminder.id}
            className="border-slate-200/80 bg-white/90 transition hover:-translate-y-0.5 hover:border-zenko-primary/40 dark:border-white/5 dark:bg-slate-900/60"
          >
            <button
              className="w-full text-left"
              onClick={() => {
                setSelected(reminder);
                setOpen(true);
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">{reminder.title}</h3>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    reminder.sent
                      ? 'bg-emerald-200/60 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-200'
                      : 'bg-zenko-primary/10 text-zenko-primary dark:bg-zenko-primary/15'
                  }`}
                >
                  {reminder.sent ? 'Enviado' : 'Pendente'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{new Date(reminder.remind_at).toLocaleString('pt-BR')}</p>
              {reminder.description && <p className="mt-3 text-sm text-slate-600 dark:text-slate-200">{reminder.description}</p>}
            </button>
          </Card>
        ))}
        {list.length === 0 && (
          <p className="rounded-3xl border border-dashed border-slate-200 bg-white/70 px-6 py-8 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
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
          isCreatePending={createReminderIsPending}
          isUpdatePending={updateReminderIsPending}
        />
      </Modal>
    </div>
  );
}
