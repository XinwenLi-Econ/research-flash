// lib/db/schema.ts
// @source: cog.md

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const flashes = sqliteTable('flashes', {
  id: text('id').primaryKey(),              // 时间戳编码 YYYYMMDDHHmm
  content: text('content').notNull(),       // max 280 @R2
  status: text('status', {
    enum: ['incubating', 'surfaced', 'archived']
  }).notNull().default('incubating'),
  deviceId: text('device_id').notNull(),    // 设备UUID
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  syncedAt: integer('synced_at', { mode: 'timestamp' }),
});

export const users = sqliteTable('users', {
  deviceId: text('device_id').primaryKey(), // 设备UUID
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
