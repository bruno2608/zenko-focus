import { readOffline, writeOffline } from '../../lib/offline';
import { Task } from './types';

export const OFFLINE_TASKS_KEY = 'tasks';

export function loadOfflineTasks() {
  return readOffline<Task[]>(OFFLINE_TASKS_KEY, []);
}

export function persistOfflineTasks(tasks: Task[]) {
  writeOffline(OFFLINE_TASKS_KEY, tasks);
}
