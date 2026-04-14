## Why

当前 `AgentLoop` 会把主循环里的 tool error payload 原样写回 `message[]`，其中混入了 `chainKey`、`remainingRecoveryBudget`、`runtimeRetryCount`、`attempt`、`stopReason` 等运行时控制元数据。它们对日志、终态 runtimeError 和调试有价值，但对模型下一步“该如何修正工具调用”帮助有限，反而持续占用上下文预算并放大错误回灌噪声。

现在需要把 machine-facing tool error payload 收敛为“最小可修复信号”：既保留稳定的错误码、可恢复性和纠错提示，又避免把诊断元数据重复灌入模型上下文，同时不削弱 frontend / runtime 的终态错误可读性与可观测性。

## What Changes

- 收敛主 `AgentLoop` 写回会话的 machine-facing tool error payload，只保留模型纠错所需的最小字段，而不再默认回灌恢复预算、链路标识、停止原因等运行时控制元数据。
- 为 machine-facing tool error payload 增加可选的结构化差量提示字段，例如 `field`、`expected`、`actual`、`fix`，仅在工具或校验器能稳定提供时返回。
- 明确区分两层错误契约：
  - conversation loop 面向模型的 tool error payload：短、小、可执行
  - runtime / frontend / telemetry 面向人类与系统诊断的 runtime error metadata：继续保留 stop reason、chain metadata、阈值与日志上下文
- 保持 planner loop 的轻量错误 payload 思路不变，本次重点收敛主 `AgentLoop` 的统一错误协议。
- 更新相关测试与规范，确保“模型面 payload 精简”与“终态 runtimeError 诊断完整”同时成立。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-backend-runtime`: 调整 conversation loop 内 machine-facing tool error payload 的字段要求，使其聚焦模型纠错信号，并将运行时诊断元数据保留在 runtime error / logging surfaces 中。

## Impact

- Affected code:
  - `apps/agent-backend/src/agent/agentLoopToolRunnerSupport.ts`
  - `apps/agent-backend/src/agent/agentLoopToolRunner.ts`
  - `apps/agent-backend/src/agent/toolInvocationError.ts`
  - `apps/agent-backend/src/agent/service/runtimeErrors.ts`
  - `apps/agent-backend/src/agent/agentLoopToolRunnerTelemetry.ts`
  - related tests under `apps/agent-backend/src/agent/**` and `apps/agent-backend/tests/agent/**`
- Affected runtime surfaces:
  - machine-facing tool error payloads written back into `message[]`
  - terminal runtime error metadata and logs
  - tool failure recovery tests and observability assertions
- No intended breaking change for frontend runtime error rendering; the main contract change is limited to the model-facing tool error payload inside the conversation loop.
