import { useEffect, useState } from 'react';
import { OFFLINE_USER_ID, isSupabaseConfigured, supabase } from '../lib/supabase';

export function useSupabaseUserId() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    if (!isSupabaseConfigured) {
      setUserId(OFFLINE_USER_ID);
      return () => {
        active = false;
      };
    }

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (active) setUserId(data.user?.id ?? OFFLINE_USER_ID);
      })
      .catch((error) => {
        console.warn('Não foi possível obter o usuário atual do Supabase.', error);
        if (active) setUserId(OFFLINE_USER_ID);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUserId(session?.user?.id ?? OFFLINE_USER_ID);
    });

    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  return userId;
}
