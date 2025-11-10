import { RouterProvider } from 'react-router-dom';
import Router from './routes/Router';
import { ToastProvider } from './components/ui/ToastProvider';

function App() {
  return (
    <ToastProvider>
      <RouterProvider router={Router} />
    </ToastProvider>
  );
}

export default App;
