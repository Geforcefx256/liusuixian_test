## Context

The current MML table experience already has the core behavior expected from the workbook path: a fixed `汇总` tab, parsed command sheets, a spreadsheet-backed grid, bottom status feedback, and text-authoritative round-tripping. The remaining mismatch is presentational. The visible sheet tabs still read as pill-style product navigation, the active sheet body is framed like a separate rounded card, and the `汇总` sheet uses a more dashboard-like surface treatment than the command-sheet grid.

That mismatch matters because this surface is now close enough to spreadsheet interaction that users evaluate it against Excel-like worksheet expectations rather than against general application chrome. The repo also already contains the pieces needed to fix this at the shell layer: workbook state is owned in Vue, the grid engine is isolated behind `MmlWorkbookGrid.vue`, the status bar is already part of the workbook shell, and the shared visual tokens in `apps/web/src/styles.css` already provide neutral canvas, panel, and border values suitable for worksheet presentation.

This keeps the change intentionally narrow: the design should improve workbook perception without reopening prior decisions around parser behavior, schema loading, grid interaction, spare rows, or text-first save semantics.

## Goals / Non-Goals

**Goals:**
- Make the MML table surface read visually as `worksheet tabs + connected sheet surface + status bar`.
- Align the `汇总` sheet and command-sheet presentations so they feel like alternate sheets inside one workbook.
- Reduce the current "pill tabs above a floating card" effect without changing workbook behavior.
- Reuse existing theme tokens and the current Jspreadsheet integration rather than introducing a new visual system or grid dependency.
- Keep the implementation concentrated in presentation-layer components so the risk of behavioral regression stays low.

**Non-Goals:**
- Changing workbook state management, active-sheet selection, status-bar semantics, or MML save behavior.
- Replacing `Jspreadsheet CE`, changing spreadsheet interaction rules, or adding broader Excel feature parity.
- Reworking MML summary information architecture, parser output, schema contracts, or row editability rules.
- Performing a broader workbench visual redesign outside the MML workbook shell.
- Introducing a separate design-token set just for MML workbook presentation unless a small token refinement is unavoidable.

## Decisions

### Decision: Keep the workbook shell in Vue and treat this as a presentation-layer refinement

The workbook shell will continue to be owned by `WorkspaceEditorPane.vue`, with `MmlWorkbookGrid.vue` remaining a themed grid adapter for active command sheets.

Rationale:
- The shell already owns tabs, summary-vs-grid switching, and status bar rendering.
- The requested change is about visual hierarchy, not about moving business state into the grid layer.
- Keeping the change in the shell reduces the chance of destabilizing selection, paste, or rewrite flows.

Alternatives considered:
- Rebuild the shell around grid-library-owned workbook UI.
- Move the whole MML table presentation into a new specialized workbook component.

Why not:
- Both options expand scope and create migration risk for a change that is fundamentally presentational.

### Decision: Define the target hierarchy as one connected workbook surface

The desired visual model is a single workbook surface composed of:

1. worksheet tab strip
2. active sheet body
3. bottom status bar

The tab strip and active sheet body must visually connect through shared borders, aligned spacing, and reduced card separation.

Rationale:
- This directly addresses the current perception gap where tabs look unrelated to the grid below.
- It matches the user expectation that sheet navigation is part of the workbook, not a separate navigation control.
- It can be achieved with existing shell structure and CSS changes.

Alternatives considered:
- Only restyle the tabs and leave the active sheet container unchanged.
- Keep the current shell structure but intensify the active tab styling.

Why not:
- Tab-only restyling would still leave the active grid inside a visually separate floating card.
- Stronger active-tab styling alone would increase button-like emphasis rather than improving workbook cohesion.

### Decision: Prefer Excel-like worksheet emphasis over generic product-tab emphasis

The workbook tabs should shift from pill-style controls toward worksheet-style tabs with lower inactive emphasis and an active state that reads as the selected sheet rather than as a primary action.

Rationale:
- The current pill language implies product navigation or filtering, which is the wrong mental model here.
- Worksheet tabs need to feel subordinate to the sheet body, not louder than it.
- This can be done by reducing pill characteristics such as large-radius chrome, exaggerated gap separation, and isolated button framing.

Alternatives considered:
- Preserve the current pill tabs and only change colors.
- Make the active tab even darker and more prominent while leaving the rest unchanged.

Why not:
- Color-only changes would not remove the navigation-button mental model.
- More prominence would worsen the mismatch between tabs and sheet content.

### Decision: Keep summary content custom, but force it into the same outer workbook language

The `汇总` sheet will remain a custom Vue-rendered page rather than becoming a spreadsheet grid, but its outer container treatment must match the command-sheet surface at the workbook-shell level.

Rationale:
- `汇总` is conceptually a workbook sheet, but not a literal data grid.
- The user-visible problem is not that `汇总` is custom; it is that `汇总` currently feels like a different product page.
- Matching the outer shell while keeping inner summary content custom preserves flexibility and avoids overfitting summary UX to the grid engine.

Alternatives considered:
- Convert `汇总` into a faux spreadsheet page.
- Leave `汇总` as-is and only restyle command-sheet tabs.

Why not:
- A faux spreadsheet summary adds complexity without improving actual information quality.
- Leaving `汇总` visually separate would preserve the workbook discontinuity during tab switching.

### Decision: Reuse existing surface and border tokens before introducing new workbook-specific tokens

Implementation should first rely on existing shared tokens such as `--bg-canvas`, `--surface-panel`, `--surface-subtle`, and `--line-subtle`. New tokens should be added only if a clear workbook-specific value is needed across multiple shell elements.

Rationale:
- The current theme already has neutral tones that are close to worksheet UI expectations.
- Reuse keeps the change consistent with the rest of the workbench and limits cross-cutting theme churn.
- The change is easier to review and roll back when it mostly adjusts composition rather than inventing a parallel token system.

Alternatives considered:
- Introduce a dedicated Excel-like token family for workbook shells.
- Hardcode workbook colors inside the MML components.

Why not:
- A new token family is disproportionate for a targeted shell alignment change.
- Hardcoded values would weaken consistency and make later adjustment harder.

## Risks / Trade-offs

- [Risk] A purely visual change may be interpreted by users as a promise of broader Excel parity. → Mitigation: keep the spec and UI language bounded to worksheet-like presentation rather than full Excel behavior.
- [Risk] Making the tab strip and sheet body feel more connected could expose inconsistencies between summary and command-sheet inner layouts. → Mitigation: align the outer workbook shell first and keep inner summary content adjustments limited to what is needed for shell continuity.
- [Risk] CSS-only shell changes can accidentally disturb responsive behavior in the workspace editor. → Mitigation: keep the scope concentrated in workbook-specific classes and preserve existing toolbar/status-bar structure.
- [Risk] Jspreadsheet default styles may still leak non-matching borders or spacing once the shell becomes more cohesive. → Mitigation: use `MmlWorkbookGrid.vue` only for targeted theme overrides that align the grid with the workbook surface.
- [Risk] Shared token reuse may limit exact Excel mimicry. → Mitigation: prioritize worksheet hierarchy and cohesion over literal Excel cloning in the first pass.

## Migration Plan

1. Refine the workbook-shell classes in `WorkspaceEditorPane.vue` so tabs, active sheet body, and summary surface share one connected visual hierarchy.
2. Update the `汇总` sheet container styling so it fits the same outer workbook-shell treatment as command sheets.
3. Apply any needed targeted theme overrides in `MmlWorkbookGrid.vue` so grid borders and header treatment align with the revised shell.
4. Update component tests that assert workbook-shell rendering or source-backed style expectations.
5. Verify that table-view behavior, active-sheet switching, status messaging, and save semantics remain unchanged.

Rollback strategy:

- Remove the workbook-shell presentation changes in `WorkspaceEditorPane.vue` and `MmlWorkbookGrid.vue`.
- Restore the previous pill-tab and card-separated presentation without requiring any data migration or backend rollback.

## Open Questions

- Whether the active worksheet tab should remain a dark filled tab, as in the user-provided reference, or shift to a lighter selected-sheet treatment closer to desktop spreadsheet defaults.
- Whether the first visual pass should also slightly tighten the workbook status bar styling so the full shell reads more continuously from tabs to sheet body to status.
