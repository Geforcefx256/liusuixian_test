## Why

Agent 在与大模型交互时未开启 thinking 模式，导致复杂任务（多步工具调用、代码生成、规划推理）的推理质量不足。DeepSeek V3.2 和华为 HIS API 部署的模型均支持 thinking 能力，但当前配置中显式关闭或未配置。

开启 thinking 后的核心矛盾是上下文消耗：thinking 内容如果进入消息历史，每轮累积 5-15k token，20 步 agent loop 后可达 200k，远超 128k 上下文窗口。因此必须在开启 thinking 的同时确保 thinking 内容不污染长期消息历史。

## What Changes

- 在 `AgentModelConfig` 中新增 `thinking` 一等配置字段，取代纯 `custom.body` 透传
- `providerClient` 根据 thinking 配置，按 provider 差异构建对应请求参数：
  - DeepSeek 直连 API：注入 `thinking: { type: "enabled" }`
  - 华为 HIS API (vLLM)：注入 `chat_template_kwargs: { enable_thinking: true }`
- `providerStream` 解析 thinking 输出：两种 provider 均通过 `delta.reasoning_content` 独立字段输出，统一解析逻辑
- SessionStore 新增 `reasoning_json` 列，reasoning 内容持久化但不计入 token budget；tool loop 中自动回传 reasoning_content（满足 DeepSeek API 要求）
- Thinking 开启时自动跳过 `temperature`/`top_p`/`top_k` 参数（DeepSeek thinking 模式会静默忽略这些参数）

## Capabilities

### New Capabilities

- `agent-thinking-mode`：Agent 与大模型交互时支持 thinking 推理模式，提升复杂任务的推理质量，且不膨胀上下文窗口

### Modified Capabilities

（无现有 spec 层级行为变更）

## Impact

- `apps/agent-backend/src/agent/types.ts`：`AgentModelConfig` 新增 `thinking` 字段
- `apps/agent-backend/src/agent/providerClient.ts`：`buildRequestBody` 感知 thinking 配置，`toOpenAiMessages` 从 message.reasoning 注入 reasoning_content
- `apps/agent-backend/src/agent/providerStream.ts`：`StreamingAccumulator` 和 `StreamingAssembledResponse` 新增 reasoning 字段，`applyChunk` 识别 `delta.reasoning_content`
- `apps/agent-backend/src/agent/loopTypes.ts`：`CompleteWithToolsResponse` 新增 reasoning 字段
- `apps/agent-backend/src/agent/sessionStoreTypes.ts`：`AgentSessionMessage` 新增 `reasoning?: string`
- `apps/agent-backend/src/agent/sessionStoreUtils.ts`：`agent_session_messages` 表新增 `reasoning_json` 列
- `apps/agent-backend/src/agent/sessionStore.ts`：insert/select 语句纳入 reasoning_json 列
- `apps/agent-backend/src/agent/agentLoop.ts`：appendAssistantMessage 传入 reasoning
- `apps/agent-backend/config.json`：两种模型配置开启 thinking
- 涉及数据库 schema 变更（加列，向后兼容）；不涉及前端、第三方依赖变更
