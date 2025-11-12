import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ui/ThemeToggle';
import OnboardingDialog from '../features/profile/OnboardingDialog';
import { useProfile } from '../features/profile/hooks';
import NotificationBanner from '../components/NotificationBanner';

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
  },
  {
    to: '/perfil',
    label: 'Perfil',
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
        <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Z" />
        <path d="M19 21a7 7 0 0 0-14 0" />
      </svg>
    )
  },
  {
    to: '/preferencias',
    label: 'Preferências',
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
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
      </svg>
    )
  }
];

export default function TabsLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, isLoading: profileLoading, isSaving: profileSaving, updateProfile } = useProfile();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (location.pathname === '') {
      navigate('/');
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (!profileLoading && profile && !profile.full_name) {
      setShowOnboarding(true);
    }
  }, [profileLoading, profile]);

  const greetingTitle = profile?.full_name
    ? `Olá, ${profile.full_name.split(' ')[0]}!`
    : 'Foco elegante para o seu dia';
  const greetingSubtitle = profile?.focus_area
    ? `Vamos conquistar resultados em ${profile.focus_area}.`
    : 'Organize tarefas, ciclos Pomodoro e lembretes em uma experiência única.';

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-100 text-slate-900 transition-colors dark:bg-zenko-background dark:text-slate-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 hidden h-72 w-72 -translate-x-1/2 rounded-full bg-zenko-secondary/25 blur-[140px] dark:block" />
        <div className="absolute bottom-[-4rem] right-[-2rem] hidden h-80 w-80 rounded-full bg-zenko-accent/20 blur-[160px] dark:block" />
        <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-white/60 via-white/40 to-transparent dark:hidden" />
      </div>
      <div className="relative mx-auto flex min-h-screen w-full max-w-screen-2xl flex-col gap-6 px-4 pb-[calc(4rem+env(safe-area-inset-bottom))] pt-[calc(2rem+env(safe-area-inset-top))] sm:px-6 xl:max-w-[90rem] xl:px-12 xl:pb-16 xl:pt-12">
        <header className="flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur shadow-[0_20px_45px_-20px_rgba(15,23,42,0.15)] transition-[grid-template-columns] dark:border-white/10 dark:bg-white/5 xl:grid xl:grid-cols-[auto,1fr,auto] xl:items-center xl:gap-6">
          <div className="flex flex-1 items-center gap-3 xl:flex-none">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white/80 text-slate-700 transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-zenko-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-white/10 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15 dark:focus-visible:ring-offset-slate-900 xl:hidden"
              aria-label="Abrir menu de navegação"
              aria-expanded={mobileMenuOpen}
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 7h16" />
                <path d="M4 12h16" />
                <path d="M4 17h16" />
              </svg>
            </button>
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-slate-500 dark:text-zenko-muted">Zenko</p>
              <p className="text-base font-semibold text-slate-900 dark:text-white">Produtividade unificada</p>
            </div>
          </div>
          <nav className="order-last hidden w-full flex-wrap justify-center gap-2 xl:order-none xl:flex xl:w-full xl:flex-nowrap xl:items-center xl:justify-center xl:gap-3">
            {tabs.map((tab) => (
              <NavLink
                key={`top-${tab.to}`}
                to={tab.to}
                end={tab.to === '/'}
                className={({ isActive }) =>
                  `group inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium transition-all ${
                    isActive
                      ? 'border-zenko-primary/60 bg-gradient-to-r from-zenko-primary/15 via-zenko-secondary/20 to-zenko-primary/15 text-zenko-primary dark:border-zenko-primary/50 dark:text-white'
                      : 'border-transparent bg-white/60 text-slate-500 hover:border-zenko-primary/40 hover:bg-white/80 hover:text-slate-900 dark:bg-white/10 dark:text-slate-300 dark:hover:border-white/20 dark:hover:bg-white/15 dark:hover:text-white'
                  }`
                }
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zenko-primary/10 text-zenko-primary transition dark:bg-white/10 dark:text-white">
                  {tab.icon}
                </span>
                {tab.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center justify-end">
            <ThemeToggle />
          </div>
        </header>
        <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-5 shadow-[0_20px_45px_-20px_rgba(15,23,42,0.15)] backdrop-blur dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-zenko-muted">Zenko · Produtividade</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">{greetingTitle}</h1>
              <p className="text-sm text-slate-600 dark:text-slate-300">{greetingSubtitle}</p>
            </div>
          </div>
        </section>
        <NotificationBanner />
        <main className="flex-1 space-y-6 overflow-visible pb-6 xl:pb-8">
          <Outlet />
        </main>
      </div>
      <OnboardingDialog
        open={showOnboarding}
        loading={profileSaving}
        initialName={profile?.full_name}
        onSubmit={async (values) => {
          await updateProfile(values);
          setShowOnboarding(false);
        }}
      />
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/70 px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(5rem+env(safe-area-inset-top))] backdrop-blur-lg xl:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute right-6 top-[calc(env(safe-area-inset-top)+1.5rem)] inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            aria-label="Fechar menu de navegação"
          >
            ×
          </button>
          <div className="mx-auto w-full max-w-md flex-1 overflow-y-auto rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-[0_25px_80px_-20px_rgba(7,11,20,0.85)] backdrop-blur-xl">
            <div className="mb-6 text-center">
              <p className="text-xs uppercase tracking-[0.35em] text-white/70">Navegação</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Explore o Zenko</h2>
            </div>
            <nav className="space-y-3">
              {tabs.map((tab) => (
                <NavLink
                  key={`mobile-${tab.to}`}
                  to={tab.to}
                  end={tab.to === '/'}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between rounded-3xl border px-4 py-3 text-base font-semibold transition-all ${
                      isActive
                        ? 'border-zenko-primary/60 bg-gradient-to-r from-zenko-primary/40 via-zenko-secondary/30 to-zenko-primary/40 text-white'
                        : 'border-white/10 bg-white/5 text-white/80 hover:border-zenko-primary/40 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white">
                      {tab.icon}
                    </span>
                    {tab.label}
                  </span>
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
