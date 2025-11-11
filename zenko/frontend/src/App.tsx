import { useEffect, useRef } from 'react';
import { RouterProvider } from 'react-router-dom';
import Router from './routes/Router';
import { ToastProvider, useToastStore } from './components/ui/ToastProvider';
import { ThemeProvider } from './components/ui/ThemeProvider';
import { useConnectivityStore } from './store/connectivity';

function App() {
  const showToast = useToastStore((state) => state.show);
  const { status, lastError } = useConnectivityStore((state) => state);
  const lastMessageRef = useRef<string | null>(null);

  useEffect(() => {
    if (status !== 'limited') {
      lastMessageRef.current = null;
      return;
    }

    const message =
      lastError ??
      'Sem conexão com o Supabase. Ajuste as credenciais ou tente novamente para habilitar a sincronização.';

    if (lastMessageRef.current === message) {
      return;
    }

    lastMessageRef.current = message;
    showToast({
      title: 'Conexão limitada',
      description: message,
      type: 'info'
    });
  }, [lastError, showToast, status]);

  return (
    <ThemeProvider>
      <ToastProvider>
        <RouterProvider router={Router} />
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
