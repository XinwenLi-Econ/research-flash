// app/api/sync/route.ts
// @source: real.md R4

import { NextRequest, NextResponse } from 'next/server';
import { flashService } from '@/services/flash.service';
import { z } from 'zod';

// 同步请求验证 schema
const syncItemSchema = z.object({
  id: z.string(),
  action: z.enum(['create', 'update', 'delete']),
  data: z.object({
    id: z.string(),
    content: z.string().max(280),
    status: z.enum(['incubating', 'surfaced', 'archived']),
    deviceId: z.string(),
    createdAt: z.string().or(z.date()),
    syncedAt: z.string().or(z.date()).nullable(),
  }),
  timestamp: z.number(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = syncItemSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: '同步数据无效', details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const { action, data } = validated.data;

    // 转换日期
    const flash = {
      ...data,
      createdAt: new Date(data.createdAt),
      syncedAt: data.syncedAt ? new Date(data.syncedAt) : null,
    };

    switch (action) {
      case 'create':
      case 'update':
        await flashService.syncFlash(flash);
        break;
      case 'delete':
        // TODO: 实现删除逻辑
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
