// app/api/sync/route.ts
// @source: real.md R4
// 同步 API - 处理离线队列项
// 鉴权策略：
//   data.userId 为空: 公开（设备级数据）
//   data.userId 非空: Session 必需（需验证 session.user.id === data.userId）

import { NextRequest, NextResponse } from 'next/server';
import { flashService } from '@/services/flash.service';
import { requireSession, checkRateLimit, getClientIP } from '@/lib/auth-helpers';
import { z } from 'zod';

// 强制动态渲染
export const dynamic = 'force-dynamic';

// 同步请求验证 schema
const syncItemSchema = z.object({
  id: z.string(),
  action: z.enum(['create', 'update', 'delete']),
  data: z.object({
    id: z.string(),
    content: z.string().max(280),
    status: z.enum(['incubating', 'surfaced', 'archived', 'deleted']),
    deviceId: z.string(),
    userId: z.string().nullable().optional(),
    createdAt: z.string().or(z.date()),
    syncedAt: z.string().or(z.date()).nullable().optional(),
    updatedAt: z.string().or(z.date()),
    version: z.string().or(z.date()),
    // 软删除相关字段
    deletedAt: z.string().or(z.date()).nullable().optional(),
    previousStatus: z.enum(['incubating', 'surfaced', 'archived']).nullable().optional(),
  }),
  timestamp: z.number(),
});

/**
 * POST /api/sync - 推送同步
 * 鉴权：
 *   data.userId 为空: 公开 + 速率限制
 *   data.userId 非空: Session 必需（验证所有权）
 */
export async function POST(request: NextRequest) {
  try {
    // 速率限制检查
    const clientIP = getClientIP(request);
    const rateLimit = checkRateLimit(`sync:push:${clientIP}`, 120, 60000);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: '请求过于频繁，请稍后再试',
          retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const validated = syncItemSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: '同步数据无效', details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const { action, data } = validated.data;

    // 如果数据包含 userId，需要验证 Session
    if (data.userId) {
      const authResult = await requireSession(request, data.userId);

      if (!authResult.authenticated) {
        return authResult.error;
      }
    }

    // 转换日期字段
    const flash = {
      id: data.id,
      content: data.content,
      status: data.status as 'incubating' | 'surfaced' | 'archived' | 'deleted',
      deviceId: data.deviceId,
      userId: data.userId || null,
      createdAt: new Date(data.createdAt),
      syncedAt: data.syncedAt ? new Date(data.syncedAt) : null,
      updatedAt: new Date(data.updatedAt),
      version: new Date(data.version),
      deletedAt: data.deletedAt ? new Date(data.deletedAt) : undefined,
      previousStatus: data.previousStatus || undefined,
    };

    switch (action) {
      case 'create':
      case 'update':
        await flashService.syncFlash(flash);
        break;
      case 'delete':
        await flashService.deleteFlash(flash.id);
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/sync 错误:', error);
    return NextResponse.json(
      { error: '同步失败' },
      { status: 500 }
    );
  }
}
