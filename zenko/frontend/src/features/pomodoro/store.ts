import { create } from 'zustand';

type PomodoroMode = 'focus' | 'short-break' | 'long-break' | 'custom';

type PomodoroStatus = 'idle' | 'running' | 'paused';

interface PomodoroSession {
  id: string;
  started_at: string;
  duration: number;
  task_id?: string;
}

interface PomodoroState {
  duration: number;
  remaining: number;
  status: PomodoroStatus;
  mode: PomodoroMode;
  taskId?: string;
  history: PomodoroSession[];
  setMode: (mode: PomodoroMode, duration: number) => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  tick: () => void;
  setTask: (taskId?: string) => void;
  setHistory: (sessions: PomodoroSession[]) => void;
  addSession: (session: PomodoroSession) => void;
}

export const usePomodoroStore = create<PomodoroState>((set, get) => ({
  duration: 25 * 60,
  remaining: 25 * 60,
  status: 'idle',
  mode: 'focus',
  history: [],
  setMode: (_mode, duration) =>
    set(() => ({
      mode: _mode,
      duration,
      remaining: duration,
      status: 'idle'
    })),
  start: () => set({ status: 'running' }),
  pause: () => set({ status: 'paused' }),
  reset: () => set((state) => ({ remaining: state.duration, status: 'idle' })),
  tick: () => {
    const { remaining, status } = get();
    if (status !== 'running') return;
    if (remaining > 0) {
      set({ remaining: remaining - 1 });
    } else {
      set({ status: 'idle' });
    }
  },
  setTask: (taskId) => set({ taskId }),
  setHistory: (sessions) => set({ history: sessions }),
  addSession: (session) =>
    set((state) => ({ history: [session, ...state.history.filter((s) => s.id !== session.id)].slice(0, 50) }))
}));
