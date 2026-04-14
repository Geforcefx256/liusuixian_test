## Why

当前工作台的文件文本视图已经支持编辑和保存，但缺少面向业务/配置人员的基础文本操作入口。对于以鼠标操作为主的用户，无法在当前打开文件内直接执行搜索、替换和撤销，会让简单校对和修订流程变得低效且不易发现。

## What Changes

- 在工作台文件打开壳的文本视图中增加当前文件级别的搜索入口，并在点击后以内嵌工具条形式展开搜索面板。
- 在搜索面板中提供面向当前打开文件的文本定位操作，包括上一个、下一个和关闭。
- 在搜索面板内增加可展开的替换区域，仅支持替换当前匹配项和全部替换当前文件匹配项。
- 在工具栏保留精简常驻动作，仅常驻展示 `搜索`、`保存` 和 `更多`，将 `撤销` 放入 `更多` 菜单作为可点击动作。
- 明确第一版范围不包含重做、跳转到行、快捷键依赖或整个工作区范围的搜索。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-web-workbench`: 工作台文件文本视图的编辑壳需要为当前打开文件提供可发现的搜索、替换和撤销交互，并保持精简工具栏布局。

## Impact

- Affected frontend UI: `apps/web/src/components/workbench/WorkspaceEditorPane.vue`
- Affected text editor integration: `apps/web/src/components/workbench/WorkspaceTextEditor.vue`
- Affected Monaco runtime wiring: `apps/web/src/components/workbench/textEditor/monacoRuntime.ts`
- Affected frontend tests around the workbench editor pane and text editor behavior
- No top-level directory changes
- No new third-party dependency should be introduced without explicit confirmation
