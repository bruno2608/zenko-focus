import { isOfflineMode, supabase } from '../../lib/supabase';
import { generateId } from '../../lib/id';
import {
  OfflineStorageError,
  readOffline,
  removeOffline,
  writeOffline,
  type OfflineResource
} from '../../lib/offline';
import { Task, TaskPayload, TaskStatus } from './types';

const TASKS_RESOURCE: OfflineResource = 'tasks';
const OFFLINE_TASKS_KEY = 'all';
const OFFLINE_ATTACHMENTS_INDEX_KEY = 'attachments-index';
const OFFLINE_ATTACHMENT_PREFIX = 'attachment:';
const MAX_OFFLINE_ATTACHMENTS = 50;

interface OfflineAttachmentPayload {
  metadata: {
    id: string;
    name: string;
    size: number;
    type: string;
    created_at: string;
  };
  blob: Blob;
}

function buildAttachmentKey(id: string) {
  return `${OFFLINE_ATTACHMENT_PREFIX}${id}`;
}

async function ensureAttachmentCapacity(bytes: number) {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return;
  }
  try {
    const { quota, usage } = await navigator.storage.estimate();
    if (typeof quota === 'number' && typeof usage === 'number') {
      const remaining = quota - usage;
      if (remaining > 0 && remaining < bytes) {
        throw new OfflineStorageError('Armazenamento offline insuficiente.', 'quota_exceeded');
      }
      if (remaining <= 0) {
        throw new OfflineStorageError('Armazenamento offline insuficiente.', 'quota_exceeded');
      }
    }
  } catch (error) {
    if (error instanceof OfflineStorageError && error.reason === 'quota_exceeded') {
      throw error;
    }
    console.warn('Não foi possível estimar a cota de armazenamento.', error);
  }
}

async function readAttachmentIndex() {
  return readOffline<string[]>(TASKS_RESOURCE, OFFLINE_ATTACHMENTS_INDEX_KEY, []);
}

async function persistAttachmentIndex(index: string[]) {
  await writeOffline(TASKS_RESOURCE, OFFLINE_ATTACHMENTS_INDEX_KEY, index);
}

async function loadOfflineAttachment(id: string) {
  return readOffline<OfflineAttachmentPayload | null>(TASKS_RESOURCE, buildAttachmentKey(id), null);
}

async function storeOfflineAttachment(file: File, existingIndex: string[]) {
  if (existingIndex.length >= MAX_OFFLINE_ATTACHMENTS) {
    throw new OfflineStorageError('Limite de anexos offline atingido.', 'quota_exceeded');
  }

  await ensureAttachmentCapacity(file.size);

  const offlineId = generateId();
  const metadata = {
    id: offlineId,
    name: file.name,
    size: file.size,
    type: file.type,
    created_at: new Date().toISOString()
  };

  const payload: OfflineAttachmentPayload = {
    metadata,
    blob: file
  };

  await writeOffline(TASKS_RESOURCE, buildAttachmentKey(offlineId), payload);
  const nextIndex = [...existingIndex, offlineId];
  await persistAttachmentIndex(nextIndex);

  return metadata;
}

async function cleanupUnusedAttachments(tasks: Task[]) {
  const referenced = new Set<string>();
  tasks.forEach((task) => {
    task.attachments.forEach((attachment) => {
      const offlineId = attachment.offlineId ?? extractOfflineId(attachment.url);
      if (offlineId) {
        referenced.add(offlineId);
      }
    });
  });

  const index = await readAttachmentIndex();
  const removals = index.filter((id) => !referenced.has(id));
  if (removals.length > 0) {
    await Promise.all(removals.map((id) => removeOffline(TASKS_RESOURCE, buildAttachmentKey(id))));
  }
  const nextIndex = index.filter((id) => referenced.has(id));
  if (nextIndex.length !== index.length) {
    await persistAttachmentIndex(nextIndex);
  }
}

function extractOfflineId(url: string | undefined) {
  if (!url) return undefined;
  if (url.startsWith('offline://')) {
    return url.replace('offline://', '');
  }
  return undefined;
}

function serializeTasks(tasks: Task[]) {
  return tasks.map((task) => ({
    ...task,
    attachments: task.attachments.map((attachment) => {
      const offlineId = attachment.offlineId ?? extractOfflineId(attachment.url);
      if (!offlineId) {
        return attachment;
      }
      return {
        ...attachment,
        offlineId,
        url: `offline://${offlineId}`
      };
    })
  }));
}

async function hydrateAttachments(attachments: Task['attachments']) {
  const result = await Promise.all(
    attachments.map(async (attachment) => {
      const offlineId = attachment.offlineId ?? extractOfflineId(attachment.url);
      if (!offlineId) {
        return attachment;
      }
      const stored = await loadOfflineAttachment(offlineId);
      if (!stored) {
        return { ...attachment, offlineId };
      }
      const url = URL.createObjectURL(stored.blob);
      return {
        ...attachment,
        offlineId,
        url,
        size: stored.metadata.size,
        type: stored.metadata.type,
        created_at: stored.metadata.created_at
      };
    })
  );
  return result.filter((attachment) => Boolean(attachment)) as Task['attachments'];
}

async function loadOfflineTasks() {
  const stored = await readOffline<Task[]>(TASKS_RESOURCE, OFFLINE_TASKS_KEY, []);
  const tasks = await Promise.all(
    stored.map(async (task) => ({
      ...task,
      attachments: await hydrateAttachments(task.attachments ?? [])
    }))
  );
  return tasks;
}

async function persistOfflineTasks(tasks: Task[]) {
  const serialized = serializeTasks(tasks);
  await writeOffline(TASKS_RESOURCE, OFFLINE_TASKS_KEY, serialized);
  await cleanupUnusedAttachments(serialized);
}

export async function fetchTasks(userId: string) {
  if (isOfflineMode(userId)) {
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
  if (isOfflineMode(userId)) {
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
    const tasks = await loadOfflineTasks();
    tasks.push(task);
    await persistOfflineTasks(tasks);
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
  if (isOfflineMode(userId)) {
    const tasks = await loadOfflineTasks();
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
    await persistOfflineTasks(updated);
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
  if (isOfflineMode(userId)) {
    return updateTask(taskId, { status }, userId);
  }
  return updateTask(taskId, { status }, userId);
}

export async function deleteTask(taskId: string, userId?: string) {
  if (isOfflineMode(userId)) {
    const tasks = (await loadOfflineTasks()).filter((task) => task.id !== taskId);
    await persistOfflineTasks(tasks);
    return;
  }
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) throw error;
}

export async function uploadAttachment(file: File) {
  if (isOfflineMode()) {
    try {
      const index = await readAttachmentIndex();
      const metadata = await storeOfflineAttachment(file, index);
      const url = URL.createObjectURL(file);
      return {
        name: metadata.name,
        url,
        offlineId: metadata.id,
        size: metadata.size,
        type: metadata.type,
        created_at: metadata.created_at
      };
    } catch (error) {
      if (error instanceof OfflineStorageError && error.reason === 'quota_exceeded') {
        throw new Error('Espaço de armazenamento offline insuficiente para salvar o anexo.');
      }
      throw error;
    }
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
