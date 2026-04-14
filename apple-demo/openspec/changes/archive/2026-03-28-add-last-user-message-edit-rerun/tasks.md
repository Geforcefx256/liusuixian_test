## 1. Backend session rewrite contract

- [x] 1.1 Extend the run request and backend runtime types to carry optional edit context for replacing a persisted last-user message inside the same session.
- [x] 1.2 Add session-store logic that validates the target as the last real editable user message and truncates that message plus every later persisted session message.
- [x] 1.3 Clean up or recompute derived session state during truncation, including preview/message-count metadata, overlapping summaries, overlapping interactions, and latest surviving plan/session meta.
- [x] 1.4 Wire the edit-context flow into run execution so truncation happens before the replacement user message is appended and normal streaming rerun begins.

## 2. Frontend edit-rerun interaction

- [x] 2.1 Add workbench state that identifies the last editable persisted user message, tracks composer edit-rerun mode, and submits the rerun through the existing session run flow.
- [x] 2.2 Update conversation message rendering so the last editable user bubble shows a hover-only `编辑` action while non-terminal, running, and pending-interaction states remain non-editable.
- [x] 2.3 Reuse the bottom composer as the edit surface by prefilling the selected user text, exposing edit-rerun state, and changing submit behavior for destructive rerun confirmation.
- [x] 2.4 Add explicit destructive confirmation copy that warns about deleting the old user message and later conversation messages while leaving workspace files and tool side effects untouched.

## 3. Verification

- [x] 3.1 Add backend tests for valid same-session rewrite, rejection of non-terminal targets, rejection during pending interactions, and derived-state cleanup after truncation.
- [x] 3.2 Add frontend store/component tests for hover-only edit affordance, composer-prefill edit mode, destructive confirmation gating, and same-session history replacement after rerun.
- [x] 3.3 Run the relevant frontend and backend automated checks covering the new edit-rerun flow and confirm the OpenSpec change is apply-ready.
