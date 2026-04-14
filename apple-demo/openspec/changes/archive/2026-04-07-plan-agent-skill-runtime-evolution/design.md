## Context

当前 `agent-backend` skill 演进讨论已经积累出多套候选 change 名称，但这些候选项来自不同拆分逻辑：

- 有的按主执行链拆，如 metadata / listing / compaction / runtime
- 有的按风险级别拆，如低风险边界项与高风险 runtime override
- 有的按具体主题拆，如 `when_to_use`、`paths`、`allowed-tools`

这导致三个实际问题：

1. 多个候选 change 在修改同一条运行链，后续很容易重复立项。
2. 依赖关系没有持久化，后续每次讨论都要重新决定“先做什么”。
3. 在借鉴 `claude-code` 时，容易把现有 `skill:exec` 受治理执行链误伤成纯 prompt 化方案。

本 change 不直接修改运行时行为。它最初的职责是把本轮 skill 系统演进固化成一份可持续引用的 change map，让后续 proposal 只展开一个子 change，而不是继续同时维护多套候选列表。

当前仓库状态已经进入收尾阶段：

- `skill-metadata-foundation` 已完成并归档
- `skill-discovery-and-listing` 已完成并归档
- `skill-state-retention` 已完成并归档
- `skill-invocation-policy` 明确暂不推进
- `skill-runtime-overrides-and-forking` 明确暂不推进

因此这次刷新不是为了扩展 change map，而是为了把这份 umbrella artifact 改写成一份与实际结果一致的 closure record，便于后续归档。

## Goals / Non-Goals

**Goals:**
- 把这份 planning change 刷新为与当前仓库状态一致的序列收尾记录。
- 明确前三个 follow-on changes 已完成，后两个 runtime 方向 change 已明确暂缓。
- 保留对 deferred items 与 `skill:exec` 非退化约束的记录。
- 让本 change 在文档层面达到可归档状态，而不是继续保留过期的 pending tasks。

**Non-Goals:**
- 不恢复或推进 `skill-invocation-policy` 与 `skill-runtime-overrides-and-forking`。
- 不在本 change 中实现任何新的 runtime 行为变更。
- 不在本 change 中直接引入新的 provider abstraction、remote skills 或 source layering。
- 不改动 monorepo 顶层目录结构。

## Decisions

### Decision: 将本 umbrella change 刷新为“已落地三项、暂缓两项”的收尾记录

这份 umbrella planning change 已完成它作为总图入口的职责。现在的正确状态不再是“继续推动剩余 follow-on changes”，而是记录：

- 哪些 follow-on changes 已经真实落地
- 哪些 follow-on changes 已被明确决定暂不推进
- 哪些全局约束在已落地序列中仍然成立

Rationale:
- 当前文档和仓库状态已经不一致；继续保留全 pending 的 tasks 只会制造噪音。
- 这份 planning change 的剩余价值在于留下正确的阶段性记录，而不是假装还有待推进的实现工作。

Alternatives considered:
- 保留原文档不动，直接带着过期 tasks 归档。

Why not:
- 会让归档记录失真，后续回看时无法分辨“未做”与“明确暂缓”。

### Decision: 将原始 5 项 follow-on map 刷新为一个“3 完成 + 2 暂缓”的结果表

原始 change map 中的 5 个 follow-on changes 仍保留为历史规划基线，但当前实际结果应表述为：

| Change | 状态 | 说明 |
| --- | --- | --- |
| `skill-metadata-foundation` | completed | 已作为第一个 follow-on change 落地并归档 |
| `skill-discovery-and-listing` | completed | 已独立落地并归档 |
| `skill-state-retention` | completed | 已独立落地并归档 |
| `skill-invocation-policy` | deferred | 当前明确暂不推进，不属于本轮收尾范围内的待实施项 |
| `skill-runtime-overrides-and-forking` | deferred | 与 invocation policy 一并暂缓，不再作为当前序列的后续动作 |

Rationale:
- 这样仍保留了原始分期逻辑，但不会误导读者以为后两项还在当前路线图内等待执行。

Alternatives considered:
- 把后两项直接从文档里删除。

Why not:
- 会丢失这次规划讨论的真实历史上下文。

### Decision: 原依赖图保留为历史规划依据，但不再驱动当前序列继续向后展开

原始依赖图如下：

```text
skill-metadata-foundation
├──> skill-discovery-and-listing
├──> skill-state-retention
└──> skill-invocation-policy
      └──> skill-runtime-overrides-and-forking
```

其中：

- `skill-metadata-foundation` 是前置地基 change。
- `skill-runtime-overrides-and-forking` 只能在 `skill-invocation-policy` 之后展开。
- `provider-abstraction` 仅在前 5 个 change 明确把 `ProviderClient` 卡住时才单独立项。

Rationale:
- 该依赖图对已经完成的前三项仍然成立，因此应继续作为历史记录保留。
- 但既然后两项已经明确暂缓，当前不再需要把这个依赖图解释为“后续还要继续实施”的承诺。

Alternatives considered:
- 删除这张依赖图。

Why not:
- 会损失这轮分期为何如此拆分的关键上下文。

### Decision: 将两个议题明确后置，不进入第一批

以下议题明确后置，不进入第一批：

- `skill-source-layering-and-dedup`
- `provider-abstraction`

Rationale:
- 当前仓库还没有足够多的真实 skill source，过早做 layering/dedup 容易过度设计。
- `provider-abstraction` 是架构改造，不是本轮 skill 语义演进的最短关键路径。

Alternatives considered:
- 把 `provider-abstraction` 提前，作为 skill runtime 演进前置工作。

Why not:
- 会把第一批 change 从“skill 语义清理”拖成“LLM 架构重构”。

### Decision: `skill:exec` 作为全序列约束，而不是独立 planning change

`skill:exec` 不单独作为一个 planning change。它在本轮中被定义为全局非回退约束：

- 后续所有 follow-on changes 都必须保留受治理的 script template 执行路径。
- 不允许借鉴 `claude-code` 时把该能力退化成纯 prompt-only fallback。
- 如果将来要增强 discoverability、参数契约展示或 artifact 回传，再单独开一个小范围实现 change。

Rationale:
- `skill:exec` 是当前 `agent-backend` 相比 `claude-code` 的重要后端优势。
- 它更适合作为整体约束，而不是和前 5 个 change 并列争抢排序。

Alternatives considered:
- 把 `preserve-and-strengthen-governed-skill-exec` 作为第 6 个正式 follow-on change。

Why not:
- 目前它更像验收约束，不像一条独立主链。

### Decision: 已落地的 `skill-metadata-foundation` 边界审查结论继续保留

第一个 follow-on change `skill-metadata-foundation` 已按以下边界完成落地：

**包含：**
- frontmatter schema 扩展
- 默认语义
- 校验规则
- catalog entry 数据模型
- runtime 所需元数据透传，但仅限数据可用，不改变行为

**不包含：**
- `allowed-tools` 真正进入工具权限链
- `model` / `effort` 真正进入模型调用链
- `context:fork` 运行行为
- skill listing 预算和条件激活
- invoked skills 保留与 compact 注入
- provider abstraction

Rationale:
- 这能确保第一个 change 只解决“skill 能表达什么”，不提前混入行为改造。

Alternatives considered:
- 在 foundation 阶段顺手让部分字段直接生效。

Why not:
- 会让第一个 change 同时改 schema、runtime policy 和上下文链路，验证面过大。

### Decision: 若未来重新讨论 runtime policy 或 runtime override，必须作为新一轮独立 change 重新立项

本次序列在 `skill-state-retention` 后即视为收尾。若将来重新讨论：

- `skill-invocation-policy`
- `skill-runtime-overrides-and-forking`

则应作为新的独立 change 重新提案，而不是恢复这份 umbrella planning change 的执行状态。

Rationale:
- 当前已经明确这两项暂不推进，再保留“稍后继续做”的语义只会让归档记录不清晰。
- 未来若重开讨论，背景、约束和参考实现都可能已经变化，重新立项比复活旧计划更准确。

## Risks / Trade-offs

- [Risk] 归档后，后续读者可能误以为 runtime policy / runtime override 已经被否定，而不是暂缓  
  → Mitigation：在刷新后的文档中明确写成 deferred，而不是 removed 或 rejected。

- [Risk] 不再推进后两项会让某些 metadata 字段继续停留在 passthrough-only 状态  
  → Mitigation：把这一点作为当前序列的明确收尾结论保留，而不是让文档继续暗示“即将生效”。

- [Risk] `provider-abstraction` 被后续实现阶段过早拉进第一批  
  → Mitigation：把它明确标记为后置项，除非前 5 个 change 的实现证明确实被 `ProviderClient` 阻塞。

- [Risk] 借鉴 `claude-code` 的过程中削弱 `skill:exec`  
  → Mitigation：把 `skill:exec` 非退化约束写入整体规划，并要求后续每个子 change 都显式说明如何与其兼容。

## Migration Plan

1. 刷新本 umbrella planning change 的 `proposal/design/tasks`，使其与当前仓库状态一致。
2. 记录前三个 follow-on changes 已完成并归档。
3. 记录 `skill-invocation-policy` 与 `skill-runtime-overrides-and-forking` 当前明确暂缓。
4. 保留 `skill:exec`、`provider-abstraction`、`skill-source-layering-and-dedup` 的约束/后置结论，作为历史上下文。
5. 在文档完成同步后，将该 planning change 视为 archive-ready。

Rollback strategy:
- 如果后续决定重新打开 runtime policy / runtime override 讨论，应新建 change，而不是回滚这份 refreshed planning record。

## Open Questions

- 当前没有必须阻塞本 umbrella planning change 的开放问题。后续开放问题应下沉到各自的 follow-on change，而不是重新回到总图层重写分期。
