// lib/auth-client.ts
// @source: cog.md
// Better Auth 客户端配置

'use client';

import { createAuthClient } from 'better-auth/react';

// 运行时获取 baseURL，确保在浏览器中使用当前域名
function getBaseURL() {
  // 优先使用环境变量（构建时注入）
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  // 浏览器环境：使用当前页面的 origin
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  // 服务端回退
  return 'http://localhost:3000';
}

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
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
