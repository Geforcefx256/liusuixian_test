## Why

当前 `agent-backend` 把 `local:question` 建模成 protocol short-circuit，再由前端通过 `question_response -> /agent/run` 触发下一轮 continuation；同时 `local:write` 等普通工具又被错误纳入 domain-result short-circuit 终态集合，导致工具链路被提前截断，出现“write 后无法自动继续 question”“刷新或后端重启后问题上下文丢失”等问题。既有机制已经暴露出 loop 终止条件与工具语义耦合过深，继续在现有 short-circuit 分支上打补丁会让 runtime 与 workbench 契约越来越脆弱。

## What Changes

- 将 question 流从“protocol short-circuit + 前端再次发起 `/agent/run`”重构为“可持久化 pending interaction + 回复后 continuation run”模型，使问题交互能够在页面刷新和后端重启后恢复
- 为 backend 引入持久化 interaction 记录与 reply/reject 接口，明确区分普通工具结果、阻塞式交互、以及显式终态输出，不再通过工具名或 JSON 形状隐式推断是否结束本轮运行
- 调整 `AgentLoop` / run lifecycle 语义，使 `local:write`、`local:run_command` 等普通工具默认返回普通 tool result 并允许模型继续，而不是被错误 short-circuit 成最终 domain result
- 更新 workbench 问题交互 UI 与运行时收敛逻辑，从 protocol question 卡片提交切换为 pending interaction 恢复、回答与 continuation 流
- 保持真正需要结构化终态收敛的 rich result / workbook-coupled 协议能力可用，但将其与 question 这类阻塞式交互从机制上解耦

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-backend-runtime`: 调整 agent loop 终止条件、question 交互模型、interaction 持久化、reply/reject API、continuation run 以及普通工具结果语义
- `agent-web-workbench`: 调整问题交互 UI、刷新恢复、后端重启恢复、continuation 提交路径以及运行中消息收敛逻辑

## Impact

- Affected code:
  - `apps/agent-backend/src/agent/agentLoop*.ts`
  - `apps/agent-backend/src/agent/chatOrchestrator.ts`
  - `apps/agent-backend/src/agent/questionAnswer.ts`
  - `apps/agent-backend/src/agent/service/RunCoordinator.ts`
  - `apps/agent-backend/src/agent/service/RunExecution.ts`
  - `apps/agent-backend/src/agent/sessionStore*.ts`
  - `apps/agent-backend/src/routes/agent.ts`
  - `apps/agent-backend/src/runtime/tools/local/question.ts`
  - `apps/agent-backend/src/runtime/tools/local/writeFile.ts`
  - `apps/web/src/api/agentApi.ts`
  - `apps/web/src/stores/workbenchStore.ts`
  - `apps/web/src/components/workbench/**`
- Affected runtime surfaces:
  - `/agent/run` lifecycle semantics and continuation behavior
  - new pending interaction list/reply/reject backend routes
  - persisted session and interaction state in SQLite
  - question UI rendering and restore-after-refresh behavior
- Data/storage impact:
  - requires new persistent interaction records and associated schema evolution
  - no requirement to migrate historical protocol question messages into the new interaction model
