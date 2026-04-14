## Context

当前 `apps/web` 的工作台壳层由 `WorkbenchShell.vue`、`ConversationPane.vue` 和 `SessionRail.vue` 共同组成：

- `WorkbenchShell.vue` 顶部 header 只承载项目 logo、admin 导航和用户菜单。
- `ConversationPane.vue` 内部另有一条“小曼智能体”身份栏，用于显示 agent 标题和副标题。
- `SessionRail.vue` 以左侧窄轨道形式常驻布局，承担“新建会话”“历史会话 hover 展开”“搜索/删除/清空历史”等能力。

这套结构已经能工作，但和本次需求直接冲突：

- 会话主入口和历史入口被放在一个 hover 依赖很强的左 rail 中，高频能力不够显式。
- 项目 logo 与“小曼智能体”身份被拆成两个区域，用户需要分别理解“产品品牌”和“当前助手”。
- 历史列表的 `preview` 在窄空间内退化成低价值的一字信息，反而增加视觉噪音。
- 现有 `SessionRail` 还承载 `clear history` 菜单，但需求文档已经明确历史页只保留搜索、列表和删除。

约束也很清楚：

- 这次变更只覆盖 `apps/web` 前端壳层和交互，不改 `workbenchStore` 的核心会话语义，不改 `/agent/api/agent/sessions/*` 契约。
- 不新增第三方依赖，不调整 monorepo 顶层结构。
- 右侧 workspace sidebar、会话发送流、会话切换/删除接口、共享工作区锁定规则都必须继续沿用。

## Goals / Non-Goals

**Goals:**

- 删除左侧常驻历史 rail，把“新建会话”和“历史会话”迁移到统一主身份区后的显式操作位。
- 融合项目 logo 与“小曼智能体（MML 配置助手）”身份表达，避免顶部品牌区和会话区身份栏割裂。
- 将历史管理改造成显式打开的简化面板，只保留搜索、列表、选中会话和删除能力。
- 去掉历史会话预览文案和 bulk-clear 前端入口，同时保留现有删除确认与共享工作区锁定约束。
- 让桌面布局从“三列加左 rail”收敛为“主内容加 workspace sidebar”，并移除左 rail 相关宽度调整逻辑。

**Non-Goals:**

- 不新增历史管理路由，也不把历史视图做成独立页面跳转。
- 不改后端 session 数据模型，不新增会话字段，不移除 `clearHistorySessions` API。
- 不改变会话首条消息创建 session 的现有行为。
- 不重做右侧 workspace sidebar，也不改消息流、上传流或 pending interaction 流程。

## Decisions

### 1. 将项目品牌和“小曼”身份合并到 `WorkbenchShell` 顶部主身份区

选择：

- 顶部 header 从“仅 logo 品牌区”升级为“logo + backend-driven 小曼身份 + 主操作按钮”的统一主身份区。
- `ConversationPane.vue` 现有 `conversation-pane__agent-bar` 不再作为独立一栏保留。
- 产品 logo 继续作为图形主标识保留，小曼智能体作为同一主身份区中的标题/副标题表达，不再在会话区重复渲染第二条身份栏。

原因：

- 用户要求“将项目 logo 和小曼智能体进行融合，删除小曼智能体这一栏”，最直接的落点就是把会话区身份上移到壳层 header。
- 现有 header 已经是所有视图共享的顶层 chrome，把主身份和会话入口放在这里，能覆盖空会话态、已持久化会话态和 workspace-expanded 态。
- 如果继续保留 `ConversationPane` 内部 agent bar，再在 header 中重复一套融合身份，会变成新的重复信息源。

备选方案：

- 保留 `ConversationPane` 的 agent bar，只在 header 增加新按钮。
  - 放弃原因：只能解决入口迁移，不能解决“logo 与小曼割裂”和“删除小曼这一栏”。
- 在会话区内部融合 logo 与小曼，而 header 保持仅 logo。
  - 放弃原因：空会话态和 workspace-expanded 态仍会出现两套顶层身份逻辑，且无法替代全局入口位。

### 2. 用 header 显式触发的历史管理面板替代左侧 `SessionRail`

选择：

- 移除 `SessionRail` 作为常驻布局列的角色。
- 历史会话改为由 header 中的“历史会话”按钮显式打开一个位于该图标下方的下拉历史管理面板。
- 历史面板继续复用现有 store 数据和删除/选择行为，但不再依赖 hover 进入/离开。
- 该下拉面板不是独立页面，也不是 modal；关闭语义统一为点击外部关闭、按 `Esc` 关闭、选中会话后关闭。
- 面板内容区采用从左侧边界开始平铺展开的布局，不做居中窄气泡样式，以保证搜索与列表区域有稳定的横向空间。

原因：

- 需求明确要求删除左侧侧边栏，同时点击按钮展示原有历史会话页面。
- 当前 `SessionRail` 的主要价值在于历史列表和删除能力，而不是“占一个独立列”。把它改成显式面板可以最小化数据层改动。
- 不引入新路由、不切换主视图，能保持 workbench 主体稳定，避免把这次 UI 调整扩大成状态机重构。

备选方案：

- 点击“历史会话”后切换到中央单独页面。
  - 放弃原因：会让当前会话上下文消失，需要额外处理返回与状态保持，超出本轮范围。
- 保留左 rail 但默认隐藏，通过按钮控制展开。
  - 放弃原因：本质仍然保留了独立 rail 结构和布局宽度，不符合“可以删除侧边栏”的需求。

### 3. 历史管理面板只保留搜索、列表、选中与删除，不再展示 preview 或 bulk-clear

选择：

- 历史会话面板只渲染搜索框、会话标题、更新时间、占用状态标识、选择动作和删除动作。
- 会话 preview 文案仅在界面层隐藏，不改变现有搜索行为与底层数据来源。
- 移除前端 `清空历史会话` 入口与相关菜单层。
- 保留当前会话高亮选中状态，确保用户在打开历史管理面板时可以立即定位正在查看的会话。

原因：

- 用户明确说明原历史会话页面“只留原始的搜索框和历史任务列表以及删除功能”。
- 当前 `preview` 在真实数据下已经退化为低价值信息，不值得继续占据垂直空间。
- 先仅隐藏 preview 而不改搜索逻辑，可以把本次范围控制在 UI 重排，避免额外引入搜索回归风险。
- 删除 bulk-clear 入口能让历史页更聚焦，也与本次“会话和历史入口易用性提升”目标一致。

备选方案：

- 保留 preview，但优化截断算法。
  - 放弃原因：需求本身希望删除该噪音，不是继续挽救它。
- 保留 bulk-clear 在更多菜单中。
  - 放弃原因：与需求文档显式范围不一致，也会继续增加历史页操作复杂度。

### 4. 保留现有 store / API / 锁定规则，只调整 UI 挂载点

选择：

- “新建会话”继续调用 `workbenchStore.startNewConversation()`。
- 选择历史会话、删除会话继续调用 `selectSession()`、`deleteSession()`。
- 共享工作区占用导致的删除禁用、owner 标识和相关提示继续沿用现有 store 计算结果。

原因：

- 这次是 UI 壳层重排，不需要改动会话生命周期和后端接口。
- 现有 store 已经正确处理“首条消息创建 session”“删除当前会话后回到空白会话态”“共享工作区占用锁定删除”等关键语义。
- 保持 contract 不变，可以把风险集中在模板、样式和测试上。

备选方案：

- 同步收敛 `workbenchStore`，彻底删除 `clearHistorySessions()` 等历史遗留方法。
  - 放弃原因：这会把前端入口下线扩展成业务接口清理，不属于当前变更。

### 5. 桌面布局移除左 rail 分隔器，仅保留会话/编辑器/右侧栏宽度模型

选择：

- 删除 `sessionRailWidth`、左 rail splitter 和相关最小/最大宽度计算。
- 保留 conversation 与 workspace editor 的分隔器，以及 editor 与 workspace sidebar 的分隔器。
- 移动端/窄屏仍沿用当前 header wrap 和 sidebar collapse 策略。

原因：

- 左 rail 被移除后，继续保留对应 width state 和 resize 逻辑只会制造死代码和测试噪音。
- 现有桌面布局真正需要保留的是 conversation/editor/sidebar 的平衡关系，而不是历史 rail 的宽度调节。

备选方案：

- 让历史面板继续支持可拖拽宽度。
  - 放弃原因：历史面板不再是常驻列，没有必要引入新的尺寸状态。

## Risks / Trade-offs

- [顶部 header 在 admin 导航与新按钮并存时可能变得拥挤] → Mitigation: 让主身份区、admin segmented control 和用户动作区保持独立 flex 片段，并复用现有窄屏换行策略。
- [移除 preview 后，用户只能依赖标题和搜索定位旧会话] → Mitigation: 保留更新时间、占用标识和搜索能力，避免列表失去辨识度。
- [下线 bulk-clear 入口会改变已有高频用户习惯] → Mitigation: 将该变化写入 spec，保留后端能力但不再默认暴露；如果后续业务需要，可在独立 change 中重新设计更合适的批量历史管理入口。
- [把 agent bar 上移后，`ConversationPane` 顶部留白和滚动测量可能受影响] → Mitigation: 同步调整 `ConversationPane` 头部结构和相关组件测试，确保消息区与 composer 的 pane-owned scrolling 不被破坏。
- [历史面板从 hover 改为点击后，关闭语义需要重新定义] → Mitigation: 统一为显式按钮切换、选择会话后关闭、点击外部关闭、`Esc` 关闭，避免 hover 竞争状态。

## Migration Plan

1. 在 `WorkbenchShell.vue` 中重构顶部 header，合并 logo 与 agent identity，并新增“新建会话”“历史会话”显式入口。
2. 将 `SessionRail.vue` 改造成 header 触发的历史管理面板，或拆出等价 replacement 组件，保留搜索/列表/删除能力，移除 preview 与 bulk-clear。
3. 调整 `ConversationPane.vue`，移除独立 agent bar，并修正消息区/空态/composer 的布局与滚动边界。
4. 删除左 rail 宽度状态、分隔器和相关桌面 resize 逻辑，仅保留 conversation/editor/sidebar 的尺寸模型。
5. 更新 `WorkbenchShell.test.ts`、`SessionRail.test.ts` 或替代组件测试，覆盖显式打开历史面板、删除确认、当前会话切换、共享工作区锁定和桌面布局回归。

回滚策略：

- 该变更没有数据迁移；如需回滚，只需恢复前端模板、样式和测试，并重新挂回左侧 `SessionRail`。
- 因为 session API 和 store contract 不变，回滚不涉及后端或数据层兼容处理。

## Open Questions

- None.
