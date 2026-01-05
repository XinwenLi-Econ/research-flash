// app/api/trash/clear/route.ts
// 清空回收站 API - 永久删除所有已删除的灵感

import { NextRequest, NextResponse } from 'next/server';
import { flashService } from '@/services/flash.service';
import { checkRateLimit, getClientIP } from '@/lib/auth-helpers';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const clearTrashSchema = z.object({
  userId: z.string().min(1, '用户ID必填'),
});

/**
 * POST /api/trash/clear - 清空回收站
 * 永久删除该用户所有状态为 deleted 的灵感
 */
export async function POST(request: NextRequest) {
  try {
    // 速率限制
    const clientIP = getClientIP(request);
    const rateLimit = checkRateLimit(`trash:clear:${clientIP}`, 10, 60000);

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
    const validated = clearTrashSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: '参数无效', details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const { userId } = validated.data;

    // 永久删除所有状态为 deleted 的灵感
    const deletedCount = await flashService.permanentDeleteFlashesByUser(userId, 'deleted');

    return NextResponse.json({
      success: true,
      deletedCount,
    });
  } catch (error) {
    console.error('POST /api/trash/clear 错误:', error);
    return NextResponse.json(
      { error: '清空回收站失败' },
      { status: 500 }
    );
  }
}
