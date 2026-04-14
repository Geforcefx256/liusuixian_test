## Context

`apps/agent-backend` 当前已经把 tool failure 分成 machine-facing tool error payload 与 user-facing runtime error metadata 两层，但主 `AgentLoop` 写回会话的 tool error payload 仍然携带大量运行时控制元数据，例如 `chainKey`、`remainingRecoveryBudget`、`runtimeRetryCount`、`attempt`、`stopReason` 等。这些字段主要服务于 recovery policy、终态报错和 observability；一旦原样进入 `message[]`，模型后续每一轮都会重复看到它们，造成上下文膨胀和纠错噪声。

同时，planner loop 的 tool error payload 已经相对轻量，说明“模型只需要最小纠错信号”在本系统里不是新模式，而是主循环尚未收敛。当前变更的关键约束是：不能削弱 frontend / runtime 仍需依赖的 stop reason、chain metadata、threshold 和日志信息，也不能为了省 token 引入 silent fallback 或模糊错误分类。

## Goals / Non-Goals

**Goals:**
- 收敛主 `AgentLoop` 的 machine-facing tool error payload，只保留模型纠错最需要的最小字段。
- 允许 tool/provider 在能稳定判断时附加 `field`、`expected`、`actual`、`fix` 这类结构化差量提示。
- 保持 `ToolInvocationError`、`runtimeError`、telemetry 与日志中的诊断元数据完整。
- 让主循环的错误协议与 planner loop 的轻量思路更一致，同时不要求两个路径完全共用同一实现。

**Non-Goals:**
- 不重做现有 tool failure classifier、runtime retry 或 model recovery 策略。
- 不改变 frontend 终态错误展示契约，也不移除 runtime error 中现有的 stop reason / threshold / chain metadata。
- 不要求所有工具第一版都必须产出 `field` / `expected` / `actual` / `fix`。
- 不借本次 change 顺手调整其他 `message[]` 压缩、context compaction 或 unrelated runtime behavior。

## Decisions

### 1. 主循环 machine-facing tool error payload 统一收敛为最小纠错协议

主 `AgentLoop` 写回会话的 tool error payload 统一收敛为：

- `success`
- `code`
- `recoverable`
- `retryHint`
- `error`

并支持可选字段：

- `field`
- `expected`
- `actual`
- `fix`

不再默认把以下运行时控制字段写回模型上下文：

- `chainKey`
- `attempt`
- `remainingRecoveryBudget`
- `runtimeRetryCount`
- `stopReason`
- `threshold`
- `denyOrigin`
- `safeToRepeat`
- `synthetic`
- 重复性的 invocation identity 字段

这样模型看到的是“下一步如何改”，而不是“运行时内部为什么这样调度”。

备选方案：

- 只对 `local:question` 特判：改动面更小，但会把错误协议做成局部特例，后续其他工具很难复用。
- 继续保留现有大 payload，只依赖长会话压缩：历史压缩不能解决“刚失败后的下一轮”仍然吃满 token 的问题。

### 2. 运行时诊断元数据继续留在 ToolInvocationError / runtimeError / telemetry

`attempt`、`stopReason`、`threshold`、`chainKey`、`remainingRecoveryBudget`、`runtimeRetryCount` 这类字段对用户与系统仍然有价值，但它们的归宿应当是：

- `ToolInvocationError`
- terminal `runtimeError`
- telemetry / logs

而不是 conversation-loop 内的 machine-facing tool error payload。这样既能继续支持终态用户提示和调试，又不会把相同的内部控制信息反复灌入模型上下文。

备选方案：

- 直接全局删除这些字段：会破坏已有 runtime error、日志与观测能力，不符合本次目标。

### 3. 差量提示字段按“能稳定判断才返回”处理

`field`、`expected`、`actual`、`fix` 只在工具或校验器能稳定给出时返回；如果运行时无法可靠判断，就省略，而不是猜测。

第一版最适合产出这类字段的是：

- 本地结构化校验器，例如 `questionContract`
- 稳定的参数/路径/payload 错误归类

第一版通常不强求产出这类字段的是：

- timeout / 429 / service unavailable
- 远端工具内部异常
- 缺少结构化上下文的执行失败

备选方案：

- 强制所有工具都提供 `fix`：会迫使运行时或工具瞎编建议，降低错误契约可信度。
- 完全不支持差量字段：会错失输入错误场景下的高价值纠错信号。

### 4. planner loop 保持轻量，不作为本次变更中心

planner loop 当前错误 payload 已经足够简练，本次不强求其与主循环完全同构。目标是先把主循环收敛到与 planner loop 同一设计方向，而不是在同一次 change 中统一所有实现细节。

备选方案：

- 同时重构主循环与 planner loop 到完全一致：一致性更强，但超出本次变更范围，也会扩大验证面。

## Risks / Trade-offs

- [模型失去部分内部状态信息] → 通过保留 `code`、`recoverable`、`retryHint` 与简洁 `error`，并为高价值输入错误提供可选差量字段，避免让模型在失去控制元数据后完全失去纠错方向。
- [某些现有测试强依赖大 payload] → 需要把测试断言从“检查所有内部字段”改为“检查模型面最小协议”和“运行时诊断元数据仍在终态可见”两层。
- [工具无法稳定提供 `fix`] → 把 `field` / `expected` / `actual` / `fix` 设计为可选字段，仅在高置信度场景返回。
- [行为边界被误解为删除诊断信息] → 在 proposal/spec/design 中明确：删除的是模型面 payload 冗余字段，不是 runtime / logging / telemetry 中的诊断能力。

## Migration Plan

1. 先收敛主 `AgentLoop` 的 machine-facing tool error payload 组装逻辑。
2. 同步保留 `ToolInvocationError`、runtime error 汇总与 telemetry 的现有诊断字段。
3. 更新主循环相关测试，拆分验证“模型面 payload 精简”与“终态 runtimeError 诊断完整”。
4. 对能稳定提供差量提示的校验路径补充 `field` / `expected` / `actual` / `fix` 测试；无法稳定提供的路径保持字段缺省。

## Open Questions

- None for this proposal phase.
