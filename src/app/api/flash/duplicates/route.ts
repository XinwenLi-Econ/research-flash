// app/api/flash/duplicates/route.ts
// 检测和清理重复灵感 API

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { flashes } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { checkRateLimit, getClientIP } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/flash/duplicates - 获取重复灵感
 * 查询参数: userId
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: '需要 userId 参数' }, { status: 400 });
    }

    // 获取用户所有灵感
    const userFlashes = await db.select()
      .from(flashes)
      .where(eq(flashes.userId, userId))
      .orderBy(desc(flashes.createdAt));

    // 按内容分组，找出重复的
    const contentMap = new Map<string, typeof userFlashes>();
    for (const flash of userFlashes) {
      const key = flash.content.trim();
      if (!contentMap.has(key)) {
        contentMap.set(key, []);
      }
      contentMap.get(key)!.push(flash);
    }

    // 找出有重复的
    const duplicates: Array<{
      content: string;
      count: number;
      flashes: typeof userFlashes;
    }> = [];

    for (const [content, flashList] of contentMap) {
      if (flashList.length > 1) {
        duplicates.push({
          content: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
          count: flashList.length,
          flashes: flashList,
        });
      }
    }

    console.log(`[/api/flash/duplicates] userId=${userId}, 找到 ${duplicates.length} 组重复灵感`);

    return NextResponse.json({ duplicates });
  } catch (error) {
    console.error('GET /api/flash/duplicates 错误:', error);
    return NextResponse.json({ error: '查询失败' }, { status: 500 });
  }
}

/**
 * DELETE /api/flash/duplicates - 清理重复灵感（保留最早的一条）
 * Body: { userId: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);
    const rateLimit = checkRateLimit(`duplicates:delete:${clientIP}`, 10, 60000);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: '请求过于频繁，请稍后再试' },
        { status: 429 }
      );
    }

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: '需要 userId 参数' }, { status: 400 });
    }

    // 获取用户所有灵感
    const userFlashes = await db.select()
      .from(flashes)
      .where(eq(flashes.userId, userId))
      .orderBy(desc(flashes.createdAt));

    // 按内容分组
    const contentMap = new Map<string, typeof userFlashes>();
    for (const flash of userFlashes) {
      const key = flash.content.trim();
      if (!contentMap.has(key)) {
        contentMap.set(key, []);
      }
      contentMap.get(key)!.push(flash);
    }

    // 删除重复的（保留最早创建的）
    let deletedCount = 0;
    for (const [, flashList] of contentMap) {
      if (flashList.length > 1) {
        // 按创建时间排序，保留最早的
        flashList.sort((a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );

        // 删除除第一条外的所有重复
        for (let i = 1; i < flashList.length; i++) {
          await db.delete(flashes).where(eq(flashes.id, flashList[i].id));
          deletedCount++;
        }
      }
    }

    console.log(`[/api/flash/duplicates] userId=${userId}, 删除了 ${deletedCount} 条重复灵感`);

    return NextResponse.json({ success: true, deletedCount });
  } catch (error) {
    console.error('DELETE /api/flash/duplicates 错误:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
