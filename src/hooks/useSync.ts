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
      const response = await fetch(
        apiUrl(`/api/sync/pull?userId=${user.id}&deviceId=${deviceInfo?.deviceId || ''}`),
        { credentials: 'include' }
      );

      if (!response.ok) {
        console.error('[Sync] 拉取数据失败:', response.status, response.statusText);
        return [];
      }

      const { serverFlashes }: SyncResponse = await response.json();
      const localFlashes = await getAllFlashes();

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
      const currentDeviceId = deviceInfo?.deviceId || '';

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

    // 只在从未登录 -> 已登录时触发一次
    if (isAuthenticated && wasAuthenticated === false && !isOffline && !syncInProgress.current) {
      syncInProgress.current = true;
      pullFromServer().finally(() => {
        syncInProgress.current = false;
      });
    }
  }, [isAuthenticated, isOffline]); // eslint-disable-line react-hooks/exhaustive-deps

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

  return {
    isSyncing,
    lastSyncAt,
    syncPendingItems,
    pullFromServer,
    fullSync,
  };
}
