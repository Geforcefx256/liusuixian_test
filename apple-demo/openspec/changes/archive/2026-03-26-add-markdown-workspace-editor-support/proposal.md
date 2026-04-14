## Why

当前工作区只对 `txt`、`csv` 和按 MML 解析的文本提供明确的上传与编辑路径，导致 Markdown 文档即使在产品流程中已经广泛存在，也无法以一致的工作区体验被上传、打开、预览和继续处理。现在需要把 Markdown 提升为一等文件类型，避免用户把方案、说明或检查结果被迫降级为普通文本处理。

## What Changes

- 扩展工作区文件支持范围，允许用户上传、打开、保存并继续处理 `.md` 文件。
- 为 Markdown 文件提供独立于普通文本和 MML 的工作区模式，使其不再复用 MML 解析入口或表格视图心智。
- 为 Markdown 文件增加文档化工作区体验，至少包含编辑视图和预览视图。
- 保持 Markdown 文件继续参与现有工作区 follow-up 流程，包括活动文件上下文和 artifact 打开路径。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-web-workbench`: 扩展工作区编辑壳支持 Markdown 文件类型、编辑/预览切换，并保持与当前文本文件一致的工作区主工具栏保存状态表达。
- `agent-backend-runtime`: 扩展工作区文件打开、保存和上传契约，使运行时能识别和返回 Markdown 文件模式。

## Impact

- Affected code:
  - `apps/web/src/components/workbench/*`
  - `apps/web/src/stores/workbenchStore.ts`
  - `apps/web/src/api/*`
  - `apps/agent-backend/src/routes/files.ts`
  - `apps/agent-backend/src/files/workspaceFileEditor.ts`
- API/contracts:
  - Workspace file mode contract will expand beyond `text | csv | mml` to include Markdown.
  - Upload allowlist will expand to accept `.md`.
- Dependencies:
  - Frontend will likely need a Markdown rendering path for preview mode and may require a dedicated rendering dependency and sanitization policy.
