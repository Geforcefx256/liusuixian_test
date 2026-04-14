## Context

Agent-backend 通过 OpenAI 兼容的 `/v1/chat/completions` HTTP API 调用大模型，核心链路为：

```
ContextManager.build() → AgentLoop.completeModelStep() → ProviderClient.completeWithTools()
     ↓                          ↓                              ↓
  消息选择/裁剪            tool loop 循环                  HTTP 请求/流式解析
```

当前使用两种模型部署：
- **DeepSeek 直连**（api.deepseek.com）：`provider: "openai"`, `modelName: "deepseek-chat"`
- **华为 HIS API**（vLLM 部署）：`provider: "huaweiHisApi"`, `modelName: "deepseek-chat"`

两者的 thinking 开启方式和响应格式不同，需要在 providerClient/providerStream 层做统一抽象。

128k context window 分配：`usable = contextWindow(128k) - maxTokens(8k) = 120k`，其中 system prompt 约占 2-4k，剩余 ~116k 给消息历史。Thinking 内容若进入历史，每轮多占 5-15k，是上下文膨胀的主因。

## Goals / Non-Goals

**Goals:**
- 两种模型均支持开启 thinking，提升推理质量
- Thinking 内容不进入长期 session 历史，不膨胀上下文
- Tool loop 中正确回传 reasoning_content（满足 DeepSeek API 约束）
- Thinking 开启时自动屏蔽不兼容的采样参数
- 配置驱动，可通过 config.json 控制是否开启

**Non-Goals:**
- 不向前端推送 thinking 内容或 stream event
- 不在 ModelCallMetrics 中独立计量 thinkingTokens（Phase 2）
- 不做按 skill/场景的 thinking effort 分级（Phase 2）
- 不做 agent loop 内首轮 on / 中间轮 off 的分级策略（Phase 2）

## Decisions

### 决策 1：Provider 差异在 providerClient 层屏蔽

**选择**：`buildRequestBody` 根据 `model.provider` + `model.thinking` 配置，自动注入 provider 特定的请求参数。上层（agentLoop/chatOrchestrator）只关心 `thinking.enabled`，不感知 provider 差异。

**理由**：providerClient 已经是 provider 适配层（处理 endpoint 路径、header、custom body），thinking 参数注入是同一职责。避免 provider 差异泄漏到 agentLoop。

### 决策 2：统一使用 reasoning_content 字段解析

**选择**：`StreamingAssembledResponse` 新增 `reasoning: string` 字段。两种 provider 均通过 `delta.reasoning_content` 独立字段输出 thinking 内容（经确认华为 HIS API 同样支持），无需 `<think>` 标签解析。

**理由**：两种 provider 输出格式统一，providerStream 只需一套解析逻辑，大幅降低复杂度。

### 决策 3：SessionStore 新增 reasoning 列持久化

**选择**：`agent_session_messages` 表新增 `reasoning_json TEXT` 列。reasoning 内容随 assistant message 一起写入数据库，查询时作为 `AgentSessionMessage.reasoning` 返回。`toOpenAiMessages` 构建 LLM 请求时，从 message.reasoning 注入 `reasoning_content` 字段；`TokenEstimator` 计算 token 时排除 reasoning 列。

**理由**：
- 消息链路一致：存什么就读什么，不需要事后注入，调试时 DB 可查
- DeepSeek API 约束：tool loop 中必须回传上一轮的 reasoning_content。reasoning 持久化后，loadMessages 自然携带，无需额外注入逻辑
- 未来扩展：Phase 2 的 thinkingTokens 计量、前端 thinking 展示都有现成数据源
- 已有先例：同表的 `meta_json`、`attributes_json` 均为可选 JSON 列，模式一致

**Schema 变更**：沿用 `ensureSessionMetaColumn()` 已有的 ALTER TABLE 迁移模式，向 `agent_session_messages` 表加列 `reasoning_json TEXT`，默认 NULL，对存量数据零影响。

**Token 排除**：`TokenEstimator.countMessage()` 通过 `serializeMessage()` 遍历 `message.parts` 计算 token。reasoning 存储在独立列（不在 parts 中），因此天然不被计入 token budget，无需额外过滤。

### 决策 4：Thinking 开启时自动屏蔽采样参数

**选择**：`buildRequestBody` 中，当 `thinking.enabled === true` 时，不发送 `temperature`、`top_p`、`top_k` 参数。

**理由**：DeepSeek thinking 模式会静默忽略这些参数。显式不发送比发送后被忽略更清晰，避免调试时的困惑。

## Risks / Trade-offs

- **[风险] DeepSeek API reasoning_content 回传格式变化**：DeepSeek V3.2 当前要求 tool loop 中回传 reasoning_content，未来版本可能变更此行为。→ 缓解：回传逻辑封装在 `toOpenAiMessages` 中，变更时只需修改一处。

- **[风险] reasoning 列增加磁盘占用**：每轮 thinking 约 5-15k 字符，20 步 loop 可产生 100-300k 字符的 reasoning 数据。→ 可接受：SQLite 单会话数据量仍在 MB 级，远低于瓶颈；且 reasoning 数据为调试和未来扩展提供价值。

- **[trade-off] reasoning 不入历史导致跨 turn 推理连贯性降低**：模型在新 turn 开始时看不到前一 turn 的推理过程，只能看到结论。→ 接受：这是所有主流框架（Claude Code、OpenClaw）的标准做法，结论本身包含足够信息。且 ConversationCompactor 生成的摘要可弥补上下文损失。
