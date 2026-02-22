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
import { apiUrl } from '@/lib/api-config';

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
          const response = await fetch(apiUrl('/api/flash'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // 携带认证凭据
            body: JSON.stringify({
              content: input.content,
              deviceId: currentDeviceId,
              userId,
            }),
          });

          if (response.ok) {
            // 同步成功：清除 syncQueue 中的 create 操作，避免重复推送
            const { clearSyncedItem } = await import('@/lib/offline/idb');
            await clearSyncedItem(queueItem.id);
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

    // 后台持久化 + 立即同步
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

        // 🚀 如果在线，立即同步到服务器
        if (!isOffline) {
          const response = await fetch(apiUrl('/api/sync'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(queueItem),
          });

          if (response.ok) {
            const { clearSyncedItem } = await import('@/lib/offline/idb');
            await clearSyncedItem(queueItem.id);
          }
        }
      } catch (error) {
        console.error('归档失败:', error);
      }
    })();
  }, [flashes, updateFlash, isOffline]);

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

        // 🚀 如果在线，立即同步到服务器
        if (!isOffline) {
          const response = await fetch(apiUrl('/api/sync'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(queueItem),
          });

          if (response.ok) {
            const { clearSyncedItem } = await import('@/lib/offline/idb');
            await clearSyncedItem(queueItem.id);
          }
        }
      } catch (error) {
        console.error('Surface 失败:', error);
      }
    })();
  }, [flashes, updateFlash, isOffline]);

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

        // 🚀 如果在线，立即同步到服务器
        if (!isOffline) {
          const response = await fetch(apiUrl('/api/sync'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(queueItem),
          });

          if (response.ok) {
            const { clearSyncedItem } = await import('@/lib/offline/idb');
            await clearSyncedItem(queueItem.id);
          }
        }
      } catch (error) {
        console.error('更新失败:', error);
      }
    })();
  }, [flashes, updateFlash, isOffline]);

  // 删除灵感（软删除）
  // 🚀 修复：确保 IndexedDB 持久化完成后再返回，避免关闭应用时数据丢失
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

    // 🚀 乐观更新：立即更新 UI
    updateFlash(id, deletedFlash);

    try {
      // 🚀 关键修复：同步等待本地持久化完成
      await updateFlashLocally(deletedFlash);
      const queueItem: OfflineQueueItem = {
        id: uuidv4(),
        action: 'update',
        data: deletedFlash,
        timestamp: Date.now(),
      };
      await addToSyncQueue(queueItem);
      console.log('[deleteFlash] 本地持久化完成');

      // 后台同步到服务器（不阻塞返回）
      if (!isOffline) {
        fetch(apiUrl('/api/sync'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(queueItem),
        }).then(async (response) => {
          if (response.ok) {
            const { clearSyncedItem } = await import('@/lib/offline/idb');
            await clearSyncedItem(queueItem.id);
            console.log('[deleteFlash] 立即同步成功');
          } else {
            console.error('[deleteFlash] 立即同步失败:', response.status);
          }
        }).catch((error) => {
          console.error('[deleteFlash] 同步请求失败:', error);
        });
      }
    } catch (error) {
      console.error('删除失败:', error);
    }

    return deletedFlash;
  }, [flashes, updateFlash, isOffline]);

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

        // 🚀 如果在线，立即同步到服务器
        if (!isOffline) {
          const response = await fetch(apiUrl('/api/sync'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(queueItem),
          });

          if (response.ok) {
            const { clearSyncedItem } = await import('@/lib/offline/idb');
            await clearSyncedItem(queueItem.id);
          }
        }
      } catch (error) {
        console.error('恢复失败:', error);
      }
    })();

    return restoredFlash;
  }, [flashes, updateFlash, isOffline]);

  // 永久删除灵感
  // 🚀 修复：确保 IndexedDB 删除完成后再返回，避免关闭应用时数据未删除
  const permanentDeleteFlash = useCallback(async (id: string) => {
    const flash = flashes.find(f => f.id === id);
    if (!flash) return;

    // 🚀 乐观更新：立即从 UI 移除
    removeFlash(id);

    try {
      // 🚀 关键修复：同步等待本地删除完成
      const { deleteFlashLocally } = await import('@/lib/offline/idb');
      await deleteFlashLocally(id);
      const queueItem: OfflineQueueItem = {
        id: uuidv4(),
        action: 'delete',
        data: flash,
        timestamp: Date.now(),
      };
      await addToSyncQueue(queueItem);
      console.log('[permanentDeleteFlash] 本地删除完成');

      // 后台同步到服务器（不阻塞返回）
      if (!isOffline) {
        fetch(apiUrl('/api/sync'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(queueItem),
        }).then(async (response) => {
          if (response.ok) {
            const { clearSyncedItem } = await import('@/lib/offline/idb');
            await clearSyncedItem(queueItem.id);
            console.log('[permanentDeleteFlash] 同步成功');
          }
        }).catch((error) => {
          console.error('[permanentDeleteFlash] 同步请求失败:', error);
        });
      }
    } catch (error) {
      console.error('永久删除失败:', error);
    }
  }, [flashes, removeFlash, isOffline]);

  // 清空回收站（永久删除所有已删除的灵感）
  const clearTrash = useCallback(async () => {
    const deletedFlashes = flashes.filter(f => f.status === 'deleted');
    if (deletedFlashes.length === 0) return 0;

    console.log(`[clearTrash] 准备删除 ${deletedFlashes.length} 条灵感`);

    try {
      const { deleteFlashLocally } = await import('@/lib/offline/idb');

      // 🚀 如果已登录且在线，先调用服务端批量删除（同步等待）
      if (!isOffline && user?.id) {
        console.log(`[clearTrash] 调用服务端批量删除, userId=${user.id}`);
        try {
          const response = await fetch(apiUrl('/api/trash/clear'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ userId: user.id }),
          });

          if (response.ok) {
            const result = await response.json();
            console.log(`[clearTrash] 服务端删除成功:`, result);
          } else {
            console.error(`[clearTrash] 服务端删除失败: ${response.status} ${response.statusText}`);
          }
        } catch (error) {
          console.error('[clearTrash] 服务端清空回收站失败:', error);
        }
      }

      // 本地删除 + 添加到同步队列（作为备份）
      for (const flash of deletedFlashes) {
        await deleteFlashLocally(flash.id);
        const queueItem: OfflineQueueItem = {
          id: uuidv4(),
          action: 'delete',
          data: flash,
          timestamp: Date.now(),
        };
        await addToSyncQueue(queueItem);
      }
      console.log(`[clearTrash] 本地删除完成，已添加 ${deletedFlashes.length} 条到同步队列`);

      // 最后更新 UI 状态
      for (const flash of deletedFlashes) {
        removeFlash(flash.id);
      }
    } catch (error) {
      console.error('[clearTrash] 清空回收站失败:', error);
    }

    return deletedFlashes.length;
  }, [flashes, removeFlash, isOffline, user]);

  // 强制清理服务器回收站（用于解决本地已清空但服务器未清空的问题）
  const forceServerClearTrash = useCallback(async (): Promise<{ success: boolean; deletedCount: number }> => {
    if (!user?.id) {
      console.log('[forceServerClearTrash] 未登录，跳过');
      return { success: false, deletedCount: 0 };
    }

    console.log(`[forceServerClearTrash] 强制清理服务器回收站, userId=${user.id}`);

    try {
      const response = await fetch(apiUrl('/api/trash/clear'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: user.id }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`[forceServerClearTrash] 服务端删除成功:`, result);
        return { success: true, deletedCount: result.deletedCount || 0 };
      } else {
        console.error(`[forceServerClearTrash] 服务端删除失败: ${response.status} ${response.statusText}`);
        return { success: false, deletedCount: 0 };
      }
    } catch (error) {
      console.error('[forceServerClearTrash] 清空回收站失败:', error);
      return { success: false, deletedCount: 0 };
    }
  }, [user]);

  // 清理服务器重复灵感
  const cleanDuplicates = useCallback(async (): Promise<{ success: boolean; deletedCount: number }> => {
    if (!user?.id) {
      console.log('[cleanDuplicates] 未登录，跳过');
      return { success: false, deletedCount: 0 };
    }

    console.log(`[cleanDuplicates] 清理重复灵感, userId=${user.id}`);

    try {
      const response = await fetch(apiUrl('/api/flash/duplicates'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: user.id }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`[cleanDuplicates] 清理成功:`, result);
        return { success: true, deletedCount: result.deletedCount || 0 };
      } else {
        console.error(`[cleanDuplicates] 清理失败: ${response.status} ${response.statusText}`);
        return { success: false, deletedCount: 0 };
      }
    } catch (error) {
      console.error('[cleanDuplicates] 清理重复灵感失败:', error);
      return { success: false, deletedCount: 0 };
    }
  }, [user]);

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
    clearTrash,
    mergeRemoteFlashes,
    getIncubating: () => getFlashesByStatusLocal('incubating'),
    getSurfaced: () => getFlashesByStatusLocal('surfaced'),
    getArchived: () => getFlashesByStatusLocal('archived'),
    getDeleted: () => getFlashesByStatusLocal('deleted'),
    reload: loadFlashes,
  };
}
