## Context

当前 interaction runtime 已经把 `question` 从 protocol question card 中拆出来，并引入了 pending interaction、reply / reject API、以及 continuation run。这一步解决了刷新恢复和后端重启恢复，但没有真正收敛“模型到底从哪里记住已回答的问题”这个核心问题。

现状里存在三条彼此分叉的语义链路：

- `agent_session_interactions` 保存了 pending / answered / rejected 状态以及 answer JSON
- `agent_session_messages` 保存了 conversation history，但不会保存 answered / rejected question 的 canonical 用户回答
- continuation run 在 build phase 里临时构造 `continuationMessage`，在 planner phase 里又改写 `request.input`

结果是：

- answered / rejected interaction 不是长期可回放的 session history 事实
- old awaiting-interaction assistant 占位文本和 tool snapshot 反而会继续留在后续模型上下文里
- build / planner 对同一份 interaction answer 使用了两种不同的 replay 语义

用户已经明确接受一个重要取舍：如果 question 回答后在会话区显示普通 user bubble，可以接受。这个前提使本次设计可以直接选择最简单、最稳定的 canonical history 方案，而不需要引入隐藏结构化消息或每轮动态投影 interaction 表的复杂模型。

## Goals / Non-Goals

**Goals:**

- 让 answered / rejected question interaction 成为同一 `session` 下可持久回放的 canonical `message[]` 历史。
- 让 build phase 与 planner phase 使用同一套 continuation replay 语义。
- 让 continuation 只承担“继续执行”的控制职责，不再承担“携带回答正文”的数据职责。
- 在 pending question 未解决时阻止新的普通 `/run` 输入，避免 session 同时出现冲突任务链。
- 避免旧 awaiting-interaction 占位信息继续污染模型上下文。

**Non-Goals:**

- 不重新设计 pending question UI 的视觉样式。
- 不引入新的隐藏 message kind 或新的专用 structured session part。
- 不迁移历史 session 中旧 question 数据为新格式；新契约只约束新写入的会话链路。
- 不改变 continuation run 使用新 `runId`、同 `sessionId` 的总体生命周期模型。

## Decisions

### Decision: 将 resolved question interaction 直接追加为普通 `user message`

当 pending question 被 answer 或 reject 后，runtime SHALL 在同一 session message history 中追加一条普通 `user` message，正文使用标准化的 interaction context 文本。该消息成为后续 `AgentLoop` replay 的 authoritative source。

首版直接复用当前 continuation text 形状，例如：

```text
[INTERACTION CONTEXT]
interaction_id: ...
question_id: ...
prompt: ...
answer: {...}
```

对于 reject 分支，则写入对应的 rejected context 文本。

Rationale:

- 这与 `AgentLoop` 目前的核心心智完全一致：模型的长期记忆来源就是 `message[]`。
- 用户已经接受回答后显示 user bubble，因此没有必要为了隐藏该 bubble 再引入新的 message part 类型。
- 这让 `ContextManager`、summary、message selection、active tail 等机制都继续围绕 session messages 工作，而不需要额外引入 interaction 表投影层。

Alternatives considered:

- 使用隐藏的 structured interaction message：拒绝，因为用户已接受 user bubble，这会增加一次无收益的消息建模复杂度。
- 每轮根据 interaction 表临时投影已回答内容：拒绝，因为 canonical replay source 仍然分裂，build / planner / summary 更难统一。

### Decision: continuation 变为纯控制信号，不再临时注入回答正文

continuation run 仍然存在，但 `continuation.interactionId` 只用于：

- 标识当前 continuation 来源于哪个 interaction
- 校验该 interaction 已经 resolved
- 保留日志、事件和可观测性上的关联关系

build phase 不再构造临时 `continuationMessage`，planner phase 也不再把 resolved interaction answer 改写成新的 `request.input`。模型后续看到的 interaction answer 一律来自已经持久化的 session history。

Rationale:

- 只要 resolved interaction 已经进入 `messages`，再保留临时注入就会重复喂给模型。
- 去掉临时注入后，build / planner 两条链路终于可以共享同一个 replay 语义。
- continuation 的含义会变得清晰: “继续执行这条被 interaction 暂停的 session 任务”，而不是“额外带一段临时消息进模型”。

Alternatives considered:

- 继续保留 build / planner 各自的临时注入逻辑：拒绝，因为这正是当前漏信息与语义分叉的根源。
- 先追加 message，再继续保留临时注入作兼容：拒绝，因为会造成重复上下文与双重记忆。

### Decision: awaiting-interaction 占位信息只服务 UI / run 收敛，不再进入未来模型 replay

本次将 waiting assistant text 与 awaiting-interaction tool snapshot 定义为“技术性等待占位信息”，它们可以继续用于当前 run 的 terminal result、UI 显示或历史可见性，但不能再作为未来模型 replay 的语义输入。

因此，context build / planner load / provider-bound message preparation 必须在进入模型前排除这类纯 waiting 占位内容，确保 resolved question 的 user message 才是这条 interaction chain 的语义事实。

Rationale:

- 当前真正污染模型的，不只是“answer 没写回 history”，还包括 old waiting placeholder 被长期回放。
- waiting placeholder 不是用户意图，也不是 assistant 真正完成的业务输出，只是 run 在等待输入的技术态。
- 把它留在 conversation 可见层，不等于必须让它继续进入 LLM replay。

Alternatives considered:

- 保留 waiting placeholder 全量 replay：拒绝，因为这会继续把“需要你的输入后才能继续”误当成长期语义事实。
- 彻底不持久化 waiting assistant message：暂不采用，因为这会扩大 terminal result / history 呈现变更面；本次只要求它退出未来模型 replay。

### Decision: pending question 存在时，普通 `/run` 输入必须被显式拒绝

当同一 session 仍有 unresolved question interaction 时：

- backend SHALL 拒绝新的普通 `/run` input
- frontend SHALL 禁用 composer、发送按钮和上传入口
- 用户只能通过 reply / reject 路径解决该 interaction，再触发 continuation run

Rationale:

- 如果 unresolved interaction 期间仍允许发送新消息，会让 session 同时存在两条竞争的任务链。
- 仅靠前端约定不够；后端也必须保持一致的 session 约束，避免外部客户端或竞态绕过 UI。
- 这能把“一次 pending question 只能阻塞一条 continuation 链”变成明确的运行时契约。

Alternatives considered:

- 只在前端禁用输入，不在后端拒绝：拒绝，因为协议层仍可被绕过。
- 允许普通输入并由后端自动把它拼到 pending answer 后面：拒绝，因为这会再次制造隐式语义和不可预期的任务分叉。

## Risks / Trade-offs

- [Risk] question 回答或 reject 后会在会话区看到普通 user bubble。 → Mitigation: 这是用户已接受的产品取舍，换来最直接的 AgentLoop 正确性和最简单的历史模型。
- [Risk] 历史 session 中旧 awaiting-interaction assistant message 仍可能存在于持久化数据里。 → Mitigation: 新设计要求 replay 过滤这些 waiting artifact，不要求历史迁移。
- [Risk] waiting artifact 过滤如果判定过宽，可能误伤正常 assistant 消息。 → Mitigation: 过滤仅针对明确的 awaiting-interaction message shape 与对应 tool snapshot，而不是模糊关键词匹配。
- [Risk] backend 在 pending interaction 时拒绝普通 `/run` 可能暴露出之前被静默允许的客户端路径。 → Mitigation: 返回显式冲突错误，并同步更新 workbench 禁用逻辑和测试。

## Migration Plan

1. 在 reply / reject 链路中，为 resolved interaction 追加 canonical `user` session message。
2. 删除 build phase 的 `continuationMessage` 注入和 planner phase 的 `request.input` 改写，保留 continuation 关联标识但不再携带回答正文。
3. 在模型 replay 构建路径中过滤 awaiting-interaction waiting artifact，确保未来上下文只保留 resolved interaction 的 canonical user message。
4. 在 `/agent/run` 增加 pending interaction 校验；存在 unresolved question 时，拒绝普通 input，只允许 reply / reject 后 continuation。
5. 更新 workbench composer 行为，在 pending question 存在时禁用普通发送入口。
6. 补齐后端与前端测试，覆盖 answered / rejected canonical history、build / planner replay 一致性、waiting artifact 过滤、以及 pending-blocked input 行为。

Rollback strategy:

- 若 question answer user bubble 或 pending-blocked input 行为引起不可接受回归，可以回滚到“resolved interaction 不写入 session history、continuation 临时注入”的旧机制。
- 本次不引入新的数据表结构，因此回滚不需要数据库迁移，只需恢复旧运行时语义。

## Open Questions

None currently. 用户已经确认：

- reject 也可以形成一条普通 message
- pending question 存在时应拒绝普通输入
