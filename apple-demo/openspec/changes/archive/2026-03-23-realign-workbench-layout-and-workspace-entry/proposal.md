## Why

The current Vue workbench has drifted away from the `index-v10.html` product structure. It treats the no-session state as a separate home stage, replaces the right-side workspace with low-value context cards, and lacks session preview and deletion behavior, which makes the main conversation flow and workspace entry model feel inconsistent and incomplete.

More importantly, the current shell and backend metadata model incorrectly treat the right-side workspace as a property of the current session. That causes the UI to show session titles in the workspace area and encourages a data shape where uploaded and generated files are attached to a session rather than to the user-facing working directory for the current agent.

The user has clarified the intended product rule:

- the workspace is not a session surface
- the workspace belongs to the current `user + agent` pair
- the history rail remains session-oriented
- the right-side workspace must show the contents of that agent-specific user working directory rather than conversation titles

This change is needed now because the team wants to stabilize the page structure and the workspace ownership model before adding richer editing behavior. If the product keeps building on a session-scoped workspace contract, later file, plan, and editing features will be implemented on the wrong domain boundary.

## What Changes

- Realign the default authenticated workbench shell to a persistent three-pane layout: history rail, conversation surface, and right-side workspace sidebar.
- Remove the separate hero-style home stage from the default entry flow and treat a new conversation as an empty conversation shell rather than a different page mode.
- Change new-session behavior so the UI returns to a blank conversation state and defers backend session creation until the first prompt is actually sent.
- Align history sessions with the `index-v10.html` interaction model: collapsed-by-default rail, hover expansion, searchable expanded list, one-line session preview, and per-session deletion with confirmation.
- Replace the current right-side context cards with a true workspace sidebar that keeps file and template entry points visible during normal conversation.
- Define the workspace as a `user + agent` scoped surface rather than a session-scoped surface, so the sidebar shows the current agent workspace for the authenticated user.
- Introduce a workspace-expanded state that appears only after the user opens a workspace file from the right-side workspace sidebar; the first implementation only needs a minimal workspace shell and placeholder content, not full editing.
- Extend backend session and workspace metadata surfaces as needed to support session previews, session deletion, and `user + agent` scoped workspace-entry data required by the updated shell.
- Isolate uploaded files, generated files, and workspace metadata by `user + agent` so the working directory model matches the intended product boundary.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-web-workbench`: change the base layout, session history behavior, new-session flow, workspace sidebar role, and workspace-entry state model so session history and agent workspace are separate concerns.
- `agent-backend-runtime`: expose the session and workspace metadata needed for session previews, deletion flow, and `user + agent` scoped workspace file entry surfaces consumed by the updated workbench.

## Impact

- Affected frontend code in `apps/web`, especially `WorkbenchShell`, `SessionRail`, workspace-related components, and the Pinia workbench store.
- Affected backend routes and data shaping in `apps/agent-backend`, especially session-list responses, workspace metadata routes, and file storage isolation used by the frontend.
- Existing `agent-web-workbench` expectations that describe a standalone home stage, a lightweight right-side context panel, or a session-owned workspace will be revised.
- Existing tests for workbench state transitions, session list rendering, workspace API clients, and file isolation behavior will need updates.
