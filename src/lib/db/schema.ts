// lib/db/schema.ts
// @source: cog.md
// 离线优先认证与跨设备同步架构

import { pgTable, text, timestamp, boolean, varchar, index } from 'drizzle-orm/pg-core';

// ========== Better Auth 必需表 ==========

/**
 * 用户表 - Better Auth 核心表
 */
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  timezone: text('timezone').default('Asia/Shanghai'), // 用户时区，用于本地化推送
  lastDigestSentAt: timestamp('last_digest_sent_at', { withTimezone: true }), // 上次周报发送时间
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * 会话表 - Better Auth 核心表
 */
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * 账户表 - Better Auth 核心表（OAuth/凭证）
 */
export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  idToken: text('id_token'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * 验证表 - Better Auth 核心表
 */
export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ========== 业务表 ==========

/**
 * 设备表 - 关联用户与设备
 * userId 可为空（未登录用户）
 */
export const devices = pgTable('devices', {
  id: text('id').primaryKey(), // UUID v4，客户端生成
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
  name: text('name'), // 设备名称（可选）
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('devices_user_id_idx').on(table.userId),
]);

/**
 * 灵感表 - 核心业务表
 * 支持离线优先和跨设备同步
 */
export const flashes = pgTable('flashes', {
  id: varchar('id', { length: 14 }).primaryKey(), // YYYYMMDDHHmmss 格式
  content: varchar('content', { length: 280 }).notNull(), // @R2: 280字限制
  status: varchar('status', { length: 20 }).notNull().default('incubating'), // incubating | surfaced | archived
  deviceId: text('device_id').notNull().references(() => devices.id),
  userId: text('user_id').references(() => users.id, { onDelete: 'set null' }), // 可为空
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  version: timestamp('version', { withTimezone: true }).notNull().defaultNow(), // 用于 LWW 冲突解决
}, (table) => [
  index('flashes_status_idx').on(table.status),
  index('flashes_device_id_idx').on(table.deviceId),
  index('flashes_user_id_idx').on(table.userId),
]);

// ========== 类型导出 ==========

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type Verification = typeof verifications.$inferSelect;
export type NewVerification = typeof verifications.$inferInsert;

export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;

export type FlashRecord = typeof flashes.$inferSelect;
export type NewFlash = typeof flashes.$inferInsert;
