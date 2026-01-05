// hooks/useAuth.ts
// @source: cog.md
// 认证 Hook - 支持离线缓存
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession, signIn, signUp, signOut } from '@/lib/auth-client';
import {
  saveAuthCache,
  getAuthCache,
  clearAuthCache,
  saveDeviceInfo,
  getDeviceInfo,
  linkDeviceToUser,
  unlinkDeviceFromUser,
} from '@/lib/offline/idb';
import type { AuthUser, AuthState } from '@/types/auth';
import { v4 as uuidv4 } from 'uuid';
import { apiUrl } from '@/lib/api-config';

/**
 * 获取或创建设备ID
 * 优先从 IndexedDB 读取，fallback 到 localStorage（向后兼容）
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

export function useAuth(): AuthState & {
  signIn: typeof signIn;
  signUp: typeof signUp;
  signOut: () => Promise<void>;
  linkDevice: (deviceId: string) => Promise<void>;
  deviceId: string;
} {
  const { data: session, isPending } = useSession();
  const [offlineUser, setOfflineUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deviceId, setDeviceId] = useState<string>('');

  // 初始化：检查离线缓存和设备ID
  useEffect(() => {
    async function init() {
      try {
        // 获取设备ID
        const id = await getOrCreateDeviceId();
        setDeviceId(id);

        // 检查离线认证缓存
        const cachedAuth = await getAuthCache();
        if (cachedAuth) {
          setOfflineUser({
            id: cachedAuth.userId,
            email: cachedAuth.email,
            name: cachedAuth.name,
            emailVerified: true, // 缓存的用户已验证
          });
        }
      } catch (error) {
        console.error('初始化认证失败:', error);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // 同步在线会话到离线缓存（使用 ref 防止循环）
  const hasSyncedSession = useRef(false);
  const lastSessionId = useRef<string | null>(null);

  useEffect(() => {
    async function syncToCache() {
      if (session?.user) {
        // 检查是否是同一个会话，避免重复同步
        const sessionId = session.session?.token || session.user.id;
        if (lastSessionId.current === sessionId) return;
        lastSessionId.current = sessionId;

        // 保存认证缓存
        await saveAuthCache({
          userId: session.user.id,
          email: session.user.email,
          name: session.user.name,
          token: session.session?.token || '',
          expiresAt: session.session?.expiresAt
            ? new Date(session.session.expiresAt).getTime()
            : Date.now() + 30 * 24 * 60 * 60 * 1000, // 默认30天
          cachedAt: Date.now(),
        });

        // 更新离线用户状态（只在首次同步时更新）
        if (!hasSyncedSession.current) {
          hasSyncedSession.current = true;
          setOfflineUser({
            id: session.user.id,
            email: session.user.email,
            name: session.user.name,
            image: session.user.image || undefined,
            emailVerified: session.user.emailVerified,
          });
        }

        // 关联设备（本地 + 服务端）
        if (deviceId) {
          // 本地关联
          await linkDeviceToUser(session.user.id);

          // 🚀 服务端关联：将设备的灵感关联到用户
          try {
            const response = await fetch(apiUrl('/api/device/link'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                deviceId,
                userId: session.user.id,
              }),
            });
            if (response.ok) {
              const result = await response.json();
              console.log(`[Auth] 设备关联成功，关联了 ${result.linkedFlashesCount} 条灵感`);
            }
          } catch (error) {
            console.error('[Auth] 服务端设备关联失败:', error);
            // 离线时忽略，下次登录重试
          }
        }
      }
    }

    if (!isPending && session) {
      syncToCache();
    }
  }, [session, isPending, deviceId]);

  // 用户信息：优先在线，fallback 到离线缓存
  const user = session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image || undefined,
        emailVerified: session.user.emailVerified,
      }
    : offlineUser;

  // 登出时清理缓存
  const handleSignOut = useCallback(async () => {
    await clearAuthCache();
    await unlinkDeviceFromUser();
    setOfflineUser(null);
    await signOut();
  }, []);

  // 关联设备到当前用户
  const handleLinkDevice = useCallback(async (targetDeviceId: string) => {
    if (!user) return;

    // 本地关联
    await linkDeviceToUser(user.id);

    // 服务端关联
    try {
      await fetch(apiUrl('/api/device/link'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: targetDeviceId,
          userId: user.id,
        }),
      });
    } catch (error) {
      console.error('设备关联失败:', error);
      // 离线时保存在本地，稍后同步
    }
  }, [user]);

  return {
    user,
    isAuthenticated: !!user,
    isLoading: isPending || isLoading,
    signIn,
    signUp,
    signOut: handleSignOut,
    linkDevice: handleLinkDevice,
    deviceId,
  };
}
