## Why

当前 question interaction 虽然会把用户回答写入 `agent_session_interactions`，但不会把这份回答写回 `session messages`。这导致 `AgentLoop` 在 continuation run 中只能临时注入回答，却不能在后续轮次从同一份 canonical `message[]` 历史稳定回放；随着会话继续，模型会反复看到“需要你的输入后才能继续”的等待态残影，却缺少已经回答的事实，最终破坏同一任务链的连续性。

这个问题已经是运行时正确性缺陷，而不是单纯的前端展示问题。继续依赖临时 continuation 注入和 pending 状态下的自由输入，只会让 build/planner 两条链路、session history、interaction 表三者的语义继续分叉。

## What Changes

- 将 answered / rejected question interaction 追加为同一 `session` 下的 canonical `user message`，让后续 `AgentLoop` 直接从 `message[]` 历史回放用户回答，而不是只从 interaction 表做临时注入。
- 将 continuation 收敛为“继续执行”的控制语义，不再承担把回答正文带进模型上下文的职责；build phase 与 planner phase 都改为依赖同一份持久化 session history。
- 明确等待态 assistant 占位信息只服务于 UI 与运行态收敛，不再作为后续模型 replay 的语义输入，避免旧 `awaiting-interaction` 文本和 tool snapshot 污染上下文。
- 在 session 存在 pending question interaction 时，后端显式拒绝普通 `/run` 输入；前端同步禁用 composer / 发送 / 上传入口，只允许通过 reply / reject 路径继续执行。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-backend-runtime`: 调整 question interaction 的 canonical history 语义、continuation replay 语义、awaiting-interaction replay 边界，以及 pending interaction 下的普通输入拒绝行为。
- `agent-web-workbench`: 调整 pending question 存在时的 composer 交互约束，并保持 reply / reject -> continuation 的单一路径。

## Impact

- Affected backend code in the runtime conversation path, especially `apps/agent-backend/src/agent/chatOrchestrator.ts`, `apps/agent-backend/src/agent/agentLoop.ts`, `apps/agent-backend/src/agent/workspace/planner.ts`, `apps/agent-backend/src/agent/sessionStore*.ts`, `apps/agent-backend/src/agent/context/**`, and `apps/agent-backend/src/routes/agent.ts`.
- Affected frontend code in `apps/web/src/components/workbench/ConversationPane.vue`, `apps/web/src/stores/workbenchStore.ts`, and related interaction tests.
- Affected runtime behavior includes reply / reject persistence, continuation run semantics, context replay selection, and `/agent/run` validation when a session is blocked by a pending question.
