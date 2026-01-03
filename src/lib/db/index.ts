// lib/db/index.ts
// @source: spec.md
// MVP: 使用内存存储，离线优先架构中 IndexedDB 是主要存储

import type { Flash, FlashStatus } from '@/types/flash';

// 内存存储（MVP阶段）
const flashStore = new Map<string, Flash>();

export const db = {
  flashes: {
    create: async (flash: Flash): Promise<Flash> => {
      flashStore.set(flash.id, flash);
      return flash;
    },

    getByDevice: async (deviceId: string): Promise<Flash[]> => {
      return Array.from(flashStore.values()).filter(f => f.deviceId === deviceId);
    },

    getByStatus: async (status: FlashStatus): Promise<Flash[]> => {
      return Array.from(flashStore.values()).filter(f => f.status === status);
    },

    update: async (id: string, data: Partial<Flash>): Promise<void> => {
      const existing = flashStore.get(id);
      if (existing) {
        flashStore.set(id, { ...existing, ...data });
      }
    },

    upsert: async (flash: Flash): Promise<void> => {
      flashStore.set(flash.id, flash);
    },
  },
};
