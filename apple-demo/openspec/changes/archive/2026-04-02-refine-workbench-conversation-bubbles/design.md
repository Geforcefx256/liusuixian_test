## Context

当前 workbench 前端直接把持久化 `session messages` 映射成 `UiMessage[]` 并逐条渲染。这个模型对运行时是忠实的，但对阅读体验并不友好，因为一次用户请求里的多条过程型 assistant 文本会以多个并列气泡出现，尤其在 `local:grep` 等多步工具链路里会显得冗长。

同时，Question Tool 在回答后会把 continuation 文本以普通 `user` message 持久化到历史中。前端目前只会改写 legacy JSON question reply，不会处理 `[INTERACTION CONTEXT]` 文本，因此刷新后会把 `interaction_id`、`question_id` 和原始 answer JSON 直接展示给用户。

这次变更需要满足两个约束：

- 不修改后端持久化的原始 `message[]` 语义，也不改变 continuation replay 机制。
- 刷新后仍要恢复相同展示结果，不能依赖仅存在于内存中的临时 UI 状态。

## Goals / Non-Goals

**Goals:**

- 让一次用户请求中的 assistant 过程消息默认收敛为“主气泡 + 过程折叠”。
- 让 Question Tool 回答后的用户气泡展示为自然摘要，而不是内部 continuation 文本。
- 在刷新/重进会话后恢复相同展示。
- 将改动限制在 `apps/web` 前端展示层和其测试中，不引入新的第三方依赖。

**Non-Goals:**

- 不修改后端 `agentLoop`、`sessionStore`、interaction persistence 或 continuation message 格式。
- 不重新定义 LLM 历史里的 canonical message 顺序或条目数量。
- 不尝试给历史消息补充新的 `runId`/`turnId` 持久化字段。
- 不处理 pending question 卡片本身的提问表单逻辑，本次仅覆盖回答后的历史展示。

## Decisions

### 1. 保留原始 `UiMessage[]`，新增前端展示分组层

`sessionMessages` 和 `draftMessages` 继续保存原始消息序列，供运行时、重试、编辑、协议渲染等既有逻辑使用。对话区新增一层 display-oriented 派生结构，用于把连续 assistant 文本消息收敛成一个可渲染分组项。

分组规则采用“以原始顺序扫描消息流”的方式：

- `user` 消息、`protocol`/`result`/`error` 消息继续按原样展示。
- 连续的 `assistant + text + done` 消息组成一个候选段。
- 候选段只有 1 条消息时，不生成折叠结构，直接保留原样。
- 候选段有 2 条及以上消息时，最后一条作为主气泡，前面的消息作为 `collapsedSteps`。
- 正在 streaming 的 assistant 文本不参与折叠，直到该轮完成后再重算展示模型。

选择这个方案，是因为它不要求后端新增 `runId/turnId`，也不会破坏现有基于 `UiMessage` 的编辑与回放逻辑。替代方案是修改后端持久化模型，为消息打上显式 turn 元数据；这种方案语义更强，但会扩大范围到 runtime、store、历史迁移和协议层，不符合本次“纯前端展示收敛”的目标。

### 2. 折叠展示按启发式分组恢复，不引入新的持久化 UI 状态

刷新后的历史重放仍然只依赖已持久化消息序列。由于当前历史消息没有 turn 级别标识，前端采用启发式规则恢复折叠：

- 一个用户消息之后、下一个非 assistant-text 消息之前的连续 assistant 文本，视为同一组候选过程消息。
- 若该段之后又出现 assistant `protocol`/`result`/`error`，则不把该结构化消息并入折叠，而是继续独立展示。
- 过程折叠默认收起，但前端不要求刷新后保留用户手动展开状态。

这样可以保证刷新后一致性，同时避免为了保存“展开/收起”再引入新的后端状态。替代方案是只对流式运行中的消息做临时收敛，reload 后恢复原始多气泡；这种方案实现简单，但用户最在意的历史回放噪音不会消失，因此不采用。

### 3. Question 回答摘要依赖 resolved interactions，而不是只解析原始文本

前端在 `selectSession` 和 `reloadSessionState` 时，不再只请求 `pending` interactions，而是请求 `pending + answered + rejected`。store 内部维护：

- 当前待回答 interaction
- 已解决 interaction 索引（按 `interactionId` 与 `questionId` 组织）

随后把历史里的 `[INTERACTION CONTEXT]` continuation 文本解析为结构化记录，并结合 resolved interaction payload 生成用户可读摘要：

- `select` 字段优先显示 option `label`
- `text` 字段显示用户输入文本
- `notes` 显示补充说明文本
- `rejected` 状态显示显式拒绝文案，而不是内部上下文块

选择这个方案，是因为现有接口已经支持按状态查询 interactions，不需要新增后端协议，同时能稳定拿到字段定义和选项标签。替代方案是只从 continuation 文本中正则提取 `answer` JSON；这种方案在 value 与 label 不一致时会丢失可读性，也无法稳定处理 rejected 状态，因此不采用。

### 4. 复用现有 question 文本改写入口，扩展为统一的“历史用户回答摘要器”

当前前端已有 `rewriteQuestionResponseText`，但仅支持 legacy JSON question reply。此次改为统一入口：

- 识别 legacy JSON answer 文本
- 识别 `[INTERACTION CONTEXT]` continuation 文本
- 输出统一的用户摘要字符串
- 同时提供“该原始文本是否应该隐藏为内部文本”的判断

这样可以把摘要逻辑收敛到一个地方，避免在 store 映射、编辑态判断、组件渲染中各自复制解析逻辑。替代方案是在 `workbenchStore` 内单独处理 `[INTERACTION CONTEXT]`；这种方案能工作，但会让历史文本重写规则继续分散，不利于后续维护。

## Risks / Trade-offs

- [启发式分组没有真实 turn 边界] → 先把折叠范围限制为连续 `assistant` 纯文本消息，不跨越用户或结构化消息，降低误并组概率。
- [加载 answered/rejected interactions 会增加一次会话切换 payload] → 复用现有 interactions 接口，一次请求拉取三个状态，避免新增额外 round trip。
- [历史 continuation 文本与 interaction 列表可能短暂不同步] → 摘要生成优先依赖已返回的 resolved interaction；若无法匹配则保留显式错误信号或原始文本，不引入静默伪造摘要。
- [折叠后的 DOM 结构变化可能影响现有消息测试] → 在 store 与 ConversationPane 增加覆盖 reload、streaming、单条消息、Question answer summary 的单元测试，确保渲染与交互稳定。

## Migration Plan

该变更仅涉及前端展示层，无数据迁移与后端发布前置条件。

实施顺序：

1. 扩展 session load/reload 逻辑，加载 resolved interactions 并建立摘要索引。
2. 在历史消息映射层增加 Question continuation 摘要改写。
3. 在对话展示层增加 assistant 分组模型与折叠 UI。
4. 更新相关 store/component 测试，验证刷新恢复与流式完成后的收敛行为。

如果需要回滚，只需移除新的 display grouping 与 question summary rewrite，恢复逐条消息渲染即可；后端数据和会话历史不会受到影响。

## Open Questions

- 折叠区默认文案是否统一为“查看过程”，还是根据步骤数展示“查看过程（3）”。
- resolved question summary 是否需要在同一摘要里保留原问题 prompt，还是仅展示答案内容。
