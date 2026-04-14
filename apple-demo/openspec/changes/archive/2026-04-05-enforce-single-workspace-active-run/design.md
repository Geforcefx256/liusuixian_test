## Context

The current product model already treats the workbench workspace as shared by `user + agent`: uploads, generated outputs, and workspace editor files are reused across sessions for the same agent. However, run admission, frontend streaming state, and destructive history actions do not consistently follow that same boundary.

Today the backend serializes runs by `user + agent + session`, while the frontend keeps major runtime state as a single global workbench singleton. This mismatch creates the most visible failures when users switch sessions during an in-flight run: the shared workspace is still mutable, but the UI no longer has a trustworthy notion of which session owns the run, which session can stop it, and which actions must remain locked.

The product decisions for this change are now fixed:

- One shared `user + agent` workspace can have only one active execution owner at a time.
- Sessions remain separate conversation threads.
- Secondary sessions may edit drafts and create new draft sessions, but they cannot start runs while the workspace is occupied.
- An unresolved pending question continues to occupy the workspace.
- Page refresh, session switching, and transient disconnects must not cancel work.
- Destructive history actions remain locked until the workspace is no longer occupied.
- UI explanation stays lightweight: locked actions explain themselves through hover/focus help rather than persistent banners or toasts.

## Goals / Non-Goals

**Goals:**
- Align runtime admission control with the existing shared-workspace boundary.
- Make the backend authoritative for workspace occupancy so multiple tabs or concurrent requests cannot bypass the rule.
- Separate workspace-level occupancy from session-level conversation state in the frontend.
- Keep the current workbench layout largely intact while making run ownership and lock state understandable.
- Preserve current `user + agent` workspace sharing for files, uploads, outputs, and editor content.

**Non-Goals:**
- Introducing session-scoped workspaces or per-session copies of uploaded/generated files.
- Supporting parallel runs across sessions within the same shared workspace.
- Adding queueing semantics for blocked runs.
- Adding source-session labels to workspace files or artifacts in this change.
- Reworking the overall workbench information architecture or replacing the current shell layout.

## Decisions

### 1. Treat workspace occupancy as a `user + agent` runtime lock

The runtime will move from a session-scoped active-run lock to a workspace-scoped occupancy lock keyed by `userId + agentId`.

Rationale:
- The workspace is already shared at that scope.
- Preventing concurrent execution at the same scope is the minimum change that avoids conflicting workspace mutations.
- This matches the agreed product model without requiring a new workspace abstraction.

Alternatives considered:
- Keep the current session-scoped lock and rely on frontend guidance only: rejected because multi-tab and direct API requests bypass the UI.
- Make workspaces session-scoped: rejected because it is a broader product and data-model change than required here.
- Support true parallel session runs in one workspace: rejected because it would require deeper output attribution, workspace conflict handling, and a larger UI model.

### 2. Define workspace occupancy as both active run and unresolved pending-question ownership

The system will treat a workspace as occupied not only while a run is actively executing, but also while a run-owned pending question remains unresolved.

Rationale:
- Product semantics say other sessions cannot proceed until the owner session is answered or explicitly rejected.
- This keeps the admission rule stable from the user’s perspective: one workspace owner at a time.

Alternatives considered:
- Release the lock when a question is raised and allow other sessions to run: rejected because it breaks the agreed model and can interleave new workspace mutations before the owner flow is resolved.

### 3. Client disconnect must not cancel work; explicit stop remains the only cancellation path

The backend will stop treating stream disconnects as implicit cancellation. Active work continues until terminal completion or an explicit stop/cancel request.

Rationale:
- Refreshing or switching sessions does not mean the user wants to cancel the task.
- This is necessary for recovering lock state after reload and for making session switching safe.

Alternatives considered:
- Preserve current cancel-on-close behavior: rejected because it makes long-running work fragile and couples runtime semantics to transient transport events.

### 4. Expose recoverable workspace-occupancy metadata from the backend

The frontend needs a durable source of truth after reload or session switching. The preferred implementation is to extend existing runtime bootstrap data with workspace-occupancy metadata that identifies:

- whether the workspace is occupied
- the occupancy state (`running`, `stop-pending`, `awaiting-question`, etc.)
- the owning session id
- the active run id when one exists

Rationale:
- The bootstrap flow already initializes workbench runtime behavior.
- Reusing bootstrap avoids introducing a second mandatory lookup during shell initialization.

Alternatives considered:
- Dedicated active-run lookup endpoint only: acceptable fallback, but not preferred because it adds another required initialization dependency.
- Infer occupancy purely from session history: rejected because it is not authoritative for in-flight state or reconnect timing.

### 5. Split frontend state into workspace-level occupancy and session-level conversation slices

The frontend store will no longer use the current active panel as the implicit destination for streaming state. Instead:

- workspace-level state will hold occupancy, owner session, and shared lock conditions
- session-level state will hold messages, pending interaction data, transient errors, and per-session status text

Stream updates must always target the owning session slice, independent of which session is currently visible.

Rationale:
- This removes the current bug where switching sessions causes stream updates to land in the wrong panel or disappear from the owner session.
- It matches the product model: shared workspace, separate conversations.

Alternatives considered:
- Keep a single message buffer and patch around the active-session assumption: rejected because it keeps the core bug in place and would become brittle as more occupancy states are added.

### 6. Keep the UI correction lightweight and layout-stable

The workbench will keep its current overall layout. UI changes are limited to:

- history-rail running-owner indication
- locked send/delete/clear affordances
- hover/focus help for lock explanations
- renaming the workspace surface to `共享工作区`

Persistent warning banners, blocking modals, and unlock toasts are intentionally excluded.

Rationale:
- The problem is semantic consistency, not page structure.
- Users asked for explanations on hover/focus rather than always-visible instructional copy.

Alternatives considered:
- Add persistent blocking notices near every locked action: rejected because it adds noise and visual weight to a narrow behavioral correction.
- Use transient toast feedback for blocked sends or automatic unlock: rejected by product direction.

### 7. Destructive history operations must be blocked in both frontend and backend

Delete-session and bulk-clear-history actions will be rendered unavailable in the frontend and rejected with explicit conflicts by the backend whenever the workspace is occupied.

Rationale:
- Frontend-only disablement is insufficient under multi-tab or concurrent-request conditions.
- Backend rejection preserves data integrity for session state during active execution.

Alternatives considered:
- Allow delete after best-effort implicit cancel: rejected because it hides ordering risks and makes failure handling ambiguous.

## Risks / Trade-offs

- [Frontend state becomes more complex] → Keep the split narrow: workspace occupancy stays global, while only session-owned runtime slices move into per-session maps; add targeted store tests for switching, refresh recovery, and blocked actions.
- [Stale occupancy can strand the UI if terminal cleanup is missed] → Release occupancy only from authoritative terminal transitions and cover crash/reconnect paths with backend tests.
- [Bootstrap changes may temporarily mismatch old frontend assumptions] → Implement backend occupancy metadata and frontend consumption in the same change; avoid partial rollout without feature parity.
- [Users may wonder why they can type but not send] → Use clear locked-state styling and hover/focus help on the send affordance and destructive actions.
- [No queueing means blocked second runs must be retried manually] → Return explicit conflict responses and keep the UX language direct about the active owner session.

## Migration Plan

1. Add backend workspace-occupancy enforcement and explicit conflict semantics for run admission and destructive history actions.
2. Extend runtime bootstrap with occupancy metadata needed for reconnect and session-switch recovery.
3. Refactor frontend workbench state into workspace-level occupancy plus session-level conversation/runtime slices.
4. Update session rail, composer, and history-management UI to reflect locked shared-workspace behavior through hover/focus help.
5. Add regression coverage for session switching during active run, pending-question occupancy, refresh recovery, and conflict responses.

Rollback strategy:
- Revert the workspace-level occupancy enforcement and bootstrap metadata change as one backend unit.
- Revert the frontend state split and locked-action UI as one frontend unit.
- Do not partially roll back only one side, because the client and server semantics need to stay aligned.

## Open Questions

- None. Product decisions for workspace scope, cancellation semantics, queueing, draft behavior, and UI explanation style are settled for this change.
