# 认知模型 (Cog)

---
name: researchflash-cog
description: ResearchFlash 灵感速记本认知模型
---

> 本认知模型服务于科研人员的"放心遗忘"场景，核心机制为 Capture -> Sleep -> Resurface。

<cog>
本系统包括以下关键实体：
- flash：灵感碎片（核心实体），用户瞬间捕捉的思维片段
- user：使用者，产生灵感的科研人员
</cog>

<flash>
- 唯一编码：创建时间戳（格式：YYYYMMDDHHmm，如 202312221430）
- 常见分类：
  - 按状态（自动流转）：孵化中 (Incubating, 新建后7天内)；待回顾 (Surfaced, 系统推送后等待处理)；已归档 (Archived, 用户确认后归档)
  - 按类型：灵感 (Note, 用户原创内容)
</flash>

<user>
- 唯一编码：设备UUID（本地生成，跨设备不互通）
- 常见分类：本地用户（MVP默认，无需注册登录）
</user>

<rel>
- user-flash：一对多（一个用户拥有多条灵感碎片）
- flash状态流转：孵化中 -> 待回顾 -> 已归档（单向不可逆）
</rel>
