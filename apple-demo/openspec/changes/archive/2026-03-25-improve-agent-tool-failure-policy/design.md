## Context

当前 `apps/agent-backend` 的 build/agent loop 在工具失败时采用单一的恢复模型：第一次失败被标记为 `recoverable`，第二次失败直接终止。该模型有三个问题：

- 它没有区分瞬时传输类失败与语义/参数类失败
- 恢复预算按整个 run 共享，某个工具失败会消耗其他工具的恢复机会
- runtime 缺少“重复失败但无进展”的显式停止条件与对应观测

同时，现有实现已经具备一些可复用基础：

- tool provider 能返回结构化 `error.type` 与 `error.message`
- `agentLoop` 已经能把 tool error part 回灌给模型
- runtime 已有 `config.json`、`ConfigLoader` 和 `runtimeError` 结构，可承载策略配置与错误元数据

本次变更只覆盖 build/agent loop；planner loop 保持现状，不纳入本次设计。

## Goals / Non-Goals

**Goals:**

- 将工具失败处理拆分为 runtime retry 与 model recovery 两层策略
- 让 runtime retry 与 model recovery 使用不同预算与计数维度
- 将失败策略配置化，并放入 `config.json`
- 为重复失败无进展场景提供稳定、可解释的停止机制
- 为工具失败、重试、恢复与停止原因补充观测字段

**Non-Goals:**

- 不在本次变更中调整 planner loop 行为
- 不引入新的外部依赖或分布式重试协调
- 不将所有工具默认升级为可自动重试
- 不改变现有前端调用路径或要求前端新增控制面板才能使用该能力

## Decisions

### 1. 将工具失败处理拆分为 runtime retry 与 model recovery

`runtime retry` 处理瞬时失败，例如 timeout、rate limit、temporary unavailable；它发生在单次 tool invocation 内部，对模型透明。  
`model recovery` 处理参数、路径、payload 等可由模型修正的错误；它通过 tool error part 把结构化失败反馈给模型，由模型决定是否再次发起工具调用。

之所以分层，是为了避免“网络抖动”和“模型参数修正”争抢同一个预算，也避免把所有失败都用一种方式处理。

备选方案：

- 统一只做 model recovery：实现简单，但会让瞬时错误暴露给模型，增加 token 消耗且不稳定
- 统一只做 runtime retry：无法处理参数错误、权限错误、路径错误等语义问题

### 2. runtime retry 按单次 tool invocation 计数

每次具体工具调用都拥有独立的 runtime retry 次数，例如某次 `local:read_file` timeout 最多自动重试 2 次；这不会影响后续其他工具调用。

之所以这样设计，是为了接近 request-level retry 语义，避免整次 run 因某个瞬时失败消耗掉全局自动重试预算。

备选方案：

- 按整个 run 计数：会让一个工具的瞬时故障影响其他工具
- 按 tool name 计数：语义比 per invocation 更粗，也会让不同调用实例互相干扰

### 3. model recovery 按单次 tool-call chain 计数

tool-call chain 指“模型在收到某个工具的可恢复失败后，连续对同一个工具做出的修正调用链”。第一版采用保守规则：只有“上一个结果是该工具的 `model_recoverable` 失败，并且模型下一次紧接着继续调用同一个工具”时，才延续为同一条 chain；一旦切到别的工具，原 chain 即结束，后续即使再回到同名工具，也视为新 chain。

之所以这样设计，是为了避免工具 A 的参数错误耗尽工具 B 的修复机会，同时仍然能限制单条失败链路无限重试。

备选方案：

- 按整个 run 计数：过于粗糙
- 按 tool name 计数：会把不相关的两次同名调用混在一起
- 做语义级意图归并：理论上更聪明，但第一版难以解释、难以验证

### 4. model recovery 预算按修正调用次数计数，而不是按总失败次数计数

第一版的 `model recovery` 预算表示“模型还能再发起多少次修正调用”，而不是“当前链路一共还能失败多少次”。首次失败只负责打开 chain 并把结构化错误回灌给模型，不消耗 recovery 预算；后续每次同链修正调用才扣减一次 recovery 预算。

之所以这样设计，是为了让参数/路径/payload 错误先被模型看见，再决定是否修正，而不是把第一次失败本身也算成一次恢复机会，导致 LLM 的修正窗口过窄。

备选方案：

- 按总失败次数计数：实现简单，但会把“首次暴露错误”与“真正的修正尝试”混为一谈
- 每次回灌错误都扣预算：对模型不友好，且不符合“先给模型看错题再修正”的语义

### 5. runtime retry 只允许用于显式声明可自动重试的幂等工具

工具元数据需要表达至少以下属性：

- `idempotent`
- `supportsRuntimeRetry`
- `supportsModelRecovery`

runtime retry 只对“幂等 + 声明支持自动重试 + 错误类型属于瞬时失败”的调用生效。非幂等工具，如写文件、执行命令、外部副作用型 gateway/MCP 工具，不应默认自动重试。第一阶段以 local 工具为主，但默认仍保持保守：`local:run_command` 不允许 runtime retry，文件/检索类工具也只有在被显式标记为 eligible 时才允许自动重试。

备选方案：

- 对所有工具启用 runtime retry：风险过高，可能重复产生副作用
- 仅靠工具名硬编码：短期可行，但长期难维护

### 6. failure classification 使用 `tool + error.type + message pattern`

第一版不要求 provider 立刻升级成更细的公共错误契约。runtime 在现有 `error.type` 之上增加一层本地 classifier，使用以下输入进行分类：

- tool name
- provider 返回的 `error.type`
- 必要时使用稳定的 message pattern

classifier 产出三个决策类目：

- `transient_retryable`
- `model_recoverable`
- `terminal`

local-first 的默认策略如下：

- `VALIDATION_ERROR` → `model_recoverable`
- `TOOL_NOT_FOUND` → `model_recoverable`
- `TOOL_DENIED` → `terminal`
- `INVALID_RESULT` → `terminal`
- `EXECUTION_TIMEOUT` → local-first 默认 `terminal`
- `EXECUTION_FAILED` → 默认 `terminal`，但 `run_command` 的命令语法错误、引号错误、未知文件 key 等可通过 message pattern 归一为 `model_recoverable`

之所以这样设计，是因为当前 local 工具里大量“模型可修”的问题最终只会表现为普通执行错误文本，如果只依赖粗粒度 `error.type`，会过早终止 run。

备选方案：

- 只依赖 `error.type`：规则简单，但对 local 工具过于粗糙
- 直接修改所有 provider 公共错误契约：长期更整洁，但不适合第一阶段落地速度

### 7. no-progress detection 是停止条件，不是额外恢复次数

no-progress detection 的职责是判断“继续执行已无价值”，而不是再多给一次机会。第一版采用可解释的规则：

- `sameFailureThreshold`: 同 tool + 同规范化 error code + 同规范化参数指纹在连续修正调用中重复出现时，达到阈值停止
- `sameOutcomeThreshold`: 同 tool + 同规范化 error code 连续出现，即使参数指纹有变化，达到阈值停止

首次失败只负责打开 chain，不计入 no-progress 阈值；只有后续修正调用才参与 no-progress 计数。命中后 runtime 终止该链路，并产生明确的 runtime failure 元数据。

备选方案：

- 不做 no-progress detection，只靠 maxSteps：成本更高，且错误原因不清楚
- 做复杂语义级“是否有任务进展”判断：准确率可能更高，但第一版复杂度过高

### 8. 错误载荷分为模型消费与用户消费两层

tool error part 面向模型，应该保留结构化字段，例如：

- `category`
- `code`
- `message`
- `retryHint`
- `safeToRepeat`
- `chainKey`
- `attempt`
- `remainingRecoveryBudget`

`runtimeError` 面向前端/用户，继续保留：

- `userMessage`
- `detail`
- `stage`
- `retryable`
- `stopReason`
- `toolName`
- `chainKey`
- `normalizedCode`
- `attempt`
- `threshold`

这样模型恢复逻辑与用户可读错误提示可以分别演进，而不互相牵制。特别地，`TOOL_DENIED` 需要作为 terminal failure 返回，并在日志中显式记录拒绝来源。

### 9. 配置统一放入 `config.json`

第一版配置集中放在 `runtime.agentLoop` 与 `runtime.tools` 下，默认值保持兼容当前行为：

- `modelRecovery.maxCorrectionCalls` 默认 `1`
- `runtimeRetry.maxAttempts` 默认 `0` 或关闭
- `loopDetection.sameFailureThreshold` 与 `sameOutcomeThreshold` 只统计修正调用，不统计首次失败
- `loopDetection` 默认启用保守阈值，或默认关闭后由配置显式打开

`0` 表示显式禁用对应能力；非法值在启动时直接报错，而不是静默回退。

## Risks / Trade-offs

- [错误分类不足] → 如果 provider 返回的 `error.type` 不够稳定，runtime retry 与 model recovery 的分流会失真；需要先收敛 error taxonomy
- [message pattern 漂移] → 如果 message pattern 过于松散，分类可能误判；第一版应只匹配少量稳定、已知的 local 工具错误文本
- [工具元数据补齐成本] → 某些现有工具没有幂等/副作用标签；第一版可以先为现有工具提供显式默认值，再逐步推广
- [tool-call chain 识别偏差] → 如果链路归并过宽，可能误把独立尝试算成同一链；第一版应采用保守、可解释的链路识别规则
- [过度停止] → no-progress detection 阈值过低会过早终止；需要通过日志与测试校准默认值
- [观测字段过少] → 如果只记录最终失败，不记录中间 retry/recovery 事件，后续很难调参；本次需要同时补运行日志与聚合指标

## Migration Plan

1. 在 `config.json` 与 `ConfigLoader` 中引入新的工具失败策略配置，并给出兼容默认值
2. 为 local-first 场景补充 failure classifier、工具元数据支持和规范化错误码
3. 在 build/agent loop 中实现 runtime retry、model recovery 预算分离、连续同工具 chain 记账与修正调用计数
4. 增加 no-progress detection、显式 stop reason、deny 来源日志与终态 runtime error 元数据
5. 补齐日志、指标和测试，确认默认配置下保持兼容

回滚策略：

- 将新增配置设为兼容默认值
- 若需要快速回退，可关闭 `runtimeRetry` 与 `loopDetection`，并把 `modelRecovery.maxCorrectionCalls` 设回 `1`

## Open Questions

- `loopDetection` 是否默认启用，还是先默认关闭并由配置显式开启
- 第一阶段 local 工具之外，gateway / MCP 工具中哪些应被标记为支持 runtime retry，哪些必须显式禁用
