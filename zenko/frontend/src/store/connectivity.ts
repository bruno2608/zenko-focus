import { create } from 'zustand';

export type ConnectivityStatus = 'checking' | 'online' | 'limited';

type ConnectivityState = {
  status: ConnectivityStatus;
  lastError: string | null;
  setStatus: (status: ConnectivityStatus, error?: string | null) => void;
};

export const useConnectivityStore = create<ConnectivityState>((set) => ({
  status: 'checking',
  lastError: null,
  setStatus: (status, error = null) => set({ status, lastError: error ?? null })
}));
