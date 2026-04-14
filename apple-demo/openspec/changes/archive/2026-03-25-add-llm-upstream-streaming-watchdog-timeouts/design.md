## Context

当前 workbench 浏览器侧已经通过 `POST /agent/api/agent/run` 读取 NDJSON 流，但 `apps/agent-backend` 内部的 `ProviderClient` 仍按整包 JSON 调用 `/chat/completions`，导致运行时只有在上游模型完整结束后才会生成最终文本和终态事件。换句话说，浏览器链路是流接口，模型链路却不是流实现。

这次变更跨越 `providerClient`、`agentLoop`、`chatOrchestrator`、`RunExecution`、错误分类与相关测试，属于后端主链路行为调整。与此同时，前端本阶段不要求做新的渲染效果，因此需要在不破坏现有 `web` 契约的前提下，把上游模型调用改成真实流式，并重新定义超时语义。

约束已经比较明确：

- 上游调用继续使用 `/chat/completions`，不切换到新的外部 API 形态。
- `agent-backend -> web` 继续保持当前 `POST + application/x-ndjson` 契约。
- 本阶段优先建设底层真实流式能力，不承诺前端按 token 或按块实时展示。
- 对 LLM 主链路 timeout 采用 watchdog 语义，只在“没有进展”时判定超时。

## Goals / Non-Goals

**Goals:**

- 让 `agent-backend -> LLM` 改为真实流式处理，并支持文本与 tool call 的增量组装。
- 在运行时中引入首包超时和空闲超时，避免把健康流仅因累计时长过长而终止。
- 保持浏览器侧 `/agent/api/agent/run` 的现有事件契约兼容，避免这次变更扩大到前端协议重构。
- 明确流式超时、流中断、取消等异常的失败收口行为，防止半截输出伪装成成功结果。

**Non-Goals:**

- 不在本阶段引入新的浏览器流协议，例如 SSE 或 WebSocket。
- 不要求前端在本阶段实现新的分块渲染或打字机效果。
- 不把 LLM 主链路默认设计成 hard deadline 模式。
- 不改变现有 `protocol`、`domainResult`、`protocolState` 等终态结构化结果模型。

## Decisions

### 1. 上游继续使用 `/chat/completions`，但改为流式模式

`ProviderClient` 继续沿用当前 chat completions 消息格式、tool schema 和 provider 适配层，只是在请求体中开启流式响应并解析上游增量 chunk。

之所以不切换外部 API 形态，是因为当前仓库的模型调用、工具调用映射、错误分类和测试基线都围绕 `/chat/completions` 建立。保持同一上游接口可以把变更集中在“响应处理方式”，而不是同时改动请求协议、模型映射和测试资产。

备选方案：

- 改用新的外部 responses 风格接口：未来可评估，但本阶段会扩大变更范围。
- 继续保持整包响应：无法解决底层不是真实流式的问题，直接排除。

### 2. 后端内部消费原始上游流，浏览器只消费运行时事件

原始上游 stream chunk 只在 `agent-backend` 内部解析和组装，浏览器仍只接收统一的 `AgentStreamEvent`。

这样做有两个目的：

- 避免把半截 tool call JSON、provider 特定字段和不稳定 chunk 结构泄漏给 `web`。
- 保证未来切换 provider 或优化流式聚合时，前端契约不需要同步重构。

备选方案：

- 将上游 chunk 直接透传给浏览器：前端会被 provider 细节污染，且 tool call 增量很难安全消费。

### 3. 主链路 timeout 采用 watchdog 语义

运行时将 timeout 拆成更明确的语义：

- `firstByteTimeout`: 请求发出后，迟迟没有首个有效上游 chunk。
- `idleTimeout`: 已开始流式响应，但在阈值内没有新的有效进展。
- `hardDeadline`: 本阶段不作为默认主链路策略。

决策核心是：**只要流仍有推进，就允许继续等待。**

这比“按累计总时长强制终止”更符合流式对话的实际情况。长回复、长工具规划或推理过程可能持续数十秒以上，但只要仍有稳定增量，就不应被误判为超时。

备选方案：

- 维持当前单一 `requestTimeoutMs` 作为总超时：会误杀健康流。
- 完全不设超时：无法区分真正卡死与慢速但健康的流。

### 4. “有进展”按可解析增量判断，而不是任意字节

watchdog 刷新不能只依赖“socket 上收到了字节”，而要依赖可证明执行继续推进的事件，例如：

- 收到并成功解析的上游 chunk
- 文本内容增量
- tool call 参数组装推进
- finish reason 或终止信号

这样可以避免空 heartbeat 或无效碎片长期掩盖真正的流卡死问题。

### 5. 流异常默认按失败收口，不将 partial output 伪装成成功

如果发生首包超时、空闲超时、上游流中断或用户取消，运行时应明确进入失败或取消路径：

- 不发伪造的成功 `assistant.final`
- 不将半截模型输出保存成已完成的 assistant 最终结果
- 通过现有 runtime error / terminal event 机制显式暴露错误

备选方案：

- 将 partial output 当成成功回答落库：会增加排障成本，并掩盖真实失败原因。

### 6. 浏览器侧事件契约 phase 1 保持兼容

本阶段不要求新增浏览器协议。`/agent/api/agent/run` 仍保留当前 NDJSON 形式和终态结果模型。即使未来要把上游增量更积极地转发为 `assistant.delta`，phase 1 也必须先保证现有 `web` 不因这次改造而失配。

## Risks / Trade-offs

- [Risk] 上游 tool call 会以多段增量到达，组装错误会导致工具调用参数损坏。
  → Mitigation: 在后端引入明确的增量组装状态机，并用测试覆盖文本、tool calls、finish reason 的混合流场景。

- [Risk] 现有 `requestTimeoutMs` 语义与 watchdog 新语义不一致，容易造成配置误解。
  → Mitigation: 在设计和实现中显式拆分 timeout 角色，避免把“累计总时长”继续当作默认主链路判定。

- [Risk] phase 1 不做前端分块展示，用户感知到的“变快”可能不明显。
  → Mitigation: 把这次变更明确定位为底层真实流式与超时语义治理，而不是完整的前端体验升级。

- [Risk] 流式引入后，错误路径从单点变成首包超时、空闲超时、流中断、取消等多分支，回归面扩大。
  → Mitigation: 对 provider client、runtime error mapping、run execution 终态收口分别补充单元测试和集成测试。

## Migration Plan

1. 在 `ProviderClient` 增加上游流式请求与增量解析能力，同时保留当前 provider/tool 映射约定。
2. 在运行时中引入首包与空闲超时语义，并把失败分类接入现有 runtime error 体系。
3. 维持 `/agent/api/agent/run` 当前 NDJSON 契约，确保 `web` 无需同步重构即可继续运行。
4. 补充测试后落地实现；如需回滚，可退回到当前整包响应逻辑而不影响浏览器协议。

## Open Questions

- phase 1 是否要把部分上游文本增量立即转成对浏览器可见的 `assistant.delta`，还是先只在后端内部流式并保持终态输出？
- timeout 配置是否沿用现有模型配置入口扩展，还是为 streaming watchdog 引入更明确的新字段命名？
