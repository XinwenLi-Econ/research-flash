// app/api/cron/weekly-digest/route.ts
// 周日邮件推送 - 每周日 UTC 12:00（北京时间 20:00）运行一次

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, flashes } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { sendWeeklyDigestEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

// 检查本周是否已发送
function hasAlreadySentThisWeek(lastSentAt: Date | null): boolean {
  if (!lastSentAt) return false;

  const now = new Date();
  const lastSent = new Date(lastSentAt);

  // 获取本周日的开始时间（周日 00:00 UTC）
  const currentDay = now.getUTCDay();
  const sundayStart = new Date(now);
  sundayStart.setUTCDate(now.getUTCDate() - currentDay);
  sundayStart.setUTCHours(0, 0, 0, 0);

  return lastSent >= sundayStart;
}

export async function GET(request: NextRequest) {
  // 验证 Cron 密钥
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://flash.xinwen-li.com';

  try {
    // 查询所有已验证邮箱的用户
    const verifiedUsers = await db.select()
      .from(users)
      .where(eq(users.emailVerified, true));

    let sentCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const user of verifiedUsers) {
      // 检查本周是否已发送
      if (hasAlreadySentThisWeek(user.lastDigestSentAt)) {
        skippedCount++;
        continue;
      }

      // 获取用户的待回顾灵感
      const surfacedFlashes = await db.select()
        .from(flashes)
        .where(and(
          eq(flashes.userId, user.id),
          eq(flashes.status, 'surfaced')
        ));

      if (surfacedFlashes.length === 0) {
        skippedCount++;
        continue;
      }

      // 发送邮件
      const result = await sendWeeklyDigestEmail(
        user.email,
        user.name || undefined,
        surfacedFlashes.map(f => ({
          id: f.id,
          content: f.content,
          createdAt: f.createdAt
        })),
        appUrl
      );

      if (result.success) {
        // 更新 lastDigestSentAt
        await db.update(users)
          .set({ lastDigestSentAt: new Date() })
          .where(eq(users.id, user.id));
        sentCount++;
      } else {
        errors.push(`${user.email}: ${result.error}`);
      }
    }

    console.log(`[Cron] Weekly digest completed: ${sentCount} sent, ${skippedCount} skipped`);

    return NextResponse.json({
      success: true,
      sent: sentCount,
      skipped: skippedCount,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron] Weekly digest error:', error);
    return NextResponse.json(
      {
        error: 'Weekly digest failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
