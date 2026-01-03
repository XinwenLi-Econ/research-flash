// app/api/flash/route.ts
// @source: real.md R2

import { NextRequest, NextResponse } from 'next/server';
import { flashService } from '@/services/flash.service';
import { z } from 'zod';

// 输入验证 schema @R2
const createFlashSchema = z.object({
  content: z.string().min(1).max(280), // @R2: 280字限制
  deviceId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createFlashSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: '输入无效', details: validated.error.flatten() },
        { status: 400 }
      );
    }

    const flash = await flashService.createFlash(validated.data);
    return NextResponse.json({ data: flash }, { status: 201 });
  } catch (error) {
    console.error('POST /api/flash 错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    if (!deviceId) {
      return NextResponse.json(
        { error: '缺少 deviceId' },
        { status: 400 }
      );
    }

    const flashes = await flashService.getFlashesByDevice(deviceId);
    return NextResponse.json({ data: flashes });
  } catch (error) {
    console.error('GET /api/flash 错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
