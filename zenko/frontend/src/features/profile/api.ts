import { OFFLINE_USER_ID, isSupabaseConfigured, supabase } from '../../lib/supabase';
import { readOffline, writeOffline } from '../../lib/offline';
import { Profile, ProfilePayload } from './types';

const OFFLINE_PROFILE_KEY = 'profile';

function fallbackProfile(userId: string): Profile {
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

function persistOffline(profile: Profile) {
  writeOffline(`${OFFLINE_PROFILE_KEY}-${profile.id}`, profile);
}

function readOfflineProfile(userId: string) {
  return readOffline<Profile>(`${OFFLINE_PROFILE_KEY}-${userId}`, fallbackProfile(userId));
}

function mapProfile(data: any, userId: string): Profile {
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

export async function fetchProfile(userId: string): Promise<Profile> {
  if (!userId) {
    throw new Error('Usuário não identificado para carregar perfil.');
  }

  if (!isSupabaseConfigured || userId === OFFLINE_USER_ID) {
    return readOfflineProfile(userId);
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('Falha ao consultar perfil remoto, usando dados locais.', error);
    return readOfflineProfile(userId);
  }

  if (!data) {
    const profile = fallbackProfile(userId);
    persistOffline(profile);
    return profile;
  }

  const profile = mapProfile(data, userId);
  persistOffline(profile);
  return profile;
}

export async function saveProfile(userId: string, payload: ProfilePayload): Promise<Profile> {
  if (!userId) {
    throw new Error('Usuário não identificado para atualizar perfil.');
  }

  if (!isSupabaseConfigured || userId === OFFLINE_USER_ID) {
    const base = readOfflineProfile(userId);
    const merged: Profile = {
      ...base,
      ...payload,
      id: userId,
      updated_at: new Date().toISOString()
    };
    persistOffline(merged);
    return merged;
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...payload, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  const profile = mapProfile(data, userId);
  persistOffline(profile);
  return profile;
}
