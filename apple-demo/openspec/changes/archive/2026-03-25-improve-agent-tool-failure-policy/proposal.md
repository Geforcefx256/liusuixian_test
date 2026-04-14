## Why

当前 agent runtime 对工具失败的处理过于粗糙：build/agent loop 只有一次全局恢复机会，未区分 runtime 自动重试与模型引导恢复，也缺少对重复失败无进展场景的显式停止与观测能力。这会导致工具调用在瞬时错误、参数错误、权限错误之间采用同一种处理方式，既不利于稳定性，也不利于诊断。

## What Changes

- 将 build/agent loop 的工具失败策略拆分为两层：
  - runtime retry：仅用于幂等工具的瞬时失败，按单次 tool invocation 计数
  - model recovery：用于可恢复的语义/参数错误，按单次 tool-call chain 计数，并优先保证 LLM 有机会基于错误反馈修正调用
- 在 `config.json` 中暴露工具失败策略配置，包括 model recovery 修正调用次数、runtime retry 次数与 loop detection 阈值
- 为工具失败引入更清晰的错误分类与结构化错误载荷，优先保障参数/路径/payload 错误回灌给模型修正，同时让前端报错消费终态 stop reason
- 为 tool-call chain 增加 no-progress detection，在重复失败且无进展时显式终止执行，而不是继续消耗 token
- 为工具失败策略增加运行期观测，包括重试次数、恢复次数、重复失败停止原因、拒绝来源与工具级失败分布
- 第一阶段仅覆盖 build/agent loop；planner loop 保持当前默认关闭路径，不纳入本次变更范围

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-backend-runtime`: 调整 runtime 对工具失败、自动重试、模型恢复、无进展停止与相关配置/观测的行为要求

## Impact

- Affected code:
  - `apps/agent-backend/src/agent/agentLoop.ts`
  - `apps/agent-backend/src/agent/toolFailureRetry.ts`
  - `apps/agent-backend/src/runtime/tools/**`
  - `apps/agent-backend/src/agent/service/runtimeErrors.ts`
  - `apps/agent-backend/src/memory/ConfigLoader.ts`
  - `apps/agent-backend/config.json`
- Affected runtime surfaces:
  - tool invocation failure handling
  - runtime error payloads
  - runtime logging / metrics
- Local tools are the first-stage focus; runtime retry remains conservative unless a tool is explicitly marked eligible
- No breaking frontend contract is intended, but runtime failure metadata may be enriched to expose clearer stop reasons.
