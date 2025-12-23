---
name: researchflash-spec-coding
description: ResearchFlash 灵感速记本编码实现规约
depends:
  - real.md
  - cog.md
---

# 编码实现规约 - ResearchFlash

> 本规约基于 `dev-coding` 技能生成，指导按照既定架构实现应用代码。

---

## 一、上下文加载

### 从 cog.md 提取

<context-cog>

**智能体能力**：
- user：本地用户，无需注册登录，以设备UUID识别

**信息结构**：
- flash：灵感碎片
  - 唯一编码：时间戳 YYYYMMDDHHmm
  - 状态：Incubating → Surfaced → Archived（单向流转）
  - 内容：用户原创文本

**上下文边界**：
- 离线优先架构
- 本地存储 + 云端同步
- 无认证系统（MVP阶段）

</context-cog>

### 从 real.md 提取

<context-real>

| 约束ID | 约束内容 | 编码影响 |
|--------|----------|----------|
| R1 | 首屏直接展示输入框 | page.tsx 直接渲染输入组件，无中间路由 |
| R2 | 单条灵感280字限制 | 前端实时校验 + 后端二次校验 |
| R3 | 每周日晚8点推送 | Cron Job 或 Web Push API |
| R4 | 离线写入自动同步 | IndexedDB + Service Worker |

</context-real>

---

## 二、技术栈锁定

<tech-stack>

| 层级 | 技术选型 | 版本要求 |
|------|----------|----------|
| 框架 | Next.js (App Router) | 15.x |
| 语言 | TypeScript | 5.x |
| 样式 | Tailwind CSS | 3.x |
| UI组件 | Shadcn/ui | latest |
| 运行时 | Bun | 1.x |
| ORM | Drizzle ORM | latest |
| 离线存储 | IndexedDB (idb) | latest |
| 推送 | Web Push API | - |

</tech-stack>

---

## 三、文件组织

<file-structure>

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                 # 首页（输入框直出）@R1
│   ├── review/
│   │   └── page.tsx             # 灵感回顾页
│   ├── archive/
│   │   └── page.tsx             # 归档列表页
│   └── api/
│       ├── flash/
│       │   └── route.ts         # 灵感CRUD
│       └── sync/
│           └── route.ts         # 离线同步 @R4
├── components/
│   ├── FlashInput.tsx           # 核心输入组件 @R1
│   ├── FlashCard.tsx            # 灵感卡片
│   ├── CharCounter.tsx          # 字数计数器 @R2
│   └── StatusBadge.tsx          # 状态标签
├── hooks/
│   ├── useFlash.ts              # 灵感CRUD hook
│   ├── useOffline.ts            # 离线状态检测 @R4
│   └── useSync.ts               # 同步逻辑 @R4
├── lib/
│   ├── db/
│   │   ├── schema.ts            # Drizzle schema
│   │   └── index.ts             # 数据库连接
│   ├── offline/
│   │   ├── idb.ts               # IndexedDB操作 @R4
│   │   └── sync.ts              # 同步队列 @R4
│   ├── scheduler.ts             # 推送调度器 @R3
│   └── utils.ts                 # 工具函数
├── services/
│   └── flash.service.ts         # 灵感业务逻辑
├── types/
│   └── flash.ts                 # 类型定义
└── workers/
    └── sw.ts                    # Service Worker @R4
```

</file-structure>

---

## 四、类型定义

<types>

```typescript
// types/flash.ts
// @source: cog.md

/**
 * 灵感状态枚举
 * 状态流转：Incubating → Surfaced → Archived（单向不可逆）
 */
export type FlashStatus = 'incubating' | 'surfaced' | 'archived';

/**
 * 灵感实体
 * 唯一编码：时间戳 YYYYMMDDHHmm
 */
export interface Flash {
  id: string;                    // 时间戳编码
  content: string;               // 内容，max 280字符 @R2
  status: FlashStatus;           // 状态
  deviceId: string;              // 所属用户设备UUID
  createdAt: Date;               // 创建时间
  syncedAt: Date | null;         // 同步时间（null表示未同步）@R4
}

/**
 * 创建灵感输入
 */
export interface CreateFlashInput {
  content: string;               // 1-280字符 @R2
}

/**
 * 离线队列项
 */
export interface OfflineQueueItem {
  id: string;
  action: 'create' | 'update' | 'delete';
  data: Flash;
  timestamp: number;
}
```

</types>

---

## 五、核心组件实现

### 5.1 首页输入组件

<component name="FlashInput">

```typescript
// components/FlashInput.tsx
// @source: real.md R1, R2
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { CharCounter } from './CharCounter';
import { useFlash } from '@/hooks/useFlash';
import { useOffline } from '@/hooks/useOffline';

const MAX_LENGTH = 280; // @R2

export function FlashInput() {
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { createFlash } = useFlash();
  const { isOffline } = useOffline();

  // @R1: 首屏自动聚焦
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!content.trim() || content.length > MAX_LENGTH) return;

    setIsSaving(true);
    try {
      await createFlash({ content: content.trim() });
      setContent('');
      // 保存成功反馈（< 300ms）
    } catch (error) {
      console.error('保存灵感失败:', error);
    } finally {
      setIsSaving(false);
    }
  }, [content, createFlash]);

  const isOverLimit = content.length > MAX_LENGTH;
  const canSubmit = content.trim().length > 0 && !isOverLimit && !isSaving;

  return (
    <div className="w-full max-w-md mx-auto p-4">
      {isOffline && (
        <div className="mb-2 text-sm text-amber-600">
          离线模式 - 灵感将在网络恢复后同步
        </div>
      )}
      <textarea
        ref={inputRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="捕捉你的灵感..."
        className="w-full h-32 p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500"
        disabled={isSaving}
      />
      <div className="flex justify-between items-center mt-2">
        <CharCounter current={content.length} max={MAX_LENGTH} />
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50"
        >
          {isSaving ? '保存中...' : '保存'}
        </button>
      </div>
      {isOverLimit && (
        <div className="mt-1 text-sm text-red-500">
          请精简至280字内 {/* @R2 */}
        </div>
      )}
    </div>
  );
}
```

</component>

### 5.2 字数计数器

<component name="CharCounter">

```typescript
// components/CharCounter.tsx
// @source: real.md R2

interface CharCounterProps {
  current: number;
  max: number;
}

export function CharCounter({ current, max }: CharCounterProps) {
  const remaining = max - current;
  const isWarning = remaining <= 30 && remaining > 0;
  const isError = remaining < 0;

  return (
    <span
      className={`text-sm ${
        isError ? 'text-red-500 font-bold' :
        isWarning ? 'text-amber-500' :
        'text-gray-400'
      }`}
    >
      {current}/{max}
    </span>
  );
}
```

</component>

---

## 六、离线优先架构

### 6.1 IndexedDB 操作

<offline-idb>

```typescript
// lib/offline/idb.ts
// @source: real.md R4

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Flash, OfflineQueueItem } from '@/types/flash';

interface FlashDB extends DBSchema {
  flashes: {
    key: string;
    value: Flash;
    indexes: { 'by-status': FlashStatus; 'by-device': string };
  };
  syncQueue: {
    key: string;
    value: OfflineQueueItem;
  };
}

let dbPromise: Promise<IDBPDatabase<FlashDB>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<FlashDB>('researchflash', 1, {
      upgrade(db) {
        // 灵感存储
        const flashStore = db.createObjectStore('flashes', { keyPath: 'id' });
        flashStore.createIndex('by-status', 'status');
        flashStore.createIndex('by-device', 'deviceId');

        // 同步队列
        db.createObjectStore('syncQueue', { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

// 保存灵感到本地
export async function saveFlashLocally(flash: Flash): Promise<void> {
  const db = await getDB();
  await db.put('flashes', flash);
}

// 添加到同步队列
export async function addToSyncQueue(item: OfflineQueueItem): Promise<void> {
  const db = await getDB();
  await db.put('syncQueue', item);
}

// 获取待同步项
export async function getPendingSyncItems(): Promise<OfflineQueueItem[]> {
  const db = await getDB();
  return db.getAll('syncQueue');
}

// 清除已同步项
export async function clearSyncedItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('syncQueue', id);
}
```

</offline-idb>

### 6.2 同步 Hook

<hook name="useSync">

```typescript
// hooks/useSync.ts
// @source: real.md R4

import { useEffect, useCallback } from 'react';
import { useOffline } from './useOffline';
import { getPendingSyncItems, clearSyncedItem } from '@/lib/offline/idb';

export function useSync() {
  const { isOffline } = useOffline();

  const syncPendingItems = useCallback(async () => {
    if (isOffline) return;

    const pendingItems = await getPendingSyncItems();

    for (const item of pendingItems) {
      try {
        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });

        if (response.ok) {
          await clearSyncedItem(item.id);
        }
      } catch (error) {
        console.error('同步失败:', error);
        // 保留在队列中，下次重试
      }
    }
  }, [isOffline]);

  // 网络恢复时自动同步
  useEffect(() => {
    if (!isOffline) {
      syncPendingItems();
    }
  }, [isOffline, syncPendingItems]);

  return { syncPendingItems };
}
```

</hook>

---

## 七、API 路由实现

### 7.1 灵感 CRUD

<api-route path="/api/flash">

```typescript
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
```

</api-route>

---

## 八、数据库 Schema

<db-schema>

```typescript
// lib/db/schema.ts
// @source: cog.md

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const flashes = sqliteTable('flashes', {
  id: text('id').primaryKey(),              // 时间戳编码 YYYYMMDDHHmm
  content: text('content').notNull(),       // max 280 @R2
  status: text('status', {
    enum: ['incubating', 'surfaced', 'archived']
  }).notNull().default('incubating'),
  deviceId: text('device_id').notNull(),    // 设备UUID
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  syncedAt: integer('synced_at', { mode: 'timestamp' }),
});

export const users = sqliteTable('users', {
  deviceId: text('device_id').primaryKey(), // 设备UUID
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

</db-schema>

---

## 九、推送调度器

<scheduler>

```typescript
// lib/scheduler.ts
// @source: real.md R3

import { flashService } from '@/services/flash.service';

/**
 * 每周日晚8点推送本周灵感回顾
 * 通过 Vercel Cron Jobs 触发: 0 20 * * 0
 */
export async function triggerWeeklyReview() {
  try {
    // 获取所有待回顾状态的灵感
    const surfacedFlashes = await flashService.getSurfacedFlashes();

    // 按设备分组
    const byDevice = groupBy(surfacedFlashes, 'deviceId');

    // 发送推送通知
    for (const [deviceId, flashes] of Object.entries(byDevice)) {
      await sendPushNotification(deviceId, {
        title: '本周灵感回顾',
        body: `你有 ${flashes.length} 条灵感等待回顾`,
        data: { type: 'weekly-review' },
      });
    }
  } catch (error) {
    console.error('推送失败:', error);
    // @R3: 失败后30分钟重试，最多3次
    throw error;
  }
}

function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = String(item[key]);
    (acc[k] = acc[k] || []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}
```

</scheduler>

---

## 十、质量检查清单

<checklist>

### 编码规范
- [ ] 代码遵循项目文件组织规范
- [ ] 命名规范：组件PascalCase，变量camelCase，常量UPPER_SNAKE
- [ ] 导入顺序：外部库 → 内部模块 → 类型 → 样式

### TypeScript
- [ ] 严格模式通过（strict: true）
- [ ] 没有无理由的 `any` 类型
- [ ] 所有函数有明确的参数和返回类型
- [ ] 使用 `unknown` + 类型守卫替代 `any`

### 约束实现
- [ ] @R1: 首页直接渲染 FlashInput，无中间页
- [ ] @R2: 前端实时校验 + 后端 zod 校验 280字限制
- [ ] @R3: Cron Job 配置每周日晚8点触发
- [ ] @R4: IndexedDB 本地存储 + 网络恢复自动同步

### 错误处理
- [ ] API 路由统一错误响应格式
- [ ] 客户端错误友好提示
- [ ] console.error 仅用于意外错误

</checklist>

---

## 十一、约束追溯索引

<traceability>

| 约束 | 文件位置 | 实现方式 |
|------|----------|----------|
| R1: 首屏无阻断 | `app/page.tsx`, `components/FlashInput.tsx` | 直接渲染输入组件，useEffect 自动聚焦 |
| R2: 280字限制 | `components/FlashInput.tsx`, `app/api/flash/route.ts` | 前端 MAX_LENGTH + 后端 zod schema |
| R3: 周日晚8点推送 | `lib/scheduler.ts`, `vercel.json` (cron) | Cron Job + Web Push API |
| R4: 离线写入同步 | `lib/offline/idb.ts`, `hooks/useSync.ts`, `workers/sw.ts` | IndexedDB + Service Worker + Background Sync |

</traceability>
