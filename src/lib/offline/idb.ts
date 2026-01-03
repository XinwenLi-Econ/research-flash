// lib/offline/idb.ts
// @source: real.md R4

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Flash, FlashStatus, OfflineQueueItem } from '@/types/flash';

interface FlashDB extends DBSchema {
  flashes: {
    key: string;
    value: Flash;
    indexes: { 'by-status': FlashStatus; 'by-device': string };
  };
  syncQueue: {
    key: string;
    value: OfflineQueueItem;
  };
}

let dbPromise: Promise<IDBPDatabase<FlashDB>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<FlashDB>('researchflash', 1, {
      upgrade(db) {
        // 灵感存储
        const flashStore = db.createObjectStore('flashes', { keyPath: 'id' });
        flashStore.createIndex('by-status', 'status');
        flashStore.createIndex('by-device', 'deviceId');

        // 同步队列
        db.createObjectStore('syncQueue', { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

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
