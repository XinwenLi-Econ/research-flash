// services/flash.service.ts
// @source: spec.md
// Flash 服务层 - 使用 Drizzle ORM

import { db } from '@/lib/db';
import { flashes, devices } from '@/lib/db/schema';
import { eq, and, desc, lt, isNull } from 'drizzle-orm';
import type { Flash, FlashStatus } from '@/types/flash';

function generateFlashId(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hour}${minute}${second}`;
}

/**
 * 将数据库记录转换为 Flash 类型
 */
function toFlash(record: typeof flashes.$inferSelect): Flash {
  return {
    id: record.id,
    content: record.content,
    status: record.status as FlashStatus,
    deviceId: record.deviceId,
    userId: record.userId,
    createdAt: record.createdAt,
    syncedAt: record.syncedAt,
    updatedAt: record.updatedAt,
    version: record.version,
  };
}

export const flashService = {
  /**
   * 创建灵感
   */
  async createFlash(input: {
    content: string;
    deviceId: string;
    userId?: string | null;
  }): Promise<Flash> {
    const now = new Date();
    const id = generateFlashId(now);

    // 确保设备存在
    await this.ensureDevice(input.deviceId, input.userId || null);

    // 创建灵感
    const [record] = await db.insert(flashes)
      .values({
        id,
        content: input.content,
        status: 'incubating',
        deviceId: input.deviceId,
        userId: input.userId || null,
        createdAt: now,
        syncedAt: now,
        updatedAt: now,
        version: now,
      })
      .returning();

    return toFlash(record);
  },

  /**
   * 确保设备记录存在
   */
  async ensureDevice(deviceId: string, userId: string | null): Promise<void> {
    const now = new Date();

    // 使用 upsert 模式
    const existing = await db.select()
      .from(devices)
      .where(eq(devices.id, deviceId))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(devices).values({
        id: deviceId,
        userId,
        lastActiveAt: now,
        createdAt: now,
      });
    } else {
      await db.update(devices)
        .set({ lastActiveAt: now, userId: userId || existing[0].userId })
        .where(eq(devices.id, deviceId));
    }
  },

  /**
   * 根据设备获取灵感
   */
  async getFlashesByDevice(deviceId: string): Promise<Flash[]> {
    const records = await db.select()
      .from(flashes)
      .where(eq(flashes.deviceId, deviceId))
      .orderBy(desc(flashes.createdAt));

    return records.map(toFlash);
  },

  /**
   * 根据用户获取所有灵感（跨设备）
   */
  async getFlashesByUser(userId: string): Promise<Flash[]> {
    const records = await db.select()
      .from(flashes)
      .where(eq(flashes.userId, userId))
      .orderBy(desc(flashes.createdAt));

    return records.map(toFlash);
  },

  /**
   * 根据状态获取灵感
   */
  async getFlashesByStatus(status: FlashStatus): Promise<Flash[]> {
    const records = await db.select()
      .from(flashes)
      .where(eq(flashes.status, status))
      .orderBy(desc(flashes.createdAt));

    return records.map(toFlash);
  },

  /**
   * 更新灵感状态
   */
  async updateFlashStatus(id: string, status: FlashStatus): Promise<void> {
    const now = new Date();
    await db.update(flashes)
      .set({ status, updatedAt: now, version: now })
      .where(eq(flashes.id, id));
  },

  /**
   * 同步灵感（Upsert - 使用数据库级别的 ON CONFLICT）
   */
  async syncFlash(flash: Flash): Promise<void> {
    const now = new Date();

    // 确保设备存在
    await this.ensureDevice(flash.deviceId, flash.userId);

    // 使用 ON CONFLICT DO UPDATE（数据库级别 upsert，避免竞态条件）
    await db.insert(flashes)
      .values({
        id: flash.id,
        content: flash.content,
        status: flash.status,
        deviceId: flash.deviceId,
        userId: flash.userId,
        createdAt: flash.createdAt,
        syncedAt: now,
        updatedAt: flash.updatedAt,
        version: flash.version,
      })
      .onConflictDoUpdate({
        target: flashes.id,
        set: {
          content: flash.content,
          status: flash.status,
          userId: flash.userId,
          syncedAt: now,
          updatedAt: flash.updatedAt,
          version: flash.version,
        },
      });
  },

  /**
   * 关联设备到用户
   */
  async linkDeviceToUser(deviceId: string, userId: string): Promise<number> {
    // 更新设备
    await db.update(devices)
      .set({ userId })
      .where(eq(devices.id, deviceId));

    // 更新该设备的所有灵感（userId 为 NULL 的）
    const result = await db.update(flashes)
      .set({ userId })
      .where(and(
        eq(flashes.deviceId, deviceId),
        isNull(flashes.userId) // 🔧 使用 isNull 正确检查 NULL
      ))
      .returning();

    return result.length;
  },

  /**
   * 删除灵感（软删除 - 设置状态为 archived）
   */
  async deleteFlash(id: string): Promise<void> {
    const now = new Date();
    await db.update(flashes)
      .set({ status: 'archived', updatedAt: now, version: now })
      .where(eq(flashes.id, id));
  },

  /**
   * 自动 Surface 过期灵感
   * 将创建时间超过 7 天且状态为 incubating 的灵感更新为 surfaced
   */
  async autoSurfaceExpiredFlashes(): Promise<number> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const result = await db.update(flashes)
      .set({
        status: 'surfaced',
        updatedAt: now,
        version: now
      })
      .where(and(
        eq(flashes.status, 'incubating'),
        lt(flashes.createdAt, sevenDaysAgo)
      ))
      .returning();

    return result.length;
  },

  /**
   * 获取用户的待回顾灵感
   */
  async getSurfacedFlashesByUser(userId: string): Promise<Flash[]> {
    const records = await db.select()
      .from(flashes)
      .where(and(
        eq(flashes.userId, userId),
        eq(flashes.status, 'surfaced')
      ))
      .orderBy(desc(flashes.createdAt));

    return records.map(toFlash);
  },
};
