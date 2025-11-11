import { readOffline, writeOffline } from '../../lib/offline';
import { Profile } from './types';

export const OFFLINE_PROFILE_KEY = 'profile';

export function fallbackProfile(userId: string): Profile {
  const now = new Date().toISOString();
  return {
    id: userId,
    full_name: '',
    focus_area: '',
    objectives: '',
    avatar_url: null,
    notifications_enabled: true,
    auto_move_done: true,
    pomodoro_sound: true,
    theme_preference: 'dark',
    created_at: now,
    updated_at: now
  };
}

export function mapProfile(data: any, userId: string): Profile {
  const now = new Date().toISOString();
  return {
    id: userId,
    full_name: data?.full_name ?? '',
    focus_area: data?.focus_area ?? '',
    objectives: data?.objectives ?? '',
    avatar_url: data?.avatar_url ?? null,
    notifications_enabled:
      typeof data?.notifications_enabled === 'boolean' ? data.notifications_enabled : true,
    auto_move_done: typeof data?.auto_move_done === 'boolean' ? data.auto_move_done : true,
    pomodoro_sound: typeof data?.pomodoro_sound === 'boolean' ? data.pomodoro_sound : true,
    theme_preference: data?.theme_preference === 'light' ? 'light' : 'dark',
    created_at: data?.created_at ?? now,
    updated_at: data?.updated_at ?? now
  };
}

export function readOfflineProfile(userId: string) {
  return readOffline<Profile>(`${OFFLINE_PROFILE_KEY}-${userId}`, fallbackProfile(userId));
}

export function persistOfflineProfile(profile: Profile) {
  writeOffline(`${OFFLINE_PROFILE_KEY}-${profile.id}`, profile);
}
