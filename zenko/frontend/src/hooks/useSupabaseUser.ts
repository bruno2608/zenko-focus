import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useSupabaseUserId() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (active) setUserId(data.user?.id ?? null);
      })
      .catch((error) => {
        console.warn('Não foi possível obter o usuário atual do Supabase.', error);
        if (active) setUserId(null);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUserId(session?.user?.id ?? null);
    });

    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  return userId;
}
