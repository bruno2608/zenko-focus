import { createClient } from '@supabase/supabase-js';
import { del, get, set } from 'idb-keyval';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const OFFLINE_USER_ID = 'offline-user';

if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.warn(
    'Supabase não está configurado. O aplicativo funcionará em modo limitado até que as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY sejam definidas.'
  );
}

export const supabase = createClient(
  SUPABASE_URL || 'http://localhost:54321',
  SUPABASE_ANON_KEY || 'public-anon-key',
  {
    auth: {
      persistSession: true,
      storage: {
        async getItem(key) {
          return (await get(key)) ?? null;
        },
        async setItem(key, value) {
          await set(key, value);
        },
        async removeItem(key) {
          await del(key);
        }
      }
    }
  }
);

export async function getCurrentUser() {
  try {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    return user ?? null;
  } catch (error) {
    console.warn('Não foi possível recuperar o usuário do Supabase.', error);
    return null;
  }
}
