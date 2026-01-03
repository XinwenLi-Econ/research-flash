// hooks/useFlash.ts
// @source: cog.md, real.md R4
'use client';

import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Flash, CreateFlashInput, OfflineQueueItem, generateFlashId } from '@/types/flash';
import {
  saveFlashLocally,
  getAllFlashes,
  getFlashesByStatus,
  updateFlashLocally,
  addToSyncQueue,
} from '@/lib/offline/idb';
import { useOffline } from './useOffline';

// 获取或创建设备ID
function getDeviceId(): string {
  if (typeof window === 'undefined') return '';

  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = uuidv4();
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
}

export function useFlash() {
  const [flashes, setFlashes] = useState<Flash[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isOffline } = useOffline();

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
  const createFlash = useCallback(async (input: CreateFlashInput): Promise<Flash> => {
    const deviceId = getDeviceId();
    const now = new Date();

    const flash: Flash = {
      id: generateFlashId(now),
      content: input.content,
      status: 'incubating',
      deviceId,
      createdAt: now,
      syncedAt: null,
    };

    // 保存到本地
    await saveFlashLocally(flash);
    setFlashes(prev => [flash, ...prev]);

    // 添加到同步队列
    const queueItem: OfflineQueueItem = {
      id: uuidv4(),
      action: 'create',
      data: flash,
      timestamp: Date.now(),
    };
    await addToSyncQueue(queueItem);

    // 如果在线，尝试立即同步
    if (!isOffline) {
      try {
        const response = await fetch('/api/flash', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: input.content, deviceId }),
        });

        if (response.ok) {
          // 更新同步时间
          const syncedFlash = { ...flash, syncedAt: new Date() };
          await updateFlashLocally(syncedFlash);
          setFlashes(prev =>
            prev.map(f => f.id === flash.id ? syncedFlash : f)
          );
        }
      } catch (error) {
        console.error('同步失败，已保存到本地:', error);
      }
    }

    return flash;
  }, [isOffline]);

  // 归档灵感
  const archiveFlash = useCallback(async (id: string) => {
    const flash = flashes.find(f => f.id === id);
    if (!flash) return;

    const updatedFlash: Flash = {
      ...flash,
      status: 'archived',
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

  // 按状态筛选
  const getFlashesByStatusLocal = useCallback((status: Flash['status']) => {
    return flashes.filter(f => f.status === status);
  }, [flashes]);

  return {
    flashes,
    isLoading,
    createFlash,
    archiveFlash,
    getIncubating: () => getFlashesByStatusLocal('incubating'),
    getSurfaced: () => getFlashesByStatusLocal('surfaced'),
    getArchived: () => getFlashesByStatusLocal('archived'),
    reload: loadFlashes,
  };
}
