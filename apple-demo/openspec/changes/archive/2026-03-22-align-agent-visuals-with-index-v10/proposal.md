## Why

当前 `apps/web` 已经复用了 `index-v10.html` 的基础色板和三栏工作台骨架，但 Agent 相关视觉仍然偏向通用后台界面：首页标题、会话区、输入区和右侧上下文栏之间缺少统一的智能体身份表达。先用一轮小范围视觉对齐把 Agent 气质拉齐，可以在不触动现有数据流和 phase 1 约束的前提下，降低产品割裂感，并为后续工作区能力迭代建立统一基线。

## What Changes

- 调整 workbench shell、home stage、conversation pane、workspace context pane 的 Agent 视觉层级，使其向 `index-v10.html` 的 Agent header、chat rail 和侧栏语言收敛。
- 在会话态增加持续可见的 Agent identity bar，使用户在进入会话后仍能明确感知当前智能体。
- 统一首页与会话态的输入区、状态 pill、badge、标题层级、间距和轻量交互反馈，减少“不同页面像不同产品”的观感。
- 保持现有三栏布局、会话流程、上传流程、phase 1 轻量 workspace 约束和后端契约不变，不引入文件预览、编辑、模板库或新的工作区状态模型。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-web-workbench`: refine the shell, home-stage, conversation, and workspace-context presentation requirements so the phase 1 Vue workbench uses a consistent Agent visual language aligned with `index-v10.html` without changing its lightweight workspace scope.

## Impact

- Affected code: `apps/web/src/styles.css`, `apps/web/src/components/workbench/WorkbenchShell.vue`, `apps/web/src/components/workbench/HomeStage.vue`, `apps/web/src/components/workbench/ConversationPane.vue`, `apps/web/src/components/workbench/WorkspaceContextPane.vue`
- Unchanged systems: `apps/web/src/stores/workbenchStore.ts`, `/agent/api/*`, `/web/api/auth/*`, backend upload/session/run contracts
- UX impact: stronger Agent identity continuity across home stage and active session, closer visual parity with the established `index-v10` baseline
