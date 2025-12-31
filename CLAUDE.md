# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 环境配置

- 设备：Apple Silicon Mac
- Node.js：使用 bun 管理（禁止 npm/yarn/pnpm）
- Python：使用 uv 管理（禁止 pip）
- Git 托管：cnb.cool

## 版本管理规则

- 采用语义版本号 vX.Y.Z
- 首次提交版本号为 v0.0.1
- 任何重大变动完成后，自动提交并递增修订号（Z 位 +1）

## 仓库信息

- 仓库地址：https://cnb.cool/xinwen-li/research-flash
- 默认分支：main

## Project Overview

ResearchFlash 是一个「灵感捕捉」应用，帮助研究者快速记录和管理灵感。采用离线优先（Offline-First）架构，核心实体是 Flash（灵感），具有三种状态流转：incubating → surfaced → archived（单向不可逆）。

## Development Commands

```bash
bun install          # 安装依赖
bun run dev          # 启动开发服务器
bun run build        # 生产构建
bun run lint         # ESLint 检查
```

## Architecture

### Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Offline Storage**: IndexedDB (via `idb` library)
- **Schema**: Drizzle ORM (prepared for future PostgreSQL migration)
- **Validation**: Zod

### Code Structure

```
src/
├── app/                 # Next.js App Router
│   ├── api/             # API Routes (flash, sync)
│   └── page.tsx         # Main page
├── components/          # React Components
├── hooks/               # Custom Hooks
│   ├── useFlash.ts      # Flash CRUD + offline sync
│   ├── useOffline.ts    # Online/offline detection
│   └── useSync.ts       # Background sync logic
├── lib/
│   ├── db/              # Database layer (in-memory for MVP)
│   └── offline/idb.ts   # IndexedDB operations
├── services/            # Business logic services
└── types/flash.ts       # Core type definitions
```

### Data Flow

1. **Write Path**: Component → `useFlash` hook → IndexedDB (local) → Sync queue → API (when online)
2. **Read Path**: Component → `useFlash` hook → IndexedDB (local)
3. **Sync**: Background sync processes queue items when connectivity is restored

### Key Constraints (@source: real.md)

- **R2**: Flash content max 280 characters
- **R4**: Offline-first - all operations must work without network, sync when online
- Flash ID format: `YYYYMMDDHHmm` (timestamp-based)
- Device identification via UUID stored in localStorage

## 42COG Methodology

This project follows 认知敏捷法 (42COG) with RCSW workflow:
- `.42cog/real/` - 现实约束
- `.42cog/cog/` - 认知模型
- `.42cog/spec/` - 规约文档
- `.42cog/work/` - 工作记录
- `.42plugin/42edu/` - 技能插件库

Source comments like `// @source: cog.md` indicate which spec document the code derives from.

## Path Alias

`@/*` maps to `./src/*` (configured in tsconfig.json)
