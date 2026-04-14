## Context

`WorkspaceEditorPane.vue` 当前在 Tab 行下方渲染一个"当前文件"信息栏（`div.workspace-editor__selected-file`），包含文件名和三点操作菜单（复制/重命名/下载/删除）。该信息栏与 Tab 行重复展示文件名，且文件操作已可通过侧边栏菜单触达，属于冗余 UI。

## Goals / Non-Goals

**Goals:**
- 移除编辑器面板中的"当前文件"信息栏，释放垂直空间
- 清理关联的死代码（computed、样式）

**Non-Goals:**
- 不改动工具栏（视图切换、搜索、保存、更多）
- 不改动侧边栏中的 `WorkspaceFileActionMenu` 使用
- 不删除 `WorkspaceFileActionMenu` 组件本身

## Decisions

**1. 直接删除模板块，不做迁移**

移除 L31-51 的 `div.workspace-editor__selected-file` 整个模板块。文件操作（重命名、删除、下载、复制文件名）在侧边栏已有入口，无需迁移到其他位置。

**2. 清理范围限定为单文件**

所有改动限定在 `WorkspaceEditorPane.vue` 内：
- 模板：删除 `div.workspace-editor__selected-file` 块
- 脚本：移除 `selectedFileRenameDisabled`、`selectedFileRenameDisabledReason`、`selectedFileDeleteDisabled`、`selectedFileDeleteDisabledReason` 四个 computed（仅此处使用）
- 脚本：移除编辑器面板内对 `WorkspaceFileActionMenu` 的 import（如果侧边栏通过独立 import 引入则安全移除；否则保留）
- 样式：移除 `workspace-editor__selected-file`、`workspace-editor__selected-file-copy`、`workspace-editor__selected-file-eyebrow`、`workspace-editor__selected-file-name` 相关 CSS 规则
- emit：检查 `copy-file-name`、`request-rename-file`、`download-file`、`delete-file` 是否仅在此块中触发，若是则从 emits 声明中移除

## Risks / Trade-offs

- **[低] 文件名可见性降低** → Tab 行已显示文件名，且 Tab 宽度有限时会截断；可接受，因为 Tab 已提供足够的文件标识
- **[无] 功能丢失** → 三点菜单中的所有操作在侧边栏均有入口，无功能丢失
