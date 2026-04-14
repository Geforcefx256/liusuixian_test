## Why

当前 `apps/agent-backend` 的模型配置仅显式支持流式超时字段，运行时请求体也会强制写入 `stream: true`。这导致兼容 OpenAI 协议但要求或依赖非流式响应的模型无法通过 `config.json` 正常启用 `stream: false`，配置与运行时行为不一致。

## What Changes

- 为单模型配置增加显式 `stream` 开关，允许在 `agent.defaultModel`、`agent.modelRegistry.*` 与 `modelsByAgent` 对应模型上声明 `stream: false`。
- 调整 agent-backend 的 provider 调用路径，在 `stream: true` 时继续使用现有 SSE 解析，在 `stream: false` 时改用普通 JSON 响应解析。
- 保持现有前端和后端 NDJSON 事件协议不变，不将上游模型响应模式直接暴露给 workbench。
- 明确 `streamFirstByteTimeoutMs` 与 `streamIdleTimeoutMs` 在 `stream: false` 下仅作为兼容保留字段，不再表示真实流式阶段语义。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-backend-runtime`: 调整模型配置与运行时调用要求，使单模型配置可以显式控制是否使用流式响应，并保证非流式响应在运行时可被正确解析与计量。

## Impact

- Affected code: `apps/agent-backend/src/agent/types.ts`, `apps/agent-backend/src/memory/ConfigLoader.ts`, `apps/agent-backend/src/agent/providerClient.ts`, related tests and baseline config.
- APIs: `config.json` 的单模型配置结构将新增 `stream` 字段。
- Systems: 仅影响 agent-backend 到上游模型 provider 的调用方式，不改变 web/workbench 现有事件协议。
- Dependencies: 不引入新依赖，也不涉及第三方依赖升级。
