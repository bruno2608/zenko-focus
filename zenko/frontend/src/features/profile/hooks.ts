import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useToastStore } from '../../components/ui/ToastProvider';
import { useSupabaseUserId } from '../../hooks/useSupabaseUser';
import { THEME_STORAGE_KEY, useThemeStore } from '../../store/theme';
import { Profile, ProfilePayload } from './types';
import { fetchProfile, saveProfile } from './api';
import { OFFLINE_USER_ID } from '../../lib/supabase';

export function useProfile() {
  const userId = useSupabaseUserId();
  const toast = useToastStore((state) => state.show);
  const queryClient = useQueryClient();
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  const query = useQuery<Profile>({
    queryKey: ['profile', userId ?? OFFLINE_USER_ID],
    queryFn: () => fetchProfile(userId ?? OFFLINE_USER_ID),
    enabled: Boolean(userId),
    staleTime: 10_000
  });

  useEffect(() => {
    const preference = query.data?.theme_preference;
    if (!preference) {
      return;
    }

    const storedTheme =
      typeof window !== 'undefined'
        ? window.localStorage.getItem(THEME_STORAGE_KEY)
        : null;

    if (storedTheme === 'light' || storedTheme === 'dark') {
      if (storedTheme !== preference) {
        if (useThemeStore.getState().theme !== storedTheme) {
          setTheme(storedTheme);
        }
        return;
      }
    }

    const currentTheme = useThemeStore.getState().theme;
    if (currentTheme !== preference) {
      setTheme(preference);
    }
  }, [query.data?.theme_preference, setTheme]);

  const buildPayload = (payload: ProfilePayload): ProfilePayload => {
    const snapshot =
      (queryClient.getQueryData(['profile', userId ?? OFFLINE_USER_ID]) as Profile | undefined) ?? {
        full_name: '',
        focus_area: '',
        objectives: '',
        avatar_url: null,
        notifications_enabled: true,
        auto_move_done: true,
        pomodoro_sound: true,
        theme_preference: theme
      };

    return {
      full_name: snapshot.full_name,
      focus_area: snapshot.focus_area,
      objectives: snapshot.objectives,
      avatar_url: snapshot.avatar_url,
      notifications_enabled: snapshot.notifications_enabled,
      auto_move_done: snapshot.auto_move_done,
      pomodoro_sound: snapshot.pomodoro_sound,
      theme_preference: snapshot.theme_preference,
      ...payload
    };
  };

  const mutation = useMutation({
    mutationFn: (payload: ProfilePayload) => saveProfile(userId ?? OFFLINE_USER_ID, buildPayload(payload)),
    onSuccess: (profile) => {
      queryClient.setQueryData(['profile', userId ?? OFFLINE_USER_ID], profile);
      toast({ title: 'Perfil atualizado', type: 'success' });
    },
    onError: (error: any) => {
      toast({
        title: 'Não foi possível salvar',
        description: error?.message ?? 'Tente novamente em instantes.',
        type: 'error'
      });
    }
  });

  return {
    userId,
    profile: query.data,
    isLoading: query.isLoading,
    isSaving: mutation.isLoading,
    updateProfile: mutation.mutateAsync
  };
}
