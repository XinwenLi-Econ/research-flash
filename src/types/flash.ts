// types/flash.ts
// @source: cog.md
// 离线优先 + 跨设备同步类型定义

/**
 * 灵感状态枚举
 * 状态流转：Incubating → Surfaced → Archived（单向不可逆）
 * 删除流转：任意状态 → Deleted（可恢复）
 */
export type FlashStatus = 'incubating' | 'surfaced' | 'archived' | 'deleted';

/**
 * 灵感实体
 * 支持离线优先和跨设备同步
 */
export interface Flash {
  id: string;                    // 时间戳编码 YYYYMMDDHHmmss
  content: string;               // 内容，max 280字符 @R2
  status: FlashStatus;           // 状态
  previousStatus?: FlashStatus;  // 删除前的状态（用于恢复）
  deviceId: string;              // 所属设备 UUID
  userId: string | null;         // 关联用户ID（未登录时为 null）
  createdAt: Date;               // 创建时间
  syncedAt: Date | null;         // 同步时间（null表示未同步）@R4
  updatedAt: Date;               // 最后更新时间
  version: Date;                 // 版本时间戳（用于 LWW 冲突解决）
  deletedAt?: Date;              // 删除时间（用于回收站自动清理）
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

/**
 * 同步响应类型
 */
export interface SyncResponse {
  serverFlashes: Flash[];        // 服务器上该用户的所有灵感
  conflicts: ConflictItem[];     // 冲突项（信息性，已自动解决）
}

/**
 * 冲突项
 */
export interface ConflictItem {
  local: Flash;
  server: Flash;
  resolution: 'local' | 'server'; // LWW 解决结果
}

/** 生成 Flash ID（格式：YYYYMMDDHHmmss） */
export function generateFlashId(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hour}${minute}${second}`;
}

/** 最大字数限制 @R2 */
export const MAX_CONTENT_LENGTH = 280;

/** 孵化期天数 */
export const INCUBATION_DAYS = 7;

/**
 * 创建新的 Flash 对象
 */
export function createFlash(
  content: string,
  deviceId: string,
  userId: string | null = null
): Flash {
  const now = new Date();
  return {
    id: generateFlashId(now),
    content,
    status: 'incubating',
    deviceId,
    userId,
    createdAt: now,
    syncedAt: null,
    updatedAt: now,
    version: now,
  };
}

/**
 * Last-Write-Wins 冲突解决
 * 比较两个 Flash 的版本，返回较新的一个
 */
export function resolveConflict(local: Flash, server: Flash): {
  winner: Flash;
  resolution: 'local' | 'server';
} {
  const localVersion = new Date(local.version).getTime();
  const serverVersion = new Date(server.version).getTime();

  // 同一设备：理论上不应该冲突
  // 不同设备：最后更新时间胜出
  if (localVersion > serverVersion) {
    return { winner: local, resolution: 'local' };
  } else {
    // 服务器优先（时间戳相同或服务器更新）
    return { winner: server, resolution: 'server' };
  }
}
