# 系统架构规格书：活水智聊（42chat）

<meta>
  <document-id>42chat-sys-spec</document-id>
  <version>1.0.0</version>
  <project>活水智聊（42chat）</project>
  <type>系统架构规格书</type>
  <created>2025-12-06</created>
  <depends>real.md, cog.md, pr.spec.md, userstory.spec.md</depends>
</meta>

---

## 1. 架构概述

**架构模式**：分层架构 + 模块化设计

**部署策略**：Serverless（Vercel / EdgeOne Pages）

**核心技术栈**：

| 层级 | 技术选型 |
|------|----------|
| 全站框架 | Next.js 15 (App Router) |
| CSS 框架 | Tailwind CSS |
| UI 组件 | shadcn/ui |
| 包管理 | bun |
| 数据库 | PostgreSQL（本地）/ Neon（云端） |
| ORM | Drizzle ORM |
| 认证授权 | Better Auth |
| AI 框架 | Vercel AI SDK |

---

## 2. 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      客户端（浏览器）                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  对话界面   │  │  设置界面   │  │  认证界面   │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
└─────────┼────────────────┼────────────────┼─────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js App Router                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   API Routes                         │    │
│  │  /api/auth  /api/chat  /api/conversations  /api/models│   │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   Services Layer                     │    │
│  │  AuthService  ChatService  ModelService  SyncService │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   Better Auth   │ │   Drizzle ORM   │ │  Vercel AI SDK  │
│   (认证授权)    │ │   (数据访问)    │ │   (AI 调用)     │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│    Session      │ │   PostgreSQL    │ │   AI Providers  │
│    Storage      │ │   (Neon)        │ │ Claude/GPT/etc  │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## 3. 子系统设计

### 3.1 Auth 子系统

**职责**：用户认证、会话管理、权限控制

**组件**：
- `auth.ts` - Better Auth 配置
- `middleware.ts` - 路由保护
- `session.ts` - 会话工具

**接口**：
- 输入：用户凭证、会话令牌
- 输出：认证状态、用户信息

**约束**：
- C1：强制登录才能使用对话功能
- C3：数据隔离，只能访问自己的数据

---

### 3.2 Chat 子系统

**职责**：对话管理、消息处理、流式响应

**组件**：
- `chat.service.ts` - 对话业务逻辑
- `message.service.ts` - 消息处理
- `stream.ts` - 流式响应处理

**接口**：
- 输入：用户消息、对话 ID、模型配置
- 输出：AI 响应（流式）、对话历史

**约束**：
- C4：通过服务端代理调用 AI API

---

### 3.3 Model 子系统

**职责**：模型配置管理、API 密钥存储、连接测试

**组件**：
- `model.service.ts` - 模型配置逻辑
- `encryption.ts` - 密钥加密/解密
- `provider.ts` - 多提供商适配

**接口**：
- 输入：API 密钥、提供商信息
- 输出：模型列表、连接状态

**约束**：
- C2：API 密钥必须加密存储

---

### 3.4 Sync 子系统

**职责**：数据同步、本地兜底、冲突处理

**组件**：
- `sync.service.ts` - 同步逻辑
- `local-storage.ts` - IndexedDB 操作
- `conflict.ts` - 冲突解决

**接口**：
- 输入：本地数据、云端数据
- 输出：同步状态、合并结果

**约束**：
- C7：云端失败时保留本地副本

---

## 4. API 设计

### 4.1 认证 API

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| POST | /api/auth/register | 用户注册 | 无 |
| POST | /api/auth/login | 用户登录 | 无 |
| POST | /api/auth/logout | 用户登出 | 必需 |
| GET | /api/auth/session | 获取会话 | 必需 |

### 4.2 对话 API

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| GET | /api/conversations | 获取对话列表 | 必需 |
| POST | /api/conversations | 创建对话 | 必需 |
| GET | /api/conversations/:id | 获取对话详情 | 必需 |
| PATCH | /api/conversations/:id | 更新对话 | 必需 |
| DELETE | /api/conversations/:id | 删除对话 | 必需 |
| GET | /api/conversations?q= | 搜索对话 | 必需 |

### 4.3 聊天 API

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| POST | /api/chat | 发送消息（流式） | 必需 |

**请求体**：
```typescript
{
  conversationId: string
  message: string
  modelId?: string
}
```

**响应**：Server-Sent Events 流式响应

### 4.4 模型配置 API

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| GET | /api/models | 获取模型列表 | 必需 |
| POST | /api/models | 添加模型配置 | 必需 |
| PATCH | /api/models/:id | 更新模型配置 | 必需 |
| DELETE | /api/models/:id | 删除模型配置 | 必需 |
| POST | /api/models/:id/test | 测试模型连接 | 必需 |

### 4.5 导出 API

| 方法 | 端点 | 描述 | 认证 |
|------|------|------|------|
| GET | /api/export/:conversationId | 导出对话 | 必需 |

**查询参数**：`?format=md&desensitize=true`

---

## 5. 目录结构

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # 认证路由组（无需登录）
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── register/
│   │       └── page.tsx
│   ├── (main)/                   # 主应用路由组（需登录）
│   │   ├── layout.tsx            # 主布局（侧边栏+内容区）
│   │   ├── page.tsx              # 首页/新对话
│   │   ├── chat/
│   │   │   └── [id]/
│   │   │       └── page.tsx      # 对话详情
│   │   └── settings/
│   │       ├── page.tsx          # 设置首页
│   │       └── models/
│   │           └── page.tsx      # 模型配置
│   ├── api/                      # API 路由
│   │   ├── auth/
│   │   │   └── [...betterauth]/
│   │   │       └── route.ts      # Better Auth 处理
│   │   ├── chat/
│   │   │   └── route.ts          # 聊天流式 API
│   │   ├── conversations/
│   │   │   ├── route.ts          # 列表/创建
│   │   │   └── [id]/
│   │   │       └── route.ts      # 详情/更新/删除
│   │   ├── models/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       └── test/
│   │   │           └── route.ts
│   │   └── export/
│   │       └── [id]/
│   │           └── route.ts
│   ├── layout.tsx                # 根布局
│   └── globals.css
├── components/                   # React 组件
│   ├── ui/                       # shadcn/ui 组件
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   └── ...
│   ├── chat/                     # 聊天相关组件
│   │   ├── ChatInput.tsx
│   │   ├── ChatMessage.tsx
│   │   ├── ChatList.tsx
│   │   ├── ModelSelector.tsx
│   │   └── StreamingMessage.tsx
│   ├── layout/                   # 布局组件
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── ConversationList.tsx
│   └── settings/                 # 设置相关组件
│       ├── ModelForm.tsx
│       └── ModelList.tsx
├── lib/                          # 工具库
│   ├── db/                       # 数据库
│   │   ├── index.ts              # Drizzle 客户端
│   │   ├── schema.ts             # 数据库 Schema
│   │   └── migrations/           # 迁移文件
│   ├── auth/                     # 认证
│   │   ├── index.ts              # Better Auth 配置
│   │   └── client.ts             # 客户端 Auth
│   ├── ai/                       # AI 相关
│   │   ├── index.ts              # AI SDK 配置
│   │   └── providers.ts          # 多提供商配置
│   ├── encryption.ts             # 加密工具
│   └── utils.ts                  # 通用工具
├── services/                     # 业务逻辑层
│   ├── auth.service.ts
│   ├── chat.service.ts
│   ├── conversation.service.ts
│   ├── model.service.ts
│   └── sync.service.ts
├── hooks/                        # React Hooks
│   ├── useChat.ts
│   ├── useConversations.ts
│   └── useModels.ts
├── types/                        # TypeScript 类型
│   ├── chat.ts
│   ├── model.ts
│   └── user.ts
└── constants/                    # 常量
    ├── providers.ts              # AI 提供商列表
    └── config.ts
```

---

## 6. 数据库 Schema

```typescript
// lib/db/schema.ts
import { pgTable, uuid, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core'

// 用户表（由 Better Auth 管理）
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow(),
})

// 对话表
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  title: text('title'),
  modelId: text('model_id'),
  archived: boolean('archived').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// 消息表
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id),
  role: text('role').notNull(), // 'user' | 'assistant' | 'system'
  content: text('content').notNull(),
  modelId: text('model_id'),
  createdAt: timestamp('created_at').defaultNow(),
})

// 模型配置表
export const modelConfigs = pgTable('model_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  provider: text('provider').notNull(), // 'openai' | 'anthropic' | 'google'
  modelId: text('model_id').notNull(),
  name: text('name'),
  apiKey: text('api_key').notNull(), // 加密存储
  enabled: boolean('enabled').default(true),
  createdAt: timestamp('created_at').defaultNow(),
})

// 提示词模板表
export const promptTemplates = pgTable('prompt_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id), // null 表示系统预设
  name: text('name').notNull(),
  content: text('content').notNull(),
  category: text('category'),
  isPublic: boolean('is_public').default(false),
  createdAt: timestamp('created_at').defaultNow(),
})
```

---

## 7. 安全架构

### 7.1 安全层级

| 层级 | 措施 | 实现 |
|------|------|------|
| 传输层 | HTTPS | Vercel 自动配置 |
| 认证层 | 会话管理 | Better Auth + Session |
| 授权层 | 数据隔离 | 所有查询添加 userId 过滤 |
| 数据层 | 密钥加密 | AES-256-GCM |
| 数据层 | 输入验证 | Zod Schema |
| 数据层 | SQL 注入防护 | Drizzle ORM 参数化查询 |

### 7.2 约束实现

| 约束 ID | 约束内容 | 实现方式 |
|--------|---------|---------|
| C1 | 强制登录 | middleware.ts 路由保护 |
| C2 | 密钥加密 | lib/encryption.ts AES 加密 |
| C3 | 数据隔离 | Service 层 userId 过滤 |
| C4 | 服务端代理 | API Route 代理 AI 调用 |
| C5 | 导出脱敏 | export API desensitize 参数 |
| C6 | 调用限流 | middleware 速率限制 |
| C7 | 本地兜底 | IndexedDB + sync.service.ts |

---

## 8. 技术决策记录（ADR）

### ADR-001：全站框架选择

**状态**：已接受

**决策**：使用 Next.js 15 with App Router

**理由**：
- 全栈框架，前后端统一
- App Router 支持 RSC 和流式渲染
- Vercel 原生支持，部署简单
- 与 Vercel AI SDK 深度集成

---

### ADR-002：数据库选择

**状态**：已接受

**决策**：PostgreSQL（本地开发）+ Neon（生产环境）

**理由**：
- PostgreSQL 功能强大，生态成熟
- Neon Serverless 按需付费，冷启动快
- 与 Drizzle ORM 完美配合

---

### ADR-003：ORM 选择

**状态**：已接受

**决策**：Drizzle ORM

**理由**：
- 类型安全，TypeScript 优先
- 轻量级，无运行时开销
- SQL-like 语法，学习成本低
- 支持边缘运行时

---

### ADR-004：认证方案

**状态**：已接受

**决策**：Better Auth

**理由**：
- 开源、自托管
- 支持多种登录方式
- 与 Next.js 深度集成
- 会话管理简单

---

### ADR-005：AI 集成方案

**状态**：已接受

**决策**：Vercel AI SDK

**理由**：
- 统一多模型接口
- 原生流式支持
- React Hooks 集成
- 与 Next.js 无缝配合

---

### ADR-006：API 密钥存储

**状态**：已接受

**决策**：AES-256-GCM 加密存储

**理由**：
- 满足 C2 约束
- 对称加密，性能好
- GCM 模式提供认证

---

### ADR-007：流式响应

**状态**：已接受

**决策**：Server-Sent Events (SSE)

**理由**：
- 单向流式，适合 AI 响应
- 浏览器原生支持
- Vercel AI SDK 默认方案

---

## 9. 质量检查清单

- [x] 架构模式适合需求（分层 + 模块化）
- [x] 所有子系统有清晰的职责
- [x] API 遵循 RESTful 约定
- [x] 目录结构支持模块化
- [x] 安全需求已解决（C1-C7）
- [x] 技术决策已记录（ADR）
- [x] 已纳入 real.md 中的约束

---

**文档版本**：v1.0.0
**创建日期**：2025-12-06
**维护者**：活水AI实验室
