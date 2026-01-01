// app/api/device/link/route.ts
// @source: cog.md
// 设备关联 API - 将设备关联到用户账户
// 鉴权策略：Session 必需（需验证 session.user.id === userId）

import { NextRequest, NextResponse } from 'next/server';
import { flashService } from '@/services/flash.service';
import { requireSession } from '@/lib/auth-helpers';
import { z } from 'zod';

// 强制动态渲染
export const dynamic = 'force-dynamic';

const linkSchema = z.object({
  deviceId: z.string().uuid(),
  userId: z.string(),
});

/**
 * POST /api/device/link - 关联设备到用户账户
 * 鉴权：Session 必需（验证所有权）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = linkSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: '输入无效', details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const { deviceId, userId } = validated.data;

    // Session 验证：必须登录且 userId 匹配
    const authResult = await requireSession(request, userId);

    if (!authResult.authenticated) {
      return authResult.error;
    }

    // 关联设备并更新该设备的灵感
    const linkedCount = await flashService.linkDeviceToUser(deviceId, userId);

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
