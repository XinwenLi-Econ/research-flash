// app/api/cron/auto-surface/route.ts
// 每日自动 Surface 过期灵感

import { NextRequest, NextResponse } from 'next/server';
import { flashService } from '@/services/flash.service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // 验证 Cron 密钥（Vercel Cron 会自动发送此 header）
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const count = await flashService.autoSurfaceExpiredFlashes();

    console.log(`[Cron] Auto-surface completed: ${count} flashes surfaced`);

    return NextResponse.json({
      success: true,
      surfaced: count,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Cron] Auto-surface error:', error);
    return NextResponse.json(
      {
        error: 'Auto-surface failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
