## REMOVED Requirements

### Requirement: Workbench SHALL provide stable selected-file naming and copy-file-name actions
**Reason**: "当前文件"信息栏与 Tab 行重复展示文件名，且其中的文件操作（复制文件名、重命名、下载、删除）已可通过侧边栏文件行操作菜单触达，属于冗余 UI。移除以简化编辑器面板布局。
**Migration**: 文件操作统一通过侧边栏的 `WorkspaceFileActionMenu` 触发，无需额外迁移。
