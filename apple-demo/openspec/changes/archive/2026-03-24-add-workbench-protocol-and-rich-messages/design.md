## Context

The backend already produces most of the signals needed for a richer workbench conversation experience:

- Session message views can already return `kind: "protocol"` plus `protocolState`.
- Planner execution already persists plan protocol messages and emits `plan.snapshot` and `plan.awaiting_decision`.
- The runtime already exposes protocol-state update and plan-decision routes.
- Terminal run results can already distinguish protocol outputs, structured domain results, and runtime errors.

The current frontend does not preserve that structure. Its workbench store maps persisted messages to a flat `UiMessage` with only `text`, and the conversation surface renders every assistant message as a plain text bubble. Plan events are reduced to status strings, and terminal structured outputs are narrowed by frontend API types before they can reach the UI.

This change crosses both `apps/web` and `apps/agent-backend`, but it should remain tightly scoped to the message layer and plan-decision loop. The goal is not to reproduce the full `ref_code` assistant cockpit. The current conversation-first shell, session rail, and right-side workspace sidebar remain the primary product frame.

## Goals / Non-Goals

**Goals:**
- Preserve structured assistant message types in the frontend instead of flattening them into plain text.
- Render the first protocol subset needed by the current planner flow: `text`, `list`, and `actions`.
- Allow users to approve or revise plans directly from the relevant protocol message in the conversation stream.
- Persist protocol UI state for interactive messages through the existing backend route.
- Present the first batch of rich message surfaces for structured outputs and structured runtime failures.
- Keep the workbench conversation-first and avoid introducing a separate cockpit mode.

**Non-Goals:**
- Recreating the full `ref_code` AI sidebar, memory panel, or model-settings experience.
- Implementing the complete protocol component set from `ref_code`, such as editable tables, forms, or nested redirect flows.
- Building a dedicated dev-logs center or full execution-timeline UI in this change.
- Replacing the existing session rail, workspace sidebar, or workspace editor shell.

## Decisions

### Decision: Treat the conversation stream as the primary owner of protocol and plan interactions

The workbench SHALL render protocol messages and plan-decision actions in the central conversation stream rather than moving those interactions into a sidebar, modal, or top-level status panel.

Rationale:
- Plans are emitted and persisted as assistant messages, so the most faithful place to interact with them is the message stream itself.
- Conversation-local actions avoid ambiguity when a user revisits older sessions or multiple plan messages.
- The current shell already centers the conversation pane as the dominant workspace.

Alternatives considered:
- Put plan approval buttons in a right-side status panel: rejected because the action would lose its message context and create ambiguity about which plan is being approved.
- Introduce a dedicated planner page or overlay: rejected because it would break the current conversation-first workbench contract for a problem already modeled as message interaction.

### Decision: Upgrade the frontend message model to a discriminated union

The frontend SHALL replace the current text-only `UiMessage` shape with a discriminated union that can preserve at least text messages, protocol messages, rich result messages, and structured error/status messages.

Rationale:
- Protocol rendering, plan actions, and rich result cards all depend on message structure that cannot be represented safely with a single `text` field.
- A discriminated union keeps rendering logic explicit and reduces brittle string-based heuristics.
- This creates a stable extension point for future structured message types without reworking the entire store again.

Alternatives considered:
- Keep `UiMessage` flat and add optional fields ad hoc: rejected because that would spread conditional rendering logic across the conversation pane and make future message types harder to reason about.

### Decision: Support only the minimum protocol subset needed for the current planner flow

The first workbench protocol renderer SHALL support `text`, `list`, and `actions` components only.

Rationale:
- The current planner protocol already fits that subset.
- Delivering the planner loop first provides immediate user value with limited rendering complexity.
- It keeps the initial change bounded and testable.

Alternatives considered:
- Port the full `ref_code` protocol renderer immediately: rejected because it would introduce unnecessary complexity before the current product proves need for broader component coverage.

### Decision: Reuse backend protocol-state and plan-decision routes rather than inventing frontend-only plan state

The workbench SHALL call the existing backend routes for message protocol-state persistence and plan decision handling.

Rationale:
- The backend already owns the persisted session message state and session plan state.
- Reusing those routes keeps the frontend aligned with server truth when switching sessions or reopening history.
- This avoids introducing frontend-only planner state that would drift from the runtime.

Alternatives considered:
- Keep planner decision state entirely client-side until next run: rejected because session metadata and plan approval are already persisted backend concerns.

### Decision: Restrict first-batch rich message support to structured result cards and structured failures

The first rich-message release SHALL support:
- table-like previews for `rows_result` or equivalent structured row payloads
- artifact reference cards for loadable runtime artifacts
- structured runtime error presentation from terminal run failure metadata

Rationale:
- These outputs map directly to runtime data already produced today.
- They add practical value without requiring a full execution-observability surface.
- They are compatible with the existing conversation-first layout.

Alternatives considered:
- Add complete metrics, context-log, and execution-step visualizations now: rejected because the existing frontend API layer does not yet preserve the necessary event contract and this would expand the change too broadly.

## Risks / Trade-offs

- [Risk] The workbench store already owns broad session and workspace behavior, so adding protocol dispatch can make it harder to maintain. → Mitigation: keep message-shape normalization explicit and isolate protocol action handling behind focused helper paths or dedicated subcomponents.
- [Risk] Planner protocol and terminal result contracts may evolve faster than the first renderer subset. → Mitigation: support unknown or unsupported structured payloads with safe fallback rendering instead of failing the whole conversation view.
- [Risk] Frontend API types currently narrow backend results and events, which can hide unsupported cases during development. → Mitigation: update frontend contract types first and align tests to real backend payload shapes before polishing UI states.
- [Risk] Users may expect full `ref_code` parity once protocol cards appear. → Mitigation: document scope in proposal and tasks, and limit first release to planner protocol plus first-batch rich messages only.

## Migration Plan

1. Expand frontend API typings so run events, session messages, and terminal results preserve backend structure instead of flattening it.
2. Upgrade frontend message normalization and rendering to support protocol messages and rich result cards while preserving text-message behavior.
3. Add protocol action dispatch for planner decisions and protocol-state persistence.
4. Refresh session metadata after plan decisions so session rail and workbench status reflect the new plan state.
5. Add focused frontend and backend tests for protocol rendering, blocked approval, successful approval, revision, and rich-result/error presentation.
6. Rollback strategy: disable protocol/rich message rendering and revert to text-only mapping while leaving backend protocol support intact if UI regressions are discovered.

## Open Questions

- Should the first rich-result batch show table previews inline by default, or collapsed behind an explicit “查看结果” affordance for large outputs?
- Should artifact reference cards only display metadata in the first release, or also include a direct “加载结果” action when the referenced artifact is fetchable from the current frontend shell?
- Should unsupported protocol component types render a generic fallback card in the conversation stream, or remain as plain raw text until explicit support is added?
