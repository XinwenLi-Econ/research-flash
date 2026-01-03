// hooks/useSync.ts
// @source: real.md R4
'use client';

import { useEffect, useCallback } from 'react';
import { useOffline } from './useOffline';
import { getPendingSyncItems, clearSyncedItem } from '@/lib/offline/idb';

export function useSync() {
  const { isOffline } = useOffline();

  const syncPendingItems = useCallback(async () => {
    if (isOffline) return;

    const pendingItems = await getPendingSyncItems();

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
  }, [isOffline]);

  // 网络恢复时自动同步
  useEffect(() => {
    if (!isOffline) {
      syncPendingItems();
    }
  }, [isOffline, syncPendingItems]);

  return { syncPendingItems };
}
