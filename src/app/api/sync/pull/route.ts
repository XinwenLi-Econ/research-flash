// app/api/sync/pull/route.ts
// @source: cog.md
// 同步拉取 API - 用于跨设备同步
// 鉴权策略：公开 + 速率限制（与 /api/sync POST 一致）

import { NextRequest, NextResponse } from 'next/server';
import { flashService } from '@/services/flash.service';
import { checkRateLimit, getClientIP } from '@/lib/auth-helpers';

// 强制动态渲染
export const dynamic = 'force-dynamic';

/**
 * GET /api/sync/pull - 拉取用户所有灵感
 * 鉴权：公开 + 速率限制（信任客户端传的 userId）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    console.log(`[/api/sync/pull] 收到请求, userId=${userId}`);

    if (!userId) {
      console.log('[/api/sync/pull] 缺少 userId 参数');
      return NextResponse.json(
        { error: '需要 userId 参数' },
        { status: 400 }
      );
    }

    // 速率限制检查
    const clientIP = getClientIP(request);
    const rateLimit = checkRateLimit(`sync:pull:${clientIP}`, 60, 60000);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: '请求过于频繁，请稍后再试',
          retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
        },
        { status: 429 }
      );
    }

    // 获取用户所有设备的灵感
    const serverFlashes = await flashService.getFlashesByUser(userId);

    console.log(`[/api/sync/pull] 返回 ${serverFlashes.length} 条灵感, userId=${userId}`);

    return NextResponse.json({
      serverFlashes,
      conflicts: [], // 冲突由客户端处理
    });
  } catch (error) {
    console.error('GET /api/sync/pull 错误:', error);
    return NextResponse.json(
      { error: '同步拉取失败' },
      { status: 500 }
    );
  }
}
