import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { initNotifications } from './lib/notifications';
import { useConnectivityStore } from './store/connectivity';
import { flush } from './lib/offlineSync';

const queryClient = new QueryClient();

const rootElement = document.getElementById('root') as HTMLElement;
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);

let pendingFlush: Promise<void> | null = null;

async function synchronizeOfflineQueue() {
  if (pendingFlush) {
    return pendingFlush;
  }
  pendingFlush = (async () => {
    try {
      const result = await flush();
      const userId = result.userId;
      if (userId && result.applied.length > 0) {
        const appliedTables = new Set(result.applied.map((mutation) => mutation.table));
        if (appliedTables.has('tasks')) {
          queryClient.invalidateQueries({ queryKey: ['tasks', userId] });
          queryClient.invalidateQueries({ queryKey: ['dashboard', userId] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-status', userId] });
          queryClient.invalidateQueries({ queryKey: ['dashboard-done', userId] });
        }
        if (appliedTables.has('reminders')) {
          queryClient.invalidateQueries({ queryKey: ['reminders', userId] });
          queryClient.invalidateQueries({ queryKey: ['dashboard', userId] });
        }
        if (appliedTables.has('pomodoro_sessions')) {
          queryClient.invalidateQueries({ queryKey: ['dashboard', userId] });
        }
      }
      if (result.pending.length > 0) {
        useConnectivityStore
          .getState()
          .setStatus(
            'limited',
            'Não foi possível sincronizar todas as alterações offline. Tentaremos novamente em breve.'
          );
      }
    } catch (error) {
      console.warn('Erro ao sincronizar fila offline.', error);
      useConnectivityStore
        .getState()
        .setStatus('limited', 'Não foi possível sincronizar as alterações offline.');
    } finally {
      pendingFlush = null;
    }
  })();
  return pendingFlush;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useConnectivityStore.getState().setStatus('online');
    void synchronizeOfflineQueue();
  });
  window.addEventListener('offline', () => {
    useConnectivityStore
      .getState()
      .setStatus('limited', 'Sem conexão com a internet. As alterações serão sincronizadas depois.');
  });
  (window as any).__zenkoFlushOfflineQueue = synchronizeOfflineQueue;
}

async function bootstrap() {
  const setConnectivityStatus = useConnectivityStore.getState().setStatus;

  if (!isSupabaseConfigured) {
    setConnectivityStatus(
      'limited',
      'Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para conectar ao Supabase.'
    );
  } else {
    setConnectivityStatus('checking');
    try {
      const {
        data: { session },
        error
      } = await supabase.auth.getSession();

      if (error) throw error;

      if (!session) {
        const { error: signInError } = await supabase.auth.signInAnonymously();
        if (signInError) throw signInError;
      }

      setConnectivityStatus('online');
      await synchronizeOfflineQueue();
    } catch (error) {
      console.warn('Falha ao inicializar a autenticação anônima do Supabase.', error);
      const message = buildSupabaseErrorMessage(error);
      setConnectivityStatus('limited', message);
    }
  }

  try {
    await initNotifications();
  } catch (error) {
    console.warn('Não foi possível inicializar as notificações.', error);
  }
}

bootstrap();

function buildSupabaseErrorMessage(error: unknown) {
  const baseMessage =
    error instanceof Error && error.message
      ? error.message
      : 'Falha ao conectar ao Supabase.';

  return (
    baseMessage +
    ' Verifique se as credenciais estão corretas e se "Enable anonymous sign-ins" está ativo em Auth > Providers no Supabase.'
  );
}
