import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import Router from './routes/Router';
import { ToastProvider, useToastStore } from './components/ui/ToastProvider';
import { ThemeProvider } from './components/ui/ThemeProvider';
import { isSupabaseConfigured } from './lib/supabase';

function App() {
  const showToast = useToastStore((state) => state.show);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      showToast({
        title: 'Configure o Supabase',
        description:
          'Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env para habilitar sincronização e autenticação.',
        type: 'info'
      });
    }
  }, [showToast]);

  return (
    <ThemeProvider>
      <ToastProvider>
        <RouterProvider router={Router} />
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
