import { useEffect, useState } from 'react';
import { OFFLINE_USER_ID, isOfflineMode, isSupabaseConfigured, supabase } from '../lib/supabase';
import { useConnectivityStore } from '../store/connectivity';

export function useSupabaseUserId() {
  const [userId, setUserId] = useState<string | null>(null);
  const connectivityStatus = useConnectivityStore((state) => state.status);

  useEffect(() => {
    let active = true;

    if (!isSupabaseConfigured) {
      setUserId(OFFLINE_USER_ID);
      return () => {
        active = false;
      };
    }

    if (connectivityStatus === 'checking') {
      setUserId(null);
      return () => {
        active = false;
      };
    }

    if (connectivityStatus !== 'online') {
      setUserId(OFFLINE_USER_ID);
      return () => {
        active = false;
      };
    }

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
  }, [connectivityStatus]);

  if (isOfflineMode(userId)) {
    return OFFLINE_USER_ID;
  }

  return userId;
}
