## Context

The current workbench persists conversations as linear sessions and reuses the same `sessionId` across follow-up turns. Frontend message history is derived from persisted session messages, while backend execution appends a new user message and then one or more assistant messages for each turn. The runtime also stores derived session state outside the message table, including summaries, plans, protocol state, and interactions.

This change must preserve the existing conversation-first shell and the existing streaming run pipeline while introducing a safe way to correct the last real user prompt. It must also respect an important product constraint already surfaced during exploration: workspace files and tool side effects are scoped to `user + agent`, not to a session turn, so a same-session rerun cannot pretend to roll them back.

## Goals / Non-Goals

**Goals:**
- Allow users to edit only the last real user message in the active persisted session.
- Reuse the bottom composer as the edit surface instead of creating a second inline editing system in the message list.
- Keep the rerun inside the same session so history rail selection, session identity, and follow-up continuity remain stable.
- Make the destructive nature of the operation explicit by confirming that the old user message and all later session messages will be removed before rerun.
- Prevent stale derived session state from surviving after the old tail is discarded.

**Non-Goals:**
- Editing any user message other than the last real user message.
- Editing assistant messages.
- Turning the user bubble itself into an inline textarea editor.
- Rolling back workspace files, output artifacts, or external/tool side effects.
- Renaming the session title automatically after the edited rerun.
- Adding a mobile-specific gesture in this change; the first version is pointer-hover driven.

## Decisions

### Decision: Use composer-prefill edit mode rather than inline bubble editing

The frontend SHALL treat edit initiation as a mode switch for the existing composer. Hovering the last editable user bubble reveals `编辑`; clicking it copies that bubble text into the bottom composer, marks the composer as editing the selected persisted message, and changes the submit affordance into a destructive rerun action.

Rationale:
- The composer already owns text input, disabled state, focus management, and submit wiring.
- Inline bubble editing would introduce a second textarea lifecycle, duplicate validation behavior, and more complex scroll/focus handling.
- Composer-prefill makes the destructive rerun state easier to explain because the confirmation can happen at the existing submit point.

Alternatives considered:
- Inline bubble editing: rejected because it adds more UI state and implementation paths for little first-version value.
- Opening a modal editor: rejected because it breaks the conversation-local feel and complicates keyboard flow.

### Decision: Extend the existing run contract with optional edit context

The frontend SHALL submit edited reruns through the existing run flow using an optional run request field that identifies the persisted last-user message being replaced. The backend SHALL validate and truncate the session tail inside the same execution path before appending the new user input and continuing normal streaming execution.

Rationale:
- A single run request keeps validation, truncation, rerun, and streaming within one backend transaction boundary from the client’s perspective.
- A separate “truncate session tail” API would introduce an avoidable failure window where the old tail is deleted but the rerun never starts.
- Reusing the run pipeline minimizes frontend orchestration changes and preserves existing telemetry and run lifecycle events.

Alternatives considered:
- Separate truncate endpoint followed by a normal run call: rejected because it creates an unnecessary split-brain failure mode.
- Direct in-place mutation of the old user message row: rejected because the current runtime model is append-oriented and would still need tail cleanup for all dependent assistant output.

### Decision: Define editable target as the last real persisted user message

Both frontend and backend SHALL treat the editable target as the last persisted user-authored session message that is visible as a normal user bubble, excluding synthetic replay artifacts such as hidden question-response JSON submissions. The frontend SHALL only surface edit affordance for that one message, and the backend SHALL reject edit-context reruns that do not address that exact terminal editable message.

Rationale:
- The UI requirement is intentionally narrow and must stay aligned with backend validation.
- Hidden synthetic continuation messages already exist in persisted history and cannot be treated as normal editable prompts.
- Backend validation is required even if the frontend hides the affordance, because stale clients or crafted requests must not rewrite arbitrary history.

Alternatives considered:
- Validating only “last persisted user row”: rejected because hidden question-response replay messages would make the visible target inconsistent.
- Trusting only frontend gating: rejected because destructive session history mutation must remain server-authoritative.

### Decision: Truncate the old tail and overlapping derived session state before rerun

When the backend accepts an edit-context rerun, it SHALL delete the addressed user message and every later persisted session message in that session before appending the replacement user message. It SHALL also clear or recompute any derived session state that becomes stale because of that deletion, including:
- session preview and message count
- summaries whose covered range overlaps the deleted tail
- interactions created for the deleted tail
- plan records created from the deleted tail, while preserving older plan records that predate the truncation cutoff
- session meta fields that depend on the latest surviving plan state

The backend SHALL leave `user + agent` workspace files and side effects untouched.

Rationale:
- Once the last user message changes, every later assistant output becomes semantically invalid.
- Derived session state is stored outside the message rows, so deleting messages alone would leave stale summaries, plans, or interaction records behind.
- Preserving workspace files matches the existing storage boundary and avoids pretending the system can reverse external effects that it cannot safely undo.

Alternatives considered:
- Deleting only assistant messages after the edited user message: rejected because the old user message itself is being replaced.
- Clearing all plan state unconditionally: rejected because plans that predate the truncation cutoff may still be valid and should survive.

### Decision: Require explicit destructive confirmation with side-effect warning

Submitting an edited rerun SHALL require explicit confirmation that states three facts: the old last user message will be replaced, all later conversation messages will be removed, and previously written workspace files or tool side effects will not be reverted.

Rationale:
- The operation is destructive from a conversation-history perspective.
- Users are likely to assume “edit and rerun” behaves like a full session rollback unless the product says otherwise.
- The repository’s debug-first rule favors explicit exposure over silent behavior.

Alternatives considered:
- Non-blocking toast or passive helper text only: rejected because it is too easy to miss for a destructive operation.

## Risks / Trade-offs

- [Risk] Upstream model failure after truncation can leave the session with the replacement user message but without a fresh successful assistant continuation. → Mitigation: keep confirmation explicit, reuse existing run failure surfaces, and keep the session history internally consistent rather than preserving obsolete output.
- [Risk] Hidden synthetic user messages make “last editable message” detection easy to get wrong. → Mitigation: centralize eligibility rules and reuse the same replay-artifact exclusion logic in frontend selection and backend validation.
- [Risk] Users may still expect generated files to disappear after rerun. → Mitigation: include the non-reverted-side-effects warning in the destructive confirmation copy.
- [Risk] Truncating derived session state without a careful cutoff can leave stale plan or summary metadata visible. → Mitigation: make truncation stateful at the session-store layer so message deletion and derived-state cleanup happen together from a shared cutoff.

## Migration Plan

1. Extend the run request contract with an optional edit-context field in frontend and backend types.
2. Add a session-store mutation that validates the target last user message and truncates the obsolete tail plus overlapping derived state.
3. Teach the run execution path to invoke that truncation before normal rerun processing when edit context is present.
4. Add frontend edit-mode state, hover affordance, composer-prefill behavior, and destructive confirmation.
5. Verify behavior with frontend store/component tests and backend session-store/runtime tests.

This change does not require a schema migration if the existing tables are reused for truncation and cleanup.

## Open Questions

- None for the first desktop-focused version.
