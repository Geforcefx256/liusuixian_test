## Context

当前 agent-backend 的单模型配置只暴露了流式超时相关字段，`ProviderClient` 在构造上游请求体时会固定发送 `stream: true`，并且主响应路径只按 SSE 流进行解析。这让 `config.json` 无法正式表达“某个模型必须使用非流式返回”的意图，也让兼容 OpenAI 协议但不稳定支持流式的 provider 无法通过现有配置正常接入。

这个改动只涉及 `apps/agent-backend` 的配置解析与 provider 调用层，不改变 web/workbench 与 agent-backend 之间已有的 NDJSON 事件协议。当前后端本身也没有把上游 token 流逐段透传到前端，而是在运行成功后统一发出完整文本，因此上游改为非流式不会改变前端契约。

## Goals / Non-Goals

**Goals:**

- 让单模型配置可以显式声明 `stream: false`。
- 在 provider 调用层根据模型配置选择 SSE 或普通 JSON 响应解析路径。
- 保持现有运行结果、usage 统计、tool call 还原和 workbench 事件协议不变。
- 保持默认行为与当前版本一致，未配置 `stream` 时继续按流式处理。

**Non-Goals:**

- 不为 provider 自动推断 `stream` 模式。
- 不改变前端消费的 NDJSON 事件结构。
- 不放宽 `usage` 的要求；非流式模式仍要求 provider 返回 usage。
- 不重新定义 `streamFirstByteTimeoutMs` 与 `streamIdleTimeoutMs` 在非流式模式下的精细阶段语义。

## Decisions

### 1. 在单模型配置上增加显式 `stream?: boolean`

将 `stream` 放在 `AgentModelConfig` 上，并允许 `agent.defaultModel`、`agent.modelRegistry.*`、`modelsByAgent` 对应模型配置声明该字段。

原因：

- 响应模式通常是模型或 provider 级差异，不是整个系统的全局执行策略。
- 与现有 `maxTokens`、`temperature`、`custom` 等模型级配置保持一致，职责清晰。
- 默认值保留为 `true`，可以避免对现有配置造成破坏性变化。

替代方案：

- 全局 `agent.stream` 开关：会把 provider 差异错误提升到系统级，不适合同仓多模型场景。
- 自动根据 provider 猜测：行为不透明，排障成本高。

### 2. ProviderClient 按 `stream` 分成两条解析路径

- `stream !== false`：维持现有请求体 `stream: true` 和 SSE 解析路径。
- `stream === false`：请求体发送 `stream: false`，并改为读取普通 JSON 响应。

非流式路径优先复用现有 `parseOpenAiChoice(...)`、`parseOpenAiUsage(...)` 和 tool-call 名称映射逻辑，避免引入两套不同的响应归一化规则。

原因：

- 当前代码中已经存在可复用的非流式 choice/usage 解析辅助函数，主流程接入成本低。
- 流式与非流式共享同一套规范化结果结构，可以降低后续维护成本。

替代方案：

- 始终请求 `stream: true`，由 provider 自己兼容：无法解决当前“配置可写但运行时不支持”的问题。
- 为非流式另写一整套 provider 归一化流程：重复逻辑过多，增加偏差风险。

### 3. 保持 usage 为必填，保持 workbench 事件契约不变

无论 `stream` 为 `true` 还是 `false`，provider 结果都必须包含 usage，并继续归一化成现有 metrics 结构。运行成功后，agent-backend 仍按当前方式向前端输出完整文本事件，而不是把上游响应模式直接泄漏到前端。

原因：

- 当前运行时、日志和度量已经依赖 usage，放宽会扩大行为面。
- 前端不需要感知上游 provider 使用流式还是非流式，只需要稳定消费 backend 结果。

替代方案：

- 在非流式模式下降级 usage 为可选：会引入隐藏降级路径，不符合当前调试优先原则。
- 将上游非流式结果改成非流式 HTTP 返回给前端：会破坏现有 workbench 契约。

### 4. 非流式模式下保留流式超时字段的兼容性，但不承诺阶段语义

`streamFirstByteTimeoutMs` 与 `streamIdleTimeoutMs` 在 `stream: false` 时继续作为兼容字段保留，但不再表示真实的“首字节超时 / 流空闲超时”阶段保证。文档和规格只要求它们在非流式模式下不被解释为精确流式语义。

原因：

- 用户已经接受该兼容语义。
- 这避免为了支持 `stream:false` 再引入额外的 `requestTimeoutMs` 回滚或一套新的超时模型。

替代方案：

- 在非流式模式下重新引入总请求超时字段：会扩大配置面和迁移成本。
- 完全禁止在 `stream:false` 模式下出现这些字段：会制造不必要的配置断裂。

## Risks / Trade-offs

- [兼容 OpenAI 的第三方 provider 返回结构不完全标准] → 保持 usage 为必填，并在非流式路径上显式失败，避免静默降级。
- [同一 provider 在不同模型上混用流式与非流式，增加测试面] → 将开关限制在单模型配置，补充流式与非流式两条主路径的单元测试。
- [用户误以为非流式模式仍具有精确的流式超时行为] → 在 spec 和实现注释中明确这些字段在 `stream:false` 下仅为兼容保留项。

## Migration Plan

1. 为模型配置类型、配置加载与基线配置补充 `stream` 字段支持，默认值保持为 `true`。
2. 在 `ProviderClient` 中按 `stream` 分流请求构造与响应解析。
3. 补充 `providerClient`、`ConfigLoader` 与运行时行为测试，覆盖默认流式、显式非流式、usage 缺失失败等路径。
4. 更新示例配置与相关文档，说明 `stream:false` 的使用方式与超时语义边界。

## Open Questions

None.
