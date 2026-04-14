## Context

当前 `apps/web` 的工作台已经有完整的顶部 header、首页 hero、会话区和右侧上下文区，也已经复用了前几轮沉淀的 `agent-identity` 视觉语义。但从你提供的截图看，最明显的偏差集中在两处：

- `WorkbenchShell.vue` 左上品牌区仍带有偏重的块状边界感，视觉上更像悬浮卡片，不像 `index-v10.html` 中嵌入 header 的轻量 `logo-icon` 区，而且当前还多了一行“核心网智能配置工作台”副标题。
- `HomeStage.vue` 的 Agent hero 虽然已经显示 badge、标题、副标题和状态，但图标语言仍是当前自定义 glyph，且“在线”状态文案与 `index-v10.html` 的首页 header 表达不一致。

这次改动跨越全局样式和两个 workbench 组件，因此先固定设计约束：

- 只处理截图中标红的品牌区与首页 Agent hero，不扩大会话区、右侧栏、store 或 API 的范围。
- 继续使用后端驱动的 Agent title / subtitle，不引入前端硬编码文案。
- 品牌区和首页 Agent 区改为复用 `index-v10.html` 的 `logo-icon` / `icon-svg` 语言，不继续沿用当前自定义 `agent-glyph` 作为这两处的最终视觉。

## Goals / Non-Goals

**Goals:**

- 让顶部品牌区在 header 内部呈现为更轻量的 inline brand，而不是一个视觉独立的卡片块，并只保留 `AI MML` 主标题。
- 让首页 Agent hero 在图标、title、subtitle、边距与整体高度上更接近 `index-v10.html`，同时移除“在线”状态文案。
- 把两块共享的视觉规则沉到 `apps/web/src/styles.css`，避免局部 scoped CSS 再次漂移。
- 保持首页 title / subtitle 继续来自后端 Agent metadata。

**Non-Goals:**

- 不调整会话消息流、输入逻辑、文件上传、右侧上下文信息结构或技能治理入口逻辑。
- 不引入新的品牌配置源或前端 Agent 覆盖字段。
- 不要求 DOM 与 `index-v10.html` 一比一复刻，只要求视觉感知对齐。

## Decisions

### 1. 顶部品牌区保留现有结构，但切换到 `index-v10` 的 `logo-icon` 语言

选择：

- 保留 `WorkbenchShell.vue` 中“logo + 产品名”的结构，删除“核心网智能配置工作台”副标题。
- 将品牌图标切换为 `index-v10.html` 中 `logo-icon` 里的分层立方体 `icon-svg`，而不是继续使用当前圆环型 glyph。
- 通过调整品牌容器的 gap、文字层级、logo badge 尺寸与 header 内的对齐方式，让它更像 `index-v10.html` 的内嵌 logo 区。
- 不再为品牌块增加额外边框、背景块或强调性外框。

原因：

- 当前结构已经满足信息表达，问题主要是视觉重量和图标语言错误，而不是信息架构错误。
- 直接在现有结构上收紧样式，风险最小，也不会影响管理员导航和右侧用户区的布局。

备选方案：

- 单独新增一个专用 `BrandHeader` 组件并重做 header 模板。
  - 放弃原因：这次改动范围太小，不值得为视觉微调引入新的组件层级。

### 2. 首页 hero 继续使用 `agent-identity` 结构，但图标和内容层级按 `index-v10` 收敛

选择：

- 保留 `HomeStage.vue` 现有的 `agent-identity` 数据结构，但去掉“在线”状态展示。
- 将首页 Agent 图标切换为 `index-v10.html` 的 `icon-svg` 语言，而不是当前自定义 glyph。
- 调整 hero 的容器高度、badge 尺寸、标题字重、subtitle 字号与头部留白，使其接近 `index-v10.html` 的 home-stage header。
- 将 `panel-eyebrow`、hero copy、status 之间的相对间距作为共享 token 处理，而不是只在 `HomeStage.vue` 内部手调。

原因：

- 当前偏差在于图标语言和层级不一致，而不是字段缺失。
- 复用现有 `agent-identity` 可以保证首页和其他 Agent surface 仍然使用同一语义体系，避免本轮把首页变成一套特殊样式。

备选方案：

- 新建只供首页使用的 `HomeAgentHero` 专属视觉组件。
  - 放弃原因：会弱化共享样式层的价值，也让后续视觉统一更难维护。

### 3. 共享样式继续集中在全局层，组件只保留布局差异

选择：

- 在 `apps/web/src/styles.css` 增补或微调品牌区与 Agent hero 共用的 `icon-svg`、badge、title、subtitle、surface 和 spacing 规则。
- `WorkbenchShell.vue` 与 `HomeStage.vue` 的 scoped CSS 只保留具体布局尺寸、响应式收紧和组件局部差异。

原因：

- 这次用户指出的本质问题就是“同一产品里的两个身份入口看起来不像同一套设计”。
- 若继续把视觉规则散落在 scoped CSS 中，下一轮很容易再次偏移。

备选方案：

- 在两个组件里分别各写一套 scoped CSS 覆盖。
  - 放弃原因：实现快，但会再次制造不可控漂移。

## Risks / Trade-offs

- [header 品牌区去掉副标题后，左侧信息密度会明显下降] → Mitigation: 用正确的 `logo-icon` 与更稳的字重维持识别度，而不是再补辅助文案。
- [首页 hero 去掉“在线”后，右侧会变得过空] → Mitigation: 通过标题区宽度、badge 尺寸和 header 留白重新平衡，而不是保留无效状态文案。
- [把共享规则继续沉到全局层，可能影响其他 Agent surface] → Mitigation: 只调整品牌区和 home hero 直接使用的类名，不扩大到会话气泡等无关区域。

## Migration Plan

1. 在 `apps/web/src/styles.css` 中梳理品牌区与首页 Agent 区共享的 `icon-svg`、badge、标题和 subtitle 规则。
2. 调整 `WorkbenchShell.vue` 顶部品牌区，替换为 `index-v10.html` 的 `logo-icon` 视觉并删除副标题。
3. 调整 `HomeStage.vue` 头部 hero，替换为 `index-v10.html` 的 `icon-svg` 图标并移除“在线”状态文案。
4. 本地验证无会话首页在桌面宽度和窄屏断点下的 header 与 hero 视觉关系。

回滚策略：

- 若结果不理想，可单独回退 `WorkbenchShell.vue` 与 `HomeStage.vue` 的视觉改动。
- 若共享样式影响面超出预期，可回退 `styles.css` 中新增的品牌 / hero 规则，而不影响数据流或会话逻辑。

## Open Questions

- 是否需要在后续单独一轮把会话态顶部 Agent bar 也进一步压到与首页完全同一套 header 节奏；本次先不纳入范围。
