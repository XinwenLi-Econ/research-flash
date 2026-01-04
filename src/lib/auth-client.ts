// lib/auth-client.ts
// @source: cog.md
// Better Auth 客户端配置

'use client';

import { createAuthClient } from 'better-auth/react';

// 使用空字符串让 better-auth 使用相对路径
// 浏览器会自动基于当前域名发送请求
export const authClient = createAuthClient({
  baseURL: '',
});

// 导出常用方法
export const {
  signIn,
  signUp,
  signOut,
  useSession,
} = authClient;

// 发送验证邮件 - 使用 Better Auth 客户端内置方法
export async function sendVerificationEmail({ email, callbackURL = '/' }: { email: string; callbackURL?: string }) {
  console.log('[AuthClient] Sending verification email to:', email);
  try {
    const result = await authClient.sendVerificationEmail({
      email,
      callbackURL,
    });
    console.log('[AuthClient] sendVerificationEmail result:', result);
    return result;
  } catch (error) {
    console.error('[AuthClient] sendVerificationEmail error:', error);
    throw error;
  }
}

// 修改密码 - 通过直接 API 调用
export async function changePassword({
  currentPassword,
  newPassword,
  revokeOtherSessions = false,
}: {
  currentPassword: string;
  newPassword: string;
  revokeOtherSessions?: boolean;
}) {
  const response = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword, revokeOtherSessions }),
    credentials: 'include',
  });
  const data = await response.json();
  if (!response.ok) {
    return { error: data.error || { message: '修改失败' } };
  }
  return data;
}
