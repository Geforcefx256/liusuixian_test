## 1. 类型与配置

- [ ] 1.1 `apps/agent-backend/src/agent/types.ts`：`AgentModelConfig` 新增 `thinking?: { enabled: boolean; budgetTokens?: number }` 字段
- [ ] 1.2 `apps/agent-backend/src/agent/loopTypes.ts`：`CompleteWithToolsResponse` 新增 `reasoning: string` 字段
- [ ] 1.3 `apps/agent-backend/src/agent/sessionStoreTypes.ts`：`AgentSessionMessage` 新增 `reasoning?: string` 字段
- [ ] 1.4 `apps/agent-backend/config.json`：`defaultModel` 新增 `"thinking": { "enabled": true }`
- [ ] 1.5 `apps/agent-backend/config.json`：`huaweiHisApi` 将 `enable_thinking: false` 改为 `true`，并新增 `"thinking": { "enabled": true }`

## 2. 请求构建：providerClient.ts

- [ ] 2.1 `buildRequestBody`：当 `model.thinking?.enabled === true` 时，按 provider 注入 thinking 参数
  - provider 为 `openai`（DeepSeek 直连）：body 中加入 `"thinking": { "type": "enabled" }`
  - provider 为 `huaweiHisApi`：body 中加入 `"chat_template_kwargs": { "enable_thinking": true }`
- [ ] 2.2 `buildSamplingRequestParams`：当 `model.thinking?.enabled === true` 时，不输出 `temperature`、`top_p`、`top_k`
- [ ] 2.3 `toOpenAiMessages`：assistant message 携带 `reasoning` 时，在输出的 OpenAI message 中附加 `reasoning_content` 字段

## 3. 流式响应解析：providerStream.ts

- [ ] 3.1 `OpenAiStreamChunk` 类型：`delta` 新增可选 `reasoning_content?: string` 字段
- [ ] 3.2 `StreamingAccumulator` 新增 `reasoningParts: string[]`
- [ ] 3.3 `applyChunk`：识别 `delta.reasoning_content`，累积到 `reasoningParts[]`
- [ ] 3.4 `StreamingAssembledResponse` 新增 `reasoning: string` 字段
- [ ] 3.5 `finalizeAccumulator`：将 `reasoningParts` join 为 `reasoning` 输出

## 4. SessionStore 持久化

- [ ] 4.1 `sessionStoreUtils.ts`：`agent_session_messages` 建表语句新增 `reasoning_json TEXT` 列
- [ ] 4.2 `sessionStoreUtils.ts`：沿用 `ensureSessionMetaColumn()` 模式，新增迁移逻辑为已有表 ALTER TABLE 加列
- [ ] 4.3 `sessionStore.ts`：`appendMessage` 的 INSERT 语句纳入 `reasoning_json` 列
- [ ] 4.4 `sessionStore.ts`：`listMessages` / 查询语句纳入 `reasoning_json` 列，映射到 `AgentSessionMessage.reasoning`
- [ ] 4.5 确认 `TokenEstimator.countMessage()` 不计入 reasoning（reasoning 在独立列，不在 parts 中，天然排除）

## 5. Agent Loop 集成：agentLoop.ts

- [ ] 5.1 `completeModelStep` 返回值携带 `response.reasoning`
- [ ] 5.2 `appendAssistantMessage`：将 reasoning 传入 sessionStore.appendMessage，写入 `reasoning_json` 列
- [ ] 5.3 下一轮 `loadMessages` 返回的 assistant message 自动携带 reasoning，`toOpenAiMessages` 中自动附加 `reasoning_content`（满足 DeepSeek tool loop 回传要求）

## 6. 验证

- [ ] 6.1 DeepSeek 直连 API 端到端验证：开启 thinking 后，单轮对话返回含 reasoning 的响应，reasoning 写入 DB 但不影响 token budget
- [ ] 6.2 DeepSeek 直连 API tool loop 验证：多步工具调用场景，reasoning_content 正确回传，无 400 错误
- [ ] 6.3 华为 HIS API 端到端验证：开启 thinking 后，reasoning_content 正确解析并持久化
- [ ] 6.4 上下文验证：多轮 tool loop 后，ContextManager 的 budget 计算不含 reasoning，消息选择不受 reasoning 大小影响
- [ ] 6.5 运行 `pnpm type-check` 确认无类型错误
- [ ] 6.6 运行 `pnpm test` 确认现有测试不受影响
