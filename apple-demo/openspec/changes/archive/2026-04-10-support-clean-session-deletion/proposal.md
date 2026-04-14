## Why

当前 Agent Workbench 只允许删除空闲会话，正在运行、停止收敛中和等待问题回答的会话都会被前后端拒绝删除。这已经和用户预期冲突，并且在真实使用中会留下无法清理的历史项。

仅仅放开删除按钮并不安全。现有运行流、会话写入路径和前端本地状态回流都可能在删除后继续写回同一个 `sessionId`，导致会话被“复活”或留下孤儿数据，因此需要把“删除运行中会话”设计成一套完整生命周期。

## What Changes

- 允许用户删除处于 `running`、`stop-pending` 和 `awaiting-question` 状态的会话。
- 将会话删除升级为“干净删除”语义：删除请求生效后，该 `sessionId` 不再接受新的会话级写入，也不会被前端流式事件或重新加载写回。
- 调整后端删除流程，使其在删除运行中会话时同时处理运行取消、等待问题状态释放和持久化数据清理。
- 调整前端历史 rail 与 workbench store，使被删除会话立即从 UI 消失，并在删除后的流式回调、hydrate、reload 中忽略该会话。
- 更新删除与批量清理相关测试，覆盖运行中会话、待回答会话和删除后防复活场景。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-backend-runtime`: 会话删除的运行时语义将从“活跃会话拒绝删除”变为“允许删除并保证删除后不再复活”。
- `agent-web-workbench`: 历史 rail 与会话状态管理的删除语义将从“活跃会话不可删”变为“确认后立即移除，并忽略后续回流”。

## Impact

- Affected code:
  - `apps/agent-backend/src/routes/agent.ts`
  - `apps/agent-backend/src/agent/service/AgentService.ts`
  - `apps/agent-backend/src/agent/service/RunCoordinator.ts`
  - `apps/agent-backend/src/agent/sessionStore.ts`
  - `apps/agent-backend/src/agent/sessionStoreUtils.ts`
  - `apps/web/src/api/agentApi.ts`
  - `apps/web/src/stores/workbenchStore.ts`
  - `apps/web/src/components/workbench/SessionRail.vue`
- Affected tests:
  - `apps/agent-backend/tests/agent.auth.routes.test.ts`
  - `apps/agent-backend/src/agent/sessionStore.test.ts`
  - `apps/web/src/stores/workbenchStore.test.ts`
- APIs:
  - Existing session delete API keeps the same route shape but changes behavior for active sessions.
- Dependencies:
  - No new third-party dependencies are required.
