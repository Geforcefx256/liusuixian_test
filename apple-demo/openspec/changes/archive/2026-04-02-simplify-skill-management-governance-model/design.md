## Context

当前 managed skill 治理模型把 `displayDescription` 放在 skill 级，而把 `displayName` 放在 `agentBindings[].displayName` 上。这种拆法既让前端信息架构不自然，也让后端和运行时承担了“同一 skill 是否要对不同 agent 显示不同名字”的复杂度。用户已经明确确认：不需要继续保留每个 Agent 一个可见名称。

这意味着本次变更不只是 UI 重排，而是一次治理模型收敛：
- skill 级治理字段承载 `displayName`、`displayDescription`、surface、starter 相关元数据
- agent 绑定只表示启用范围
- governed runtime metadata 在不同 agent 上复用同一套治理名称与描述

这次变更会同时影响 `apps/web` 与 `apps/agent-backend`，并需要考虑已有 managed skill 数据如何迁移到新结构。

## Goals / Non-Goals

**Goals:**
- 将用户可见名称收敛为 managed skill 的统一治理字段，而不是 agent 绑定字段。
- 让 `Skill 管理` 页面形成清晰的三段式信息架构：基础信息、首页卡片治理、Agent 绑定范围。
- 简化 managed skill 持久化模型、admin API 和运行时 governed metadata 解析。
- 为现有数据提供可预期的迁移路径，避免导入记录失去已有治理名称。

**Non-Goals:**
- 不修改 canonical `SKILL.md` 包结构，也不把治理字段写回 canonical skill。
- 不引入“默认名称 + agent 覆盖名”的双层模型；本次直接去掉 agent 级名称。
- 不重做 starter 语义、surface 策略或运行时授权边界。

## Decisions

### Decision: `displayName` 升为 skill 级治理字段，agent binding 只保留范围

managed skill 记录使用单一 `displayName` 表达用户可见名称；`agentBindings` 只保留 `agentId` 等范围信息，不再存储 `displayName`。

Rationale:
- 这与产品语义一致：名称属于“这个 skill 是什么”，不是“给谁用”。
- 它能显著降低前后端模型复杂度，避免同一 skill 在多 agent 间做名称分叉。

Alternatives considered:
- 保留 agent 级名称并在 UI 中隐藏：会留下无意义的数据复杂度和潜在歧义。
- 改成“skill 默认名 + agent 覆盖名”：比当前更可控，但用户已明确不需要这层能力。

### Decision: 运行时 governed metadata 对所有已绑定 agent 复用同一治理名称与描述

当多个 agent 都绑定到同一 managed skill 时，governed product surfaces 和运行时 catalog 统一读取 skill 级 `displayName` 与 `displayDescription`。

Rationale:
- 避免运行时再做 agent 级名称分支解析。
- 与 UI 侧简化后的单一基础信息模型保持一致。

Alternatives considered:
- 仅在 UI 简化，运行时继续保留 agent 级名称解析：会让前后端模型失真，维护成本更高。

### Decision: 迁移现有数据时优先保留已有治理名称

对于已有 managed skill 记录，迁移时需要从现有 `agentBindings[].displayName` 中推导 skill 级 `displayName`。优先选择：
1. 若存在非默认、非空治理名，则采用该值；
2. 否则回退到现有 skill 级展示名；
3. 再否则回退 canonical 名称或 skillId。

Rationale:
- 管理员已经做过的治理输入应尽量保留。
- 迁移不应因为去掉 agent 级名称而把页面重置回默认导入值。

Alternatives considered:
- 强制管理员重新填写统一名称：实现简单，但会丢失已有治理劳动。

## Risks / Trade-offs

- [不同 agent 上原本存在不同治理名称时会丢失分叉信息] → 迁移时选取最合理的已有名称，并在 proposal 范围内明确这是有意的能力收缩。
- [admin API 变更会影响前后端联调与测试桩] → 在同一次变更中同步更新共享类型、API 客户端和测试 fixture。
- [旧数据迁移规则不清会导致名称回退异常] → 在实现前明确迁移优先级，并通过后端测试覆盖默认名、空值和多绑定场景。
- [UI 改版与模型改版同时进行会增加变更面] → 保持布局改动只服务于新信息架构，不额外掺入其它视觉重做。

## Migration Plan

1. 调整 managed skill 数据结构与 admin API contract，引入统一 `displayName` 字段并移除 `agentBindings[].displayName`。
2. 在后端 registry/持久化层加入旧记录迁移逻辑，确保已有治理名称能映射到 skill 级字段。
3. 更新前端类型、Skill 管理页结构与保存逻辑，把 `用户可见名称` 移入 `基础信息`。
4. 更新运行时 governed metadata 解析与相关测试，确保所有已绑定 agent 使用同一治理后名称。

## Open Questions

- None.
