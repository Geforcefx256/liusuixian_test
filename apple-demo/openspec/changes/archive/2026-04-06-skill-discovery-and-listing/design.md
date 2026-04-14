## Context

当前 skill 运行链里有两个重复暴露 catalog 的位置：

- `buildSkillsInstruction()` 会在 executor 的模型上下文里注入全部 `availableSkills`
- `buildSkillToolDescription()` 会在 `skill` tool 描述里再次内联全部 skill 列表

这会带来三个问题：

1. 模型在真正调用 `skill:skill` 前就反复看到相同 catalog，prompt 重复明显。
2. listing 与完整 `SKILL.md` 没有清晰分层，模型不容易形成“先看摘要，再按需加载正文”的使用路径。
3. 当前没有单独的预算与 observability 边界，某些 skill 元数据一旦变长，就可能直接吞掉整体上下文，而且 trimming 行为缺少显式日志。

另一方面，参考 `claude-code` 后可以看出更稳定的分层是：

- listing reminder 只负责告诉模型有哪些 skill 可用
- `skill:skill` 负责加载完整 `SKILL.md`

但本仓库又和 `claude-code` 不同：这里已经有受治理的 skill 授权边界和既有 `skill:exec` 语义，因此不能把这次 change 做成“另起一个新 skill tool”或“顺手引入 discovery 排序”。本次只收敛 build/executor 的 listing contract，并明确 discovery 仍然 disabled。

## Goals / Non-Goals

**Goals:**
- 只在 build/executor 路径注入一个独立的 conversation reminder，而不是继续把 catalog 塞进 `skill` tool 描述或顶层 system prompt。
- 把 listing reminder 的摘要字段固定为 `name`、`description`、`whenToUse`，用于帮助模型决定“要不要加载 skill”。
- 保留现有 `skill:skill`，继续让完整 `SKILL.md` 通过显式 tool 调用按需加载。
- 给 listing 注入建立明确的预算策略，并对构建、裁剪、跳过、注入过程补充结构化日志。
- 为未来 discovery 留一个显式 scaffold，但在本次 change 中保持 disabled，避免虚假的相关性筛选。

**Non-Goals:**
- 不实现真实的 discovery、候选池排序或相关性召回。
- 不修改 planner 路径，本次只覆盖 build/executor。
- 不引入新的 skill tool，也不替换现有 `skill:skill` / `skill:exec`。
- 不处理 skill state retention、invocation policy、runtime override、provider abstraction 等后续 change。
- 不改动 managed skill governance、skill-management UI 或 monorepo 顶层目录结构。

## Decisions

### 1. 用 executor 会话 reminder 注入 `listing reminder`，而不是增加新工具

本次的 `listing reminder` 是一次 model-facing conversation reminder injection，不是新 tool。它会在 build/executor 发起模型调用前，基于当前请求的 `availableSkills` 生成一段独立提示，告诉模型当前有哪些已授权 skill 可用，以及每个 skill 的最小摘要。

这样做的原因是：

- 它的职责是“帮助模型决定要不要调用 `skill` tool”，而不是“加载 skill 内容”。
- 如果做成新 tool，模型还要先学会调用另一个 discovery tool，反而把原本的分层复杂化。
- 现有 runtime 已经在 build/executor request 上收敛出 `availableSkills`，可以直接复用授权结果，不必再新增一层权限链。
- reminder 不属于 agent identity / instructions，本身不应该和顶层 system prompt 混在一起；把它作为消息级 reminder 更接近 `claude-code` 的分层语义。

备选方案：

- 把 listing 做成新 skill discovery tool：会增加工具面复杂度，也会和现有 `skill:skill` 形成职责重叠。
- 继续把 catalog 内联在 `skill` tool 描述里：重复 prompt 问题依旧存在，也不利于 budget 与 observability 独立治理。
- 把 reminder 继续拼进顶层 system prompt：虽然实现简单，但会继续混淆“agent 固定身份指令”和“本次运行时可用 skill 列表”的边界。

### 2. listing 摘要只保留 `name`、`description`、`whenToUse`

listing reminder 的目标是帮助模型决定“这个 skill 值不值得加载全文”，因此只保留：

- `name`
- `description`
- `whenToUse`

不在 listing 中放入：

- `sourcePath`
- `inputExample`
- `outputExample`
- `allowedTools`
- 完整 `SKILL.md` 正文

这样可以把 listing 与正文分层钉死：listing 是决策摘要，`skill:skill` 才是完整加载路径。

备选方案：

- 同时放更多 frontmatter 字段：会让 listing 很快膨胀，且其中大部分字段只有在真正决定加载 skill 后才有价值。
- 继续展示 `sourcePath`：对模型决策价值很低，反而浪费预算。

### 3. discovery 在本次 change 中显式 disabled，不做伪实现

本次会保留一个显式的 discovery mode 概念，但唯一合法状态是 `disabled`。也就是说：

- listing 的输入直接来自 build/executor request 已有的 `availableSkills`
- 不额外做全文字符串撞运气式匹配
- 不声称“只展示最相关的 skills”
- 如果有 skill 没进最终 listing，只能是因为显式 budget 裁剪，而不是隐藏 discovery 逻辑

这样做是为了给后续真实 discovery 留接口位置，但不把当前讨论伪装成已经具备 relevance selection。

备选方案：

- 顺手加一个简单关键词匹配 discovery：这会制造“已经做了 discovery”的错觉，而且误召回/漏召回边界不清。
- 完全不保留 discovery mode 概念：后续真实实现时又要重新改 builder contract 与日志语义。

### 4. 采用静态字符预算，先做 deterministic trimming

第一版 listing budget 使用静态字符预算，而不是 token 预算或动态 provider 预算。预算策略分两层：

- 总 budget：限制整段 listing reminder 的最大字符数
- 单条 budget：限制单个 skill 摘要最多占用的字符数，防止某一个 `description` 或 `whenToUse` 吞掉整体空间

trimming 原则：

- 永远保留 skill `name`
- 优先裁剪较长的 `whenToUse` / `description`
- 如果总 budget 不足以继续追加条目，则跳过后续条目
- 所有 trim / skip 都必须留下结构化日志

这里选择字符预算，是因为第一版目标是先建立稳定、可解释、可测试的边界；相比 token 估算，字符预算更简单、确定性更强，也更容易和日志字段对齐。

备选方案：

- 直接做 tokenizer-aware token budgeting：更精确，但会把第一版实现和 provider/tokenizer 细节强耦合，扩大范围。
- 只做总 budget，不做单条 budget：仍然可能出现一个 skill 摘要吃掉大部分 listing 的问题。

### 5. `skill` tool 描述改为静态说明，catalog 只出现在 reminder

`buildSkillToolDescription()` 会被收敛成静态使用说明，只保留：

- 如何按 name/id 加载 skill
- `local:*` 与 `skill:*` asset tools 的边界
- `SKILL.md` 必须通过 `skill` tool 加载

它不再内联当前 skill catalog。这样同一个 turn 中“有哪些 skill 可用”只在 listing reminder 出现一次，`skill` tool 描述则专注于使用规则。

备选方案：

- 同时保留 reminder 和 tool description catalog：实现简单，但重复问题完全没有解决。

### 6. 把 listing budgeting 做成显式 observability contract

这次 change 会把日志作为一等产物，而不是附带实现细节。最少需要覆盖三类事件：

- `skill_listing_built`
- `skill_listing_entry_trimmed`
- `skill_listing_injected`

可选补充：

- `skill_listing_skipped`
- `skill_tool_invoked_with_listing_context` 或等价诊断字段

建议日志字段包括：

- `agentId`
- `discoveryMode`
- `sourceSkillCount`
- `includedSkillCount`
- `trimmedSkillCount`
- `budgetChars`
- `totalCharsBeforeBudget`
- `totalCharsAfterBudget`
- `skillId`
- `skillName`
- `trimMode`
- `beforeChars`
- `afterChars`
- `listingChars`
- `injectionSurface`

这些日志的目标不是替代业务逻辑，而是让后续调试可以明确回答：

- listing 是不是作为 reminder 注入了
- 注入前原始 skill 数量是多少
- 哪些 skill 被裁剪或跳过
- discovery 当前是不是 disabled
- 注入目标是不是 conversation message，而不是 system prompt

其中 `discoveryMode` 更适合作为内部诊断字段保留在 build result / 结构化日志里，而不是继续作为面向模型的 reminder 文本行暴露。对模型而言，真正需要理解的是“这是一组当前可用的技能摘要，完整内容仍需显式加载”，而不是实现字段名本身。

备选方案：

- 只打一条粗粒度 debug 日志：难以定位是哪条 skill 吃掉预算，也不符合用户要求的显式日志暴露。

## Risks / Trade-offs

- [Risk] 不做 discovery 会导致 build/executor 在 skill 很多时只能依赖顺序和 budget，而不是相关性优先  
  → Mitigation：在设计与日志中保留 `discoveryMode: disabled` 诊断语义，并把真实 discovery 留到后续独立 change。

- [Risk] 字符预算不如 token 预算精确  
  → Mitigation：第一版优先要 deterministic、易测和易解释；后续若确有 provider/tokenizer 压力，再单独升级预算策略。

- [Risk] 去掉 `skill` tool 描述里的 catalog 后，模型可能过度依赖 reminder  
  → Mitigation：在 reminder 中明确提示“完整 skill 内容需通过 `skill` tool 加载”，并保留静态 tool guidance。

- [Risk] budget skip 会让部分 skill 在当前 turn 没有出现在 listing  
  → Mitigation：将 skip 明确归因到 budget，并通过结构化日志暴露，而不是伪装成 discovery 已筛掉这些 skill。

## Migration Plan

1. 先新增独立的 listing builder，输入为 build/executor request 的 `availableSkills`，输出为 reminder 文本与 budget 诊断信息。
2. 在 build/executor 的模型调用链中以 conversation reminder message 的形式注入该 reminder，并同步记录 `built` / `trimmed` / `injected` 日志。
3. 收敛 `skill` tool 描述为静态说明，移除当前内联 catalog。
4. 增加测试，覆盖 summary 字段范围、budget trimming、静态 tool 描述，以及 discovery disabled 仅保留在内部诊断而不作为 reminder 文本暴露的语义。

Rollback strategy:

- 如需回滚，只需要移除 listing builder reminder 注入并恢复原有 `skill` tool 描述；本 change 不涉及数据迁移或持久化状态变更。

## Open Questions

- None for this proposal phase.
