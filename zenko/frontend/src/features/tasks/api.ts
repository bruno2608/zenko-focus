import { supabase } from '../../lib/supabase';
import { Task, TaskPayload, TaskStatus } from './types';

export async function fetchTasks(userId: string) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as Task[];
}

export async function createTask(userId: string, payload: TaskPayload) {
  const { data, error } = await supabase
    .from('tasks')
    .insert({ ...payload, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data as Task;
}

export async function updateTask(taskId: string, payload: Partial<TaskPayload>) {
  const { data, error } = await supabase
    .from('tasks')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .select()
    .single();
  if (error) throw error;
  return data as Task;
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  return updateTask(taskId, { status });
}

export async function deleteTask(taskId: string) {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) throw error;
}

export async function uploadAttachment(file: File) {
  const filePath = `${crypto.randomUUID()}-${file.name}`;
  const { error } = await supabase.storage.from('attachments').upload(filePath, file, {
    contentType: file.type
  });
  if (error) throw error;
  const {
    data: { publicUrl }
  } = supabase.storage.from('attachments').getPublicUrl(filePath);
  return { name: file.name, url: publicUrl };
}
