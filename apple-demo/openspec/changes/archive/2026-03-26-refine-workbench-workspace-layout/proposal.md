## Why

The current workbench layout still contains redundant workspace naming, misleading file-entry actions, and fixed-width pane behavior that degrades noticeably on low-resolution laptop screens. The result is a UI that looks more complex than it is, hides the real intent of the workspace area, and makes common editing flows harder than necessary.

## What Changes

- Refine the right-side workspace sidebar so the top-level tab remains `工作空间`, but repeated headings such as `工作区文件` and `小曼智能体工作区` are removed.
- Increase the usable width of the right-side workspace area on normal desktop and laptop layouts so the `工作空间` / `模板` tabs do not wrap in narrow-but-supported viewport widths.
- Replace the current misleading `增加文件` / `上传文件` framing with a unified `新增` entry model that represents both upload and file-creation actions.
- Introduce a governed create-file menu under the workspace entry point with explicit actions for `上传文件`, `新建 TXT`, `新建 MD`, and `新建 MML`.
- Remove the low-value `关闭工作区` action from the workspace editor shell.
- Add user-resizable pane behavior for the history rail, conversation pane, workspace editor pane, and right workspace sidebar so users can tune width allocation instead of relying only on fixed ratios and auto-collapse.
- Preserve the current conversation-first workbench shell while making low-resolution behavior prioritize editor usability before sacrificing the workspace sidebar.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-web-workbench`: change the workspace shell requirements to remove redundant workspace headings, support governed create-file entry points, and allow user-resizable pane widths in the authenticated workbench.

## Impact

- Affected frontend code in `apps/web`, especially `WorkbenchShell`, `WorkspaceSidebar`, `WorkspaceEditorPane`, conversation/file entry surfaces, and related layout tokens or drag state.
- Affected backend code in `apps/agent-backend` because the current file API supports upload/open/save but does not yet expose explicit create-empty-file behavior for TXT, MD, and MML workspace files.
- Affected workbench UX contract in `openspec/specs/agent-web-workbench/spec.md`.
