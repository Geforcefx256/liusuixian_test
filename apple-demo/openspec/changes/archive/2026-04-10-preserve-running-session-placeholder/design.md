## Context

当前工作台在发送消息时，会先在前端本地插入用户消息和一个运行中的 assistant 占位气泡，再通过流式事件更新这条本地消息。用户切换会话时，`selectSession()` 会用服务端返回的会话历史直接覆盖当前前端消息列表。

在 `sessionA` 仍然运行、但服务端历史尚未持久化对应 assistant 消息时，快速切到 `sessionB` 再切回 `sessionA`，会发生以下竞态：

1. 前端本地 assistant 占位消息已经存在。
2. `sessionA` 切回时重新拉取历史，服务端此时可能只有 user 消息。
3. 前端用不完整的历史覆盖本地消息，导致 assistant 占位气泡消失。
4. 后续流事件仍然尝试更新原本的本地 assistant 消息，但该消息已经被覆盖掉，直到下一次完整重载历史后才重新出现 assistant 气泡。

这个问题集中在 `apps/web/src/stores/workbenchStore.ts` 的会话水合与流式状态收敛逻辑。当前无需改变后端接口，也不需要引入新的依赖。

## Goals / Non-Goals

**Goals:**
- 在运行中的会话切回时，保持 assistant 占位气泡持续可见。
- 在服务端历史追平后，以持久化 assistant 消息替换本地占位，避免重复气泡。
- 保持现有运行中、停止中、等待问题回答等状态语义不变。
- 通过回归测试覆盖快速 `A -> B -> A` 切换和状态收敛场景。

**Non-Goals:**
- 不修改 agent-backend 的消息持久化时序。
- 不引入新的会话同步协议、订阅机制或后端补偿接口。
- 不调整现有会话列表、工作区占用或消息渲染组件的对外行为。

## Decisions

### Decision: 在前端会话水合阶段保留运行中的本地 assistant 占位消息

会话切回时，前端应先读取当前 session 的本地运行状态。如果该 session 仍处于 `running` 或 `stop-pending`，并且本地保存了一个尚未持久化的 assistant 消息，则水合后的消息列表需要将这条本地 assistant 占位重新并入最终显示结果。

这样可以保证：
- 服务端历史暂时落后时，用户仍能看到运行中的 assistant 气泡。
- 后续流事件仍能继续命中这条本地消息并更新内容。

选择这个方案，而不是简单接受服务端历史覆盖，是因为当前缺陷正来自“服务端历史暂时不完整但被当成绝对权威”。

备选方案：
- 改后端，在 run 开始时先持久化一条空 assistant 消息。
  - 放弃原因：会改变后端消息语义与持久化时序，影响面更大。
- 在流事件更新时发现消息不存在就临时补插一条。
  - 放弃原因：补偿逻辑分散在事件路径，容易与水合路径再次冲突。

### Decision: 以持久化 assistant 消息为最终权威，主动收敛 transient 占位

一旦服务端历史已经返回对应 assistant 消息，前端必须停止保留本地 transient assistant 占位，并只展示持久化消息。

这样可以避免：
- 同一轮对话出现两条 assistant 气泡。
- 占位气泡在 run 完成后继续残留。

这里的关键不是永久保留本地消息，而是仅在“服务端历史尚未追平”的短暂窗口中保留。

### Decision: 保持修复范围限制在 workbench store 与现有测试体系内

本次变更只修改前端 store 的水合合并逻辑和相关单元测试，不扩散到组件层重构或后端 API 变更。

这样可以：
- 降低回归面。
- 让测试直接覆盖问题发生的状态机入口。
- 避免引入与当前问题无关的新行为调整。

## Risks / Trade-offs

- [Risk] 本地占位与服务端正式消息同时显示，产生重复气泡。
  -> Mitigation: 仅当服务端历史缺少正式 assistant 消息时才保留 transient 占位；一旦历史追平立即收敛为持久化消息。

- [Risk] 停止中或已完成会话错误地继续保留占位消息。
  -> Mitigation: 将保留条件限制在 `running` / `stop-pending` 且存在未持久化 assistant 消息的 session。

- [Risk] 快速 `A -> B -> A` 水合竞态再次用旧请求覆盖新状态。
  -> Mitigation: 复用现有 hydration generation 保护，只在最新一轮水合结果上执行 transient 合并。

- [Risk] 修复影响等待问题回答或错误态会话的现有收敛逻辑。
  -> Mitigation: 为 `awaiting-question`、失败、停止收敛维持现有 authoritative state 优先规则，不把这类状态纳入 transient 保留条件。
