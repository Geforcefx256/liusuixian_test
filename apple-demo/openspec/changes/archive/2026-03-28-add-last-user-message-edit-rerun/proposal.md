## Why

The workbench currently treats a persisted conversation as append-only, which forces users to start over manually when they notice the last user prompt was wrong or incomplete. This needs to change now because the product already encourages iterative agent work, but the lack of a controlled "edit and rerun" path makes simple prompt correction unnecessarily expensive and error-prone.

## What Changes

- Add a workbench affordance that allows users to edit only the last real user message in the active persisted session.
- Show the `编辑` entry only when the pointer hovers that last editable user bubble, and hide it for all other messages, during active runs, and while the session is blocked on a pending interaction.
- Reuse the bottom composer as the editing surface by prefilling it with the last user message instead of turning the bubble itself into an inline editor.
- Change edit submission into an explicit destructive rerun flow that asks for confirmation before deleting the old last user message and all later session messages, then reruns the session from the edited input inside the same session.
- Warn users clearly that this flow only rewrites conversation history and does not roll back workspace files or prior tool side effects.
- Extend backend session APIs so the frontend can validate the last editable user message, truncate the session tail safely, and return the updated session state needed for immediate rerun.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-web-workbench`: change conversation interaction requirements so the workbench can expose hover-only editing for the last real user message, reuse the composer as an edit surface, require destructive confirmation, and surface the non-reverted-side-effects warning.
- `agent-backend-runtime`: change session-history mutation requirements so the runtime can validate, truncate, and rewrite the tail of an existing session for a same-session rerun without silently preserving obsolete assistant history.

## Impact

- Affected frontend workbench message rendering, composer state management, and session action handling in `apps/web`.
- Affected backend session storage, session message APIs, and rerun orchestration in `apps/agent-backend`.
- Affected tests for conversation rendering, session mutation behavior, and rerun safety semantics.
