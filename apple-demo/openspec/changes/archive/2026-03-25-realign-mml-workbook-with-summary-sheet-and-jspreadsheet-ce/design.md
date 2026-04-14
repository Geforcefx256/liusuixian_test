## Context

The current MML table view already proved the backend schema stub, the parser, conservative read-only rules, and statement-level rewrite path. What it did not settle is the workbook interaction model. The implemented UI renders summary information above the table, adds a card-style sheet overview on top of the regular tabs, and uses a native HTML table with inline `<input>` and `<select>` controls. That leaves the experience visually and behaviorally short of the `index-v10` workbook model and short of what users expect from an Excel-like surface.

The product also has a hard dependency constraint for this round: `Handsontable` cannot be used, and the realistic candidates are limited to `Jspreadsheet CE 4.15` and `AG Grid 33.1.1`. Within that constraint, `Jspreadsheet CE 4.15` is the more natural fit because it is workbook-oriented and provides the bounded spreadsheet interactions needed for the command-sheet surface, while `AG Grid` keeps key range-selection and clipboard features behind Enterprise licensing.

The backend contract does not need to change for this follow-up. The current schema API, MML parse model, row safety classification, and text-first save path remain the authority. The change is concentrated in the workbench interaction shell and the active command-sheet grid engine.

## Goals / Non-Goals

**Goals:**
- Restore the workbook information architecture so `汇总` is a real sheet tab, always first, and never rendered as a banner above the grid.
- Keep command-sheet pages visually focused on the spreadsheet surface with tabs at the top and workbook state in the bottom status bar.
- Replace the native HTML MML grid with a `Jspreadsheet CE 4.15` integration for active command sheets.
- Preserve the current text-first MML authority, schema-driven columns, and conservative row safety rules.
- Support bounded spreadsheet interactions for active command sheets: rectangular selection, standard copy/paste, keyboard navigation, and schema-driven dropdown editors.
- Keep `网元类型` and `网元版本` outside the grid as shell-owned controls.

**Non-Goals:**
- Changing the backend schema API or replacing the existing MML parse and rewrite model.
- Delivering full Excel parity, including non-contiguous multi-range selection.
- Adding row insertion, row deletion, sheet creation, sheet deletion, or drag-fill authoring flows.
- Moving summary content into the spreadsheet engine itself.
- Introducing `AG Grid` or any new backend dependency as part of this change.

## Decisions

### Decision: Keep workbook chrome in Vue and use Jspreadsheet only for active command-sheet grids

The workbench will own the workbook tabs, summary-page state, and status bar in Vue. `Jspreadsheet CE` will be mounted only for the active command sheet, not for the `汇总` sheet and not as the owner of the overall workbook shell.

Rationale:
- `汇总` is not a spreadsheet worksheet. It is a custom summary page.
- The product needs explicit control over tab order so `汇总` always stays leftmost.
- Keeping tabs and status in Vue lets the workbench preserve existing shell state and avoids overfitting product structure to the grid library.

Alternatives considered:
- Use `Jspreadsheet` workbook tabs for every sheet, including `汇总`.
- Keep the custom HTML table and manually add selection and clipboard behaviors.

Why not:
- `Jspreadsheet` workbook tabs are a worse fit for a non-grid summary page.
- Extending the native HTML table would keep increasing custom interaction code while still lagging behind spreadsheet expectations.

### Decision: Preserve the existing MML workbook projection and route spreadsheet edits back through text-first patching

The current `mmlWorkbook` model remains the business model: `sheet.columns`, `sheet.rows`, row safety, and `applyMmlCellEdit(...)` continue to define what is editable and how edits serialize back into text.

Rationale:
- The parser and rewrite model are already aligned with the conservative non-destructive save contract.
- Replacing that logic would introduce unnecessary regression risk.
- The grid engine should improve interaction quality, not replace the document authority model.

Alternatives considered:
- Let `Jspreadsheet` data become the saved workbook authority.
- Build a second spreadsheet-specific state model separate from `mmlWorkbook`.

Why not:
- Both alternatives create a second business authority and make text-view convergence harder.

### Decision: Choose Jspreadsheet CE 4.15 over AG Grid 33.1.1 for the active MML sheet surface

The command-sheet grid will use `Jspreadsheet CE 4.15`.

Rationale:
- The required interaction model is workbook-first rather than data-grid-first.
- `Jspreadsheet CE` provides the bounded spreadsheet affordances needed here, including tabs-oriented mental model, rectangular selection, copy/paste, keyboard navigation, dropdown editors, and frozen spreadsheet presentation patterns.
- `AG Grid` Community is a poor fit under the current constraint because official range selection and clipboard operations are documented as Enterprise features.

Alternatives considered:
- `AG Grid 33.1.1`

Why not:
- Its strongest spreadsheet-like interactions are not available under the current allowed licensing boundary.

### Decision: Keep spreadsheet promises bounded to CE-supported main-path interactions

The spec and UI copy will promise only the spreadsheet interactions that fit comfortably in `Jspreadsheet CE`: one active rectangular selection, standard copy/paste, keyboard navigation, and schema-driven editing controls.

Rationale:
- This keeps the feature scope honest.
- `Jspreadsheet CE` does not justify promising full Excel parity or Pro-only interactions such as non-contiguous multi-range selection.
- Bounded promises are easier to test and maintain.

Alternatives considered:
- Continue describing the surface as "strictly aligned with Excel".

Why not:
- That overcommits beyond the selected dependency's supported feature set and would create avoidable expectation gaps.

### Decision: Spreadsheet selection and read-only feedback belong in the workbook status bar

The active sheet name, active cell or selection range, editable/read-only feedback, and fallback hinting will live in the bottom status bar.

Rationale:
- It preserves the clean workbook body expected after leaving `汇总`.
- It matches the existing OpenSpec direction that status-heavy messaging belongs in the bottom bar rather than in banners above the grid.
- It gives the user continuous feedback for selection and blocked edits without adding more card chrome.

Alternatives considered:
- Show a persistent warning strip above every command sheet.
- Keep cell-level feedback only through browser-native tooltips.

Why not:
- A persistent strip weakens the spreadsheet feel.
- Tooltips alone are too weak for blocked paste or selection-state feedback.

### Decision: Batch paste remains conservative and text-authoritative

Spreadsheet paste will be supported only when the target rectangle maps cleanly to editable known-parameter cells. If any targeted cell would violate row safety, hit an unknown-parameter area, or require unsupported structural repair, the workbench will reject that spreadsheet edit and keep the user on the current text-authoritative content.

Rationale:
- Bulk spreadsheet interactions must still obey the existing non-destructive rewrite guarantees.
- Partial silent application would be hard for users to trust and hard for the serializer to reason about.
- A conservative all-or-nothing rule is easier to explain and verify.

Alternatives considered:
- Apply valid pasted cells and silently skip blocked cells.
- Allow pasted values into rows that are otherwise read-only.

Why not:
- Silent skipping would make spreadsheet behavior feel inconsistent.
- Allowing edits into otherwise unsafe rows breaks the existing safety contract.

## Risks / Trade-offs

- [Jspreadsheet CE still falls short of full Excel parity] → Mitigation: constrain product language and specs to the supported main-path interactions only.
- [Grid reinitialization may cause selection or focus churn when the source text changes] → Mitigation: keep a stable active-sheet key and explicitly rehydrate selection and status-bar state after rebuilds where possible.
- [Batch paste can create ambiguous failure cases against read-only rows or unsupported targets] → Mitigation: validate the full target rectangle before applying changes and show explicit status-bar feedback when the operation is blocked.
- [A new frontend dependency adds styling and lifecycle integration work] → Mitigation: isolate the library behind a dedicated MML sheet adapter component and keep the rest of the workbook shell library-agnostic.

## Migration Plan

1. Add the `Jspreadsheet CE 4.15` frontend dependency and create an adapter component for active command-sheet rendering.
2. Replace the current MML summary banner and sheet-card overview with Vue-managed workbook tabs that include a fixed leftmost `汇总` tab.
3. Wire `Jspreadsheet` events back into the existing `mmlWorkbook` projection and `applyMmlCellEdit(...)` path.
4. Update tests and status-bar behavior for summary navigation, spreadsheet selection, blocked edits, and conservative paste handling.
5. If the grid integration regresses editing or selection stability during rollout, revert to the previous native-table renderer while keeping the workbook tab state changes isolated.

## Open Questions

- Whether the first release should expose frozen first-column behavior immediately or defer it until the base grid integration is stable.
- Whether blocked paste feedback should stay status-bar-only or also surface a lightweight inline toast once the product language is finalized.
