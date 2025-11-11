import { useEffect, useMemo } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const tabs = [
  {
    to: '/',
    label: 'Tarefas',
    icon: (
      <svg
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 6h8M5 12h5M5 18h8" />
        <path d="M15.5 5.5 18 8l3.5-3.5" />
      </svg>
    )
  },
  {
    to: '/pomodoro',
    label: 'Pomodoro',
    icon: (
      <svg
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 5c3.866 0 7 2.91 7 6.5S15.866 18 12 18s-7-2.91-7-6.5c0-1.19.4-2.308 1.09-3.25" />
        <path d="M9 3.5c1.2 1.4 2.6 2 5 2" />
        <path d="M12 10v3.5l2.5 1.5" />
      </svg>
    )
  },
  {
    to: '/reminders',
    label: 'Lembretes',
    icon: (
      <svg
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 9a6 6 0 0 1 12 0c0 5 2 7 2 7H4s2-2 2-7" />
        <path d="M10 20h4" />
      </svg>
    )
  },
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 19V9" />
        <path d="M10 19V5" />
        <path d="M16 19v-7" />
        <path d="M22 19V11" />
      </svg>
    )
  }
];

export default function TabsLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname === '') {
      navigate('/');
    }
  }, [location.pathname, navigate]);

  const todayLabel = useMemo(() => {
    const formatted = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-zenko-background text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-zenko-secondary/25 blur-[140px]" />
        <div className="absolute bottom-[-4rem] right-[-2rem] h-80 w-80 rounded-full bg-zenko-accent/20 blur-[160px]" />
      </div>
      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-28 pt-8 sm:px-6">
        <header className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.35em] text-zenko-muted">Zenko · Produtividade</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-white">Foco elegante para o seu dia</h1>
              <p className="text-sm text-slate-300">Organize tarefas, ciclos Pomodoro e lembretes em uma experiência única.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-medium text-slate-200 backdrop-blur">
              {todayLabel}
            </div>
          </div>
        </header>
        <main className="flex-1 space-y-6 overflow-y-auto pb-6">
          <Outlet />
        </main>
      </div>
      <nav className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-3xl border border-white/10 bg-slate-950/80 p-2 backdrop-blur">
        <div className="grid grid-cols-4 gap-2">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 rounded-2xl px-3 py-2 text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-zenko-primary/30 via-zenko-secondary/30 to-zenko-primary/30 text-white shadow-lg shadow-zenko-secondary/20'
                    : 'text-slate-400 hover:text-white'
                }`
              }
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-white/5 text-zenko-primary">
                {tab.icon}
              </span>
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
