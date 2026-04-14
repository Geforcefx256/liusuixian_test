## Context

当前 managed skill registry 以 `skillId` 为主键保存一条全局记录，并在记录上直接存放 `displayName`、`displayDescription`、`surface` 和 `agentBindings`。这个结构可以表达“一个 skill 绑到哪些 Agent”，但不能表达“同一个 canonical skill 在不同 Agent 下展示不同的用户可见名称”。

与此同时，前台用户可见的技能名称来源并不统一。搜索和 starter 可以读取 governed metadata，但运行中 `tool.started`、完成态 summary、以及由 `skillTriggered` 驱动的 header 仍可能回落为 raw canonical name 或 `skillId`。这会让终端用户看到内部实现标识，违背治理层应当拥有最终展示控制权的产品目标。

本次变更还必须保留现有 `生产 / 测试` 语义：`测试` 态的 Skill 继续留在治理后台中可见和可编辑，但不进入正常工作台前台和运行时。

## Goals / Non-Goals

**Goals:**
- 让 `用户可见名称` 成为所有“技能名称槽位”的唯一用户态来源。
- 支持同一个 canonical skill 在不同 Agent 绑定下配置不同的用户可见名称。
- 保持现有 `生产 / 测试` 轨道不变，并将“未完成治理”与 `测试` 态绑定。
- 确保运行时事件和前台 header 不再向终端用户暴露 `skillId` 或 canonical skill name。

**Non-Goals:**
- 不把 `displayDescription` 一并改造成 Agent 维度治理。
- 不引入按 Agent 维度独立发布 `生产 / 测试` 的新状态模型。
- 不改变 canonical `SKILL.md`、skill catalog、或 raw canonical skill identity 的解析方式。
- 不移除用户态 header 中的 `Skill:` 机制词。

## Decisions

### 1. 用户可见名称改为“按绑定治理”，但状态仍保持 skill 级别

采用“skill 记录 + binding 级显示覆盖”的模型，而不是把每个 `skillId + agentId` 拆成独立 managed record。

建议形态：
- managed skill 继续以 canonical `skillId` 为主记录。
- `agentBindings` 从纯字符串数组提升为包含治理字段的绑定项集合。
- 每个绑定项至少包含 `agentId` 和 `displayName`。

这样可以满足“同 skill 在不同 Agent 下展示不同名称”，同时保留现有 managed registry 的主记录、导入、排序、surface、starter 等治理框架。

备选方案：
- 把 managed skill 完全拆成 `skillId + agentId` 二维记录。
  - 放弃原因：会放大导入、查询、排序、surface 迁移和现有 API 兼容成本。

### 2. `生产 / 测试` 继续保持全局 surface，但生产门槛按所有已绑定 Agent 校验

`surface` 继续保留在 managed skill 主记录上，不改成 per-agent 发布模型。一个 skill 只维护一条 `production` 或 `experimental` 状态。

当管理员尝试把 skill 切到 `生产` 时，后端必须验证：
- 至少存在一个绑定 Agent。
- 每个绑定 Agent 都已配置非空用户可见名称。
- 每个绑定 Agent 的用户可见名称都不等于默认导入值（`skillId` / canonical name）。
- 每个绑定 Agent 的用户可见名称在该 Agent 作用域内唯一。

只要任一绑定未完成治理，该 skill 就必须停留在 `测试` 态。

备选方案：
- surface 也改成 per-agent 维度。
  - 放弃原因：会把当前“测试态即后台治理态”的简单模型扩展成完整灰度发布系统，超出本次范围。

### 3. 用户可见名称的唯一性在 Agent 作用域内校验

唯一性约束定义为：
- 同一 Agent 下，两个不同 canonical skill 不能共享同一用户可见名称。
- 不同 Agent 之间可以为同一 canonical skill 或不同 skill 使用不同名称。

这样与“名称按 Agent 维度不同”的产品要求一致，也避免把不同 Agent 的业务语境强行绑成全局统一命名。

### 4. 运行时用户可见名称解析由后端负责，前端只消费 governed 值

发现类界面继续通过 agent detail / bootstrap 里的 governed skill metadata 获取名称。

执行类界面改为优先消费后端已解析好的 governed 名称：
- `tool.started` 对于 skill 调用时输出当前 Agent 作用域下的用户可见名称。
- completed run summary 不再依赖原始 `skillTriggered` 直接展示给用户；运行结果需要携带可直接用于 header 的 governed skill display name，或提供足够的 runtime metadata 让前端无需回落到 raw id。

这保证“用户可见名称”在运行时和发现面一致，并减少前端自行拼装名字时的回落风险。

备选方案：
- 前端根据 `skillTriggered` 再去 activeAgent.skills 本地查映射。
  - 放弃原因：这会让运行时展示依赖前端当前缓存是否及时刷新，也不利于统一约束“绝不向用户暴露 raw id”。

### 5. 技能治理 UI 改为围绕绑定项编辑名称

当前管理页只有一个全局 `用户可见名称` 输入框，这与 Agent 维度治理不匹配。治理 UI 需要改为：
- 在每个已绑定 Agent 上显示对应的用户可见名称输入。
- 在列表和详情头部显示“当前选中 Agent 语境下的治理名称”，或明确提示这是 canonical skill 记录的摘要视图。
- 对未完成治理和名称冲突给出显式校验反馈。

`用户可见描述` 继续保留现有单值编辑方式，避免一次性扩大治理矩阵。

## Risks / Trade-offs

- [Risk] Agent 绑定结构从字符串数组升级后，现有 API 和落盘数据需要迁移
  → Mitigation：提供向后兼容读取逻辑，将旧 `agentBindings: string[]` 在加载时提升为绑定记录，并把初始用户可见名称填入默认导入值。

- [Risk] 全局 surface 与 Agent 维度名称并存，管理员可能误以为可以单独发布某个 Agent
  → Mitigation：在治理 UI 中明确说明 `生产 / 测试` 仍是 skill 级状态，任一绑定未完成治理都不能进入生产。

- [Risk] 旧数据中的默认名称普遍等于 `skillId`，会导致大量 skill 被判定为未完成治理
  → Mitigation：只在“切到生产”时严格阻止；后台列表仍可见并允许逐步补全治理。

- [Risk] 运行时仍保留 canonical skill identity 供模型调用，可能再次误传到用户面
  → Mitigation：把“canonical identity 仅供内部解析，用户面一律消费 governed name”写入 runtime 和 workbench requirement，并补测试覆盖 `tool.started`、summary header、搜索、starter。

## Migration Plan

1. 扩展 managed skill 持久化模型，支持 binding 级 `displayName`。
2. 在 registry 加载阶段把旧 `agentBindings: string[]` 自动提升为新结构。
3. 保持 canonical skill 解析、批准边界、`测试` 态过滤逻辑不变。
4. 更新 admin skill API 和治理 UI，支持按 Agent 编辑用户可见名称与冲突校验。
5. 更新 runtime metadata、tool.started 事件与 completed summary naming 输入，确保执行态不暴露 raw id。
6. 更新 workbench，统一消费 governed name。

## Open Questions

None.
