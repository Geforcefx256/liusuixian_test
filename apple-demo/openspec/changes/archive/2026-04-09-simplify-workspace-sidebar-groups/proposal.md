## Why

当前工作空间侧栏在标题、分组命名、空状态和创建入口上存在多处冗余信息，导致用户需要先理解“共享工作区 / input / working / NEW”这套内部术语，才能判断上传区和工程区分别负责什么。现在需要把侧栏改成更直接的 `upload` / `project` 心智模型，并收紧空状态展示，让分组结构更干净。

## What Changes

- 移除工作空间侧栏顶部的“共享工作区”标题行及其悬浮说明，只保留分组列表。
- 将用户可见的分组标签从 `input` 改为 `upload`，从 `working` 改为 `project`，但保留底层分组标识不变。
- 在 `upload` 和 `project` 分组名前增加文件夹图标，强化分组含义。
- 调整空状态展示：当 `upload` 或 `project` 没有内容时，仅保留分组名，不显示 `0` 计数，也不显示“暂无文件”文案。
- 将 `project` 分组右侧的顶层创建入口从 `NEW` 改为 `+`，并与文件夹行内新建入口复用同一套 `+` 视觉样式和菜单交互。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-web-workbench`: 调整工作空间侧栏的标题、分组命名、空状态和 `working` 创建入口的用户可见行为。

## Impact

- Affected specs: `openspec/specs/agent-web-workbench/spec.md`
- Affected frontend code: `apps/web/src/components/workbench/WorkspaceSidebar.vue`
- Affected store mapping: `apps/web/src/stores/workbenchStore.ts`
- Affected tests: `apps/web/src/components/workbench/WorkspaceSidebar.test.ts`
- No top-level directory changes
- No third-party dependency changes
