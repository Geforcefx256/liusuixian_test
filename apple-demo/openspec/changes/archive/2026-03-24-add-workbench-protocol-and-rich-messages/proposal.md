## Why

The current workbench frontend already receives protocol messages, planner events, and richer runtime result signals from the backend, but it collapses almost all of them into plain text bubbles and status strings. That leaves users unable to complete plan approval flows in the UI and prevents the workbench from presenting structured results in a governed, understandable way.

## What Changes

- Upgrade the workbench message model so frontend conversation state can preserve structured protocol messages, rich results, and structured error/status payloads instead of flattening everything into plain text.
- Add protocol-message rendering to the conversation surface for the first supported subset of protocol components: `text`, `list`, and `actions`.
- Add protocol action handling in the workbench so users can execute planner decisions from the conversation surface and persist protocol UI state for interactive messages.
- Complete the plan confirmation and revision loop in the workbench by wiring planner protocol actions to the existing backend plan-decision APIs and reflecting updated session plan state in the UI.
- Add the first batch of rich message presentation for structured runtime outputs, specifically table-like result previews, artifact references, and structured runtime error feedback.
- Keep the current conversation-first shell, session rail, and workspace sidebar model rather than introducing a separate assistant sidebar, memory panel, model-settings panel, or full ref_code cockpit in this change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-web-workbench`: Extend the authenticated workbench contract so the conversation surface can render interactive protocol messages, support plan approval and revision from the message stream, and present the first batch of rich structured results.
- `agent-backend-runtime`: Extend the runtime/frontend contract so session message APIs, plan-decision routes, and terminal run results provide the structured protocol and rich-result metadata required by the upgraded workbench.

## Impact

- Frontend message types, run-stream event types, and session-message mapping in `apps/web`.
- Workbench conversation rendering, protocol action dispatch, and plan-state refresh behavior in `apps/web`.
- Agent runtime API contract exposure for plan decisions, protocol-state persistence, and structured terminal outputs in `apps/agent-backend`.
- Frontend and backend tests covering protocol message rendering, planner decision loops, and rich-message presentation.
