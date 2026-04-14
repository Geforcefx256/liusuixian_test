## Context

当前 runtime 的 short-circuit 结构化输出存在三个耦合错误：

- `AgentLoop` / `plannerLoop` 会同时持久化工具 short-circuit 结果和模型原始 `tool_calls` 响应，导致同一轮 assistant 消息双写
- 会话历史只把 `text` 当作结构化 payload 的主要载体，导致 protocol / domain-result 的真实结构依赖 raw JSON 文本解析
- 运行完成时仍会把 `execution.text` 作为普通 assistant text 流给前端，导致 protocol 或 artifact 结果在运行中或 reload 后暴露 raw JSON

这个问题已经在 `local:question` 暴露为“卡片正常渲染，但同时出现异常 JSON 文本气泡”，但根因并不局限于 question tool，而是所有 short-circuit 结构化输出路径的公共消息语义错误。由于本次已明确不需要处理历史数据，设计可以只面向新的写入契约。

## Goals / Non-Goals

**Goals:**

- 为 short-circuit 结构化输出建立单一、稳定、可恢复的 canonical assistant 消息语义
- 让 protocol / domain-result 的持久化和恢复不再依赖 raw text JSON 解析
- 阻断结构化 payload 以普通 assistant 文本污染后续模型上下文
- 让运行时展示与 reload 后展示基于同一份结构化数据，而不是两套推断逻辑
- 对齐主 `AgentLoop` 与 `plannerLoop` 的 short-circuit 行为

**Non-Goals:**

- 不处理历史 session 数据迁移或旧脏消息修复
- 不改变 `local:question` 或 `local:run_command` 对外暴露的业务语义
- 不引入新的独立问答 API；`question_response` 继续走现有会话循环
- 不重构普通纯文本 assistant 消息或非 short-circuit 工具消息的整体模型

## Decisions

### Decision: Short-circuit 结构化输出只持久化一条 canonical assistant 消息

主 `AgentLoop` 与 `plannerLoop` SHALL 在检测到 protocol / domain-result 类型的 short-circuit 结果时，只持久化一条 assistant 消息。该消息承担以下责任：

- 作为 session history 的唯一 assistant 记录
- 作为 `onAssistantStepComplete` 的元数据挂载对象
- 作为 terminal run result 的 `assistantMessageId`

不再允许同一轮同时保留：

- 一条工具 short-circuit 消息
- 以及一条模型原始 `tool_calls + content` assistant 消息

Rationale:

- 双写是这次异常气泡的直接根因
- `ContextManager`、message meta、history reload 都需要稳定的 canonical message id
- 单消息语义可以同时修复 build loop 与 planner loop 的分叉行为

Alternatives considered:

- 只在前端隐藏异常文本气泡：拒绝，因为数据库与模型上下文污染仍然存在
- 保留两条消息但给前端加特殊过滤：拒绝，因为会话语义仍然不一致，且 `onAssistantStepComplete` 仍会挂到错误消息

### Decision: 为 session message 增加显式 structured part，而不是继续把结构化结果塞进 raw text

runtime SHALL 为 short-circuit 结构化输出增加显式的 structured session part，至少能够表达：

- `kind: "protocol"`
- `kind: "domain-result"`
- 对应的结构化 payload

short-circuit canonical assistant 消息将同时包含：

- 面向模型和预览的摘要 text part
- 保留工具调用上下文的 tool part
- 面向前端/history 恢复的 structured part

`sessionStore` 与相关 result builder SHALL 优先读取 structured part 恢复 message view 与 terminal structured output，而不是把 raw text 重新 parse 成 protocol/domain-result。

Rationale:

- protocol/domain-result 是结构化消息，不应继续依赖 `JSON.parse(text)` 猜测
- tool part 仍可保留工具调用上下文，避免破坏后续模型连续性
- 一个通用 structured part 比单独扩展 `protocol` / `result` 多种 part 更容易保持机制统一

Alternatives considered:

- 只给 `question` 增加 `protocol` part：拒绝，因为 `local:run_command` 的 `artifact_ref` 也属于同一机制
- 完全去掉 tool part，仅保留 summary text：拒绝，因为后续模型上下文可能需要工具调用与工具结果的机器可读连续性

### Decision: 模型看到的是 tool-owned summary，而不是模型原始 `response.text`

当 short-circuit 结构化输出发生时，runtime SHALL 丢弃该轮模型原始 `response.text` 作为用户可见消息与会话持久化来源的资格。canonical assistant 消息中的 text part 必须来自 runtime 基于真实结构化 payload 生成的 summary，而不是来自模型在 `tool_calls` 轮次附带的 content。

Rationale:

- 当前实证已证明模型可以在 `tool_calls` 轮次伪造一份结构化 JSON，并且其 `questionId` 可与真实 tool output 不一致
- 只有工具真实返回值才是可信的结构化源
- summary text 仍可用于 preview、session title、模型对上一轮结果的自然语言理解

Alternatives considered:

- 继续信任模型 `response.text` 并尝试从中提取正确 JSON：拒绝，因为这会把错误内容进一步制度化
- 在 provider 层粗暴丢弃所有 `tool_calls` 轮次 content：拒绝，因为问题根因在消息语义，不在 provider transport

### Decision: structured short-circuit 结果不再通过普通 assistant text stream 暴露 raw JSON

当 terminal output 是 `protocol` 或 `domain-result` 时，runtime SHALL 允许前端以 terminal result 作为权威结构化结果来源，而不是强制发送 `assistant.delta/final` 的 raw JSON 文本。前端运行中的临时 assistant 占位消息可以等待 terminal structured result 完成后再收敛为卡片/结果消息。

Rationale:

- 当前运行中的 raw JSON 闪现与 reload 后异常文本都来自“结构化结果先被当 text”
- protocol/domain-result 本质上是结构化 UI 数据，不适合通过普通 assistant 文本流展示
- 前端已经在 `run.completed` 后拥有足够的结构化终态结果来替换临时消息

Alternatives considered:

- 继续发送 raw JSON delta，再由前端覆盖：拒绝，因为用户会看到短暂异常内容，且逻辑上仍然错误
- 给前端添加“如果像 JSON 就别显示”规则：拒绝，因为这是脆弱的表现层补丁

### Decision: plannerLoop 与主 AgentLoop 使用同一套 short-circuit 消息语义

`plannerLoop` SHALL 与主 `AgentLoop` 采用同样的 canonical short-circuit 规则，包括：

- 单条 assistant canonical message
- structured part 持久化
- summary text 生成
- 不再额外落库模型原始 `tool_calls` 消息

Rationale:

- 当前两个 loop 各自保留了同类双写语义
- 如果只修主 loop，plan 阶段仍会保留同一种协议泄漏路径

Alternatives considered:

- 只修主 `AgentLoop`：拒绝，因为会留下同类设计缺口

## Risks / Trade-offs

- [Risk] 新增 structured session part 会改变 session message 内部模型。 → Mitigation: 将改动限制在 session part parser / serializer、message view builder 和 result builder，普通 text/tool 消息不变。
- [Risk] summary text 过于简略可能降低后续模型对上一轮 short-circuit 结果的理解。 → Mitigation: 为 protocol 和 domain-result 定义稳定的 tool-owned summarizer，保留必要业务信息但不泄漏 raw JSON。
- [Risk] 取消 structured output 的 raw text stream 可能让运行中消息在完成前保持空白更久。 → Mitigation: 让前端继续显示已有的“处理中”占位，并在 terminal result 到达时一次性收敛成结构化消息。
- [Risk] 保留 tool part 意味着模型仍能看到 tool role 的结构化输出。 → Mitigation: 问题的主要污染源是 assistant text 模仿；保留 tool part 可维持链路语义，必要时再单独评估 provider 对 tool role 的约束。
- [Risk] 只面向新数据契约，旧 session 仍可能保持旧形态。 → Mitigation: 本次明确不做历史数据治理，避免把实现复杂度带到 proposal 之外。

## Migration Plan

1. 为 session message 引入 structured short-circuit part，并更新 parser / serializer / message view builder。
2. 重构 `AgentLoopToolRunner`、`AgentLoop` 与 `plannerLoop` 的 short-circuit 返回值，使 canonical assistant message 只在 loop 层落库一次。
3. 为 protocol / domain-result 增加 tool-owned summary 生成，并停止持久化模型原始 `response.text` 作为 short-circuit 消息正文。
4. 更新 terminal result 构建与 stream 发射逻辑，让 structured output 走结构化终态路径而不是 raw text stream。
5. 更新前端 `workbenchStore` 与相关渲染逻辑，使运行时与 reload 后都以结构化 payload 为准。
6. 补齐主 loop、planner loop、session history、run stream、workbench reload 的测试。

Rollback strategy:

- 若实现需要回退，可恢复当前 text-only short-circuit 持久化路径并移除 structured part 读取逻辑
- 因本次不做历史数据迁移，回滚不需要额外数据修复步骤

## Open Questions

- None currently. The change is scoped narrowly enough to proceed to implementation once the proposal is approved.
