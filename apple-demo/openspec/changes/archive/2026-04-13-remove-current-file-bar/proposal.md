## Why

编辑器面板中"当前文件"栏（显示文件名 + 三点操作菜单）与上方 Tab 行功能重复——Tab 行已经展示文件名和关闭按钮，文件操作在侧边栏也可触达。移除该栏可减少视觉噪音，为编辑区域腾出垂直空间。

## What Changes

- 移除 `WorkspaceEditorPane.vue` 中 `div.workspace-editor__selected-file` 区块（模板、样式、关联逻辑）
- 清理该区块引入的 `WorkspaceFileActionMenu` 组件引用（仅编辑器面板内的引用，侧边栏保留）
- 清理不再使用的 props/emit/computed（如 rename-disabled、delete-disabled 相关）

## Capabilities

### New Capabilities

_无新增能力_

### Modified Capabilities

- `agent-web-workbench`: 移除编辑器面板中的"当前文件"信息栏 UI，不影响工具栏和内容区域

## Impact

- 仅影响 `apps/web/src/components/workbench/WorkspaceEditorPane.vue` 一个文件
- `WorkspaceFileActionMenu` 组件本身保留（侧边栏仍在使用）
- 不涉及 API、依赖或后端变更
