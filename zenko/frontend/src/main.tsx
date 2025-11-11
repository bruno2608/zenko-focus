import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { initNotifications } from './lib/notifications';
import { useToastStore } from './components/ui/ToastProvider';

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
  if (isSupabaseConfigured) {
    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        await supabase.auth.signInAnonymously();
      }
    } catch (error) {
      console.warn('Falha ao inicializar a autenticação anônima do Supabase.', error);
      const message =
        (error instanceof Error ? error.message : 'Falha ao conectar ao Supabase.') +
        ' Alguns recursos permanecerão limitados até a configuração correta.';
      useToastStore.getState().show({
        title: 'Modo limitado',
        description: message,
        type: 'info'
      });
    }
  }

  try {
    await initNotifications();
  } catch (error) {
    console.warn('Não foi possível inicializar as notificações.', error);
  }
}

if (!isSupabaseConfigured) {
  console.info('Supabase não configurado. Inicializando em modo offline.');
}

bootstrap();
