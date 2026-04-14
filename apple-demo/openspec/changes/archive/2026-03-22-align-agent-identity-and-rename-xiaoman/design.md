## Context

当前 `apps/web` 已经通过 agent detail 与 runtime bootstrap 接入后端 Agent 元数据，首页、会话态和右侧上下文区也都在展示当前 Agent 的部分信息，但这些展示面并没有完全共享同一套 Agent 身份表达。首页和会话态仍使用简化的文本 badge，会话态虽然已有 Agent bar，但其视觉层级没有收敛到 `index-v10.html` 的 Agent header 语言；右侧上下文区则直接显示 `agent.name`，与主内容区优先使用 `presentation.title` 的逻辑存在潜在分叉。

这次变更跨越 `apps/web` 的多个 workbench 组件，并且涉及 `apps/agent-backend/assets/agents/workspace-agent/AGENT.md` 的 canonical 元数据，因此适合先把设计决策固定下来。约束也很明确：

- 只收敛 Agent identity 的视觉和命名一致性，不改变现有 API、store 和运行时契约。
- 不新增前端 Agent 配置文件，也不把品牌配置、图标配置或命名配置转移到前端。
- 不扩展 phase 1 workspace scope，右侧仍然是轻量上下文栏而不是完整工作区。

## Goals / Non-Goals

**Goals:**

- 让首页、会话态和右侧上下文区共享一致的 Agent 身份语言，包括 badge / icon、标题、副标题和状态表达。
- 保持会话态仅增强现有 Agent bar，而不是新增第二层标题栏。
- 保持 Agent 名称由后端元数据驱动，并将当前 `workspace-agent` 的显示名称正式调整为 `小曼智能体`。
- 让右侧上下文区与主内容区使用一致的 Agent 标题优先级，避免未来出现命名分叉。

**Non-Goals:**

- 不改变 auth、session、streaming、planner/build、技能治理或 runtime bootstrap 结构。
- 不重做 `SessionRail`、消息协议、上传逻辑或工作区状态模型。
- 不引入新的图标库、BFF 字段或前端本地常量来覆盖 Agent 元数据。

## Decisions

### 1. 后端 canonical Agent 元数据继续作为名称真源

选择：
- 通过修改 `apps/agent-backend/assets/agents/workspace-agent/AGENT.md` 的 `name` 字段，将当前 Agent 显示名调整为 `小曼智能体`。
- 前端继续从现有 agent detail / bootstrap 数据链路读取名称，不新增前端覆盖逻辑。

原因：
- 当前链路已经由后端驱动 Agent `name` 和 `presentation.title`，没有必要为这次命名调整引入新的前端真源。
- 如果前端对某个 `agentId` 做名称特判，后续会让 Agent identity 的来源失真，并增加维护成本。

备选方案：
- 在前端组件中按 `agentId` 写死 `小曼智能体`。
  - 放弃原因：会制造第二命名源，且与现有“后端驱动 metadata”的方向冲突。

### 2. 统一主内容区和右侧栏的 Agent 标题优先级

选择：
- 首页和会话态继续优先使用 `presentation.title`，fallback 到 `name`。
- 右侧上下文区也使用同样的优先级，而不是单独只读 `name`。

原因：
- `presentation.title` 已经是当前 workbench 主展示面的标准标题来源。
- 右侧栏若继续只读 `name`，未来一旦 `presentation.title` 与 `name` 分离，就会出现同页不同名。

备选方案：
- 强制所有区域只显示 `name`。
  - 放弃原因：会削弱 `presentation` 作为面向 UI 的 Agent 展示层含义，也没有解决一致性问题。

### 3. 复用并增强现有 Agent identity 结构，不新增新的会话标题层

选择：
- `HomeStage.vue` 与 `ConversationPane.vue` 继续基于现有 `agent-identity` 结构演进。
- `ConversationPane.vue` 保留现有 `conversation-pane__agent-bar` 位置，只增强其 badge / icon、留白、层级和视觉表达。

原因：
- 当前会话区并不是完全没有标题栏，而是一个较弱的基础版本。
- 如果额外再叠一层标题栏，会把简单的视觉对齐演变成页面结构膨胀。

备选方案：
- 新增一层独立的会话标题栏组件。
  - 放弃原因：会制造重复 header，并增加窄屏高度压力。

### 4. 共享 Agent 视觉语义类沉到全局样式层

选择：
- 在 `apps/web/src/styles.css` 中统一沉淀 Agent badge / icon、Agent identity、Agent bar surface 等共享样式。
- 组件 scoped 样式只保留布局差异和局部微调。

原因：
- 首页、会话态、右侧上下文区和消息头像都需要复用同一套视觉语言。
- 如果每个组件各写一套，会再次产生漂移。

备选方案：
- 在各组件内单独复制样式。
  - 放弃原因：一致性无法长期维持。

## Risks / Trade-offs

- [只改名称字段可能让部分旧截图、文档与现网名称不一致] → Mitigation: 在 proposal 和 tasks 中明确这是正式产品命名收敛，验证以当前 UI 展示为准。
- [共享样式进入全局层后，其他区域可能误用] → Mitigation: 保持类名围绕 Agent workbench 语义命名，不做过度抽象。
- [会话态 Agent bar 强化后在窄屏上占用更多高度] → Mitigation: 延续现有紧凑断点策略，只增强视觉，不显著增加结构高度。
- [右侧上下文区统一标题优先级后，如果后端 metadata 缺失会更明显暴露问题] → Mitigation: 保留 `name` 作为 fallback，避免 metadata 不完整时出现空标题。

## Migration Plan

1. 更新 `workspace-agent` 的 canonical Agent 名称为 `小曼智能体`。
2. 在 `apps/web/src/styles.css` 中补充共享 Agent identity 视觉语义。
3. 调整 `HomeStage.vue` 与 `ConversationPane.vue`，让首页和会话态共享同一套 Agent badge / icon 与标题层级。
4. 调整 `WorkspaceContextPane.vue`，统一当前智能体标题优先级，并使右侧身份表达与主内容区一致。
5. 视需要轻量调整 `WorkbenchShell.vue` 的品牌区图形表达，使整体视觉更接近 `index-v10.html`，但不改变产品品牌与 Agent 身份的层级角色。
6. 验证首页、会话态、右侧上下文区在名称和视觉上都能稳定显示 `小曼智能体`，且现有会话与上传流程不受影响。

回滚策略：
- 若视觉效果不理想，可独立回退前端样式与模板改动。
- 若命名调整需要回退，只需恢复 `AGENT.md` 中的 canonical 名称，不影响运行时接口结构。

## Open Questions

- 顶部全局品牌区是否在本轮同时切换到与 Agent badge 同源的图形语言，还是仅对齐中间主内容区与右侧栏。
- `小曼智能体` 是否需要同步调整 `description` 或 `presentation.summary` 的产品措辞，还是仅调整名称字段即可。
