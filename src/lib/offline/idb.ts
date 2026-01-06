// lib/offline/idb.ts
// @source: real.md R4
// 离线优先存储层 - 支持认证缓存和跨设备同步

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Flash, FlashStatus, OfflineQueueItem } from '@/types/flash';

// ========== 类型定义 ==========

/**
 * 认证缓存类型 - 用于离线访问
 */
export interface AuthCache {
  id: string; // 固定为 'current'
  userId: string;
  email: string;
  name: string;
  token: string;
  expiresAt: number; // Unix timestamp (ms)
  cachedAt: number; // 缓存时间
}

/**
 * 设备信息类型
 */
export interface DeviceInfo {
  id: string; // 固定为 'current'
  deviceId: string; // UUID v4
  userId: string | null; // 关联的用户ID（未登录时为 null）
  linkedAt: number | null; // 关联时间
}

/**
 * IndexedDB Schema
 */
interface FlashDB extends DBSchema {
  flashes: {
    key: string;
    value: Flash;
    indexes: {
      'by-status': FlashStatus;
      'by-device': string;
      'by-user': string;
    };
  };
  syncQueue: {
    key: string;
    value: OfflineQueueItem;
  };
  authCache: {
    key: string;
    value: AuthCache;
  };
  deviceInfo: {
    key: string;
    value: DeviceInfo;
  };
}

// ========== 数据库初始化 ==========

let dbPromise: Promise<IDBPDatabase<FlashDB>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<FlashDB>('researchflash', 2, {
      upgrade(db, oldVersion) {
        // 版本 1：基础存储
        if (oldVersion < 1) {
          // 灵感存储
          const flashStore = db.createObjectStore('flashes', { keyPath: 'id' });
          flashStore.createIndex('by-status', 'status');
          flashStore.createIndex('by-device', 'deviceId');

          // 同步队列
          db.createObjectStore('syncQueue', { keyPath: 'id' });
        }

        // 版本 2：认证缓存和设备信息
        if (oldVersion < 2) {
          // 添加用户索引到 flashes（如果存储已存在）
          if (db.objectStoreNames.contains('flashes')) {
            // 注意：无法在升级中直接添加索引到已存在的 store
            // 需要在应用层处理按用户查询
          }

          // 认证缓存存储
          if (!db.objectStoreNames.contains('authCache')) {
            db.createObjectStore('authCache', { keyPath: 'id' });
          }

          // 设备信息存储
          if (!db.objectStoreNames.contains('deviceInfo')) {
            db.createObjectStore('deviceInfo', { keyPath: 'id' });
          }
        }
      },
    });
  }
  return dbPromise;
}

// ========== Flash 操作 ==========

// 保存灵感到本地
export async function saveFlashLocally(flash: Flash): Promise<void> {
  const db = await getDB();
  await db.put('flashes', flash);
}

// 获取所有灵感
export async function getAllFlashes(): Promise<Flash[]> {
  const db = await getDB();
  return db.getAll('flashes');
}

// 根据状态获取灵感
export async function getFlashesByStatus(status: FlashStatus): Promise<Flash[]> {
  const db = await getDB();
  return db.getAllFromIndex('flashes', 'by-status', status);
}

// 根据设备ID获取灵感
export async function getFlashesByDevice(deviceId: string): Promise<Flash[]> {
  const db = await getDB();
  return db.getAllFromIndex('flashes', 'by-device', deviceId);
}

// 根据用户ID获取灵感（应用层过滤）
export async function getFlashesByUser(userId: string): Promise<Flash[]> {
  const db = await getDB();
  const allFlashes = await db.getAll('flashes');
  return allFlashes.filter(flash => flash.userId === userId);
}

// 删除灵感
export async function deleteFlashLocally(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('flashes', id);
}

// 更新灵感
export async function updateFlashLocally(flash: Flash): Promise<void> {
  const db = await getDB();
  await db.put('flashes', flash);
}

// ========== 同步队列操作 ==========

// 添加到同步队列
export async function addToSyncQueue(item: OfflineQueueItem): Promise<void> {
  const db = await getDB();
  await db.put('syncQueue', item);
}

// 获取待同步项
export async function getPendingSyncItems(): Promise<OfflineQueueItem[]> {
  const db = await getDB();
  return db.getAll('syncQueue');
}

// 清除已同步项
export async function clearSyncedItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('syncQueue', id);
}

// 清空同步队列
export async function clearAllSyncQueue(): Promise<void> {
  const db = await getDB();
  await db.clear('syncQueue');
}

// 清空所有本地灵感（用于强制重置）
export async function clearAllFlashes(): Promise<void> {
  const db = await getDB();
  await db.clear('flashes');
}

// ========== 认证缓存操作 ==========

/**
 * 保存认证缓存
 * 用于离线时访问用户信息
 */
export async function saveAuthCache(auth: Omit<AuthCache, 'id'>): Promise<void> {
  const db = await getDB();
  await db.put('authCache', { ...auth, id: 'current' });
}

/**
 * 获取认证缓存
 * 如果已过期（超过7天），返回 undefined
 */
export async function getAuthCache(): Promise<AuthCache | undefined> {
  const db = await getDB();
  const cache = await db.get('authCache', 'current');

  if (!cache) return undefined;

  // 检查是否过期（Token 过期或缓存超过7天）
  const now = Date.now();
  const gracePeriod = 7 * 24 * 60 * 60 * 1000; // 7天离线宽限期

  if (cache.expiresAt < now && now - cache.cachedAt > gracePeriod) {
    await clearAuthCache();
    return undefined;
  }

  return cache;
}

/**
 * 清除认证缓存
 */
export async function clearAuthCache(): Promise<void> {
  const db = await getDB();
  await db.delete('authCache', 'current');
}

// ========== 设备信息操作 ==========

/**
 * 保存设备信息
 */
export async function saveDeviceInfo(info: Omit<DeviceInfo, 'id'>): Promise<void> {
  const db = await getDB();
  await db.put('deviceInfo', { ...info, id: 'current' });
}

/**
 * 获取设备信息
 */
export async function getDeviceInfo(): Promise<DeviceInfo | undefined> {
  const db = await getDB();
  return db.get('deviceInfo', 'current');
}

/**
 * 更新设备用户关联
 */
export async function linkDeviceToUser(userId: string): Promise<void> {
  const db = await getDB();
  const info = await db.get('deviceInfo', 'current');

  if (info) {
    await db.put('deviceInfo', {
      ...info,
      userId,
      linkedAt: Date.now(),
    });
  }
}

/**
 * 取消设备用户关联
 */
export async function unlinkDeviceFromUser(): Promise<void> {
  const db = await getDB();
  const info = await db.get('deviceInfo', 'current');

  if (info) {
    await db.put('deviceInfo', {
      ...info,
      userId: null,
      linkedAt: null,
    });
  }
}
