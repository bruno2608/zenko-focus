export interface Reminder {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  remind_at: string;
  sent: boolean;
  created_at: string;
}

export interface ReminderPayload {
  title: string;
  description?: string;
  remind_at: string;
  sent?: boolean;
}
