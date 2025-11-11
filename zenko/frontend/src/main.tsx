import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { initNotifications } from './lib/notifications';
import { useConnectivityStore } from './store/connectivity';

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
