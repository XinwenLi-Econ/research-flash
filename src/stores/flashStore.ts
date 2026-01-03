// stores/flashStore.ts
// Zustand store for Flash state management - enables state sharing across components
import { create } from 'zustand';
import type { Flash } from '@/types/flash';

interface FlashState {
  flashes: Flash[];
  isLoading: boolean;
  deviceId: string;

  // Actions
  setFlashes: (flashes: Flash[]) => void;
  addFlash: (flash: Flash) => void;
  updateFlash: (id: string, flash: Flash) => void;
  removeFlash: (id: string) => void;
  setIsLoading: (loading: boolean) => void;
  setDeviceId: (id: string) => void;
}

export const useFlashStore = create<FlashState>((set) => ({
  flashes: [],
  isLoading: true,
  deviceId: '',

  setFlashes: (flashes) => set({ flashes }),

  addFlash: (flash) => set((state) => ({
    flashes: [flash, ...state.flashes],
  })),

  updateFlash: (id, flash) => set((state) => ({
    flashes: state.flashes.map((f) => (f.id === id ? flash : f)),
  })),

  removeFlash: (id) => set((state) => ({
    flashes: state.flashes.filter((f) => f.id !== id),
  })),

  setIsLoading: (isLoading) => set({ isLoading }),

  setDeviceId: (deviceId) => set({ deviceId }),
}));
