// hooks/useFlash.ts
// @source: cog.md, real.md R4
// Flash Hook - 支持跨设备同步，使用 Zustand 全局状态
'use client';

import { useCallback, useEffect } from 'react';
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
import { useFlashStore } from '@/stores/flashStore';

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
  // 使用 Zustand 全局状态
  const {
    flashes,
    isLoading,
    deviceId,
    setFlashes,
    addFlash,
    updateFlash,
    removeFlash,
    setIsLoading,
    setDeviceId,
  } = useFlashStore();

  const { isOffline } = useOffline();
  const { user } = useAuth();

  // 初始化设备ID
  useEffect(() => {
    if (!deviceId) {
      getOrCreateDeviceId().then(setDeviceId);
    }
  }, [deviceId, setDeviceId]);

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
  }, [setFlashes, setIsLoading]);

  // 初始加载（只加载一次）
  useEffect(() => {
    if (isLoading && flashes.length === 0) {
      loadFlashes();
    }
  }, [isLoading, flashes.length, loadFlashes]);

  // 创建灵感 - 同步函数，立即返回
  const createFlash = useCallback((input: CreateFlashInput): Flash => {
    // 同步获取 deviceId：优先使用状态，否则用临时 ID（后台会修正）
    const currentDeviceId = deviceId || localStorage.getItem('deviceId') || uuidv4();
    const userId = user?.id || null;

    // 使用工厂函数创建 Flash
    const flash = createFlashEntity(input.content, currentDeviceId, userId);

    // 🚀 乐观更新：立即更新全局状态，所有组件同时更新
    addFlash(flash);

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
            updateFlash(flash.id, syncedFlash);
          }
        }
      } catch (error) {
        console.error('后台保存/同步失败:', error);
      }
    })();

    // 🚀 立即返回，完全同步
    return flash;
  }, [deviceId, isOffline, user, addFlash, updateFlash]);

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

    // 乐观更新
    updateFlash(id, updatedFlash);

    // 后台持久化
    (async () => {
      try {
        await updateFlashLocally(updatedFlash);
        const queueItem: OfflineQueueItem = {
          id: uuidv4(),
          action: 'update',
          data: updatedFlash,
          timestamp: Date.now(),
        };
        await addToSyncQueue(queueItem);
      } catch (error) {
        console.error('归档失败:', error);
      }
    })();
  }, [flashes, updateFlash]);

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

    updateFlash(id, updatedFlash);

    (async () => {
      try {
        await updateFlashLocally(updatedFlash);
        const queueItem: OfflineQueueItem = {
          id: uuidv4(),
          action: 'update',
          data: updatedFlash,
          timestamp: Date.now(),
        };
        await addToSyncQueue(queueItem);
      } catch (error) {
        console.error('Surface 失败:', error);
      }
    })();
  }, [flashes, updateFlash]);

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

    updateFlash(id, updatedFlash);

    (async () => {
      try {
        await updateFlashLocally(updatedFlash);
        const queueItem: OfflineQueueItem = {
          id: uuidv4(),
          action: 'update',
          data: updatedFlash,
          timestamp: Date.now(),
        };
        await addToSyncQueue(queueItem);
      } catch (error) {
        console.error('更新失败:', error);
      }
    })();
  }, [flashes, updateFlash]);

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

    updateFlash(id, deletedFlash);

    (async () => {
      try {
        await updateFlashLocally(deletedFlash);
        const queueItem: OfflineQueueItem = {
          id: uuidv4(),
          action: 'update',
          data: deletedFlash,
          timestamp: Date.now(),
        };
        await addToSyncQueue(queueItem);
      } catch (error) {
        console.error('删除失败:', error);
      }
    })();

    return deletedFlash;
  }, [flashes, updateFlash]);

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

    updateFlash(id, restoredFlash);

    (async () => {
      try {
        await updateFlashLocally(restoredFlash);
        const queueItem: OfflineQueueItem = {
          id: uuidv4(),
          action: 'update',
          data: restoredFlash,
          timestamp: Date.now(),
        };
        await addToSyncQueue(queueItem);
      } catch (error) {
        console.error('恢复失败:', error);
      }
    })();

    return restoredFlash;
  }, [flashes, updateFlash]);

  // 永久删除灵感
  const permanentDeleteFlash = useCallback(async (id: string) => {
    const flash = flashes.find(f => f.id === id);
    if (!flash) return;

    removeFlash(id);

    (async () => {
      try {
        const { deleteFlashLocally } = await import('@/lib/offline/idb');
        await deleteFlashLocally(id);
        const queueItem: OfflineQueueItem = {
          id: uuidv4(),
          action: 'delete',
          data: flash,
          timestamp: Date.now(),
        };
        await addToSyncQueue(queueItem);
      } catch (error) {
        console.error('永久删除失败:', error);
      }
    })();
  }, [flashes, removeFlash]);

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
  }, [setFlashes]);

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
