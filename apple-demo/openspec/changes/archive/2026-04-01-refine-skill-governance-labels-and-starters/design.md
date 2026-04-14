## Context

当前技能治理与工作台入口之间已经有一条明确的数据链路：后端 managed skill registry 产出治理后的 `displayName` / `displayDescription` / `surface` / `starter*` 元数据，前端工作台基于 active agent detail 计算 `visibleSkills`、`starterGroups` 和 `searchableSkills`。问题不在于缺少治理数据，而在于两个前端入口消费这份数据的方式不一致。

Skill 管理页仍使用“展示面 / 生产面 / 实验面”的旧术语；空会话工作台的“常用起点”只展示分组标题和副标题，没有把治理后的技能名称外显出来；而“更多搜索 / 热门技能”与首页代表 starter 又直接展示技能名。与此同时，管理员在 Skill 管理页保存治理名称后，当前工作台并不会主动刷新 active agent detail，导致治理后的名称不会立刻反映到聊天页和首页。

这次变更横跨治理页面、工作台空会话 UI 和 workbench store 的状态同步，因此需要先明确产品语义和刷新边界，再进入实现。

## Goals / Non-Goals

**Goals:**
- 统一 Skill 管理页的用户可见术语，让“展示 / 生产 / 测试”成为一致的治理表达。
- 让空会话工作台中的“常用起点”在保留分组入口模型的前提下，展示治理后的技能名称预览。
- 保持“常用起点”整卡单一点击行为，不把卡片变成多按钮列表。
- 让 Skill 管理页保存后的治理名称能及时反映到聊天页、热门技能和首页 starter 展示。

**Non-Goals:**
- 不改变 managed skill registry、agent binding 或 runtime skill approval 的授权语义。
- 不引入新的分组模型，也不把“常用起点”改成完整技能列表页。
- 不新增第三方依赖，不调整顶层目录结构。

## Decisions

### 1. 保留现有 starter 分组模型，只增强卡片内的信息密度

“常用起点”仍然保留四个固定 task-group 卡片，卡片主动作继续由当前分组的代表 starter skill 决定。这样可以维持现有的低认知成本和整卡点击体验，避免因为把 2-3 个技能名做成可点击子项而引入二级交互冲突。

备选方案：
- 让每个预览 skill 名称可单独点击。未采用，因为这会让一张卡同时承担“分组入口”和“技能列表”两种交互，复杂度明显上升。
- 直接把“常用起点”改成技能 chips。未采用，因为这会削弱分组语义，和“更多搜索 / 热门技能”重复。

### 2. 用治理后的 displayName 作为所有用户可见技能名称的单一真值

对终端用户可见的 starter 卡片、热门技能、搜索结果和首页 starter，统一使用 managed skill governance 产出的 `displayName`。前端不再为这些入口单独定义回退命名规则；如果某个入口显示到 `skillId`，应视为链路缺陷而不是可接受的显示策略。

备选方案：
- 对部分入口继续显示 canonical name 或 skill id。未采用，因为这会破坏管理员在治理页面中“所改即所得”的预期。

### 3. 在保存治理信息后刷新 active agent detail，而不是局部猜测多个消费者状态

Skill 管理页保存成功后，前端应刷新当前 active agent 的 detail / bootstrap 相关元数据，使 workbench store 重新计算 `visibleSkills`、`starterGroups` 和 `searchableSkills`。这样比在管理页本地列表、聊天页空态和首页之间做多处手工 patch 更可靠，也更接近后端作为治理真值源的现有架构。

备选方案：
- 仅在 AdminSkillManagement 组件本地 patch 管理列表。未采用，因为它无法覆盖聊天页和首页使用的 workbench store 状态。
- 通过事件总线逐个同步各组件局部状态。未采用，因为当前已经有集中式 workbench store，增加事件分发只会让同步路径更脆弱。

### 4. 预览名称数量采用响应式规则，而不是按字数计算

starter 卡片中技能名称预览的数量使用布局驱动的响应式规则，例如移动端 2 个、桌面端 3 个，并对每一项使用单行截断。按字数动态切换数量在中英文混排和不同 viewport 下不稳定，容易产生不可预测的折行。

备选方案：
- 根据字符串长度动态显示 2 或 3 项。未采用，因为字符数不能可靠代表真实占宽。

## Risks / Trade-offs

- [Risk] 保存治理信息后刷新 active agent detail 可能导致当前空会话 UI 短暂闪动。 → Mitigation: 复用现有 agent detail 拉取链路，只刷新必要的 governed metadata，并保持当前选中 agent 不变。
- [Risk] starter 卡片增加名称预览后，在窄屏下可能挤压分组文案空间。 → Mitigation: 使用固定响应式数量和单行截断，避免高度失控。
- [Risk] 术语从“实验”改成“测试”后，现有断言和快照测试会集中失败。 → Mitigation: 在同一变更内统一更新管理页、工作台和测试用例中的用户可见文案断言。

## Migration Plan

1. 先更新 spec 和前端展示语义，明确“展示 / 生产 / 测试”与 starter 预览的行为合同。
2. 再实现管理页保存后的 workbench store 刷新链路，确保治理名称变更能反映到 active agent 相关入口。
3. 最后更新空会话 starter 卡片与相关测试，验证首页、聊天页和热门技能使用同一套治理名称。

## Open Questions

- None at proposal time.
