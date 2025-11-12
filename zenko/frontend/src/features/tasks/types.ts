export type TaskStatus = 'todo' | 'doing' | 'done';

export interface ChecklistItem {
  text: string;
  done: boolean;
}

export interface Attachment {
  name: string;
  url: string;
  offlineId?: string;
  size?: number;
  type?: string;
  created_at?: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  due_date?: string | null;
  start_date?: string | null;
  due_time?: string | null;
  due_reminder?: string | null;
  due_recurrence?: string | null;
  labels: string[];
  checklist: ChecklistItem[];
  attachments: Attachment[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TaskPayload {
  title: string;
  description?: string;
  status: TaskStatus;
  sort_order?: number;
  due_date?: string | null;
  start_date?: string | null;
  due_time?: string | null;
  due_reminder?: string | null;
  due_recurrence?: string | null;
  labels?: string[];
  checklist?: ChecklistItem[];
  attachments?: Attachment[];
}
