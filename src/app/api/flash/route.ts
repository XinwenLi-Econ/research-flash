// app/api/flash/route.ts
// @source: real.md R2
// Flash API - 支持跨设备同步
// 鉴权策略：
//   POST: 公开 + 速率限制
//   GET ?deviceId: 公开
//   GET ?userId: Session 必需

import { NextRequest, NextResponse } from 'next/server';
import { flashService } from '@/services/flash.service';
import { requireSession, checkRateLimit, getClientIP } from '@/lib/auth-helpers';
import { z } from 'zod';

// 强制动态渲染
export const dynamic = 'force-dynamic';

// 输入验证 schema @R2
const createFlashSchema = z.object({
  content: z.string().min(1).max(280), // @R2: 280字限制
  deviceId: z.string().uuid(),
  userId: z.string().nullable().optional(),
});

/**
 * POST /api/flash - 创建灵感
 * 鉴权：公开 + 速率限制（60次/分钟/IP）
 */
export async function POST(request: NextRequest) {
  try {
    // 速率限制检查
    const clientIP = getClientIP(request);
    const rateLimit = checkRateLimit(`flash:create:${clientIP}`, 60, 60000);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: '请求过于频繁，请稍后再试',
          retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    const body = await request.json();
    const validated = createFlashSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: '输入无效', details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const flash = await flashService.createFlash({
      content: validated.data.content,
      deviceId: validated.data.deviceId,
      userId: validated.data.userId || null,
    });

    return NextResponse.json(
      { data: flash },
      {
        status: 201,
        headers: {
          'X-RateLimit-Remaining': String(rateLimit.remaining),
        },
      }
    );
  } catch (error) {
    console.error('POST /api/flash 错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/flash - 查询灵感
 * 鉴权：
 *   ?deviceId: 公开（设备级查询）
 *   ?userId: Session 必需（需验证 session.user.id === userId）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');
    const userId = searchParams.get('userId');

    // userId 查询：需要 Session 验证
    if (userId) {
      const authResult = await requireSession(request, userId);

      if (!authResult.authenticated) {
        return authResult.error;
      }

      const flashes = await flashService.getFlashesByUser(userId);
      return NextResponse.json({ data: flashes });
    }

    // deviceId 查询：公开访问
    if (deviceId) {
      const flashes = await flashService.getFlashesByDevice(deviceId);
      return NextResponse.json({ data: flashes });
    }

    return NextResponse.json(
      { error: '需要 deviceId 或 userId 参数' },
      { status: 400 }
    );
  } catch (error) {
    console.error('GET /api/flash 错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
