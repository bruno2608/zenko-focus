export type TaskStatus = 'todo' | 'doing' | 'done';

export interface ChecklistItem {
  text: string;
  done: boolean;
}

export interface Attachment {
  name: string;
  url: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  due_date?: string | null;
  labels: string[];
  checklist: ChecklistItem[];
  attachments: Attachment[];
  created_at: string;
  updated_at: string;
}

export interface TaskPayload {
  title: string;
  description?: string;
  status: TaskStatus;
  due_date?: string | null;
  labels?: string[];
  checklist?: ChecklistItem[];
  attachments?: Attachment[];
}
