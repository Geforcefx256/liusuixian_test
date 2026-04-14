## Why

当前工作区已经支持 Markdown 文件的编辑和预览切换，但打开文件时默认停在文本编辑视图。对以阅读、校对、确认结构为主的 Markdown 场景，这与用户预期相反，也让“打开文件”后的第一眼体验偏离文档消费心智。

## What Changes

- 调整工作区 Markdown 文件的默认展示策略，使其在成为当前激活文件时默认进入预览视图。
- 保留现有“编辑 / 预览”双视图切换能力，允许用户随时切回编辑。
- 不引入按文件记忆上次视图的状态持久化；每次重新打开或重新激活 Markdown 文件时，仍按默认预览策略进入。
- 保持非 Markdown 文件的当前默认行为不变，包括普通文本、CSV 和 MML 文件。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-web-workbench`: 调整 Markdown 工作区文件的打开默认视图要求，使其在激活时默认展示预览，同时保留现有编辑入口与标准工作台壳层。

## Impact

- Affected code:
  - `apps/web/src/components/workbench/WorkspaceEditorPane.vue`
  - `apps/web/src/components/workbench/WorkspaceEditorPane.test.ts`
- APIs/contracts:
  - No backend API or workspace file contract changes.
- Dependencies:
  - No new dependencies expected.
