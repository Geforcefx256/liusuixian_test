## Context

`local:question` 当前是一个输出 protocol form 的本地工具，由 workbench 渲染并在提交时把 `{ questionId, answer }` 作为普通会话输入回传 runtime。这个模型已经满足当前产品边界，不需要引入 `opencode` 那种独立的 question 生命周期服务。

当前主要问题集中在安全性和纠错质量，而不是生命周期建模：

- 必填 `select` 字段会默认选中第一项，导致未显式交互也可能形成答案
- question 定义只支持顶层 `required`，无法表达字段级必填
- question 工具的定义校验主要靠运行时断言，缺少更强的一致性约束
- question 回答回传后缺少最小后端校验，更多依赖前端约定
- question 校验错误文案过长，模型重试时会被灌入过多自然语言
- workspace-agent 的 question 规则同时分散在 tool description 和 `CONTEXT.md` 中，容易重复漂移

这次设计目标是强化当前 protocol-based question flow，而不是替换它。

## Goals / Non-Goals

**Goals:**
- 消除必填 `select` 在未显式选择前自动形成答案的误答风险。
- 为 `local:question` 增加字段级 `required` 语义，并与现有顶层 `required` 形成稳定优先级。
- 强化 question 定义阶段的后端校验，拒绝不安全或含糊的 question payload。
- 在现有会话输入链路内增加最小 question answer 校验，确保回答与原始协议消息匹配。
- 将 question 的模型可见校验错误压缩为短句，同时保留日志中的详细错误。
- 收敛 question 使用规则来源，避免 `CONTEXT.md` 与 tool description 重复分叉。

**Non-Goals:**
- 不引入独立的 question pending store、`question.list`、`question.reply` 或 `question.reject` API。
- 不支持“用户拒绝回答”的显式后端语义。
- 不改变当前 question short-circuit 走 protocol message 的总体架构。
- 不在本次变更中放宽 `select` 选项数 `2-4` 的上限。
- 不把所有本地工具的错误文案统一重构为新的通用格式化框架。

## Decisions

### Decision: Required select fields SHALL remain unselected until the user explicitly chooses an option

`local:question` 生成 protocol form 时，`select` 字段默认不再因为 `required === true` 而自动取第一项。必填只表示“提交前必须完成显式选择”，不表示“系统可替用户代填默认答案”。

Rationale:
- 这是当前误答风险的直接根因。
- 推荐项放第一位依然有价值，但不能再被默认当作用户答案。
- 这项改动局部且收益最高，不需要改动整体协议模型。

Alternatives considered:
- 保留当前默认选中第一项，只在前端上增加更明显的提示。
- 仅对 `(Recommended)` 选项禁用默认值。

Why not:
- 只做提示无法消除“未交互即已回答”的根问题。
- 部分特判会让规则不一致，后续更难推理和测试。

### Decision: Field-level required SHALL take precedence over top-level question required

question 定义将新增 `fields[].required`，并采用如下优先级：

`field.required ?? question.required ?? false`

也就是说，顶层 `required` 作为默认值保留；字段级 `required` 用于覆盖默认值，表达混合必填/选填表单。

Rationale:
- 前端 protocol runtime 已经支持字段级 `required`，当前 tool 定义没有把能力显式暴露出来。
- 这能保留现有简单调用方式，同时支持复杂问题。

Alternatives considered:
- 移除顶层 `required`，只保留字段级定义。
- 继续只支持顶层 `required`。

Why not:
- 只保留字段级会增加简单问题的负担。
- 只保留顶层无法表达真实业务中的混合表单约束。

### Decision: Strengthen question definition validation at tool-construction time

`buildQuestionProtocol()` 及其 schema 输入层将补充更强的约束，包括但不限于：

- `fields` 与 `options` 互斥
- `select` 字段必须提供 `options`
- `text` 字段不得携带 `options`
- 字段 id 不得重复
- 同一 `select` 的 option value 不得重复
- 真实选项值不得为空字符串
- question payload 不得生成会导致隐式回答的默认值

Rationale:
- question 错误越早暴露，模型纠错链越稳定。
- 这些约束都属于 tool contract，而不是前端渲染细节。

Alternatives considered:
- 仅保留当前运行时断言，不补 schema。

Why not:
- 这样会继续让非法 payload 直到较晚阶段才暴露，而且错误形式不稳定。

### Decision: Add a minimal backend answer validator inside the existing conversation input path

本次不引入新的 reply API，但会在现有会话输入链路中加入一个“question answer recognizer/validator”段，负责：

- 识别输入是否为 `{ questionId, answer }`
- 从当前 session 中定位最近相关的 question protocol message
- 校验 `questionId` 是否匹配
- 校验字段集合、选项值、必填项是否与原协议消息一致
- 校验通过后再继续正常会话处理

Rationale:
- 这样可以得到 reply handler 的核心收益，而不引入新的生命周期系统。
- 它把前端约定变成后端契约，降低伪造 payload 和前后端漂移风险。

Alternatives considered:
- 保持只依赖前端校验。
- 新增独立 `/question/reply` 路由。

Why not:
- 只依赖前端校验无法防止错误客户端或回放输入。
- 新路由超出当前边界，也会把简单问题复杂化。

### Decision: Compress model-visible question validation errors at the provider boundary

question 的内部详细校验信息继续保留在日志中，但 provider 向 agent loop 返回的 `VALIDATION_ERROR` message 将改成短句、有限集合、面向纠错的格式，例如：

- `Question prompt is required.`
- `Question must provide exactly one of fields or options.`
- `Select options must contain 2-4 items.`
- `Recommended option must be the first item.`

Rationale:
- 当前长错误文案对人友好，但会增加不同 LLM 的重试噪音。
- provider 边界最适合同时保留“日志详细、模型短句”两种视图。

Alternatives considered:
- 在 agent loop 层统一压缩所有工具错误。
- 保持 question 错误原样透传。

Why not:
- agent loop 不应理解每个工具的细节语义。
- question 是当前最明显的长错误来源，先局部收敛更安全。

### Decision: Keep the 2-4 select-option limit and simplify question guidance instead of relying on description alone

本次保留 `select` 仅适用于 `2-4` 个封闭选项的约束，不修改 `CONTEXT.md` 为“只靠 tool description”，而是收敛为一组更短、更高信号的规则。

Rationale:
- 当前误答问题与选项上限无直接关系，优先级较低。
- `opencode` 也不是只靠 tool description，而是同时依赖 description、prompt 和 permission。
- 完全移除额外规则会让模型在现有系统中更容易漂移。

Alternatives considered:
- 直接放宽 `select` 项数限制。
- 删除 `CONTEXT.md` 中的 question 规则，只保留 description。

Why not:
- 现在先放宽项数会放大未修复前的误答和校验面。
- 单靠 description 在当前系统里不够稳定，也不符合已有实践。

## Risks / Trade-offs

- [更严格的 question 校验会让此前“勉强可用”的 payload 直接失败] → 用短错误文案保证模型能快速重试，同时保留日志中的详细原因。
- [最小 answer 校验可能错误匹配历史 question message] → 将匹配范围限制为当前 session 中最近的相关 protocol question，并补充针对 stale/mismatch 的测试。
- [字段级 `required` 与顶层 `required` 共存可能引入理解成本] → 明确采用 `field.required ?? question.required ?? false`，并在 tests 中锁定优先级。
- [收敛 `CONTEXT.md` 规则后，部分模型在极端场景下可能更依赖 description] → 保留最关键的高信号规则，不完全移除上下文约束。

## Migration Plan

1. 调整 question tool schema 与 protocol builder，移除 required select 的隐式默认回答，并补充字段级 `required`。
2. 补强 question 定义校验与短错误格式化逻辑。
3. 在现有会话输入路径中加入最小 question answer 校验。
4. 更新 workbench 校验与状态收敛逻辑，确保 required select 必须显式选择。
5. 收敛 workspace-agent 中的 question 规则文案。
6. 通过后端单测与 workbench 测试锁定误答、防错和重试行为。

Rollback strategy:
- 如果上线后出现兼容性问题，可整体回退 question tool builder、provider 错误格式化和 answer 校验改动。
- 本次不涉及持久化数据迁移，不需要额外回滚脚本。

## Open Questions

- None for proposal scope. 当前方案已明确：保留 protocol-based question flow，不引入独立 question 生命周期服务。
