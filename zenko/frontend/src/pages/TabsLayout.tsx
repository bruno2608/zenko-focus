import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

const tabs = [
  { to: '/', label: 'Tarefas' },
  { to: '/pomodoro', label: 'Pomodoro' },
  { to: '/reminders', label: 'Lembretes' },
  { to: '/dashboard', label: 'Dashboard' }
];

export default function TabsLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname === '') {
      navigate('/');
    }
  }, [location.pathname, navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-zenko-background text-white">
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <Outlet />
      </main>
      <nav className="sticky bottom-0 bg-zenko-surface border-t border-slate-700 grid grid-cols-4 text-sm">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end
            className={({ isActive }) =>
              `py-3 text-center ${isActive ? 'text-zenko-primary font-semibold' : 'text-slate-300'}`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
