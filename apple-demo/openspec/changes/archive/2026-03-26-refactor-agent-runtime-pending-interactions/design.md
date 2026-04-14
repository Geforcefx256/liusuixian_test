## Context

当前 runtime 有两条相互污染的机制边界：

- `local:question` 通过 protocol short-circuit 结束当前 run，再由前端把 `{ questionId, answer }` 作为普通用户输入重新发起 `/agent/run`
- `local:write`、`local:run_command` 等工具又会被 `structuredOutput` 逻辑按 `toolName + summary JSON` 推断为 domain-result short-circuit，从而隐式结束本轮运行

这导致 loop 终止条件与工具返回值耦合，出现三类问题：

- 普通工具链路会被提前截断，模型无法在同一任务上下文里继续思考
- question 流依赖 protocol 消息与前端再次 `/run` 的偶然配合，刷新或后端重启后恢复能力弱
- backend / frontend 都在把“普通工具结果”“阻塞式交互”“真正终态输出”混在同一套 short-circuit 语义里处理

本次重构的目标不是逐字照搬 `opencode` 的内存挂起协程实现，而是向它的分层原则靠拢：普通工具继续返回普通 tool result，交互请求走独立 pending interaction 模型，终态输出只由显式 final 语义触发。由于当前产品是 browser + backend + persisted sessions 形态，设计必须支持页面刷新与后端重启后的恢复，因此不能依赖单进程内存中的挂起 Promise 作为唯一真相。

## Goals / Non-Goals

**Goals:**

- 将 question 流改造成可持久化、可恢复的 pending interaction + continuation run 模型
- 明确区分普通工具结果、阻塞式交互、显式终态输出三种 runtime outcome
- 让 `local:write`、`local:run_command` 等普通工具默认继续 loop，而不是被隐式 short-circuit
- 在页面刷新和后端重启后恢复 pending question，并允许用户回答后继续同一 session 任务
- 保留 planner / workbook 等真正需要 protocol UI 的场景，不让 question 再占用 protocol 机制

**Non-Goals:**

- 不恢复“同一个挂起中的 JS Promise / run 协程 / SSE 连接”
- 不迁移历史 protocol question 消息为新的 interaction 记录
- 不在本次把 permission、plan decision 等所有交互统一迁入 interaction service
- 不重构全部 rich result UI；本次只要求普通工具不再隐式终止 run

## Decisions

### Decision: 引入持久化 interaction 记录，而不是依赖内存挂起的 question await

backend SHALL 为阻塞式交互引入独立持久化模型，例如 `agent_session_interactions`，最少记录：

- `interactionId`
- `userId`, `agentId`, `sessionId`
- `runId`
- `kind`，当前为 `question`
- `payloadJson`，保存问题文本、字段契约、允许值、required 元数据
- `status`，如 `pending / answered / rejected / expired`
- `createdAt`, `resolvedAt`
- `continuationContextJson`，保存 continuation 所需的最小上下文

Rationale:

- 当前 session SQLite 基础设施已经存在，新增一张 interaction 表的代价可控
- 只有持久化 interaction 记录，才能在页面刷新和后端重启后恢复
- 这比恢复同一个内存 Promise 简单得多，也更符合服务端产品架构

Alternatives considered:

- 像 `opencode` 一样完全使用内存 pending map + Deferred：拒绝，因为当前产品需要浏览器刷新与后端重启恢复
- 把 question 继续编码进 protocol message + protocol_state：拒绝，因为 question 不再适合放在富 UI protocol 机制里

### Decision: Question tool 触发的是 `awaiting-interaction` outcome，而不是 protocol short-circuit

`local:question` SHALL 不再返回 protocol short-circuit assistant message。取而代之的是：

1. 工具校验输入并创建 `pending` interaction 记录
2. loop 接收一个显式 `awaiting-interaction` outcome
3. 当前 run 以等待输入的终态结束
4. frontend 通过 interaction API 展示并恢复问题 UI

这个 outcome 与普通 success/error/cancelled 分离，避免再用 assistant text/protocol/domain-result 伪装“等待输入”。

Rationale:

- 当前 question 机制的核心问题在于“等待输入”被伪装成了 protocol short-circuit message
- 显式 waiting outcome 能清楚表达当前 run 已暂停，但 session 任务尚未完成
- 这样可以让 frontend 在恢复场景里直接读取 pending interaction，而不必依赖旧消息体推断

Alternatives considered:

- 让 `/agent/run` 在 SSE 连接上一直挂着等待用户回复：拒绝，因为刷新与重启恢复会极其复杂
- 保持 run status 只有 success/error/cancelled，把等待输入伪装成 success：拒绝，因为语义不真实，也会继续污染前端状态机

### Decision: 用户回答后创建 continuation run，而不是恢复原 run 协程

question 回复流程 SHALL 是：

1. 前端调用 interaction reply API
2. backend 按原始 interaction contract 校验答案
3. backend 将 interaction 标记为 `answered`
4. frontend 触发一个新的 continuation run
5. continuation run 读取会话历史和已解决 interaction，并以规范化的 interaction-answer 上下文继续模型循环

continuation run 可以使用新的 `runId`，但必须保留同一个 `sessionId`，并在 runtime/日志里记录它关联的是哪个 interaction。

Rationale:

- 这能达到“任务可继续”的产品目标，而不需要恢复进程内挂起栈
- 现有系统本身已经是以 run 为单位的 HTTP/SSE 生命周期， continuation run 更契合当前架构
- 新 `runId` 更容易调试、落日志和失败重试

Alternatives considered:

- 试图恢复同一个 `runId` 与同一个工具调用栈：拒绝，因为需要工作流检查点式复杂度
- 在 reply API 内直接偷偷调用模型，不显式创建 continuation run：拒绝，因为前端会失去统一 run 生命周期与可见状态

### Decision: 普通工具是否终止 loop 必须是显式语义，不能再靠工具名或返回 JSON 形状推断

runtime SHALL 废弃当前基于 `toolName + summary JSON` 的隐式 short-circuit 判定。新的规则是：

- 普通工具：`read` / `write` / `run_command` / skill 等，返回 tool result，loop 继续
- 阻塞式交互：返回 `awaiting-interaction`
- 显式终态输出：只有被显式标记为 final 的结果才允许结束 run 并进入 terminal structured output 路径

`local:write` 返回 `artifact_ref` 仍然合法，但这不再自动意味着“本轮应结束”。

Rationale:

- 当前 write 被错误终止，根因就在隐式推断
- 终止条件必须成为 loop contract，而不是工具输出格式副作用
- 这能把普通工具与 rich result/structured output 真正解耦

Alternatives considered:

- 仅把 `local:write` 从白名单里移除，保留其他隐式推断：拒绝，因为根因还在，未来还会污染别的工具
- 彻底移除 structured output：拒绝，因为 planner/workbook/rich result 仍需要显式结构化终态

### Decision: Question UI 从 protocol runtime 中拆出，前端通过独立 interaction 状态恢复

frontend SHALL 为 pending interaction 建立独立状态源，而不是把问题继续塞进 conversation protocol message。典型流程：

- 选择 session 或刷新页面时，同时拉取 session messages 与 pending interactions
- 若存在 `pending question`，在 conversation shell 内或 composer 附近展示 question UI
- 用户回答后调用 reply API，再创建 continuation run
- question 完成后，UI 以 interaction status 与新的 continuation 消息收敛，不再依赖原 protocol message 的 `protocolState`

Rationale:

- 当前 `question_response -> runConversationInput()` 路径把 question 回答伪装成普通用户输入，语义太弱
- 独立 interaction 状态源更适合刷新恢复和重启恢复
- protocol runtime 可以继续服务 planner/workbook，不再同时背负 question 的恢复职责

Alternatives considered:

- 保持 question 仍显示为 protocol card，只是后端持久化 interaction：拒绝，因为机制仍然双轨，复杂度高
- 让问题 UI 完全脱离会话页面，做成全局弹窗：拒绝，因为会打断当前 workbench 心智

## Risks / Trade-offs

- [Risk] 新增 interaction 表、API 和 run outcome 会扩大 backend/frontend 变更面。 → Mitigation: 先只覆盖 `question`，不要在同一变更内把 permission/plan decision 也一起迁入。
- [Risk] continuation run 使用新 `runId`，与“同一个 run 继续”直觉不完全一致。 → Mitigation: 在日志与事件里显式记录 `continuationOfInteractionId`，保持可观测性。
- [Risk] `local:write` 不再 short-circuit 后，部分现有 rich result UI 可能不再自动出现。 → Mitigation: 本次先把“普通工具不断流”作为硬目标，显式 final result 呈现语义单独保留，不在本次混合重写。
- [Risk] 历史 session 中旧 question protocol 消息不会自动升级。 → Mitigation: 明确新契约只约束新写入数据，旧数据继续按兼容只读逻辑展示。
- [Risk] 前端同时维护 protocol runtime 与 interaction runtime，会短期增加状态复杂度。 → Mitigation: 明确 question 从 protocol 中移出后，职责边界反而会更清晰。

## Migration Plan

1. 新增 interaction persistence schema、store 接口与 list/reply/reject API，但先不移除旧 question 路径。
2. 重构 `local:question` 和 `AgentLoop` outcome 模型，引入 `awaiting-interaction` 终态与 continuation context。
3. 前端增加 pending interaction 查询、恢复与回答 UI，并切换 question 提交流程到 interaction reply + continuation run。
4. 将 `structuredOutput` 的隐式终态判定从 `local:write`、`local:run_command` 等普通工具上移除，只保留显式 final 路径。
5. 删除旧 `question_response -> runConversationInput()` 链路与对应 backend normalize path 的主用路径，仅保留必要兼容窗口。
6. 补齐刷新恢复、后端重启恢复、continuation run、普通工具不断流的端到端测试。

Rollback strategy:

- 若 interaction runtime 引入严重回归，可暂时恢复旧 protocol question 路径并关闭新的 interaction reply 入口
- interaction 表为追加式新数据，不要求对历史 session 做回滚迁移

## Open Questions

- 是否在本次同时为 `permission` 预留 interaction 基础类型，但不接入 UI
- continuation run 的 terminal/result 事件是否需要新增显式字段，例如 `continuationOfInteractionId`
