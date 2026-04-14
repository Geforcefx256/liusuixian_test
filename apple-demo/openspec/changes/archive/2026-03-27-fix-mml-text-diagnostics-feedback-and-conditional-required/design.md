## Context

The current MML text-view assistance path spans the backend Excel-backed rule importer, the normalized MML schema contract, shared frontend statement parsing helpers, and the Monaco-backed text editor shell. That path already supports completion, hover help, and diagnostics, but investigation showed two concrete gaps:

- Conditional-required Excel rules are imported into schema metadata with `required: true`, which makes frontend validation treat them as unconditional missing-parameter failures before condition evaluation runs.
- Monaco diagnostics are rendered only as markers inside the editor surface. Users can see wave-underlines, but they do not get a stable file-level diagnostic summary or a dedicated place to inspect all active issues.

This change is cross-cutting because it touches backend rule normalization, frontend semantic validation, and workbench interaction design in one user flow.

## Goals / Non-Goals

**Goals:**
- Preserve the distinction between unconditional required parameters and conditionally required parameters in the runtime schema contract.
- Ensure text-view diagnostics only report missing conditional parameters when the active statement satisfies the declared trigger condition.
- Make text-view diagnostics discoverable through hover content plus a workbench-level summary and expandable list.
- Keep diagnostics advisory and compatible with the current text-first editing model.

**Non-Goals:**
- Turning Monaco diagnostics into hard validation that blocks saves or forces table-view usage.
- Replacing Monaco markers with a custom inline rendering system.
- Expanding this change into broader IP-format validation, lint severities policy, or generalized IDE-style problem panes for every file type.

## Decisions

### Decision: Keep `required` reserved for unconditional requiredness

The runtime schema contract will treat `required: true` as meaning unconditional requiredness only. Conditional requiredness will continue to live in `requiredMode` plus `conditions`, without collapsing those parameters into the unconditional bucket.

Rationale:
- Frontend validation already has separate logic for `conditional_required`; it fails today because the unconditional check runs first.
- Keeping `required` narrow preserves a clean contract for all schema consumers.
- This removes false positives without requiring frontend-only special cases that work around malformed metadata.

Alternatives considered:
- Keep the current import shape and patch only frontend validation.
- Remove `required` entirely and force all consumers to read only `requiredMode`.

Why not:
- Frontend-only patches would leave the runtime contract internally inconsistent and easy to misuse in future consumers.
- Removing `required` would widen the change unnecessarily and create churn outside this bug.

### Decision: Merge schema help and diagnostic feedback in Monaco hover

When a hovered text range has an active diagnostic, the hover surface should lead with diagnostic content and then include schema guidance when relevant, rather than showing schema help alone.

Rationale:
- Users already expect hovering a wave-underline to explain the underline.
- Reusing Monaco hover keeps the interaction local to the marked text.
- Combining the two surfaces avoids conflicting hover systems.

Alternatives considered:
- Keep hover schema-only and rely solely on a bottom panel for diagnostics.
- Add toast notifications instead of hover explanation.

Why not:
- Schema-only hover leaves the most direct diagnostic affordance unexplained.
- Toasts are transient and poorly matched to persistent advisory diagnostics.

### Decision: Surface file-level diagnostics through a collapsed-by-default summary and expandable list

The workbench shell will show a diagnostic summary in the existing status-bar region for MML text view when active diagnostics exist. Activating that summary will expand a dedicated diagnostic list below the status bar, with each entry jumping back to the relevant statement range in Monaco.

Rationale:
- The status bar already exists in `WorkspaceEditorPane` and is the least disruptive place to advertise file-level state.
- A collapsed-by-default pattern keeps the editor focused while still making diagnostics discoverable.
- The expandable list supports multi-diagnostic triage without forcing users to hunt through the text manually.

Alternatives considered:
- Always show a persistent error strip or panel.
- Keep diagnostics entirely inside `WorkspaceTextEditor`.

Why not:
- A permanently expanded panel would consume vertical space even for transient warnings.
- Keeping the entire UI inside the editor component would hide file-level state from the workbench shell and complicate layout coordination.

### Decision: Emit normalized diagnostics from `WorkspaceTextEditor` to the shell

`WorkspaceTextEditor` will remain the source of Monaco marker computation, but it will also emit normalized diagnostic metadata so `WorkspaceEditorPane` can render the summary and expandable list without recomputing editor-local state.

Rationale:
- The editor already knows the active model, marker ranges, and refresh timing.
- The shell already owns the status bar and surrounding layout.
- A one-way event boundary avoids duplicating validation logic across components.

Alternatives considered:
- Recompute diagnostics in `WorkspaceEditorPane`.
- Let `WorkspaceTextEditor` render the full summary and list internally.

Why not:
- Recomputing in the shell duplicates logic and risks drift from actual marker state.
- Rendering shell-owned UI from the child component blurs responsibilities and complicates tests.

## Risks / Trade-offs

- [Risk] Existing consumers may already assume `required: true` can include conditional requirements. → Mitigation: update the runtime spec and focused tests so the narrower contract is explicit and enforced.
- [Risk] Hover content could become noisy when both schema help and diagnostics exist. → Mitigation: lead with one short diagnostic block and keep schema details compact below it.
- [Risk] The summary/list UI may make warning-heavy files feel louder than before. → Mitigation: keep the list collapsed by default and preserve advisory semantics.
- [Risk] Jump-to-diagnostic interactions could drift from Monaco marker ranges. → Mitigation: emit shell-facing diagnostics from the same editor-side normalization step that feeds `setModelMarkers`.

## Migration Plan

1. Update runtime rule import semantics so conditional rules preserve `requiredMode` and `conditions` without promoting them to unconditional `required`.
2. Align frontend statement validation and diagnostics tests with the corrected contract.
3. Add editor-to-shell diagnostic emission, status-bar summary rendering, hover priority rules, and expandable list navigation.
4. Verify that previously false-positive UNC `20.11.2` examples render without diagnostics while real rule violations remain visible.

## Open Questions

- Whether the diagnostic list should expose a lightweight severity filter from the first release or start with a flat list only.
- Whether the status-bar summary should remain hidden at zero diagnostics or explicitly show a neutral `无诊断` state.
