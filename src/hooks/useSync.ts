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
  getDeviceInfo,
} from '@/lib/offline/idb';
import type { Flash, SyncResponse } from '@/types/flash';
import { resolveConflict } from '@/types/flash';

export function useSync() {
  const { isOffline } = useOffline();
  const { user, isAuthenticated } = useAuth();
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
        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });

        if (response.ok) {
          await clearSyncedItem(item.id);
        }
      } catch (error) {
        console.error('同步失败:', error);
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
        `/api/sync/pull?userId=${user.id}&deviceId=${deviceInfo?.deviceId || ''}`
      );

      if (!response.ok) {
        console.error('拉取数据失败:', response.statusText);
        return [];
      }

      const { serverFlashes }: SyncResponse = await response.json();
      const localFlashes = await getAllFlashes();

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

      if (conflicts.length > 0) {
        console.log(`已解决 ${conflicts.length} 个冲突（LWW）`);
      }

      setLastSyncAt(new Date());
      return serverFlashes;
    } catch (error) {
      console.error('拉取服务器数据失败:', error);
      return [];
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, user, isOffline]);

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

  return {
    isSyncing,
    lastSyncAt,
    syncPendingItems,
    pullFromServer,
    fullSync,
  };
}
