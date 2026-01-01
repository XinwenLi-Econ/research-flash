// app/api/sync/pull/route.ts
// @source: cog.md
// 同步拉取 API - 用于跨设备同步
// 鉴权策略：Session 必需（需验证 session.user.id === userId）

import { NextRequest, NextResponse } from 'next/server';
import { flashService } from '@/services/flash.service';
import { requireSession } from '@/lib/auth-helpers';

// 强制动态渲染
export const dynamic = 'force-dynamic';

/**
 * GET /api/sync/pull - 拉取用户所有灵感
 * 鉴权：Session 必需（验证所有权）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: '需要 userId 参数' },
        { status: 400 }
      );
    }

    // Session 验证：必须登录且 userId 匹配
    const authResult = await requireSession(request, userId);

    if (!authResult.authenticated) {
      return authResult.error;
    }

    // 获取用户所有设备的灵感
    const serverFlashes = await flashService.getFlashesByUser(userId);

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
