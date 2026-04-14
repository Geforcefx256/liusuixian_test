## Context

`Skill 管理` 视图复用了受 `100dvh` 约束的 workbench shell。当前 shell 与 admin body 都采用 `overflow: hidden` 来维持整页无全局滚动条的布局，但 `AdminSkillManagement` 只给左侧列表分配了滚动出口，没有给右侧治理详情体分配滚动容器，也没有把最小高度收缩链完整传递到详情内容层。结果是详情内容一旦超过可用高度，就会被父层直接裁切，尤其在 `首页卡片治理` 区块出现时最明显。

这次变更只覆盖前端布局与样式，不修改 managed-skill 数据模型、保存接口和数据库存储。目标是在保留现有 workbench shell 视口约束的前提下，让管理页内部面板承担各自的滚动与响应式职责。

## Goals / Non-Goals

**Goals:**
- 让 `Skill 管理 -> 治理详情` 在视口受限时仍能完整访问所有治理控件和预览内容。
- 为列表区和详情区定义稳定、可预期的滚动职责，避免内容被外层 `overflow: hidden` 直接裁切。
- 让 `Starter 摘要与预览` 区块在常见桌面宽度和窄屏宽度下都不会横向溢出。
- 为这个布局契约补充前端测试，防止后续样式回归。

**Non-Goals:**
- 不修改 managed skill 的保存字段、接口契约或任何数据库结构。
- 不重做 `Skill 管理` 页面的视觉样式、信息架构或表单字段。
- 不把 admin 视图改造成独立路由页，也不放开整个 workbench shell 的全局页面滚动。

## Decisions

### Decision: 保持 shell 级无全局滚动，改由 admin pane 自己滚动

`WorkbenchShell` 继续维持视口约束和外层 `overflow: hidden`，`AdminSkillManagement` 内部负责把滚动出口放到列表区和详情区内容层，而不是让整个页面恢复浏览器级纵向滚动。

Rationale:
- 这与现有 workbench 的 pane-owned scrolling 模式一致，不会让 admin 视图成为壳层中的例外。
- 仅修复管理页内部滚动职责，影响面最小，不会波及工作台、会话区和侧栏的滚动行为。

Alternatives considered:
- 让 `workbench-shell__admin-body` 开启全局纵向滚动：实现简单，但会打破壳层统一的视口模型，也更容易引入 header 下整页抖动。
- 只给最外层 `.admin-skills` 开滚动：虽然能看到更多内容，但列表和详情会失去独立面板语义，长列表与长详情会相互干扰。

### Decision: 明确打通 admin 详情区的最小高度链与滚动容器

`AdminSkillManagement` 需要把 `min-height: 0` 传递到 layout、detail pane 和 detail body，并把详情体设为唯一的纵向滚动出口；左侧列表保持自己的滚动容器。

Rationale:
- 当前问题本质是 CSS 收缩链断裂和滚动容器缺失，不是数据量异常。
- 把滚动落在 detail body 能确保头部、元信息和表单区块在一个清晰的容器内连续滚动，行为与用户管理抽屉的成熟模式一致。

Alternatives considered:
- 给 `.admin-skills__detail` 本身开滚动：可行，但更容易把外层卡片 padding 与阴影裁切逻辑混在一起，测试锚点也不如 detail body 明确。
- 继续依赖浏览器默认滚动：在当前壳层 `overflow: hidden` 前提下无效，不能从根因解决问题。

### Decision: 对 starter 治理区采用响应式栅格回落，而不是允许横向溢出

`Starter 摘要与预览` 的控制区继续使用多列布局，但在空间不足时必须回落为单列或更保守的列宽，而不是让表单和预览撑出视口。

Rationale:
- 当前用户感知最强的问题之一就是页面右侧被“截断”，其本质既包括纵向不可滚动，也包括局部横向栅格过紧。
- 用响应式回落比强制横向滚动更符合表单治理场景，阅读和编辑成本更低。

Alternatives considered:
- 增加横向滚动：会让治理表单和预览需要双轴滚动，操作成本高。
- 固定更宽的最小列宽：会在更多屏幕尺寸下提前触发溢出。

## Risks / Trade-offs

- [admin pane 的滚动位置与当前选中状态耦合不足] → 仅调整布局和滚动职责，不改变选中逻辑，避免引入额外状态同步。
- [样式修复只覆盖当前截图宽度，遗漏其他断点] → 为桌面和窄屏断点都增加测试断言，覆盖 detail body 滚动出口和栅格单列回落。
- [把滚动放进 detail body 可能影响卡片内阴影/粘性预期] → 保持非 sticky 方案，只修复可达性，避免额外视觉行为变化。

## Migration Plan

1. 调整 `AdminSkillManagement` 的高度链、详情体滚动容器和 starter 区栅格约束。
2. 仅在必要时补充 `WorkbenchShell` 的 admin 容器样式以配合内部 pane 滚动。
3. 更新前端测试，覆盖样式契约与关键文案所在区块的可达性。
4. 本次变更无需数据迁移，也不需要后端发布顺序配合。

## Open Questions

- None.
