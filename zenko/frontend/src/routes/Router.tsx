import { createBrowserRouter } from 'react-router-dom';
import TabsLayout from '../pages/TabsLayout';
import Kanban from '../features/tasks/Kanban';
import PomodoroTimer from '../features/pomodoro/PomodoroTimer';
import RemindersPage from '../features/reminders/RemindersPage';
import DashboardPage from '../features/dashboard/DashboardPage';
import ProfilePage from '../features/profile/ProfilePage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <TabsLayout />,
    children: [
      { index: true, element: <Kanban /> },
      { path: 'pomodoro', element: <PomodoroTimer /> },
      { path: 'reminders', element: <RemindersPage /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'perfil', element: <ProfilePage /> }
    ]
  }
]);

export default router;
