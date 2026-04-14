## Why

当前 `apps/agent-backend` 对上游 LLM 仍然使用整包响应模式，只有在模型完整返回后才向 `web` 发出最终文本，因此现有 `/agent/api/agent/run` 虽然具备 NDJSON 流接口，底层却不是真正的上游流式处理。这使长回复、长工具规划和取消场景的响应性不足，也让“超时”只能按整次请求处理，无法区分首包迟迟不来与流中途卡死。

现在需要先把主链路改成真实流式，并明确超时语义：对 LLM 对话默认采用 watchdog，而不是硬性总时长截止。只要上游流仍有推进，就允许继续等待；真正需要暴露和处理的是首包超时与空闲超时。

## What Changes

- 将 `agent-backend -> LLM` 的模型调用改为基于 `/chat/completions` 的上游流式处理，而不是等待整包 JSON 后再继续执行。
- 保持 `agent-backend -> web` 现有 `POST /agent/run + application/x-ndjson` 事件契约兼容，不要求本阶段引入新的浏览器流协议。
- 在后端内部增加对上游流式 chunk 的增量组装，确保文本、tool call、finish reason 和最终结果可以在流式场景下正确收敛。
- 将主链路 timeout 语义调整为 watchdog：引入首包等待和流式空闲超时，默认不把累计总时长作为健康流的硬截止条件。
- 明确流式超时、流中断和取消时的失败收口行为，避免把半截上游输出伪装成成功完成。

## Capabilities

### New Capabilities

### Modified Capabilities

- `agent-backend-runtime`: 调整模型调用、流事件生成和超时语义，使运行时支持上游真实流式处理并采用 watchdog 风格的对话超时判定。

## Impact

- Affected code:
  - `apps/agent-backend/src/agent/providerClient.ts`
  - `apps/agent-backend/src/agent/chatOrchestrator.ts`
  - `apps/agent-backend/src/agent/agentLoop.ts`
  - `apps/agent-backend/src/agent/service/RunExecution.ts`
  - `apps/agent-backend/src/agent/modelRequestError.ts`
  - `apps/agent-backend/src/agent/service/runtimeErrors.ts`
  - related tests under `apps/agent-backend/src/agent/**/*.test.ts`
- APIs and contracts:
  - Upstream model call stays on `/chat/completions`
  - Browser-facing `/agent/api/agent/run` NDJSON contract remains compatible in phase 1
- Systems:
  - `agent-backend` runtime execution and timeout handling
  - workbench conversation streaming behavior via existing backend event contract
