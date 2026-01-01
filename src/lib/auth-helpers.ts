// lib/auth-helpers.ts
// @source: cog.md
// API 路由鉴权辅助函数

import { NextRequest, NextResponse } from 'next/server';
import { auth } from './auth';

/**
 * 鉴权结果类型
 */
export type AuthResult =
  | { authenticated: true; session: { user: { id: string; email: string; name: string } } }
  | { authenticated: false; error: NextResponse };

/**
 * 验证 Session 并可选验证用户 ID
 * @param request - Next.js 请求对象
 * @param expectedUserId - 可选，期望的用户 ID（用于资源所有权验证）
 */
export async function requireSession(
  request: NextRequest,
  expectedUserId?: string
): Promise<AuthResult> {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || !session.user) {
      return {
        authenticated: false,
        error: NextResponse.json(
          { error: '未登录，请先登录' },
          { status: 401 }
        ),
      };
    }

    // 如果指定了期望的 userId，验证所有权
    if (expectedUserId && session.user.id !== expectedUserId) {
      return {
        authenticated: false,
        error: NextResponse.json(
          { error: '无权访问此资源' },
          { status: 403 }
        ),
      };
    }

    return {
      authenticated: true,
      session: {
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
        },
      },
    };
  } catch (error) {
    console.error('Session 验证失败:', error);
    return {
      authenticated: false,
      error: NextResponse.json(
        { error: '认证服务异常' },
        { status: 500 }
      ),
    };
  }
}

/**
 * 可选验证 Session（不强制要求登录）
 * @param request - Next.js 请求对象
 */
export async function optionalSession(
  request: NextRequest
): Promise<{ user: { id: string; email: string; name: string } } | null> {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session || !session.user) {
      return null;
    }

    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      },
    };
  } catch {
    return null;
  }
}

/**
 * 简单的内存速率限制器
 * 生产环境建议使用 Redis
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 60,
  windowMs: number = 60000
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  // 清理过期记录
  if (record && record.resetAt < now) {
    rateLimitStore.delete(identifier);
  }

  const current = rateLimitStore.get(identifier);

  if (!current) {
    // 首次请求
    const resetAt = now + windowMs;
    rateLimitStore.set(identifier, { count: 1, resetAt });
    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }

  if (current.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count++;
  return { allowed: true, remaining: maxRequests - current.count, resetAt: current.resetAt };
}

/**
 * 获取客户端 IP 地址
 */
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  if (realIP) {
    return realIP;
  }

  return 'unknown';
}
