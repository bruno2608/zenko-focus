import { OFFLINE_USER_ID, isOfflineMode, supabase } from '../../lib/supabase';
import { Profile, ProfilePayload } from './types';
import {
  fallbackProfile,
  mapProfile,
  persistOfflineProfile,
  readOfflineProfile
} from './offlineRepository';

export async function fetchProfile(userId: string): Promise<Profile> {
  if (!userId) {
    throw new Error('Usuário não identificado para carregar perfil.');
  }

  if (isOfflineMode(userId)) {
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
    persistOfflineProfile(profile);
    return profile;
  }

  const profile = mapProfile(data, userId);
  persistOfflineProfile(profile);
  return profile;
}

export async function saveProfile(userId: string, payload: ProfilePayload): Promise<Profile> {
  if (!userId) {
    throw new Error('Usuário não identificado para atualizar perfil.');
  }

  if (isOfflineMode(userId)) {
    const base = readOfflineProfile(userId);
    const merged: Profile = {
      ...base,
      ...payload,
      id: userId,
      updated_at: new Date().toISOString()
    };
    persistOfflineProfile(merged);
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
  persistOfflineProfile(profile);
  return profile;
}
