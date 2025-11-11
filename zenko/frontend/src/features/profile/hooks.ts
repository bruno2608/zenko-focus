import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useToastStore } from '../../components/ui/ToastProvider';
import { useSupabaseUserId } from '../../hooks/useSupabaseUser';
import { useThemeStore } from '../../store/theme';
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
    if (query.data?.theme_preference && query.data.theme_preference !== theme) {
      setTheme(query.data.theme_preference);
    }
  }, [query.data?.theme_preference, setTheme, theme]);

  const mutation = useMutation({
    mutationFn: (payload: ProfilePayload) => saveProfile(userId ?? OFFLINE_USER_ID, payload),
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
