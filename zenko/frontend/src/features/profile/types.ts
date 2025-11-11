export type ThemePreference = 'light' | 'dark';

export interface Profile {
  id: string;
  full_name: string;
  focus_area: string;
  objectives: string;
  avatar_url: string | null;
  notifications_enabled: boolean;
  auto_move_done: boolean;
  pomodoro_sound: boolean;
  theme_preference: ThemePreference;
  created_at: string;
  updated_at: string;
}

export type ProfilePayload = Partial<
  Pick<
    Profile,
    | 'full_name'
    | 'focus_area'
    | 'objectives'
    | 'avatar_url'
    | 'notifications_enabled'
    | 'auto_move_done'
    | 'pomodoro_sound'
    | 'theme_preference'
  >
>;
