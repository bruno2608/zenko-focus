import { readOffline, writeOffline } from '../../lib/offline';
import { OFFLINE_USER_ID } from '../../lib/supabase';
import { generateId } from '../../lib/id';

export interface OfflinePomodoroSession {
  id: string;
  user_id: string;
  duration_minutes: number;
  task_id: string | null;
  started_at: string;
}

export const OFFLINE_SESSIONS_KEY = 'pomodoro-sessions';

export function loadOfflineSessions() {
  return readOffline<OfflinePomodoroSession[]>(OFFLINE_SESSIONS_KEY, []);
}

export function persistOfflineSessions(sessions: OfflinePomodoroSession[]) {
  writeOffline(OFFLINE_SESSIONS_KEY, sessions);
}

export function saveOfflineSession(durationInSeconds: number, taskId?: string) {
  const sessions = loadOfflineSessions();
  const session: OfflinePomodoroSession = {
    id: generateId(),
    user_id: OFFLINE_USER_ID,
    duration_minutes: Math.round(durationInSeconds / 60),
    task_id: taskId ?? null,
    started_at: new Date().toISOString()
  };
  persistOfflineSessions([session, ...sessions].slice(0, 50));
  return session;
}
