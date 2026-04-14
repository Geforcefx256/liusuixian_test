## Why

当前工作台的历史栏只支持逐条删除会话。当某个助手下积累了大量历史会话时，用户只能重复执行单条删除，清理成本高且打断浏览。现在需要补上一条明确、低风险的批量清理路径，让用户可以快速清空当前助手下的历史会话，同时保留当前正在查看的会话上下文。

## What Changes

- 在工作台历史会话展开面板中增加一个低优先级危险操作入口，用于清空当前助手下的历史会话。
- 将该操作明确限定为“仅删除当前助手下除当前会话之外的 persisted sessions”，不清空当前会话，不跨助手生效。
- 为该批量清理操作增加显式确认、可清空数量提示、空状态禁用和运行中阻止规则，避免误删或与运行时会话状态发生竞态。
- 在后端增加与前端语义一致的批量删除能力，确保历史列表、会话元数据和关联持久化状态一起被一致移除。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-web-workbench`: 历史会话栏的 requirement 将从“支持单条删除”扩展为“支持排除当前会话的批量清空历史会话”，并要求危险操作入口、确认语义、禁用规则和清空后的前端状态收敛。
- `agent-backend-runtime`: session metadata 和删除契约将从“支持单条 session 删除”扩展为“支持按 user + agent 范围批量删除历史 session，且排除当前 session”，并要求关联持久化状态被一致删除。

## Impact

- Frontend: `apps/web/src/components/workbench/SessionRail.vue`, `apps/web/src/components/workbench/WorkbenchShell.vue`, `apps/web/src/stores/workbenchStore.ts`, 相关测试。
- Backend: `apps/agent-backend/src/routes/agent.ts`, `apps/agent-backend/src/agent/service/AgentService.ts`, `apps/agent-backend/src/agent/sessionStore*.ts`, 相关测试。
- API surface: 增加一个 session 批量清空历史的后端路由或等价契约，供工作台调用。
- Dependencies: 不新增第三方依赖。
