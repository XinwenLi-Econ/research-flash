// hooks/useFlash.ts
// @source: cog.md, real.md R4
// Flash Hook - 支持跨设备同步
'use client';

import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Flash,
  CreateFlashInput,
  OfflineQueueItem,
  createFlash as createFlashEntity,
} from '@/types/flash';
import {
  saveFlashLocally,
  getAllFlashes,
  updateFlashLocally,
  addToSyncQueue,
  getDeviceInfo,
  saveDeviceInfo,
} from '@/lib/offline/idb';
import { useOffline } from './useOffline';
import { useAuth } from './useAuth';

/**
 * 获取或创建设备ID
 * 优先从 IndexedDB 读取，fallback 到 localStorage
 */
async function getOrCreateDeviceId(): Promise<string> {
  if (typeof window === 'undefined') return '';

  // 优先从 IndexedDB 读取
  const deviceInfo = await getDeviceInfo();
  if (deviceInfo?.deviceId) return deviceInfo.deviceId;

  // fallback 到 localStorage（向后兼容）
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = uuidv4();
    localStorage.setItem('deviceId', deviceId);
  }

  // 保存到 IndexedDB
  await saveDeviceInfo({
    deviceId,
    userId: null,
    linkedAt: null,
  });

  return deviceId;
}

export function useFlash() {
  const [flashes, setFlashes] = useState<Flash[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deviceId, setDeviceId] = useState<string>('');
  const { isOffline } = useOffline();
  const { user, isAuthenticated } = useAuth();

  // 初始化设备ID
  useEffect(() => {
    getOrCreateDeviceId().then(setDeviceId);
  }, []);

  // 加载灵感
  const loadFlashes = useCallback(async () => {
    try {
      const allFlashes = await getAllFlashes();
      // 按创建时间倒序排列
      allFlashes.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setFlashes(allFlashes);
    } catch (error) {
      console.error('加载灵感失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    loadFlashes();
  }, [loadFlashes]);

  // 创建灵感
  const createFlash = useCallback((input: CreateFlashInput): Flash => {
    // 同步获取 deviceId：优先使用状态，否则用临时 ID（后台会修正）
    const currentDeviceId = deviceId || localStorage.getItem('deviceId') || uuidv4();
    const userId = user?.id || null;

    // 使用工厂函数创建 Flash
    const flash = createFlashEntity(input.content, currentDeviceId, userId);

    // 🚀 乐观更新：立即更新 UI，无需等待任何异步操作
    setFlashes(prev => [flash, ...prev]);

    // 🚀 后台持久化：完全不阻塞
    (async () => {
      try {
        // 确保 deviceId 已保存
        if (!deviceId && !localStorage.getItem('deviceId')) {
          localStorage.setItem('deviceId', currentDeviceId);
          await saveDeviceInfo({
            deviceId: currentDeviceId,
            userId: null,
            linkedAt: null,
          });
        }

        // 并发执行本地存储操作
        const queueItem: OfflineQueueItem = {
          id: uuidv4(),
          action: 'create',
          data: flash,
          timestamp: Date.now(),
        };
        await Promise.all([
          saveFlashLocally(flash),
          addToSyncQueue(queueItem),
        ]);

        // 如果在线，尝试立即同步（后台执行）
        if (!isOffline) {
          const response = await fetch('/api/flash', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: input.content,
              deviceId: currentDeviceId,
              userId,
            }),
          });

          if (response.ok) {
            // 更新同步时间
            const syncedFlash: Flash = {
              ...flash,
              syncedAt: new Date(),
            };
            await updateFlashLocally(syncedFlash);
            setFlashes(prev =>
              prev.map(f => f.id === flash.id ? syncedFlash : f)
            );
          }
        }
      } catch (error) {
        console.error('后台保存/同步失败:', error);
      }
    })();

    // 🚀 立即返回，完全同步
    return flash;
  }, [deviceId, isOffline, user]);

  // 归档灵感
  const archiveFlash = useCallback(async (id: string) => {
    const flash = flashes.find(f => f.id === id);
    if (!flash) return;

    const now = new Date();
    const updatedFlash: Flash = {
      ...flash,
      status: 'archived',
      updatedAt: now,
      version: now,
    };

    await updateFlashLocally(updatedFlash);
    setFlashes(prev =>
      prev.map(f => f.id === id ? updatedFlash : f)
    );

    // 添加到同步队列
    const queueItem: OfflineQueueItem = {
      id: uuidv4(),
      action: 'update',
      data: updatedFlash,
      timestamp: Date.now(),
    };
    await addToSyncQueue(queueItem);
  }, [flashes]);

  // Surface 灵感（孵化完成）
  const surfaceFlash = useCallback(async (id: string) => {
    const flash = flashes.find(f => f.id === id);
    if (!flash || flash.status !== 'incubating') return;

    const now = new Date();
    const updatedFlash: Flash = {
      ...flash,
      status: 'surfaced',
      updatedAt: now,
      version: now,
    };

    await updateFlashLocally(updatedFlash);
    setFlashes(prev =>
      prev.map(f => f.id === id ? updatedFlash : f)
    );

    // 添加到同步队列
    const queueItem: OfflineQueueItem = {
      id: uuidv4(),
      action: 'update',
      data: updatedFlash,
      timestamp: Date.now(),
    };
    await addToSyncQueue(queueItem);
  }, [flashes]);

  // 更新灵感内容
  const updateFlashContent = useCallback(async (id: string, content: string) => {
    const flash = flashes.find(f => f.id === id);
    if (!flash) return;

    const now = new Date();
    const updatedFlash: Flash = {
      ...flash,
      content,
      updatedAt: now,
      version: now,
    };

    await updateFlashLocally(updatedFlash);
    setFlashes(prev =>
      prev.map(f => f.id === id ? updatedFlash : f)
    );

    // 添加到同步队列
    const queueItem: OfflineQueueItem = {
      id: uuidv4(),
      action: 'update',
      data: updatedFlash,
      timestamp: Date.now(),
    };
    await addToSyncQueue(queueItem);
  }, [flashes]);

  // 删除灵感（软删除）
  const deleteFlash = useCallback(async (id: string) => {
    const flash = flashes.find(f => f.id === id);
    if (!flash || flash.status === 'deleted') return;

    const now = new Date();
    const deletedFlash: Flash = {
      ...flash,
      previousStatus: flash.status,
      status: 'deleted',
      deletedAt: now,
      updatedAt: now,
      version: now,
    };

    await updateFlashLocally(deletedFlash);
    setFlashes(prev =>
      prev.map(f => f.id === id ? deletedFlash : f)
    );

    // 添加到同步队列
    const queueItem: OfflineQueueItem = {
      id: uuidv4(),
      action: 'update',
      data: deletedFlash,
      timestamp: Date.now(),
    };
    await addToSyncQueue(queueItem);

    return deletedFlash;
  }, [flashes]);

  // 恢复灵感（从回收站恢复）
  const restoreFlash = useCallback(async (id: string) => {
    const flash = flashes.find(f => f.id === id);
    if (!flash || flash.status !== 'deleted') return;

    const now = new Date();
    const restoredFlash: Flash = {
      ...flash,
      status: flash.previousStatus || 'incubating',
      previousStatus: undefined,
      deletedAt: undefined,
      updatedAt: now,
      version: now,
    };

    await updateFlashLocally(restoredFlash);
    setFlashes(prev =>
      prev.map(f => f.id === id ? restoredFlash : f)
    );

    // 添加到同步队列
    const queueItem: OfflineQueueItem = {
      id: uuidv4(),
      action: 'update',
      data: restoredFlash,
      timestamp: Date.now(),
    };
    await addToSyncQueue(queueItem);

    return restoredFlash;
  }, [flashes]);

  // 永久删除灵感
  const permanentDeleteFlash = useCallback(async (id: string) => {
    const flash = flashes.find(f => f.id === id);
    if (!flash) return;

    // 从 IndexedDB 中删除
    const { deleteFlashLocally } = await import('@/lib/offline/idb');
    await deleteFlashLocally(id);

    setFlashes(prev => prev.filter(f => f.id !== id));

    // 添加到同步队列
    const queueItem: OfflineQueueItem = {
      id: uuidv4(),
      action: 'delete',
      data: flash,
      timestamp: Date.now(),
    };
    await addToSyncQueue(queueItem);
  }, [flashes]);

  // 按状态筛选
  const getFlashesByStatusLocal = useCallback((status: Flash['status']) => {
    return flashes.filter(f => f.status === status);
  }, [flashes]);

  // 合并远程数据到本地（用于跨设备同步）
  const mergeRemoteFlashes = useCallback(async (remoteFlashes: Flash[]) => {
    const localFlashes = await getAllFlashes();
    const mergedMap = new Map<string, Flash>();

    // 先添加本地数据
    for (const flash of localFlashes) {
      mergedMap.set(flash.id, flash);
    }

    // 合并远程数据（LWW）
    for (const remoteFlash of remoteFlashes) {
      const localFlash = mergedMap.get(remoteFlash.id);

      if (!localFlash) {
        // 远程有，本地没有 -> 添加
        mergedMap.set(remoteFlash.id, remoteFlash);
        await saveFlashLocally(remoteFlash);
      } else {
        // 都有 -> 比较 version
        const localVersion = new Date(localFlash.version).getTime();
        const remoteVersion = new Date(remoteFlash.version).getTime();

        if (remoteVersion > localVersion) {
          // 远程更新 -> 使用远程
          mergedMap.set(remoteFlash.id, remoteFlash);
          await updateFlashLocally(remoteFlash);
        }
        // 本地更新或相同 -> 保留本地（会在 push 时同步）
      }
    }

    // 更新状态
    const merged = Array.from(mergedMap.values());
    merged.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    setFlashes(merged);
  }, []);

  return {
    flashes,
    isLoading,
    deviceId,
    createFlash,
    archiveFlash,
    surfaceFlash,
    updateFlashContent,
    deleteFlash,
    restoreFlash,
    permanentDeleteFlash,
    mergeRemoteFlashes,
    getIncubating: () => getFlashesByStatusLocal('incubating'),
    getSurfaced: () => getFlashesByStatusLocal('surfaced'),
    getArchived: () => getFlashesByStatusLocal('archived'),
    getDeleted: () => getFlashesByStatusLocal('deleted'),
    reload: loadFlashes,
  };
}
