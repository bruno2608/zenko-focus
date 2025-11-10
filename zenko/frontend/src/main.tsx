import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { supabase } from './lib/supabase';
import { initNotifications } from './lib/notifications';

const queryClient = new QueryClient();

declare global {
  interface Window {
    __ZENKO_BOOT_ERROR__?: string;
  }
}

const rootElement = document.getElementById('root') as HTMLElement;
const root = ReactDOM.createRoot(rootElement);

async function bootstrap() {
  try {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) {
      await supabase.auth.signInAnonymously();
    }
  } catch (error) {
    console.warn('Falha ao inicializar a autenticação anônima do Supabase.', error);
    window.__ZENKO_BOOT_ERROR__ =
      (error instanceof Error ? error.message : 'Falha ao conectar ao Supabase.') +
      ' Alguns recursos permanecerão limitados até a configuração correta.';
  }

  try {
    await initNotifications();
  } catch (error) {
    console.warn('Não foi possível inicializar as notificações.', error);
  }

  root.render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>
  );
}

bootstrap();
