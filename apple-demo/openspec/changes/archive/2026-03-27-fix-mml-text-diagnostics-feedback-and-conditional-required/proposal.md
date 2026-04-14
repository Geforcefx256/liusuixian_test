## Why

The MML text editor currently produces a misleading failure shape: conditionally required parameters can be flagged as missing even when their trigger conditions are not active, and the resulting Monaco diagnostics are only visible as wave-underlines with no stable summary surface. This makes valid files appear broken and forces users to guess whether the problem is real, advisory, or a schema bug.

## What Changes

- Correct the MML schema and frontend validation path so conditionally required parameters are only diagnosed when their declared trigger conditions match the active statement.
- Keep Monaco marker-based diagnostics in text view, but make them discoverable through explicit hover content and a workspace-level diagnostic summary with an expandable list.
- Preserve advisory diagnostics semantics so text mode remains saveable and text-first, while making active warnings and errors understandable without relying on Monaco-only affordances.
- Add focused coverage for conditional-required rule handling and for the new text-view diagnostic summary behavior.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-web-workbench`: MML text-view diagnostics must avoid conditional-required false positives and must surface discoverable diagnostic feedback beyond marker underlines alone.
- `agent-backend-runtime`: the internal MML schema contract must preserve the distinction between unconditional required parameters and conditionally required parameters so frontend validation can evaluate rule triggers correctly.

## Impact

- Affected frontend code in `apps/web/src/components/workbench`, especially `WorkspaceTextEditor.vue`, `WorkspaceEditorPane.vue`, and shared MML semantic helpers.
- Affected backend/runtime schema import and contract code in `apps/agent-backend/src/mmlRules` and `apps/agent-backend/src/files/mmlSchema.ts`.
- Affected OpenSpec requirements in `openspec/specs/agent-web-workbench/spec.md` and `openspec/specs/agent-backend-runtime/spec.md`.
- Test coverage updates across frontend diagnostic tests and runtime/schema normalization tests.
