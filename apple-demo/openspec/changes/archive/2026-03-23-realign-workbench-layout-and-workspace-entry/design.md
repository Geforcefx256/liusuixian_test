## Context

The current Vue workbench was intentionally scoped as a phase-1 shell with a separate home stage, a session stage, and a lightweight right-side context panel. That earlier reduction made the first delivery simpler, but it also moved the product away from the structure established by `index-v10.html`.

The current gaps are now clear:

- the authenticated default screen is treated as a separate home page instead of a conversation-first workbench shell
- the right side is implemented as low-value status cards instead of a persistent workspace sidebar
- the central workspace area is not modeled as its own state and therefore cannot be opened independently from normal conversation
- the history rail lacks preview text and deletion affordances
- the layout still reflects a page-level composition rather than a viewport shell with pane-owned scroll behavior
- the backend and frontend currently model workspace entries as session-owned data, which is the wrong product boundary

The user has clarified the intended interaction model:

- the default authenticated view is already the main workbench
- that base workbench always includes conversation and a visible workspace sidebar
- opening the workspace is a separate action triggered by double-clicking a file in the right-side workspace
- the first implementation of the workspace only needs the page structure and placeholder shell, not full editing behavior
- the workspace belongs to the current `user + agent` pair, not to the current session
- the history rail shows sessions, while the workspace sidebar shows the working directory content for the selected agent

This clarification changes the domain model as well as the layout model. The shell still needs the same three-pane structure, but the workspace data source must move from `sessionId` to a `userId + agentId` scoped workspace key.

This change is therefore a shell-and-state-model correction across both `apps/web` and the metadata surfaces exposed by `apps/agent-backend`.

## Goals / Non-Goals

**Goals:**

- Realign the authenticated default workbench to a conversation-first three-pane shell: history rail, conversation surface, and workspace sidebar.
- Remove the separate home-stage requirement from the default workbench flow.
- Define a distinct workspace-expanded state that appears only after the user opens a workspace file.
- Align the history rail with the `index-v10.html` behavior, including collapsed-by-default presentation, hover expansion, session preview text, and confirmed deletion.
- Preserve governed agent identity and starter-entry behavior inside the empty conversation shell rather than on a separate landing page.
- Introduce only the minimum `user + agent` scoped workspace-entry backend data needed to render the workspace sidebar and open a placeholder editor shell.
- Separate session persistence concerns from workspace ownership concerns.
- Require uploaded files, generated files, plans, and future workspace artifacts to live under a `user + agent` scoped workspace boundary.
- Eliminate page-level scrolling in favor of pane-owned scroll containers.

**Non-Goals:**

- This change does not deliver real file editing, table editing, text editing, save, or download flows.
- This change does not fully implement the template-library product behavior beyond the structural sidebar entry point.
- This change does not redesign skill governance, auth flows, or planner/build execution semantics.
- This change does not require full document-content APIs for the workspace editor in the first pass.

## Decisions

### 1. The workbench will use a conversation-first base shell instead of separate home and session stages

The frontend will no longer treat “no active session” as a separate full-page home stage. Instead, authenticated users will always enter the same base shell:

- left history rail
- central conversation surface
- right workspace sidebar

If the current conversation is empty, the conversation surface can still show governed starter affordances and empty-state guidance, but it remains the same shell rather than a different page mode.

This decision separates product structure from session persistence and removes the confusing coupling between “no active session” and “not yet in the workbench.”

Alternatives considered:

- Keep the separate home stage and only restyle it.
  - Rejected because the user explicitly wants the default page to already be the normal conversation layout.
- Auto-open the central workspace whenever a session exists.
  - Rejected because workspace opening is a distinct user action and should not be tied to session presence.

### 2. Session lifecycle will be modeled separately from workspace visibility

Two independent UI axes will be used:

- conversation session state: no persisted session yet vs persisted active session
- workspace visibility state: workspace closed vs workspace expanded

But that is no longer enough. There is a second separation that must be explicit in the data model:

- session ownership: history, title, preview, message persistence, plan decision flow
- workspace ownership: files, groups, directory labels, and reusable workspace artifacts for the current `user + agent`

`activeSessionId` is therefore not sufficient to drive the whole layout or the workspace data source. The frontend needs:

- session selection for the conversation history
- an additional workspace-open state keyed by the currently opened workspace file or tab set
- a workspace source keyed by the selected `agentId` and the authenticated user, independent of which session is currently selected

This prevents the central workspace from appearing during normal conversation and matches the intended behavior that only double-clicking a workspace file opens the editor shell.

Alternatives considered:

- Continue using `activeSessionId` as the single top-level stage switch.
  - Rejected because it forces unrelated UI concerns into one flag and recreates the current problem.
- Keep session state and workspace-open state separate, but still load the sidebar tree from the selected session.
  - Rejected because it still binds the workspace to the wrong product owner and causes the workspace to display conversation metadata such as session titles.

### 3. New-session actions will return to a blank conversation shell and defer backend session creation until first prompt

The “new conversation” action will clear the active persisted session selection and return the UI to an empty conversation shell. The frontend will only call backend session creation when the user sends the first prompt for that draft conversation.

This avoids creating empty sessions, matches the desired “new conversation” experience, and keeps the base shell visually stable.

Alternatives considered:

- Keep immediate backend session creation on every “new conversation” click.
  - Rejected because it creates empty sessions and prevents the UI from returning to the intended blank conversation state.

### 4. The history rail will mirror the `index-v10.html` collapsed/expanded interaction model

The left rail will have two presentation modes:

- collapsed by default, showing only the new-session control and session icons
- expanded on hover, showing search, preview text, timestamps, and delete controls

Deletion will remain a frontend-confirmed destructive action. The backend only needs to perform the delete; confirmation stays in the client interaction layer.

This restores the density and interaction model the user expects without forcing the workbench to permanently dedicate a wide left column.

Alternatives considered:

- Keep a permanently expanded history column.
  - Rejected because it does not match the intended product behavior and wastes horizontal space.

### 5. The right side will become a persistent workspace sidebar, not a status card panel

The current right-side panel will be replaced with a structural workspace sidebar that keeps file and template entry points visible during normal conversation. The sidebar remains visible by default in both the base shell and the workspace-expanded shell, but users may manually collapse it.

The sidebar is not a session summary. It is the visible entry point into the current `user + agent` workspace. Its tree, title, and grouping must therefore be derived from workspace metadata for the selected agent rather than from the active session title.

The sidebar is responsible for:

- showing workspace sections or file groups
- exposing upload entry points
- exposing template-library entry points
- providing file selection and file-opening actions

It is not responsible for summarizing agent model, tool count, or verbose status cards.

Alternatives considered:

- Keep the existing context cards and add file links beneath them.
  - Rejected because it keeps the wrong product metaphor and does not match the desired workspace entry model.

### 6. The first implementation of the central workspace will be a minimal shell, not a real editor

When a user opens a workspace file, the frontend will insert a central workspace area between the conversation surface and the right workspace sidebar. That central area will provide:

- open-file tabs
- a toolbar or control-row skeleton
- a clear active-file title and file-kind presentation
- placeholder content for the active file surface
- close-workspace or close-tab affordances

This is enough to validate the layout, state transitions, and panel-resizing behavior before committing to text or table editing APIs.

Alternatives considered:

- Delay the central workspace entirely until editing is ready.
  - Rejected because the shell itself is what needs validation now.
- Fully implement editing in the same change.
  - Rejected because it is a larger, separate capability wave.

### 7. Backend surfaces will be extended only for metadata that the new shell cannot fake reliably

The runtime already supports session deletion and file upload, but the frontend currently lacks:

- a session preview field suitable for the expanded history rail
- a stable workspace-entry metadata surface suitable for the right-side workspace sidebar and workspace-open action
- a `user + agent` scoped workspace contract that keeps file ownership independent from session ownership
- storage isolation rules that prevent different users or different agents from sharing the same physical workspace bucket by accident

This change will therefore add only the minimum backend metadata needed to render the shell correctly. It will not require full editing APIs in the first pass.

Alternatives considered:

- Fake preview text and workspace entries entirely on the frontend.
  - Rejected because history previews should survive reloads and reopened sessions, and workspace entry data should not be inferred from transient local client state.
- Keep a session-scoped workspace metadata API and try to reinterpret the returned title or tree labels in the client.
  - Rejected because the contract itself would still encode the wrong ownership model and would continue to leak session naming into the workspace surface.

### 8. Workspace storage and metadata will be isolated by `user + agent`

The runtime workspace for this product feature will be keyed by the authenticated user and the selected agent:

- workspace key: `userId + agentId`
- session key: `userId + agentId + sessionId`

The workspace key owns:

- uploaded files
- generated output files
- plans and future workspace documents
- workspace metadata such as file tree descriptors or stable file identifiers

The session key owns:

- message history
- session preview and title
- session-only derived state
- optional view-state references such as recently opened files or active plan references

This keeps the right-side workspace aligned with the actual working directory model while allowing sessions to reference workspace artifacts without owning them.

An acceptable first-pass runtime directory shape is:

```text
workspace/
└── users/
    └── {userId}/
        └── agents/
            └── {agentId}/
                ├── uploads/
                ├── outputs/
                ├── plans/
                └── workspace-meta.json
```

Alternatives considered:

- Keep a single global uploads or outputs directory for all users and agents.
  - Rejected because it breaks isolation and does not model the product workspace correctly.
- Key workspace by user only and share one workspace across all agents.
  - Rejected because the user explicitly wants workspaces to be independent per `user + agent`.

### 9. The viewport shell will own height, and each pane will own scrolling

The workbench root will be treated as a fixed-height viewport shell. Header height will be reserved once, and the remaining shell height will be distributed among panes using `min-height: 0` and pane-level overflow containers.

This removes the global page scrollbar and makes left, center, workspace editor, and right panes scroll independently.

Alternatives considered:

- Keep the current document-height layout and patch individual overflow bugs.
  - Rejected because the issue is structural, not isolated to one component.

## Risks / Trade-offs

- [This is larger than a styling-only cleanup] → Mitigation: keep the workspace-expanded implementation intentionally skeletal and postpone real editing.
- [Backend metadata design could overfit the prototype tree shape] → Mitigation: define only minimal session preview and workspace entry descriptors, not full editor documents.
- [Changing workspace ownership from session to `user + agent` affects multiple existing routes and store assumptions] → Mitigation: preserve session APIs for history and messages while introducing a separate workspace surface with a distinct contract.
- [Existing uploaded or generated artifacts may need migration] → Mitigation: treat this change as the point where ownership becomes explicit, and add migration or fallback loading only if existing persisted data must be preserved.
- [Lazy session creation changes existing store assumptions and tests] → Mitigation: update workbench-store tests to distinguish draft conversation state from persisted session state.
- [The absence of full editing may make the workspace feel incomplete] → Mitigation: explicitly frame this change as shell validation and keep the central workspace visually intentional rather than empty.
- [Starter-entry behavior may become ambiguous after removing the separate home stage] → Mitigation: anchor starter affordances inside the empty conversation shell and avoid a second page mode.

## Migration Plan

1. Update the `agent-web-workbench` spec to replace the separate home-stage/context-panel model with the conversation-first shell and `user + agent` scoped workspace-entry model.
2. Update the `agent-backend-runtime` spec to require session preview metadata plus `user + agent` scoped workspace metadata needed by the shell.
3. Refactor the frontend shell state so session persistence, workspace ownership, and workspace visibility are independent concerns.
4. Replace the current right-side context cards with the new workspace sidebar and add sidebar-collapse handling.
5. Add the history rail preview and deletion flows, including confirmation UI and refreshed list behavior.
6. Introduce the minimal workspace-expanded shell that opens only from workspace file interactions.
7. Move workspace file ownership and storage isolation from session metadata into the `user + agent` workspace contract.
8. Verify layout behavior for fixed viewport height, pane-owned scrolling, and workspace isolation before adding further workspace behavior.

Rollback strategy:

- The earlier shell can be restored by reverting the frontend shell/state changes and removing the new metadata usage.
- Backend preview and workspace metadata can remain additive if needed, because the older frontend can ignore those fields.

## Open Questions

- Should the template-library tab remain interactive in this change, or ship as a structural placeholder until the template workflow is revisited?
- What is the preferred source for the session preview string: latest user-visible message, latest assistant-visible message, or a runtime-maintained summary field?
- Should session state preserve any workspace view preferences, such as last opened file or active tab set, or should that remain purely client-side for now?
