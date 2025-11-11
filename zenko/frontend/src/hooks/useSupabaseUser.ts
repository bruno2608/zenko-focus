import { useEffect, useState } from 'react';
import { OFFLINE_USER_ID, isSupabaseConfigured, supabase } from '../lib/supabase';
import { useConnectivityStore } from '../store/connectivity';

const LAST_USER_STORAGE_KEY = 'zenko-last-user-id';

function getStoredUserId() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage?.getItem(LAST_USER_STORAGE_KEY) ?? null;
  } catch (error) {
    console.warn('Não foi possível acessar o último usuário conhecido.', error);
    return null;
  }
}

function persistUserId(id: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (id) {
      window.localStorage?.setItem(LAST_USER_STORAGE_KEY, id);
    } else {
      window.localStorage?.removeItem(LAST_USER_STORAGE_KEY);
    }
  } catch (error) {
    console.warn('Não foi possível persistir o último usuário conhecido.', error);
  }
}

export function useSupabaseUserId() {
  const [userId, setUserId] = useState<string | null>(() => getStoredUserId());
  const connectivityStatus = useConnectivityStore((state) => state.status);

  useEffect(() => {
    let active = true;

    if (!isSupabaseConfigured) {
      setUserId(null);
      persistUserId(null);
      return () => {
        active = false;
      };
    }

    if (connectivityStatus === 'checking' || connectivityStatus !== 'online') {
      return () => {
        active = false;
      };
    }

    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!active) return;
        const id = data.user?.id ?? null;
        setUserId(id);
        persistUserId(id);
      })
      .catch((error) => {
        console.warn('Não foi possível obter o usuário atual do Supabase.', error);
        if (active) setUserId((prev) => prev ?? getStoredUserId());
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const id = session?.user?.id ?? null;
      setUserId(id);
      persistUserId(id);
    });

    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, [connectivityStatus]);

  if (!isSupabaseConfigured) {
    return OFFLINE_USER_ID;
  }

  if (connectivityStatus === 'checking') {
    return null;
  }

  if (connectivityStatus !== 'online') {
    return userId ?? getStoredUserId() ?? OFFLINE_USER_ID;
  }

  return userId ?? getStoredUserId();
}
