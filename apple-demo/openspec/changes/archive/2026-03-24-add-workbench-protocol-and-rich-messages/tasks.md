## 1. Frontend Message Contract Upgrade

- [x] 1.1 Expand `apps/web` agent API types so session messages, stream events, and terminal run results preserve protocol payloads, plan-decision data, structured result payloads, and structured runtime failures from `apps/agent-backend`.
- [x] 1.2 Replace the current flat workbench `UiMessage` shape with a discriminated message model that can represent text, protocol, rich result, and structured error/status messages.
- [x] 1.3 Update workbench store message normalization so persisted session history and terminal run results keep structured data instead of flattening it into plain text.

## 2. Protocol Rendering And Plan Actions

- [x] 2.1 Add conversation-stream rendering components for the first protocol subset: `text`, `list`, and `actions`.
- [x] 2.2 Add frontend protocol action dispatch for planner decisions and wire it to session-scoped backend plan-decision APIs.
- [x] 2.3 Add protocol-state persistence wiring so interactive protocol messages can save and later recover backend-backed protocol UI state.
- [x] 2.4 Refresh visible session plan state after planner decisions so the workbench reflects the resulting `plan` or `build` mode accurately.

## 3. Rich Message First Batch

- [x] 3.1 Add conversation result-card rendering for structured row-preview results.
- [x] 3.2 Add conversation artifact-card rendering for artifact reference results.
- [x] 3.3 Add structured runtime failure presentation so failed runs render a richer error card than a generic status string alone.
- [x] 3.4 Add safe fallback rendering for unsupported structured message or protocol payloads so the conversation stream remains usable during partial support.

## 4. Validation

- [x] 4.1 Add frontend tests for protocol message mapping, protocol rendering, plan approval success, blocked approval, and revise flow.
- [x] 4.2 Add frontend tests for rich row-result, artifact-reference, and structured runtime-error rendering.
- [x] 4.3 Add backend tests where needed to verify plan-decision and protocol-state contracts exposed to the upgraded workbench remain stable.
