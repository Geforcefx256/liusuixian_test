## Why

当前工作台编辑器在顶部同时显示标签页文件名和“当前文件 + 文件名”区块，重复表达同一事实，浪费垂直空间并削弱信息层级。现在需要把顶部结构收敛为更清晰的导航层与操作层，让用户一眼分辨“当前在哪个文件”和“当前能做什么”。

## What Changes

- 精简工作台编辑器顶部结构，移除重复的“当前文件 + 文件名”区块。
- 将工作台编辑器顶部明确收敛为两层：文件标签行和工具栏行。
- 保留文件级操作入口，但不再依附重复文件名区块展示。
- 调整窄屏下顶部布局，使标签与工具栏职责保持稳定而不重复表达文件名。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-web-workbench`: 调整工作台文件编辑壳层顶部的信息层级，要求文件名只由标签行承担，工具栏与文件级操作不再重复渲染当前文件标题。

## Impact

- Affected specs: `openspec/specs/agent-web-workbench/spec.md`
- Affected code: `apps/web/src/components/workbench/WorkspaceEditorPane.vue`
- Affected tests: `apps/web/src/components/workbench/WorkspaceEditorPane.test.ts`
- No top-level directory changes
- No third-party dependency changes
