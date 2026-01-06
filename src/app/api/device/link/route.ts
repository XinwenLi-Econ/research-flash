// app/api/device/link/route.ts
// @source: cog.md
// 设备关联 API - 将设备关联到用户账户
// 鉴权策略：公开 + 速率限制（与其他同步 API 一致，解决原生应用 cookie 问题）

import { NextRequest, NextResponse } from 'next/server';
import { flashService } from '@/services/flash.service';
import { checkRateLimit, getClientIP } from '@/lib/auth-helpers';
import { z } from 'zod';

// 强制动态渲染
export const dynamic = 'force-dynamic';

const linkSchema = z.object({
  deviceId: z.string().uuid(),
  userId: z.string().min(1),
});

/**
 * POST /api/device/link - 关联设备到用户账户
 * 鉴权：公开 + 速率限制（信任客户端传的 userId，与 /api/sync 一致）
 */
export async function POST(request: NextRequest) {
  try {
    // 速率限制
    const clientIP = getClientIP(request);
    const rateLimit = checkRateLimit(`device:link:${clientIP}`, 30, 60000);

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
    const validated = linkSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: '输入无效', details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const { deviceId, userId } = validated.data;

    console.log(`[/api/device/link] 关联设备 deviceId=${deviceId}, userId=${userId}`);

    // 关联设备并更新该设备的灵感
    const linkedCount = await flashService.linkDeviceToUser(deviceId, userId);

    console.log(`[/api/device/link] 关联成功，更新了 ${linkedCount} 条灵感`);

    return NextResponse.json({
      success: true,
      linkedFlashesCount: linkedCount,
    });
  } catch (error) {
    console.error('POST /api/device/link 错误:', error);
    return NextResponse.json(
      { error: '设备关联失败' },
      { status: 500 }
    );
  }
}
