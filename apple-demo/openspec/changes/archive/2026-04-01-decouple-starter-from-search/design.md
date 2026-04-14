## Context

当前实现是 change `route-starter-cards-to-more-search` 的产物：快速开始卡片点击后会设置 `skillDiscoveryContext`，自动展开更多搜索面板，按 intent group 过滤搜索结果，并在搜索区域显示"来自常用起点"横幅和代表 skill 置顶高亮。这个设计把快速开始的交互委托给了更多搜索，导致两个区域耦合。

这次调整将快速开始和更多搜索彻底解耦为两个独立区域，快速开始采用两步确认选中的交互模型，更多搜索回归纯粹的全局搜索功能。主要影响 `ConversationPane.vue` 的空态交互和 `workbenchStore.ts` 中的状态管理。不改变 governed skill 数据链路、分组模型，不新增依赖。

## Goals / Non-Goals

**Goals:**
- 快速开始区域内的 skill 支持两步操作：点击展开描述 → 点击"开始使用"链接发送 starterPrompt。
- 更多搜索与快速开始完全独立，默认展开，不受快速开始操作影响。
- 全局只允许一个 skill 处于展开/选中态（跨卡片、跨区域互斥）。
- 更多搜索默认只展示热门技能 chip 和搜索框，不展示全量技能列表。
- 移除 discovery context 概念及其关联的 UI 和状态逻辑。

**Non-Goals:**
- 不改变 managed skill governance、starter 分组数量或 intent group 定义。
- 不改变 starterPrompt 的生成逻辑。
- 不改变 skill 实际执行方式（仍通过 send-prompt 发送）。
- 不引入新的后端接口或第三方依赖。
- 不改变快速开始卡片本身的分组展示逻辑（仍显示 3 个 preview skill）。

## Decisions

### 1. 用全局选中态替代 discovery context

新增 `selectedStarterSkillId: Ref<string | null>` 作为唯一的 skill 选中状态。无论从快速开始还是更多搜索点击 skill，都设置同一个 selectedStarterSkillId。点击已选中的 skill 或点击"开始使用"后清除选中态。

移除 `SkillDiscoveryContext` 接口、`skillDiscoveryContext` ref、`focusStarterDiscovery()`、`clearSkillDiscoveryContext()`、`filterSkillsByDiscoveryContext()`、`prioritizeRepresentativeSkill()` 以及所有消费这些状态的代码。

备选方案：
- 保留 discovery context 但仅用于快速开始。未采用，因为增加了不必要的复杂度，且快速开始的选中行为不需要与搜索状态绑定。
- 为快速开始和更多搜索分别维护选中态。未采用，因为全局互斥是用户的明确预期，分开管理反而增加同步复杂度。

### 2. 快速开始采用卡片内展开模式

快速开始卡片内的每个 skill 名称作为独立可点击元素。点击后在卡片内原地展开描述文字和"开始使用 →"链接。同一卡片内手风琴互斥，跨卡片也互斥（通过全局 selectedStarterSkillId 保证）。

卡片内展开的 skill 应显示：skill 名称（带选中标记）、描述文字、"开始使用 →"文字链接。其余未选中的 skill 保持为列表项形式。

点击"开始使用 →"时 emit `send-prompt` 事件并发送该 skill 的 `starterPrompt`。

备选方案：
- 点击 skill 直接发送 starterPrompt。未采用，因为用户明确要求两步确认以避免误操作。
- 点击卡片空白区展开全部 skill 列表后再选。未采用，因为每个卡片固定展示 3 个 preview skill，无需额外的展开全量步骤。

### 3. 更多搜索默认展开且独立运作

更多搜索区域默认展开（移除 `searchPanelOpen` 折叠/展开逻辑，或将其初始值改为 true）。搜索行为简化为：

- 无搜索词时：显示热门技能 chip。
- 有搜索词时：显示全局过滤后的匹配结果列表。
- 无匹配时：显示提示文案 + 搜索建议 chip。
- 热门 chip 点击时将 skill 名称填入搜索框作为关键词。
- 搜索结果中的 skill 点击行为与快速开始一致（展开描述 + "开始使用 →"）。

搜索过滤不再经过 `filterSkillsByDiscoveryContext`，直接对 `visibleSkills` 做 `filterSkillsBySearchQuery`。移除 `prioritizeRepresentativeSkill` 调用，搜索结果按 `compareStarterSkills` 排序即可。

备选方案：
- 更多搜索保留折叠/展开切换。未采用，因为用户明确要求默认展开，且面板空间足够。
- 更多搜索默认展示全量技能列表。未采用，因为与快速开始区域功能重复，用户要求只保留热门 chip。

### 4. 移除代表 skill 推荐机制

移除 `StarterGroupView.skill`（代表 skill）字段和 `Starter 推荐` badge UI。快速开始卡片上每个 skill 地位平等，由用户自己选择，不需要系统预设推荐。

备选方案：
- 保留代表 skill 但不在 UI 上体现。未采用，因为会增加数据模型复杂度却没有实际价值。

### 5. 清理 WorkbenchShell 联动代码

移除 `WorkbenchShell.vue` 中的 `handleStarterDiscovery()` 函数和对应的 `@discover-group` 事件处理。快速开始卡片的交互完全在 `ConversationPane.vue` 内部闭环，不再需要向 store 传递 discovery context。

新增 ConversationPane 对 `selectedStarterSkillId` 的读写能力，可通过 prop/emit 或直接调用 store action 实现。

## Risks / Trade-offs

- [Risk] 移除 discovery context 后，空分组卡片（如"配置核查"无 skill 时）的点击行为需要重新定义。 → Mitigation: 空分组卡片保持展示空态提示文案，不响应 skill 点击（因为没有 skill 可点）。
- [Risk] 快速开始卡片内展开描述可能增加卡片高度，影响三列布局的视觉平衡。 → Mitigation: 展开时只影响被选中卡片的卡片高度，其余卡片不受影响；描述文字应简洁。
- [Risk] 全局选中态在会话切换、新建会话时需要正确重置。 → Mitigation: 在 `startNewConversation()` 和 agent 切换时同步清除 `selectedStarterSkillId`。

## Migration Plan

1. 在 store 中新增 `selectedStarterSkillId` 状态和相关 action，同时标记旧 discovery context 代码待移除。
2. 重构 `ConversationPane.vue` 的快速开始模板，实现卡片内 skill 展开/选中交互。
3. 简化更多搜索逻辑，移除 discovery context 过滤和代表 skill 置顶，改为默认展开。
4. 清理 WorkbenchShell 的 discovery 联动代码。
5. 移除 `SkillDiscoveryContext`、`filterSkillsByDiscoveryContext`、`prioritizeRepresentativeSkill`、`focusStarterDiscovery`、`clearSkillDiscoveryContext` 等废弃代码。
6. 更新相关测试，覆盖两步选中、全局互斥、更多搜索独立搜索等场景。

## Open Questions

- None.
