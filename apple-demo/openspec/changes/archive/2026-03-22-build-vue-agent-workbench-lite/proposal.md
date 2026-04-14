## Why

仓库已经完成 `apps/agent-backend` 的迁移，也已经有 [index-v10.html](/Users/gaolifu/work/project/apple/apple-demo/index-v10.html) 这样的高保真工作台原型，但 `apps/web` 仍然没有可运行的正式前端。现在需要基于 Vue 建立新的智能体工作台，把登录、会话、流式对话和工作区上下文真正接到已迁移的后端上，尽快形成可联调、可验证的产品闭环。

## What Changes

- 在 `apps/web` 下创建新的 Vue 前端工程，以 `index-v10.html` 作为首期信息架构和视觉骨架。
- 接入基于 Cookie 会话的登录体验，参考 `ref_code` 的用户认证实现，对接 `/web/api/auth/*`。
- 实现首期智能体工作台，包括首页技能入口、历史会话、会话创建、消息历史、流式对话、工作区上下文和文件上传入口。
- 将 `index-v10.html` 中间区域从“编辑器/预览工作台”收敛为“智能助手 + 工作区上下文”的首期形态，不实现文件内容预览、表格编辑和文本编辑。
- 延后模板库完整能力、管理员用户管理、文件预览、表格视图和复杂审批 UI，只保留必要入口或占位。

## Capabilities

### New Capabilities
- `agent-web-auth`: 定义 Vue 前端的登录、登录态校验、当前用户展示与登出行为。
- `agent-web-workbench`: 定义 Vue 智能体工作台的首页、会话、流式对话、工作区上下文与上传入口行为。

### Modified Capabilities
- None.

## Impact

- Affected code: `apps/web/**` 新建 Vue/Vite 应用结构、页面、状态管理、API 客户端与样式资源。
- Affected APIs: `/web/api/auth/*`, `/agent/api/agents/*`, `/agent/api/runtime/*`, `/agent/api/agent/*`, `/agent/api/files/*`。
- Affected product assets: `index-v10.html` 的页面结构、交互分区和视觉语言将迁移为正式前端实现。
- Affected dependencies: Vue 3、Vite、Pinia，以及可能新增的 Vue Router。
- Integration constraints: 继续依赖同源代理和 Cookie 会话；首期不要求文件预览和后台管理闭环。
