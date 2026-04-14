## 1. Backend Metadata Contracts

- [x] 1.1 Extend the session-list response to include a preview string suitable for the expanded history rail.
- [x] 1.2 Verify and, if needed, refine session-deletion route behavior so deleting a session removes its persisted messages and related session-only derived state.
- [x] 1.3 Replace the session-scoped workspace metadata surface with a `user + agent` scoped workspace surface that returns workspace groups and file-entry identifiers for the right-side workspace sidebar.
- [x] 1.4 Ensure uploaded files and generated files can be recovered as reusable workspace entries across sessions for the same `user + agent` workspace.
- [x] 1.5 Isolate runtime workspace storage, file maps, and artifact metadata by `user + agent` rather than using a global workspace bucket.

## 2. Frontend Shell State Model

- [x] 2.1 Refactor the workbench store so draft conversation state, persisted active session state, `user + agent` workspace state, and workspace-open state are modeled independently.
- [x] 2.2 Change the new-conversation action to return to a blank conversation shell without immediately creating a backend session.
- [x] 2.3 Update first-prompt submission flow so the frontend creates the backend session lazily before starting the streamed run.
- [x] 2.4 Convert the top-level workbench layout to a fixed-height viewport shell with pane-owned scrolling instead of page-level scrolling.
- [x] 2.5 Make the right-side workspace title, tree, and open-file source derive from the active agent workspace rather than the selected session title.

## 3. History Rail Experience

- [x] 3.1 Rebuild the left history rail to support collapsed-by-default presentation and hover-based expansion aligned with `index-v10.html`.
- [x] 3.2 Render searchable expanded session entries with title, updated time, and one-line preview text.
- [x] 3.3 Add per-session delete controls in the expanded rail with explicit confirmation before the backend delete call.
- [x] 3.4 Handle deletion edge cases, including clearing the active session or draft state when the deleted session is currently selected.

## 4. Workspace Sidebar And Expanded Shell

- [x] 4.1 Replace the current right-side context-card panel with a persistent workspace sidebar that shows workspace and template entry surfaces.
- [x] 4.2 Wire upload actions and workspace metadata into the workspace sidebar so file entries can be selected and reopened from the active `user + agent` workspace rather than from persisted session data.
- [x] 4.3 Add double-click workspace-file behavior that opens the workspace-expanded shell without hiding the conversation surface.
- [x] 4.4 Build the minimum viable central workspace shell with file tabs, a toolbar skeleton, placeholder active-file content, and close-workspace behavior.
- [x] 4.5 Add manual collapse and re-expand behavior for the right-side workspace sidebar while keeping the active workspace file open.
- [x] 4.6 Ensure the workspace sidebar never renders a session title as the workspace heading or root node label.

## 5. Empty Conversation And Identity Surfaces

- [x] 5.1 Move governed starter affordances from the separate home-stage implementation into the empty conversation shell.
- [x] 5.2 Preserve consistent agent identity treatment across blank conversation, persisted conversation, and workspace-expanded states.
- [x] 5.3 Remove low-value model and status summary cards that no longer belong in the right-side workspace surface.

## 6. Verification

- [x] 6.1 Update frontend store and component tests for lazy session creation, history preview rendering, deletion flow, `user + agent` workspace loading, and workspace-open state transitions.
- [x] 6.2 Add or update backend tests for session preview metadata, session deletion, `user + agent` workspace metadata responses, and file-storage isolation behavior.
- [x] 6.3 Run the relevant frontend and backend test suites and verify the workbench shell behavior manually against the approved interaction model.
