// types/flash.ts
// @source: cog.md

/**
 * 灵感状态枚举
 * 状态流转：Incubating → Surfaced → Archived（单向不可逆）
 */
export type FlashStatus = 'incubating' | 'surfaced' | 'archived';

/**
 * 灵感实体
 * 唯一编码：时间戳 YYYYMMDDHHmm
 */
export interface Flash {
  id: string;                    // 时间戳编码
  content: string;               // 内容，max 280字符 @R2
  status: FlashStatus;           // 状态
  deviceId: string;              // 所属用户设备UUID
  createdAt: Date;               // 创建时间
  syncedAt: Date | null;         // 同步时间（null表示未同步）@R4
}

/**
 * 创建灵感输入
 */
export interface CreateFlashInput {
  content: string;               // 1-280字符 @R2
}

/**
 * 离线队列项
 */
export interface OfflineQueueItem {
  id: string;
  action: 'create' | 'update' | 'delete';
  data: Flash;
  timestamp: number;
}

/** 生成 Flash ID（格式：YYYYMMDDHHmm） */
export function generateFlashId(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}${month}${day}${hour}${minute}`;
}

/** 最大字数限制 @R2 */
export const MAX_CONTENT_LENGTH = 280;

/** 孵化期天数 */
export const INCUBATION_DAYS = 7;
