## Context

`Skill 管理` 页面已经处于 workbench shell 内，并复用了全局 token、卡片壳和状态标签，但页面内部对文本层级的选型没有完全遵循工作台主视图现有约定。当前偏差主要集中在三类文本：

- hero 说明文案使用了正文级 `font-body`
- 分区标题 `h3` 使用了正文级 `font-body`
- 列表项和绑定项的名称文本缺少显式字号收口，容易退回默认继承

相比之下，`HomeStage`、`ConversationPane` 和 `UserManagementDrawer` 已经形成稳定基线：
- 页面标题使用 `font-page-title`
- 卡片 / 分区标题使用 `font-title`
- 控件和摘要使用 `font-dense`
- 辅助说明和标签使用 `font-meta`

这次变更只覆盖 `apps/web` 的 Skill 管理页面样式与相关测试，不修改全局 token，不引入新依赖，也不扩大到布局、交互或信息架构调整。

## Goals / Non-Goals

**Goals:**
- 让 `Skill 管理` 页面在工作台壳内与现有 workbench surface 使用同一套字体语义层级。
- 明确 Skill 管理页内各类文本的映射：页面标题、卡片标题、分区标题、控件文字、摘要、说明和辅助信息。
- 通过显式样式声明降低默认继承带来的漂移风险，并补足回归验证。

**Non-Goals:**
- 不新增全局 typography token，也不改动 `styles.css` 中现有字号变量定义。
- 不重做 Skill 管理页布局、配色、间距、滚动逻辑或信息架构。
- 不要求一次性统一所有 admin 页面，只以工作台基线拉齐当前 Skill 管理页。

## Decisions

### Decision: 以 workbench 现有 typography token 语义作为唯一基线

Skill 管理页继续使用现有的 `font-page-title / font-title / font-dense / font-meta / font-overline` 体系，不引入任何新 token，也不在页面内定义第二套字号名义。

Rationale:
- 视觉不统一的问题来自 token 选择不一致，而不是 token 能力不足。
- 继续复用现有 token 可以让 `HomeStage`、`ConversationPane`、`UserManagementDrawer` 与 Skill 管理页共享同一语义语言，维护成本最低。

Alternatives considered:
- 新增 admin 专属字号 token：会让 workbench 内出现第二套排版语言，放大不一致。
- 直接放大全局 token：会影响工作台其他区域，不符合“以工作台为基线收敛”的目标。

### Decision: Skill 管理页采用“28 / 16 / 13 / 12”四层主排版映射

页面标题保持 `font-page-title`；卡片标题和分区标题统一使用 `font-title`；控件文字、列表摘要、预览摘要和治理摘要使用 `font-dense`；标签、hint、辅助说明和次要元信息使用 `font-meta`。

Rationale:
- 这正是工作台现有页面最稳定的视觉节奏。
- Skill 管理页中的大多数文本已经在 `dense` / `meta` 上，只需要收口偏离的少数位置即可。

Alternatives considered:
- 继续保留 hero copy 和 section title 的 `font-body`：会让 Skill 管理页在工作台中显得更松、更像独立后台。
- 把更多文案提升到 `title`：会压缩信息层次，降低次要说明与结构标题的区分度。

### Decision: 对名称文本使用显式字号声明，而不是依赖继承

列表项名称、绑定项名称等关键识别文本需要显式声明字号层级，避免浏览器默认样式或父级继承导致不同模块出现不稳定观感。

Rationale:
- 当前页面中多个 `strong` 文本没有明确字号，容易因父级变化产生偏移。
- 名称文本是管理员在列表浏览和绑定治理中最频繁扫描的对象，应该稳定落在工作台已习惯的层级上。

Alternatives considered:
- 继续依赖默认继承：实现更省事，但回归风险高，且不利于建立可验证的视觉规范。

## Risks / Trade-offs

- [Hero 说明文案从 14px 收敛到 12px 后可读性下降] → 保持 `line-height: var(--line-meta)`，并只收紧说明文本，不影响主标题和主要操作。
- [分区标题提升到 16px 后局部视觉重量增加] → 仅用于结构性 `h3`，不扩大到标签、hint 或表单辅助说明，维持层级清晰。
- [只修 Skill 管理页会让其他 admin 页面仍有潜在偏差] → 先以当前用户反馈页面收口，后续如果发现类似问题，再复用这套映射扩展到其他 admin surface。
- [显式字号声明增多可能造成样式分散] → 只在偏离工作台基线的关键节点加显式声明，不新增冗余局部 token。

## Migration Plan

1. 在 `AdminSkillManagement.vue` 中按工作台字体语义重新映射 hero copy、section title 和名称文本。
2. 保持现有全局 token 与公共样式类不变，避免扩大影响面。
3. 为 Skill 管理页增加样式回归断言，验证关键字号语义仍然存在。
4. 通过定向前端测试确认组件渲染与现有治理交互未受影响。

## Open Questions

- None.
