import { OFFLINE_USER_ID, isSupabaseConfigured, supabase } from '../../lib/supabase';
import { generateId } from '../../lib/id';
import { readOffline, writeOffline } from '../../lib/offline';
import { Task, TaskPayload, TaskStatus } from './types';

const OFFLINE_TASKS_KEY = 'tasks';

function isOffline(userId: string) {
  return !isSupabaseConfigured || userId === OFFLINE_USER_ID;
}

function loadOfflineTasks() {
  return readOffline<Task[]>(OFFLINE_TASKS_KEY, []);
}

function persistOfflineTasks(tasks: Task[]) {
  writeOffline(OFFLINE_TASKS_KEY, tasks);
}

async function toDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Falha ao ler arquivo para uso offline.'));
    reader.readAsDataURL(file);
  });
}

export async function fetchTasks(userId: string) {
  if (isOffline(userId)) {
    return loadOfflineTasks();
  }
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as Task[];
}

export async function createTask(userId: string, payload: TaskPayload) {
  if (isOffline(userId)) {
    const now = new Date().toISOString();
    const task: Task = {
      id: generateId(),
      user_id: userId,
      title: payload.title,
      description: payload.description,
      status: payload.status,
      due_date: payload.due_date ?? null,
      labels: payload.labels ?? [],
      checklist: payload.checklist ?? [],
      attachments: payload.attachments ?? [],
      created_at: now,
      updated_at: now
    };
    const tasks = loadOfflineTasks();
    tasks.push(task);
    persistOfflineTasks(tasks);
    return task;
  }
  const { data, error } = await supabase
    .from('tasks')
    .insert({ ...payload, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data as Task;
}

export async function updateTask(taskId: string, payload: Partial<TaskPayload>, userId?: string) {
  if (!isSupabaseConfigured || userId === OFFLINE_USER_ID) {
    const tasks = loadOfflineTasks();
    const updated = tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            ...payload,
            labels: payload.labels ?? task.labels,
            checklist: payload.checklist ?? task.checklist,
            attachments: payload.attachments ?? task.attachments,
            due_date: payload.due_date ?? task.due_date,
            status: payload.status ?? task.status,
            updated_at: new Date().toISOString()
          }
        : task
    );
    persistOfflineTasks(updated);
    const next = updated.find((task) => task.id === taskId);
    if (!next) {
      throw new Error('Tarefa não encontrada no cache offline.');
    }
    return next;
  }
  const { data, error } = await supabase
    .from('tasks')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', taskId)
    .select()
    .single();
  if (error) throw error;
  return data as Task;
}

export async function updateTaskStatus(taskId: string, status: TaskStatus, userId?: string) {
  if (!isSupabaseConfigured || userId === OFFLINE_USER_ID) {
    return updateTask(taskId, { status }, userId);
  }
  return updateTask(taskId, { status }, userId);
}

export async function deleteTask(taskId: string, userId?: string) {
  if (!isSupabaseConfigured || userId === OFFLINE_USER_ID) {
    const tasks = loadOfflineTasks().filter((task) => task.id !== taskId);
    persistOfflineTasks(tasks);
    return;
  }
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) throw error;
}

export async function uploadAttachment(file: File) {
  if (!isSupabaseConfigured) {
    return { name: file.name, url: await toDataUrl(file) };
  }
  const filePath = `${generateId()}-${file.name}`;
  const { error } = await supabase.storage.from('attachments').upload(filePath, file, {
    contentType: file.type
  });
  if (error) throw error;
  const {
    data: { publicUrl }
  } = supabase.storage.from('attachments').getPublicUrl(filePath);
  return { name: file.name, url: publicUrl };
}
