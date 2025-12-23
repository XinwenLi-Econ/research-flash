---
name: project-cog
description: Cognitive model defining core entities and relationships
---

  <cog>
  本系统包括以下关键实体：
  - flash：灵感碎片（核心实体）
  - user：使用者（MVP阶段仅用于本地标识）
  </cog>

  <entity name="flash">
    <unique_id>创建时间戳（格式：YYYYMMDDHHmm，如 202312221430）</unique_id>
    <classification>
      状态（自动流转）：
      - 孵化中 (Incubating)：新建后7天内
      - 待回顾 (Surfaced)：系统推送后等待用户处理
      - 已归档 (Archived)：用户确认后归档

      类型：
      - 灵感 (Note)：用户原创内容
    </classification>
  </entity>

  <entity name="user">
    <unique_id>设备UUID（本地生成，跨设备不互通）</unique_id>
    <classification>
      - 本地用户（MVP默认）
    </classification>
  </entity>

  <relationship>
  user - flash：一对多（一个用户拥有多条灵感）
  </relationship>
