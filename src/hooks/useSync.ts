// hooks/useSync.ts
// @source: real.md R4
// 同步 Hook - 支持跨设备同步和 LWW 冲突解决
'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { useOffline } from './useOffline';
import { useAuth } from './useAuth';
import {
  getPendingSyncItems,
  clearSyncedItem,
  getAllFlashes,
  saveFlashLocally,
  updateFlashLocally,
  deleteFlashLocally,
  getDeviceInfo,
} from '@/lib/offline/idb';
import type { Flash, SyncResponse } from '@/types/flash';
import { resolveConflict } from '@/types/flash';
import { apiUrl, isNative } from '@/lib/api-config';
import { useFlashStore } from '@/stores/flashStore';

export function useSync() {
  const { isOffline } = useOffline();
  const { user, isAuthenticated } = useAuth();
  const { setFlashes } = useFlashStore();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  // 使用 ref 防止 useEffect 循环依赖
  const hasSyncedOnMount = useRef(false);
  const prevAuthState = useRef<boolean | null>(null);
  const syncInProgress = useRef(false);

  // 同步待处理项（Push）
  const syncPendingItems = useCallback(async () => {
    if (isOffline) return;

    const pendingItems = await getPendingSyncItems();
    if (pendingItems.length === 0) return;

    setIsSyncing(true);

    for (const item of pendingItems) {
      try {
        const response = await fetch(apiUrl('/api/sync'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include', // 携带认证凭据
          body: JSON.stringify(item),
        });

        if (response.ok) {
          await clearSyncedItem(item.id);
        } else {
          console.error('同步响应错误:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('同步失败:', error instanceof Error ? error.message : error);
        // 保留在队列中，下次重试
      }
    }

    setIsSyncing(false);
    setLastSyncAt(new Date());
  }, [isOffline]);

  // 从服务器拉取数据（Pull）- 跨设备同步
  const pullFromServer = useCallback(async (): Promise<Flash[]> => {
    if (!isAuthenticated || !user || isOffline) return [];

    setIsSyncing(true);

    try {
      const deviceInfo = await getDeviceInfo();
      const currentDeviceId = deviceInfo?.deviceId || '';

      // 🚀 关键修复：先关联设备，确保该设备的灵感归属到用户
      // 解决竞态条件：useSync 可能在 useAuth 完成设备关联前就开始拉取
      if (currentDeviceId) {
        console.log('[Sync] 拉取前先关联设备...');
        try {
          const linkResponse = await fetch(apiUrl('/api/device/link'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              deviceId: currentDeviceId,
              userId: user.id,
            }),
          });
          if (linkResponse.ok) {
            const linkResult = await linkResponse.json();
            console.log(`[Sync] 设备关联完成，关联了 ${linkResult.linkedFlashesCount} 条灵感`);
          }
        } catch (linkError) {
          console.error('[Sync] 设备关联失败:', linkError);
          // 继续拉取，不阻塞流程
        }
      }

      console.log(`[Sync] 开始拉取数据, userId=${user.id}, deviceId=${currentDeviceId}`);
      const response = await fetch(
        apiUrl(`/api/sync/pull?userId=${user.id}&deviceId=${currentDeviceId}`),
        { credentials: 'include' }
      );

      if (!response.ok) {
        console.error('[Sync] 拉取数据失败:', response.status, response.statusText);
        return [];
      }

      const { serverFlashes }: SyncResponse = await response.json();
      const localFlashes = await getAllFlashes();

      console.log(`[Sync] 服务器返回 ${serverFlashes.length} 条灵感，本地有 ${localFlashes.length} 条`);

      // 创建服务器灵感 ID 集合，用于快速查找
      const serverFlashIds = new Set(serverFlashes.map(f => f.id));

      // Last-Write-Wins 合并
      const conflicts: Array<{ local: Flash; server: Flash; resolution: 'local' | 'server' }> = [];

      for (const serverFlash of serverFlashes) {
        const localFlash = localFlashes.find(f => f.id === serverFlash.id);

        if (!localFlash) {
          // 服务器有，本地没有 -> 拉取到本地
          await saveFlashLocally(serverFlash);
        } else {
          // 都有 -> 应用 LWW
          const { winner, resolution } = resolveConflict(localFlash, serverFlash);

          if (resolution === 'server') {
            await updateFlashLocally(winner);
          }

          // 记录冲突（仅用于调试/日志）
          if (resolution !== 'local') {
            conflicts.push({ local: localFlash, server: serverFlash, resolution });
          }
        }
      }

      // 处理「本地有，服务器没有」的情况 - 表示已在其他设备永久删除
      let deletedCount = 0;
      // currentDeviceId 已在函数开头定义

      for (const localFlash of localFlashes) {
        const shouldExistOnServer =
          localFlash.userId === user.id ||
          (localFlash.userId === null && localFlash.deviceId === currentDeviceId);

        if (shouldExistOnServer && !serverFlashIds.has(localFlash.id)) {
          await deleteFlashLocally(localFlash.id);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        console.log(`[Sync] 删除了 ${deletedCount} 条已在其他设备删除的灵感`);
      }

      if (conflicts.length > 0) {
        console.log(`[Sync] 已解决 ${conflicts.length} 个冲突（LWW）`);
      }

      // 🚀 自动去重：检测并删除重复灵感（相同内容，保留最早的）
      const allFlashesBeforeDedup = await getAllFlashes();
      const contentMap = new Map<string, typeof allFlashesBeforeDedup>();

      for (const flash of allFlashesBeforeDedup) {
        const key = flash.content.trim();
        if (!contentMap.has(key)) {
          contentMap.set(key, []);
        }
        contentMap.get(key)!.push(flash);
      }

      let localDupDeleted = 0;
      const serverDupIds: string[] = [];

      for (const [, flashList] of contentMap) {
        if (flashList.length > 1) {
          // 按创建时间排序，保留最早的
          flashList.sort((a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );

          // 删除除第一条外的所有重复（本地）
          for (let i = 1; i < flashList.length; i++) {
            await deleteFlashLocally(flashList[i].id);
            serverDupIds.push(flashList[i].id);
            localDupDeleted++;
          }
        }
      }

      // 同时清理服务器上的重复灵感
      if (serverDupIds.length > 0 && user?.id) {
        try {
          await fetch(apiUrl('/api/flash/duplicates'), {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ userId: user.id }),
          });
        } catch (error) {
          console.error('[Sync] 清理服务器重复灵感失败:', error);
        }
      }

      if (localDupDeleted > 0) {
        console.log(`[Sync] 自动去重：删除了 ${localDupDeleted} 条重复灵感`);
      }

      // 同步完成后更新 Zustand store，刷新 UI
      const allFlashes = await getAllFlashes();
      allFlashes.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setFlashes(allFlashes);

      setLastSyncAt(new Date());
      return serverFlashes;
    } catch (error) {
      console.error('拉取服务器数据失败:', error);
      return [];
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, user, isOffline, setFlashes]);

  // 完整同步（Push + Pull）
  const fullSync = useCallback(async () => {
    if (isOffline) return;

    // 先推送本地变更
    await syncPendingItems();

    // 再拉取服务器数据（如果已登录）
    if (isAuthenticated) {
      await pullFromServer();
    }
  }, [isOffline, syncPendingItems, pullFromServer, isAuthenticated]);

  // 网络恢复时自动同步（仅执行一次）
  useEffect(() => {
    if (!isOffline && !hasSyncedOnMount.current && !syncInProgress.current) {
      hasSyncedOnMount.current = true;
      syncInProgress.current = true;
      fullSync().finally(() => {
        syncInProgress.current = false;
      });
    }
  }, [isOffline]); // eslint-disable-line react-hooks/exhaustive-deps

  // 登录状态变化时触发同步（仅在状态真正变化时执行）
  useEffect(() => {
    const wasAuthenticated = prevAuthState.current;
    prevAuthState.current = isAuthenticated;

    // 🚀 修复：从未登录/初始状态 -> 已登录时触发同步
    // wasAuthenticated === false 或 wasAuthenticated === null 都表示之前未登录
    // 必须确保 user 对象存在才能同步
    if (isAuthenticated && user && !wasAuthenticated && !isOffline && !syncInProgress.current) {
      console.log('[Sync] 检测到登录，开始同步数据...');
      syncInProgress.current = true;
      pullFromServer()
        .then((flashes) => {
          console.log(`[Sync] 登录后同步完成，获取到 ${flashes.length} 条灵感`);
        })
        .catch((error) => {
          console.error('[Sync] 登录后同步失败:', error);
        })
        .finally(() => {
          syncInProgress.current = false;
        });
    }
  }, [isAuthenticated, user, isOffline]); // eslint-disable-line react-hooks/exhaustive-deps

  // 🚀 页面可见时自动同步（切换回 app 时拉取最新数据）
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        isAuthenticated &&
        !isOffline &&
        !syncInProgress.current
      ) {
        console.log('[Sync] 页面可见，开始同步...');
        syncInProgress.current = true;
        fullSync().finally(() => {
          syncInProgress.current = false;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAuthenticated, isOffline, fullSync]);

  // 🚀 Capacitor 原生应用：监听应用恢复事件
  useEffect(() => {
    if (!isNative()) return;

    let appListener: { remove: () => void } | null = null;

    const setupAppListener = async () => {
      try {
        const { App } = await import('@capacitor/app');
        appListener = await App.addListener('appStateChange', ({ isActive }) => {
          if (
            isActive &&
            isAuthenticated &&
            !isOffline &&
            !syncInProgress.current
          ) {
            console.log('[Sync] 原生应用恢复，开始同步...');
            syncInProgress.current = true;
            fullSync().finally(() => {
              syncInProgress.current = false;
            });
          }
        });
      } catch (error) {
        console.error('[Sync] 无法监听应用状态:', error);
      }
    };

    setupAppListener();

    return () => {
      appListener?.remove();
    };
  }, [isAuthenticated, isOffline, fullSync]);

  // 🚀 强制重新同步（用于修复数据不一致问题）
  // 重新关联设备 + 清空本地数据 + 从服务器拉取
  const forceResync = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    if (!isAuthenticated || !user || isOffline) {
      return { success: false, message: '需要登录且在线才能重新同步' };
    }

    setIsSyncing(true);
    console.log('[Sync] 开始强制重新同步...');

    try {
      const deviceInfo = await getDeviceInfo();
      const currentDeviceId = deviceInfo?.deviceId || '';

      // 1. 重新关联设备（确保设备的灵感关联到用户）
      if (currentDeviceId) {
        console.log('[Sync] 重新关联设备...');
        const linkResponse = await fetch(apiUrl('/api/device/link'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            deviceId: currentDeviceId,
            userId: user.id,
          }),
        });

        if (linkResponse.ok) {
          const result = await linkResponse.json();
          console.log(`[Sync] 设备关联成功，更新了 ${result.linkedFlashesCount} 条灵感`);
        }
      }

      // 2. 从服务器拉取数据
      console.log('[Sync] 从服务器拉取数据...');
      const pullResponse = await fetch(
        apiUrl(`/api/sync/pull?userId=${user.id}&deviceId=${currentDeviceId}`),
        { credentials: 'include' }
      );

      if (!pullResponse.ok) {
        return { success: false, message: `拉取数据失败: ${pullResponse.status}` };
      }

      const { serverFlashes }: SyncResponse = await pullResponse.json();
      console.log(`[Sync] 服务器返回 ${serverFlashes.length} 条灵感`);

      // 3. 清空本地数据并重新保存服务器数据
      const { clearAllFlashes } = await import('@/lib/offline/idb');
      await clearAllFlashes();
      console.log('[Sync] 已清空本地数据');

      for (const flash of serverFlashes) {
        await saveFlashLocally(flash);
      }
      console.log(`[Sync] 已保存 ${serverFlashes.length} 条灵感到本地`);

      // 4. 更新 UI
      const sortedFlashes = [...serverFlashes].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setFlashes(sortedFlashes);

      setLastSyncAt(new Date());
      return { success: true, message: `同步成功，共 ${serverFlashes.length} 条灵感` };
    } catch (error) {
      console.error('[Sync] 强制重新同步失败:', error);
      return { success: false, message: '同步失败，请稍后重试' };
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, user, isOffline, setFlashes]);

  return {
    isSyncing,
    lastSyncAt,
    syncPendingItems,
    pullFromServer,
    fullSync,
    forceResync,
  };
}
