## Context

The current workbench protocol implementation was intentionally scoped to a planner-first subset: `text`, `list`, `actions`, and `plan_decision`. That was sufficient for the first protocol release, but the migrated runtime and `local:question` tool now emit broader `ref_code`-style protocol messages that include `form`, `question_response`, richer action types, and workbook-coupled tool actions.

The gap is no longer theoretical. Users now hit fallback states in normal workflows because the backend emits protocol shapes that the frontend stores structurally but cannot execute interactively. The missing pieces are not limited to rendering. The workbench also lacks protocol runtime infrastructure such as action dispatch, placeholder resolution, runtime state capture, and restored message snapshots.

This change remains conversation-first. It does not attempt to recreate the whole `ref_code` cockpit, but it does aim to make the workbench protocol runtime broad enough that migrated protocol flows can execute end-to-end inside the existing shell.

## Goals / Non-Goals

**Goals:**
- Expand the protocol renderer to support the broader `ref_code` component surface used by migrated runtime flows.
- Add a reusable protocol runtime in `apps/web` that can capture UI state, build action context, resolve placeholders, and dispatch multiple protocol action types.
- Complete the `question_response` interaction loop so `local:question` messages are usable in the workbench.
- Preserve and recover interactive protocol state across reloads, including message-shape convergence after submission or redirect.
- Define how workbook-coupled protocol actions behave in the workbench so they either execute end-to-end or degrade with explicit governed feedback rather than generic unsupported errors.

**Non-Goals:**
- Recreating unrelated `ref_code` surfaces such as memory panels, model settings, dev-log centers, or a separate assistant cockpit shell.
- Changing the backend question-tool protocol format away from its current `form + question_response + placeholder` contract.
- Replacing the conversation-first workbench shell with a protocol-first standalone page.

## Decisions

### Decision: Add a dedicated protocol runtime layer rather than extending the current planner-only card ad hoc

The workbench SHALL add a protocol runtime layer that owns:
- component rendering metadata
- runtime UI state snapshots
- action runtime context assembly
- placeholder resolution
- action dispatch and post-action message convergence

Rationale:
- `form`, `table`, redirects, and delegated/tool actions all need shared state and action plumbing.
- Keeping this logic in a reusable runtime avoids spreading protocol-specific branching across `ConversationPane` and `workbenchStore`.
- This aligns the workbench more closely with the `ref_code` architecture without copying the whole product shell.

Alternatives considered:
- Continue patching the current `ProtocolMessageCard` with one-off cases: rejected because `question_response` already shows the need for shared runtime state and placeholder resolution.

### Decision: Treat `protocolState` as structured UI state, not just a note bucket

The workbench SHALL treat protocol state as an opaque but structured UI snapshot that may contain:
- `form`
- `listSelection`
- `table`
- `message`
- lightweight metadata such as `lastActionId`, `actionStatus`, and notices

Rationale:
- Reload recovery for interactive messages requires more than a status note.
- The frontend must be able to persist a converged message snapshot after actions like question submit, redirect, or plan approval.
- The backend route already accepts arbitrary JSON protocol state, so the frontend can adopt richer structure without inventing a new API.

Alternatives considered:
- Persist only local transient form state in memory: rejected because it breaks session reload and multi-turn continuity.

### Decision: Support the `ref_code` protocol component surface in the workbench, but keep unsupported workbook dependencies explicit

The renderer SHALL support:
- `text`
- `list`
- `form`
- `table`
- `button-group`

The action system SHALL support:
- `submit`
- `cancel`
- `tool`
- `redirect`
- `delegate`

Workbook-coupled actions such as `gateway_tools_invoke` and `modify_mml_rows` SHALL either:
- execute through the workbench runtime when the required workbook/runtime context is available, or
- surface an explicit governed notice that the current workbench state cannot execute that action yet

Rationale:
- The goal is broad protocol compatibility, but some actions depend on workbook selection, approval, or insertion overlays.
- Explicit compatibility handling is better than generic “unsupported action” failures because it distinguishes “not implemented” from “missing current context”.

Alternatives considered:
- Promise full `ref_code` parity for every protocol action in one pass: rejected because the workbench shell and workbook runtime are not identical.

### Decision: Reuse the existing run pipeline for question answers instead of inventing a dedicated backend route

The `question_response` path SHALL submit `{ questionId, answer }` as a normal backend input on the active session, while suppressing raw user-bubble noise in the frontend.

Rationale:
- The backend already expects question answers through the normal conversation loop.
- Avoiding a dedicated route keeps session history and model flow consistent with existing runtime semantics.
- This matches the reference pattern closely and minimizes backend API expansion.

Alternatives considered:
- Add a dedicated answer-question route: rejected because it duplicates conversation semantics already owned by the runtime.

### Decision: Restore interactive messages from `protocolState.message` when present

When persisted protocol state contains a message snapshot override, the workbench SHALL render that snapshot in preference to the original persisted protocol payload.

Rationale:
- Question submissions, redirects, and some plan actions mutate the visible message shape after interaction.
- Recovering only the original payload would resurrect stale buttons and stale components after reload.

Alternatives considered:
- Reconstruct interactive message state from raw protocol plus local heuristics: rejected because the converged state is already known and should be persisted directly.

## Risks / Trade-offs

- [Risk] Protocol runtime scope can balloon into refactoring the whole conversation stack. → Mitigation: isolate protocol runtime helpers and keep ordinary text/result message behavior unchanged.
- [Risk] Workbook-coupled tool actions may expose missing dependencies in the current shell. → Mitigation: define explicit compatibility checks and governed notices instead of silently failing or pretending success.
- [Risk] Persisting richer protocol state may preserve malformed snapshots from buggy clients. → Mitigation: keep backend validation permissive but add frontend guards when reading message overrides.
- [Risk] Masking raw question-response payloads could hide debugging detail. → Mitigation: keep the raw data in session history while only changing user-facing rendering in the workbench.

## Migration Plan

1. Introduce shared protocol runtime helpers for state snapshots, action context, and placeholder resolution.
2. Expand protocol rendering in the workbench to support additional component types without regressing existing planner cards.
3. Add generalized action dispatch and complete the question-response flow.
4. Add persisted message override recovery and post-action convergence for protocol messages.
5. Add workbook-coupled action compatibility handling and the required tests.
6. Rollback strategy: disable the new protocol runtime paths and fall back to the current planner-only subset while keeping structured message preservation intact.

## Open Questions

- Should `delegate` actions execute immediately in the workbench when the current shell cannot visualize subagent progress, or should they first land as governed notices until a clearer session UX is added?
- For editable `table` protocol components, should the first workbench release treat them purely as protocol-local state, or synchronize them with workspace/open-file state when a workbook-backed action depends on them?
