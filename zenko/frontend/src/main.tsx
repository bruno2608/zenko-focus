import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { supabase } from './lib/supabase';
import { initNotifications } from './lib/notifications';

const queryClient = new QueryClient();

async function bootstrap() {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    await supabase.auth.signInAnonymously();
  }

  await initNotifications();

  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
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
