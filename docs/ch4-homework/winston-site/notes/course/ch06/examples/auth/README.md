# 认证 + RBAC 示例

本目录包含认证（Authentication）和基于角色的访问控制（RBAC）的完整示例代码。

## 目录

1. [认证 vs 授权](#认证-vs-授权)
2. [Neon Auth 架构](#neon-auth-架构)
3. [RBAC 模型](#rbac-模型)
4. [示例文件](#示例文件)
5. [运行示例](#运行示例)

---

## 认证 vs 授权

### 认证（Authentication）

**认证**回答的问题是：**"你是谁？"**

- 用户登录（邮箱/密码、OAuth）
- Session 管理
- Token 验证
- 登出

**示例场景：**
- 用户输入邮箱和密码，系统验证身份
- 用户通过 Google 账号登录
- 系统检查 Session Token 是否有效

### 授权（Authorization）

**授权**回答的问题是：**"你能做什么？"**

- 权限检查
- 角色验证
- 资源访问控制
- 操作许可

**示例场景：**
- 检查用户是否有权删除某条消息
- 验证用户是否是分组管理员
- 判断用户能否访问某个 API Key

### 关系图

```
┌──────────────────────────────────────────────────────┐
│                        用户请求                       │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
          ┌───────────────────────────┐
          │  1. 认证 (Authentication) │
          │     "你是谁？"             │
          └──────────┬────────────────┘
                     │
                     ├─ 未登录 → 跳转登录页
                     │
                     ▼
          ┌──────────────────────────┐
          │  2. 授权 (Authorization)  │
          │     "你能做什么？"         │
          └──────────┬───────────────┘
                     │
                     ├─ 无权限 → 返回 403 Forbidden
                     │
                     ▼
          ┌──────────────────────┐
          │   3. 执行业务逻辑      │
          └──────────────────────┘
```

---

## Neon Auth 架构

### 什么是 Neon Auth？

Neon Auth 是 Neon 提供的托管认证服务，基于 Better Auth 框架：

- **OAuth 集成**：支持 Google、GitHub、Discord 等
- **密码认证**：内置密码哈希和验证
- **Session 管理**：自动管理用户会话
- **组织/团队**：内置多租户支持

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     Neon Database                           │
├─────────────────────────┬───────────────────────────────────┤
│     neon_auth schema    │         public schema             │
│   (系统管理，不可修改)     │      (业务表，你来设计)             │
├─────────────────────────┼───────────────────────────────────┤
│ • user                  │ • user_profiles (扩展信息)         │
│   - id (text)           │   - userId (外键)                 │
│   - email               │   - role (角色)                   │
│   - password_hash       │   - preferences (偏好)            │
│                         │                                   │
│ • account (OAuth)       │ • conversations (对话)            │
│ • session (会话)         │ • messages (消息)                 │
│ • verification          │ • api_keys (API密钥)              │
│ • organization          │ • groups (分组)                   │
│ • member                │                                   │
│                         │                                   │
│ • users_sync ◄──────────┼─── 外键引用点                      │
│   - id (text)           │                                   │
│   - name                │                                   │
│   - email               │                                   │
│   - rawJson             │                                   │
└─────────────────────────┴───────────────────────────────────┘
```

### usersSync 助手

Drizzle ORM 提供了 `usersSync` 助手，用于引用 `neon_auth.users_sync` 表：

```typescript
import { usersSync } from 'drizzle-orm/neon';

export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  // 外键引用 neon_auth.users_sync
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => usersSync.id),
  role: userRoleEnum('role').default('member').notNull(),
  // ...
});
```

**为什么用 users_sync 而不是 user？**

| 对比 | neon_auth.user | neon_auth.users_sync |
|------|----------------|---------------------|
| 数据敏感度 | 高（含密码哈希） | 低（仅基本信息） |
| 设计目的 | 认证系统内部 | 业务表外键关联 |
| 字段 | id, email, password, ... | id, name, email, rawJson |
| 推荐用途 | 认证逻辑 | 业务外键 |

---

## RBAC 模型

### 什么是 RBAC？

RBAC (Role-Based Access Control) 是一种基于角色的访问控制模型：

- **角色 (Role)**：定义用户的身份类型（如 member、admin）
- **权限 (Permission)**：定义可以执行的操作（如 read、write、delete）
- **资源 (Resource)**：定义被操作的对象（如 conversation、message）
- **策略 (Policy)**：定义角色与权限的映射关系

### 核心概念

```
用户 (User) ──→ 角色 (Role) ──→ 权限 (Permission) ──→ 资源 (Resource)
   │                │                   │                    │
   │                │                   │                    │
alice@example.com  group_admin         write              conversation
```

### 本项目的角色定义

根据 `src/db/schema.ts` 中的 `userRoleEnum`：

```typescript
export const userRoleEnum = pgEnum('user_role', [
  'member',        // 普通成员
  'group_admin',   // 分组管理员
  'system_admin'   // 系统管理员
]);
```

### 角色层级

```
system_admin (系统管理员)
     │
     ├─ 所有权限
     │
     ▼
group_admin (分组管理员)
     │
     ├─ 管理所属分组的资源
     ├─ 管理分组成员
     │
     ▼
member (普通成员)
     │
     ├─ 管理自己的资源
     └─ 查看分组共享资源
```

### 权限定义

本项目定义了以下权限：

| 权限 | 说明 | 示例 |
|------|------|------|
| `read` | 读取资源 | 查看对话列表 |
| `write` | 写入资源 | 创建消息、更新对话标题 |
| `delete` | 删除资源 | 删除对话、删除消息 |
| `admin` | 管理权限 | 管理分组成员、配置 API Key |

### 资源定义

根据 `src/db/schema.ts` 中的 `resourceTypeEnum`：

```typescript
export const resourceTypeEnum = pgEnum('resource_type', [
  'api_key',       // API 密钥
  'user',          // 用户
  'conversation',  // 对话
  'message',       // 消息
  'group',         // 分组
  'template',      // 提示词模板
  'config',        // 系统配置
]);
```

### 角色-权限映射

| 角色 | conversation | message | api_key | group | template | config |
|------|-------------|---------|---------|-------|----------|--------|
| **member** | 自己的: read/write/delete | 自己对话的: read/write/delete | 自己的: read/write/delete | 所属的: read | 自己的: read/write/delete | read |
| **group_admin** | 分组的: read/write/delete | 分组对话的: read/write/delete | 分组的: read/write/delete/admin | 管理的: read/write/admin | 分组的: read/write/delete | read |
| **system_admin** | 所有: read/write/delete/admin | 所有: read/write/delete/admin | 所有: read/write/delete/admin | 所有: read/write/delete/admin | 所有: read/write/delete/admin | read/write/admin |

### 策略检查流程

```
┌─────────────────────────────────────────────────────────────┐
│               用户请求操作资源                                 │
│        (user: alice, action: delete, resource: conversation) │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │  1. 获取用户角色       │
          │     role = "member"   │
          └──────────┬───────────┘
                     │
                     ▼
          ┌──────────────────────┐
          │  2. 检查角色权限       │
          │     member 是否有     │
          │     delete 权限？     │
          └──────────┬───────────┘
                     │
                     ├─ 没有 → 返回 403 Forbidden
                     │
                     ▼
          ┌──────────────────────┐
          │  3. 检查资源所有权     │
          │     conversation 是否  │
          │     属于 alice？       │
          └──────────┬───────────┘
                     │
                     ├─ 不属于 → 返回 403 Forbidden
                     │
                     ▼
          ┌──────────────────────┐
          │   4. 允许操作          │
          └──────────────────────┘
```

---

## 示例文件

| 文件 | 说明 |
|------|------|
| `01-session.ts` | Session 获取和验证 |
| `02-login-flow.ts` | 登录/登出流程演示 |
| `03-protected-route.ts` | 受保护路由（中间件） |
| `04-roles.ts` | RBAC 角色定义和获取 |
| `05-permissions.ts` | RBAC 权限检查 |
| `06-policy-check.ts` | 完整策略检查示例 |

### 学习路径

```
认证基础
  ├─ 01-session.ts       ← 理解 Session
  └─ 02-login-flow.ts    ← 理解登录流程

认证应用
  └─ 03-protected-route.ts ← 保护路由

授权基础
  ├─ 04-roles.ts         ← 理解角色
  └─ 05-permissions.ts   ← 理解权限

授权应用
  └─ 06-policy-check.ts  ← 综合应用
```

---

## 运行示例

### 前置条件

1. 安装依赖：

```bash
bun install
```

2. 配置环境变量：

```bash
# .env
DATABASE_URL=postgresql://...
```

3. 推送数据库 Schema：

```bash
bunx drizzle-kit push
```

4. 运行种子数据（可选）：

```bash
bunx tsx src/db/seed.ts
```

### 运行示例

使用 `bunx tsx` 运行任意示例文件：

```bash
# Session 示例
bunx tsx src/examples/auth/01-session.ts

# 登录流程示例
bunx tsx src/examples/auth/02-login-flow.ts

# 受保护路由示例
bunx tsx src/examples/auth/03-protected-route.ts

# 角色示例
bunx tsx src/examples/auth/04-roles.ts

# 权限检查示例
bunx tsx src/examples/auth/05-permissions.ts

# 完整策略检查示例
bunx tsx src/examples/auth/06-policy-check.ts
```

---

## 实际应用场景

### 场景 1：用户查看自己的对话列表

```typescript
// 1. 认证：验证用户身份
const session = await getSession();
if (!session) {
  return redirect('/login');
}

// 2. 授权：检查权限（member 可以读取自己的对话）
const canRead = checkPermission(session.user.role, 'conversation', 'read');
if (!canRead) {
  return { error: 'No permission' };
}

// 3. 业务逻辑：查询对话列表
const conversations = await db.query.conversations.findMany({
  where: eq(conversations.userId, session.user.id),
});
```

### 场景 2：分组管理员管理分组成员

```typescript
// 1. 认证：验证用户身份
const session = await getSession();
if (!session) {
  return { error: 'Not authenticated' };
}

// 2. 授权：检查是否是分组管理员
const userGroup = await db.query.userGroups.findFirst({
  where: and(
    eq(userGroups.userId, session.user.id),
    eq(userGroups.groupId, groupId),
  ),
});

if (userGroup?.role !== 'group_admin') {
  return { error: 'Not a group admin' };
}

// 3. 业务逻辑：添加成员
await db.insert(userGroups).values({
  userId: newMemberId,
  groupId: groupId,
  role: 'member',
});
```

### 场景 3：系统管理员查看所有操作日志

```typescript
// 1. 认证：验证用户身份
const session = await getSession();
if (!session) {
  return { error: 'Not authenticated' };
}

// 2. 授权：检查是否是系统管理员
const userProfile = await db.query.userProfiles.findFirst({
  where: eq(userProfiles.userId, session.user.id),
});

if (userProfile?.role !== 'system_admin') {
  return { error: 'System admin only' };
}

// 3. 业务逻辑：查询所有日志
const logs = await db.query.operationLogs.findMany({
  orderBy: desc(operationLogs.createdAt),
  limit: 100,
});
```

---

## 安全最佳实践

### 1. 永远不要信任客户端

```typescript
// ❌ 错误：信任客户端传来的 userId
const userId = req.body.userId;
const conversations = await db.query.conversations.findMany({
  where: eq(conversations.userId, userId),
});

// ✅ 正确：从 Session 获取 userId
const session = await getSession();
const conversations = await db.query.conversations.findMany({
  where: eq(conversations.userId, session.user.id),
});
```

### 2. 先认证，后授权

```typescript
// ✅ 正确的顺序
const session = await getSession(); // 1. 认证
if (!session) return { error: 'Not authenticated' };

const hasPermission = checkPermission(...); // 2. 授权
if (!hasPermission) return { error: 'Forbidden' };

// 3. 执行业务逻辑
```

### 3. 最小权限原则

```typescript
// ✅ 默认拒绝，明确授权
function checkPermission(role: UserRole, resource: string, action: string) {
  // 默认返回 false
  const permissions = rolePermissions[role] || {};
  return permissions[resource]?.[action] === true;
}
```

### 4. 记录敏感操作

```typescript
// ✅ 记录操作日志
await db.insert(operationLogs).values({
  operatorId: session.user.id,
  operationType: 'delete',
  resourceType: 'conversation',
  resourceId: conversationId,
  details: { title: conversation.title },
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
});
```

---

## 参考资料

- [Neon Auth 官方文档](https://neon.tech/docs/guides/neon-auth-nextjs)
- [Better Auth 文档](https://better-auth.com/docs)
- [RBAC 维基百科](https://en.wikipedia.org/wiki/Role-based_access_control)
- [OWASP 访问控制指南](https://cheatsheetseries.owasp.org/cheatsheets/Access_Control_Cheat_Sheet.html)

---

## 常见问题

### Q1: 认证和授权可以分开实现吗？

**A:** 可以，而且应该分开。认证负责验证身份，授权负责验证权限。两者职责不同，应该解耦。

### Q2: 为什么需要 users_sync 表？

**A:** `neon_auth.user` 表包含敏感信息（密码哈希等），`users_sync` 是一个同步表，只包含基本信息（id、name、email），专门用于业务表的外键关联。

### Q3: 角色和权限的区别是什么？

**A:** 角色是用户的身份标签（如 admin、member），权限是具体的操作许可（如 read、write）。角色通过映射关系包含多个权限。

### Q4: 如何实现更细粒度的权限控制？

**A:** 可以结合资源所有权检查。例如，member 只能删除自己的对话，需要在权限检查后再检查 `conversation.userId === session.user.id`。

### Q5: Session 存储在哪里？

**A:** Neon Auth 的 Session 存储在 `neon_auth.session` 表中，由 Better Auth 自动管理。客户端通过 Cookie 存储 Session Token。
