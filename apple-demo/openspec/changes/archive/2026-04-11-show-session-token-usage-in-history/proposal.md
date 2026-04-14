## Why

当前 workbench 虽然已经把每次 assistant 回复的 usage 明细持久化到了消息 `meta.usage`，但管理员仍然无法直接从历史会话列表判断某个会话累计消耗了多少 token。这个信息主要用于运营排查和成本感知，应该集中展示在历史会话管理面板里，而不打扰普通用户的当前对话体验。

## What Changes

- 在 agent runtime 中新增按 `sessionId` 聚合已落库 assistant `meta.usage` 的独立查询能力，返回当前会话累计 token 摘要。
- 将该 usage 查询限定为 `admin` / `super_admin` 可访问的独立接口，不耦合 `/agent/run` 主对话链路。
- 在 workbench 历史会话面板中，为管理员可见的会话条目增加弱化 token badge，展示该会话累计 token。
- usage 查询失败时只影响 badge 展示，不阻断历史会话列表加载、会话切换或正常对话。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-backend-runtime`: 新增管理员可访问的 session usage 聚合查询，并要求该查询与主对话执行链路解耦。
- `agent-web-workbench`: 历史会话面板在管理员视角下新增弱化的 session token 累计展示，普通用户不显示该信息。

## Impact

- Affected code:
  - `apps/agent-backend/src/agent/sessionStore.ts`
  - `apps/agent-backend/src/agent/sessionStoreTypes.ts`
  - `apps/agent-backend/src/routes/agent.ts`
  - `apps/web/src/api/agentApi.ts`
  - `apps/web/src/api/types.ts`
  - `apps/web/src/components/workbench/SessionRail.vue`
  - `apps/web/src/stores/workbenchStore.ts`
- APIs:
  - 新增独立的 session usage 查询接口，供历史会话面板按需读取
- Dependencies:
  - 无新增第三方依赖
- Systems:
  - 历史会话管理面板
  - 后端 session/message usage 聚合查询
  - 管理员角色可见性控制
