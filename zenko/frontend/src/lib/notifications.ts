import { useToastStore } from '../components/ui/ToastProvider';

let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (audioContext) return audioContext;
  const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
  if (!Ctx) return null;
  audioContext = new Ctx();
  if (audioContext.state === 'suspended') {
    const resume = () => {
      audioContext?.resume().catch(() => undefined);
      document.removeEventListener('pointerdown', resume);
      document.removeEventListener('keydown', resume);
    };
    document.addEventListener('pointerdown', resume, { once: true });
    document.addEventListener('keydown', resume, { once: true });
  }
  return audioContext;
}

export async function initNotifications() {
  getAudioContext();
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  if ('serviceWorker' in navigator) {
    await navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }
}

function playNotificationSound() {
  const ctx = getAudioContext();
  if (!ctx) return;
  ctx.resume().catch(() => undefined);
  const duration = 1.2;
  const now = ctx.currentTime;
  const oscillator = ctx.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(880, now);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

export function scheduleNotification(title: string, options?: NotificationOptions, delay = 0) {
  setTimeout(() => {
    let delivered = false;
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, options);
        delivered = true;
      } catch (error) {
        console.warn('Não foi possível exibir a notificação do navegador.', error);
      }
    }

    if (!delivered) {
      const show = useToastStore.getState().show;
      show({ title, description: options?.body, type: 'info' });
    }

    playNotificationSound();

    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([200, 80, 200]);
      } catch (error) {
        console.warn('Falha ao acionar vibração.', error);
      }
    }
  }, Math.max(0, delay));
}
