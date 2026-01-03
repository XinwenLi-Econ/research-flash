// services/flash.service.ts
// @source: spec.md

import { db } from '@/lib/db';
import type { Flash, FlashStatus } from '@/types/flash';

function generateFlashId(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}${month}${day}${hour}${minute}`;
}

export const flashService = {
  async createFlash(input: { content: string; deviceId: string }): Promise<Flash> {
    const now = new Date();
    const id = generateFlashId(now);

    const flash: Flash = {
      id,
      content: input.content,
      status: 'incubating',
      deviceId: input.deviceId,
      createdAt: now,
      syncedAt: now,
    };

    await db.flashes.create(flash);
    return flash;
  },

  async getFlashesByDevice(deviceId: string): Promise<Flash[]> {
    return db.flashes.getByDevice(deviceId);
  },

  async getSurfacedFlashes(): Promise<Flash[]> {
    return db.flashes.getByStatus('surfaced');
  },

  async updateFlashStatus(id: string, status: FlashStatus): Promise<void> {
    await db.flashes.update(id, { status });
  },

  async syncFlash(flash: Flash): Promise<void> {
    await db.flashes.upsert({
      ...flash,
      syncedAt: new Date(),
    });
  },
};
