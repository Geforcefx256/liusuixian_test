## Context

当前 `apps/web` 的 Vue workbench 已经接入后端 agent 元数据、会话、消息流和文件上传，但首页、会话区和右侧上下文栏的 Agent 呈现方式仍然比较分散。`index-v10.html` 已经定义了一套更明确的 Agent 视觉语言，包括首页与会话态共用的 badge、title、status、chat rail 顶部 identity bar、统一的输入区和轻量工作台侧栏。

这次变更的约束很明确：

- 只做 Agent 视觉对齐，不改变 phase 1 “轻量 workspace context” 的产品边界。
- 不引入新的后端契约、路由、store 结构或文件工作区状态机。
- 不改三栏主布局，不把当前实现强行扩展成完整的 `index-v10` 工作区。

受影响的实现集中在 `apps/web/src/styles.css` 和现有四个 workbench 组件，因此这是一个跨多个组件的前端收口变更，但不属于架构重构。

## Goals / Non-Goals

**Goals:**

- 让首页和会话页共享一致的 Agent identity 视觉语言，包括 badge、标题、副标题和在线状态。
- 让会话区更接近 `index-v10` 的 chat rail 视觉，尤其是顶部 Agent bar、消息区留白和底部输入 dock。
- 让右侧 `WorkspaceContextPane` 更像工作台侧栏，而不是一组松散的信息卡片。
- 在不改变交互能力的前提下，提高当前 Vue workbench 与 `index-v10.html` 的产品一致性。

**Non-Goals:**

- 不实现文件预览、表格视图、编辑器、模板库或文件树。
- 不调整 `SessionRail` 的结构、数据模型或会话行为。
- 不修改 `workbenchStore`、`agentApi` 或任何 `/agent/api/*`、`/web/api/auth/*` 契约。
- 不引入新的组件库、图标库或全局设计系统重构。

## Decisions

### 1. 复用现有布局与状态模型，只做视觉收口

选择：
- 保留 `WorkbenchShell -> SessionRail / main / WorkspaceContextPane` 的布局结构。
- 保留 `HomeStage` 与 `ConversationPane` 的现有职责，不把 `ConversationPane` 重构成新的工作台容器。

原因：
- 用户已明确要求“一点一点来”，当前阶段重点是先拉齐 Agent 视觉效果。
- 如果这一轮顺手引入工作区结构重构，会把纯视觉任务变成状态与组件边界调整，扩大风险。

备选方案：
- 直接把当前中间区拆成 `chat rail + editor area`。
  - 放弃原因：这属于能力改造，不是视觉收口。

### 2. 在 `styles.css` 中补共享的 Agent 视觉语义类，而不是在每个组件里复制样式

选择：
- 在全局样式中新增少量共享 token 和语义类，例如 Agent identity、panel eyebrow、soft input shell、agent rail surface。
- 组件内 scoped 样式只负责布局差异和局部微调。

原因：
- 首页和会话页都需要同一套 Agent badge / title / subtitle / status 风格。
- 如果继续在每个组件里各写一套，后续第二轮细调会很难保持一致。

备选方案：
- 每个组件各自用 scoped CSS 手工复刻 `index-v10`。
  - 放弃原因：容易再次出现样式漂移。

### 3. 会话态通过轻量 Agent bar 建立“当前智能体”持续可见性

选择：
- 给 `ConversationPane` 增加顶部 Agent bar。
- 通过 `WorkbenchShell` 已有的 `agentTitle`、`agentSubtitle` 继续向下传递，不新增 store 字段。

原因：
- 进入会话后，当前实现的 Agent 身份感明显弱于 `index-v10`。
- 现有 `WorkbenchShell` 已经具备衍生标题与摘要的计算逻辑，复用它即可。

备选方案：
- 在 `ConversationPane` 内再次直接读取 store。
  - 放弃原因：会让展示组件与 store 更紧耦合，且没有必要。

### 4. 右侧栏只收敛气质，不伪装成完整 workspace

选择：
- `WorkspaceContextPane` 继续保留 Agent 信息、任务状态和文件列表三段结构。
- 只调整 section header、上传按钮、文件列表 row 和摘要文本层级，使其更接近 `index-v10` 侧栏气质。

原因：
- 当前 spec 明确 phase 1 仍是 lightweight workspace context，而不是文件工作区。
- 如果用过于强的视觉暗示把它做成“几乎是文件树”，会制造错误预期。

备选方案：
- 先做假的工作空间 / 模板库 tab。
  - 放弃原因：这会把视觉对齐任务变成结构性占位设计，收益不高。

### 5. 保持顶层 shell header 低存在感，让 Agent 区成为主视觉锚点

选择：
- 顶部全局 header 保留现有功能，但降低 logo 和按钮的视觉抢占。
- 首页 header 与会话 Agent bar 成为主要识别层。

原因：
- `index-v10` 的产品识别重心在 Agent 头部，而不是全局导航栏。
- 当前顶栏相对偏“管理台”，容易削弱中间主区的 Agent 工作感。

备选方案：
- 保持当前顶栏强度不变，只调整中间区。
  - 放弃原因：最终仍会出现重心错位。

## Risks / Trade-offs

- [视觉收口后，右侧栏仍然缺少真正工作区能力] → Mitigation: 在 design 和 spec 中明确 phase 1 边界，避免把本轮成果误解为 workspace 能力完成。
- [共享视觉类进入全局样式后，后续组件可能误用] → Mitigation: 将新增类限定在 Agent workbench 语义范围，命名保持具体，不做过度抽象。
- [`ConversationPane` 增加 Agent bar 后，窄屏高度压力上升] → Mitigation: 复用 `index-v10` 的紧凑尺寸，在移动断点下同步收紧内边距和字号。
- [只改视觉不改结构，仍无法完全复刻 `index-v10`] → Mitigation: 将目标定义为“视觉拉齐”而非“工作区等价实现”，先解决识别一致性。

## Migration Plan

1. 在 `styles.css` 中补充共享 Agent 视觉 token 和语义类。
2. 调整 `ConversationPane.vue`，加入顶部 Agent bar 和统一输入 dock 视觉。
3. 调整 `WorkbenchShell.vue`，把 Agent title/subtitle 继续传给会话区，并弱化顶层 header 视觉。
4. 调整 `HomeStage.vue`，使首页 header、技能卡和输入区与会话态视觉语言统一。
5. 调整 `WorkspaceContextPane.vue`，收敛为更接近工作台侧栏的轻量视觉表达。
6. 通过桌面和窄屏断点检查首页、会话页、右侧栏的一致性，不改任何 backend 或 store 行为。

回滚策略：
- 所有改动仅限前端样式和局部模板，若结果不理想，可逐文件回退到当前 Vue 版本，不影响现有会话、上传和认证流程。

## Open Questions

- 会话态 Agent bar 是否使用纯文本 `AI` badge，还是直接复用简洁 SVG 标识。
- 右侧上传按钮是否只做样式收敛，还是同步补一个轻量图标以贴近 `index-v10`。
- 首页技能卡是否需要在本轮补充更明显的 category / description 层级，还是只统一边框与 hover 反馈。
