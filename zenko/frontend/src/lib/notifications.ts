export async function initNotifications() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  if ('serviceWorker' in navigator) {
    await navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }
}

export function scheduleNotification(title: string, options?: NotificationOptions, delay = 0) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  setTimeout(() => {
    new Notification(title, options);
  }, delay);
}
