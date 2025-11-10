import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import Router from './routes/Router';
import { ToastProvider, useToastStore } from './components/ui/ToastProvider';
import { isSupabaseConfigured } from './lib/supabase';

function App() {
  const showToast = useToastStore((state) => state.show);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.__ZENKO_BOOT_ERROR__) {
      showToast({
        title: 'Modo limitado',
        description: window.__ZENKO_BOOT_ERROR__,
        type: 'info'
      });
      delete window.__ZENKO_BOOT_ERROR__;
    } else if (!isSupabaseConfigured) {
      showToast({
        title: 'Configure o Supabase',
        description:
          'Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env para habilitar sincronização e autenticação.',
        type: 'info'
      });
    }
  }, [showToast]);

  return (
    <ToastProvider>
      <RouterProvider router={Router} />
    </ToastProvider>
  );
}

export default App;
