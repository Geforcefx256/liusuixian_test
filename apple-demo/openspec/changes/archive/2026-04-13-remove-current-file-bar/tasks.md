## 1. 移除模板和脚本

- [x] 1.1 删除 `WorkspaceEditorPane.vue` 中 `div.workspace-editor__selected-file` 模板块（L31-51）
- [x] 1.2 移除 `selectedFileRenameDisabled`、`selectedFileRenameDisabledReason`、`selectedFileDeleteDisabled`、`selectedFileDeleteDisabledReason` 四个 computed
- [x] 1.3 检查并移除仅由该块触发的 emit 声明（`copy-file-name`、`request-rename-file`、`download-file`、`delete-file`）
- [x] 1.4 如果 `WorkspaceFileActionMenu` 的 import 仅在该块中使用，移除该 import 及组件注册

## 2. 清理样式

- [x] 2.1 移除 `workspace-editor__selected-file`、`workspace-editor__selected-file-copy`、`workspace-editor__selected-file-eyebrow`、`workspace-editor__selected-file-name` 相关 CSS 规则

## 3. 验证

- [x] 3.1 运行 `pnpm type-check` 确认无类型错误
- [x] 3.2 运行 `pnpm build` 确认构建通过
