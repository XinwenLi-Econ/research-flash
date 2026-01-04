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

// 发送验证邮件 - 通过直接 API 调用
export async function sendVerificationEmail({ email }: { email: string }) {
  const response = await fetch('/api/auth/send-verification-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return response.json();
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
