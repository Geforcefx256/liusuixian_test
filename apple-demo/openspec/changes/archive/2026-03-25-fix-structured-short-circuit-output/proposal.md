## Why

当前 runtime 对 short-circuit 结构化输出的消息语义不一致：同一轮工具调用会同时落库工具产出的结构化消息和模型原始 `tool_calls` 响应消息，导致会话历史双写、结构化 payload 被当作普通 assistant 文本回灌模型、以及前端在流式展示与 reload 后看到不一致的结果。这个问题已经在 `local:question` 场景中暴露为“协议卡片正常显示，但同时出现异常 JSON 文本气泡”，并且同类机制也影响 `local:run_command` 的结构化结果分支。

## What Changes

- 统一 short-circuit 结构化输出的持久化语义：一次 short-circuit 结果只允许形成一条 canonical assistant 会话消息，而不是同时保留工具结果消息与模型原始 `tool_calls` 消息
- 为 runtime 会话消息引入明确的结构化 short-circuit 承载方式，使 protocol / domain-result 不再仅依赖 raw text 保存与恢复
- 将模型上下文回灌改为使用面向模型的摘要文本，而不是直接回灌 protocol JSON 或结构化结果 JSON 本体，避免后续轮次模仿污染
- 调整运行完成时的前端流式事件契约，使 protocol/domain-result 不再通过普通 assistant text 流事件暴露 raw JSON
- 对齐主 `AgentLoop` 与 `plannerLoop` 的 short-circuit 处理语义，避免同一机制在不同 loop 中继续分叉

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-backend-runtime`: 调整 short-circuit 结构化输出的会话持久化、模型上下文回灌、流式结果发射以及 planner/build loop 一致性要求
- `agent-web-workbench`: 调整前端对 short-circuit 结构化消息的运行时与 reload 呈现契约，避免依赖 raw text JSON 渲染 protocol/domain-result

## Impact

- Affected code:
  - `apps/agent-backend/src/agent/agentLoop.ts`
  - `apps/agent-backend/src/agent/agentLoopToolRunner.ts`
  - `apps/agent-backend/src/agent/workspace/plannerLoop.ts`
  - `apps/agent-backend/src/agent/providerClient.ts`
  - `apps/agent-backend/src/agent/sessionStore*.ts`
  - `apps/agent-backend/src/agent/service/RunExecution.ts`
  - `apps/web/src/stores/workbenchStore.ts`
  - `apps/web/src/components/workbench/**`
- Affected runtime surfaces:
  - persisted session message shape for short-circuit structured outputs
  - model input construction for assistant history
  - stream event behavior for protocol/domain-result runs
  - workbench reload and structured message rendering
- No historical data migration is required for this change; the new contract only needs to govern newly written session messages.
