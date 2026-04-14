## Context

`apps/agent-backend` 目前已经能把模型调用失败归类为 `transport`、`http`、`timeout_first_byte`、`timeout_idle` 等 runtime error，但 `transport` 失败路径只保留顶层 `TypeError: fetch failed`，不足以定位是连接建立前、TLS/代理链路中，还是上游长时间无响应后被动断开。

排障上还存在第二个问题：错误路径的运行计时没有带上失败模型调用的累计耗时，导致长时间等待后的模型失败被记入 `otherCostTime`，让 `[AgentRunTiming]` 无法直观看出时间到底消耗在模型还是其他阶段。

这次变更是一次纯诊断增强：不调整 `config.json`、不改 provider 选择规则、不扩大 timeout 窗口，只让下一次复现时能从日志直接看到失败所处阶段和更完整的底层错误上下文。

## Goals / Non-Goals

**Goals:**

- 为模型 `transport` 类失败提供可区分阶段的结构化诊断日志。
- 展开并保留底层 `error.cause` 链路中的关键字段，提升内网网关问题的可判读性。
- 让失败模型请求的耗时继续体现在模型维度的运行计时中。
- 保持现有 provider 行为、超时配置和配置文件内容不变。

**Non-Goals:**

- 不修改 `config.json` 或新增配置项。
- 不调整 `streamFirstByteTimeoutMs`、`streamIdleTimeoutMs` 或引入新的默认硬超时策略。
- 不试图在本次变更中修复内网网关或上游模型本身的不稳定性。
- 不改变前端展示文案或 `/agent/api/agent/run` 的浏览器事件契约。
- 不修改与模型 transport 诊断和失败计时无关的业务代码、业务流程或领域行为。

## Decisions

### 1. 诊断增强限定在 backend observability，不改变运行时控制语义

`transport` 失败当前已经能正确归类到模型错误层，但根因不透明。本次只增强日志和计时，不改 timeout 语义，也不把网关问题伪装成新的分类。这样可以避免在证据不足时引入新的边界规则或误导性的“修复”。

备选方案：
- 直接调大 timeout。放弃，因为当前失败主要发生在 `fetch` 阶段，现有 stream watchdog 并不覆盖这一段，单纯调大配置不能提高可观测性。
- 为 transport 再引入更多 failureKind。暂不采用，因为现阶段缺少足够样本验证稳定分类规则，先把原始上下文打出来更稳妥。

### 2. 失败日志按请求阶段拆分，而不是只打印统一 `fetch failed`

设计上会把模型调用至少区分为两个阶段：

- `request_pre_response`: 请求已经发出，但还未收到响应头时失败。
- `response_stream`: 已收到响应头，后续在流读取、协议解析或 watchdog 过程中失败。

这样下一次看到日志时，可以先判断问题卡在网关建立响应之前，还是已经进入 SSE/stream 阶段后才出错。

备选方案：
- 继续保留单条统一 transport 日志。放弃，因为无法回答“323 秒究竟卡在响应前还是流中”这个核心问题。

### 3. 展开底层 cause 链，但只记录诊断字段，不记录敏感载荷

顶层 `TypeError: fetch failed` 对 Node/undici 来说过于抽象。实现上应递归提取 `cause` 链中的稳定字段，例如 `name`、`message`、`code`、`errno`、`syscall`、`address`、`port`，并挂到结构化日志中。

同时延续当前 request/header redaction 策略，只记录定位问题所需的传输诊断字段，不额外暴露 token、authorization 或完整请求体。

备选方案：
- 直接 `JSON.stringify(error)`。放弃，因为 `Error` 默认不可枚举，通常得不到真正有价值的底层字段。

### 4. 错误路径继续沿用失败模型 metrics，而不是在 terminal 阶段丢弃

`AgentLoop` 在模型失败时其实已经把失败调用的 `latencyMs` 放进 `AgentExecutionError.modelMetricsAggregate`，但 `RunExecution` 的错误路径最终仍把 `modelAggregate` 传成 `null`，导致模型耗时从 run timing summary 中消失。

这次设计要求错误路径沿用已有失败模型 aggregate，保证长时间等待后的失败仍被记为模型耗时。这样 `[AgentRunTiming]` 才能和 `[LLM TIMING]` 的失败日志互相印证。

备选方案：
- 继续只在 `runtime_error.detail` 里附带 requestUrl。放弃，因为没有耗时归因时，排障仍然需要人工对多条日志做时间猜测。

### 5. 写入范围限定在诊断链路相关模块，避免顺带改业务实现

本次 change 的价值在于提高复现后的判读能力，而不是顺手整理 runtime 其他逻辑。实现时应把改动限制在模型请求日志、runtime error 打印、run timing 汇总及其测试上；如果发现其他业务代码存在问题，应留待后续独立 change 处理。

备选方案：
- 借这次机会一起重构 provider/runtime 周边代码。放弃，因为会扩大 diff 面，降低下次复现时“日志增强是否生效”的可验证性。

## Risks / Trade-offs

- [Risk] 日志量增加，尤其是 transport 失败高发时会放大错误日志体积。
  Mitigation: 只在失败路径记录扩展诊断字段，不对每次成功请求增加同等详细度。

- [Risk] 底层 cause 字段在不同 Node/undici 版本下不完全一致。
  Mitigation: 设计上记录稳定字段集合并允许缺省，不依赖单一字段存在。

- [Risk] 阶段化日志命名如果与当前实现细节耦合过强，后续 provider 调整会增加维护成本。
  Mitigation: 只暴露高层阶段语义，例如“响应前”和“流读取中”，避免绑定某个私有函数名。

- [Risk] 为了补日志顺带改到不相关业务逻辑，导致回归面扩大。
  Mitigation: 将改动文件限制在 proposal 中列出的诊断链路模块和相关测试，避免混入 unrelated business refactor。

## Migration Plan

这是 backend-only 的可观测性增强变更，无需数据迁移和配置迁移。

部署步骤：

1. 发布包含日志增强和计时修正的 `apps/agent-backend`。
2. 用现有内网模型配置继续运行，不修改 `config.json`。
3. 下次复现时，优先收集同一 `runId/turnId` 下的 `[LLM TIMING]`、`[AgentService] runtime_error` 和 `[AgentRunTiming]` 三类日志进行比对。

回滚策略：

- 直接回滚本次代码变更即可，不涉及持久化数据或配置兼容问题。

## Open Questions

- 内网 `modelgateway` 到上游模型是直接透传 SSE，还是先等待上游结果后再回传，当前仍未知；本次设计通过阶段化日志保证即使不知道网关内部实现，也能先判断失败停在响应前还是响应后。
