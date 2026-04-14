## Why

当前 workbench 把运行占用建模成 `user + agent` 级别的全局锁，导致同一 Agent 下只要某个会话正在运行或等待追问，其他会话就无法继续发起新的 run。这个行为与“多个会话共享同一个 working 区”并不一致，也会阻断用户在同一 Agent 下并行推进多个会话的实际使用方式。

## What Changes

- 放开后端针对 `user + agent` 共享工作区的全局运行占用拦截，允许同一 Agent 下的不同 session 同时发起和执行 run。
- 将前端 workbench 的运行态从单一全局 run 模型调整为按 session 追踪，使同页签切换到其他会话后仍可继续发送。
- 保持单个 session 内的运行约束：同一 session 在已有活跃 run 或处于 `awaiting-question` 时，不允许继续普通发送。
- 调整会话删除与清空历史规则，不再因其他 session 活跃而做全局禁止，但必须保护活跃 session 不被删除，批量清理时跳过活跃 session。
- 保持现有共享 working 区语义，不为本次改动引入排队机制，也不新增工作区写冲突处理。

## Capabilities

### New Capabilities
- （无）

### Modified Capabilities
- `agent-backend-runtime`: 调整运行协调与会话治理要求，允许同一 `user + agent` 作用域内的不同 session 并发运行，并限制删除或批量清理活跃 session。
- `agent-web-workbench`: 调整 workbench 运行态与交互约束，要求按 session 追踪 run，使不同会话之间的发送、等待追问和历史管理互不全局阻塞。

## Impact

- Affected specs: `openspec/specs/agent-backend-runtime/spec.md`, `openspec/specs/agent-web-workbench/spec.md`
- Affected backend: `apps/agent-backend/src/routes/agent.ts`, `apps/agent-backend/src/agent/service/AgentService.ts`, `apps/agent-backend/src/agent/service/RunCoordinator.ts`, `apps/agent-backend/src/agent/sessionStore.ts`
- Affected frontend: `apps/web/src/stores/workbenchStore.ts`, `apps/web/src/components/workbench/WorkbenchShell.vue`, `apps/web/src/components/workbench/ConversationPane.vue`, `apps/web/src/components/workbench/WorkspaceSidebar.vue`
- Affected tests: agent runtime route/service tests and workbench store/component tests covering concurrent session runs and active-session history protection
- 不涉及新增或升级第三方依赖。
- 不涉及顶层目录结构变更。
