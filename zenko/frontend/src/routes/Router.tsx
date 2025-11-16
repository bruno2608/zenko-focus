import { createBrowserRouter } from 'react-router-dom';
import TabsLayout from '../pages/TabsLayout';
import Kanban from '../features/tasks/Kanban';
import PomodoroTimer from '../features/pomodoro/PomodoroTimer';
import RemindersPage from '../features/reminders/RemindersPage';
import DashboardPage from '../features/dashboard/DashboardPage';
import ProfilePage from '../features/profile/ProfilePage';
import PreferencesPage from '../features/preferences/PreferencesPage';
import MindmapsDashboard from '../features/mindmaps';
import MindmapEditor from '../features/mindmaps/editor';

const router = createBrowserRouter([
  {
    path: '/',
    element: <TabsLayout />,
    children: [
      { index: true, element: <Kanban /> },
      { path: 'task/new', element: <Kanban /> },
      { path: 'task/:taskId', element: <Kanban /> },
      { path: 'pomodoro', element: <PomodoroTimer /> },
      { path: 'reminders', element: <RemindersPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'mindmaps', element: <MindmapsDashboard /> },
      { path: 'mindmaps/:id', element: <MindmapEditor /> },
      { path: 'perfil', element: <ProfilePage /> },
      { path: 'preferencias', element: <PreferencesPage /> }
    ]
  }
]);

export default router;
