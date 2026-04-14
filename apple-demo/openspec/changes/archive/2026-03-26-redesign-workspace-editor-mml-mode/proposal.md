## Why

The current workspace editor header mixes view switching, file type, MML metadata, save state, and primary actions into one responsive strip, so the editor collapses into multi-line chrome at laptop-class widths instead of preserving editing space for the document itself. At the same time, the UI presents MML as a file type rather than a parsing mode, which conflicts with the product model that any `txt` text can be configured and handled as MML.

This change is needed now to make the workbench editor usable in dense day-to-day correction flows: the header must stay stable on common screen sizes, users must be able to discover and configure MML handling without exposing implementation jargon, and surrounding panes must stop stealing width from the active document.

## What Changes

- Redesign the workspace editor header into a stable single-line primary toolbar that keeps only high-frequency controls: view switching, MML parsing entry, save state, and save action.
- Remove the `类型 MML` display and the `继续处理` action from the editor header.
- Replace always-visible MML metadata inputs with a summary-style `按 MML 解析` entry that exposes MML handling as a parsing mode for `txt` files rather than a file type.
- Add an expandable MML configuration area for `网元类型` and `网元版本`, using the existing MML save/model behavior instead of introducing a new persistence contract.
- Replace user-facing technical wording with task-oriented copy such as `未启用`, `待配置`, `暂不可用`, and `表格视图可用`.
- Rebalance the workspace-expanded shell so the editor gets priority width, the right workspace sidebar yields first under pressure, and the left session rail expands as an overlay instead of changing layout width on hover.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `agent-web-workbench`: change the workspace editor shell requirements so MML is presented as an optional parsing mode for `txt` files, the editor header remains width-stable, and workspace side panes yield without reflow-heavy hover behavior.

## Impact

- `apps/web/src/components/workbench/WorkspaceEditorPane.vue` header structure, MML entry UI, and user-facing state messaging.
- `apps/web/src/components/workbench/WorkbenchShell.vue`, `SessionRail.vue`, `WorkspaceSidebar.vue`, and shared layout tokens in `apps/web/src/styles.css`.
- Workbench store/editor integration for MML parsing-mode entry and existing MML metadata persistence behavior.
- Frontend component tests covering editor header states, MML mode flows, and workspace shell responsive behavior.
