## Why

The current workbench frontend only supports a planner-focused protocol subset, while the migrated backend and question tool already emit broader protocol messages such as `form` and `question_response`. That mismatch leaves users blocked in real workflows and exposes fallback errors in places where the product should provide a complete interaction loop.

## What Changes

- Expand the workbench protocol renderer from the current planner subset to the broader `ref_code` protocol surface used by migrated runtime flows.
- Add interactive protocol runtime support in the frontend for `form`, `table`, `button-group`, richer `list` behaviors, and protocol text styles.
- Add general protocol action dispatch so the workbench can execute `question_response`, `plan_decision`, `redirect`, `cancel`, `delegate`, and governed tool-style protocol actions instead of hard-coding planner-only actions.
- Add protocol UI state snapshots, placeholder resolution, and reload recovery so interactive protocol messages can persist and restore form, table, and selection state.
- Complete the question-tool interaction loop by supporting form input, required validation, placeholder expansion, submit handling, and post-submit message-state convergence.
- Define explicit compatibility behavior for workbook-coupled protocol actions such as gateway invocation and row-modification flows so the workbench either supports them end-to-end or degrades intentionally.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `agent-web-workbench`: extend protocol rendering, interaction, and recovery behavior from the current planner subset toward the broader `ref_code` protocol surface.
- `agent-backend-runtime`: tighten runtime/frontend protocol-state and action contracts needed for richer protocol recovery and interactive message execution.

## Impact

- `apps/web` protocol rendering components, workbench store action routing, protocol-state persistence, message masking, and interaction tests.
- `apps/agent-backend` runtime/session message contracts and tests where richer protocol-state recovery or workbook-coupled tool actions require backend contract clarification.
- Main OpenSpec requirements for `agent-web-workbench` and `agent-backend-runtime`.
