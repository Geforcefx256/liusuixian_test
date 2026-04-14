## Context

The current workbench already has the right product shape: a conversation-first shell, a persistent workspace sidebar, a Monaco-backed text path, a Markdown preview path, and a table-oriented path for structured data. The remaining weakness is typographic governance.

The frontend currently mixes many close-together font sizes and several narrow responsive `clamp(...)` values across shell chrome, cards, sidebars, drawers, rails, result tables, and workspace surfaces. In practice, this creates three problems:

- nearby hierarchy levels are hard to distinguish because `14px`, `15px`, `16px`, `17px`, and `18px` are all used for title-like roles
- small-assistive roles drift between `10px`, `11px`, and `12px`
- editor and table surfaces are only partially governed, so they can diverge from each other when body-level typography changes

This change is not a brand redesign. It is a typography-governance correction for an already established product surface.

Constraints:
- The system must work for Simplified Chinese UI copy first.
- The authenticated workbench is a dense operational surface, not a marketing page.
- Monaco, raw text editing, MML workbook grids, native table previews, and result tables must remain readable at high density.
- The change should reduce typography variants, not replace them with many new token aliases.

## Goals / Non-Goals

**Goals:**
- Establish a governed typography token system for the workbench.
- Keep the main UI font family optimized for Chinese business application reading.
- Reduce the number of active text-size roles to a small semantic set that can be reused across components.
- Separate general UI typography from editor and table typography so those surfaces remain stable as the shell evolves.
- Ensure browse and edit states in table views remain typographically aligned.
- Preserve a dedicated Markdown document scale that stays inside the workspace shell without competing with shell chrome.

**Non-Goals:**
- Redesigning color, spacing, iconography, or layout structure beyond what typography governance requires.
- Turning the workbench into a content-heavy documentation site with oversized body typography.
- Replacing Monaco, replacing `jspreadsheet`, or changing backend contracts.
- Introducing a broad fluid-typography system for dense workbench chrome.

## Decisions

### Decision: Use a Chinese-first UI font stack and a distinct monospace stack

The workbench SHALL use two governed font families only:

- UI sans: `"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", "Segoe UI", sans-serif`
- mono: `"SFMono-Regular", "SF Mono", "Cascadia Mono", "Consolas", monospace`

Rationale:
- The workbench is primarily Chinese UI, so the main stack should optimize Chinese readability before English technical character.
- Monaco, raw text editing, inline code, and protocol/code blocks need a consistent monospace surface.
- Allowing each component to declare its own family string recreates the current governance gap.

Alternatives considered:
- Adopt a technical dashboard pair such as `Fira Sans` and `Fira Code`.

Why not:
- That pairing is more appropriate for English-first technical dashboards than a Chinese operational workbench.
- The current product already uses a system-Chinese visual tone and should converge rather than pivot.

### Decision: Govern the shell with a small semantic size scale instead of raw component-specific values

The workbench SHALL normalize its primary semantic sizes to this scale:

- `overline`: `11px`
- `meta`: `12px`
- `dense`: `13px`
- `body`: `14px`
- `title`: `16px`
- `section`: `18px`
- `page-title`: `28px`
- `display`: `32px`

Rationale:
- This preserves enough hierarchy for a dense workbench while removing ambiguous near-duplicates.
- It makes cross-component roles comparable.
- It keeps the shell practical on laptop-class widths.

Alternatives considered:
- Preserve the current `10px` to `18px` scatter and only patch the worst offenders.
- Use a broader fluid scale with many `clamp(...)` tokens.

Why not:
- Patch-only cleanup would leave the same governance problem in place.
- The current small `clamp(...)` values create negligible visual benefit while increasing maintenance cost.

### Decision: Separate typography into UI, editor, table, and document surfaces

The workbench SHALL treat typography as four operational surfaces rather than one shared body rule:

- UI surface: general shell copy, controls, descriptions, labels, and message text
- editor surface: Monaco and raw text editing
- table surface: MML workbook grid, native table preview, and rich result tables
- document surface: rendered Markdown headings and prose

Rationale:
- Users perform different reading tasks in each surface.
- Editor and table density should not be accidentally changed by shell-level body adjustments.
- Markdown preview needs a document-oriented heading scale that would be too large for shell chrome.

Alternatives considered:
- Let all surfaces inherit from one global `body` size and adjust only exceptions.

Why not:
- That model already caused divergence because high-density surfaces need explicit governance.

### Decision: Keep editor typography fixed at high-density monospace

The editor surface SHALL use:

- font family: mono
- size: `13px`
- line height: `1.6`

This applies to Monaco-backed text editing and the textarea fallback path.

Rationale:
- The workbench is an operational correction surface, not a large-format writing environment.
- `13px` preserves line density and spatial stability for Monaco, especially when line numbers and multi-pane layouts are present.
- The fallback text path must match Monaco so switching implementations does not change perceived density.

Alternatives considered:
- Raise editor text to `14px`.

Why not:
- It reduces usable density and makes the workspace feel looser without solving the hierarchy problem.

### Decision: Govern all table surfaces at a shared dense sans scale

All table-oriented surfaces SHALL use:

- font family: UI sans
- body size: `13px`
- line height: `1.5`
- meta/supporting text: `12px`

This applies to:
- `jspreadsheet` MML workbook grid
- native workspace table view
- protocol message tables
- rich result tables

Rationale:
- These surfaces are scanned, compared, and occasionally edited rather than read as long-form prose.
- `13px` is already the de facto stable size in several table surfaces and should become the governed standard.
- Sans-serif UI text is more appropriate than monospace for mixed-language data tables in this product.

Alternatives considered:
- Let native table previews inherit shell body typography while keeping `jspreadsheet` at its own size.
- Use monospace in all tables for consistency with editor surfaces.

Why not:
- Inheriting shell body size would create visible drift between table implementations.
- Monospace tables would over-emphasize code-like appearance where it is not needed.

### Decision: Editing a table cell must not change its typography role

The workbench SHALL keep table browse state and table edit state on the same typography role. If a cell is shown at `13px`, the editing input for that cell MUST also render at `13px`.

Rationale:
- Typography jumps during edit-mode entry are visually obvious and make the table feel unstable.
- This is especially important for workspace tables, where users alternate rapidly between scanning and editing.

Alternatives considered:
- Let editing controls inherit default form typography from the shell.

Why not:
- That would reintroduce `13px` versus `14px` divergence during in-cell editing.

### Decision: Markdown preview keeps a dedicated document scale

Markdown preview SHALL keep a document-oriented scale inside the workspace shell:

- `h1`: `28px`
- `h2`: `22px`
- `h3`: `18px`
- prose body: `14px`
- inline code: `12px` monospace

Rationale:
- Rendered Markdown is a document-reading surface, not shell chrome.
- The preview needs stronger heading differentiation than dense workbench chrome.
- The document scale can coexist with the shell scale as long as it is scoped to the preview surface only.

## Recommended Token Model

The implementation should converge on a small, explicit token set:

```css
--font-family-ui: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei",
  "Noto Sans SC", "Segoe UI", sans-serif;
--font-family-mono: "SFMono-Regular", "SF Mono", "Cascadia Mono", "Consolas", monospace;

--font-overline: 11px;
--font-meta: 12px;
--font-dense: 13px;
--font-body: 14px;
--font-title: 16px;
--font-section: 18px;
--font-page-title: 28px;
--font-display: 32px;

--font-doc-h1: 28px;
--font-doc-h2: 22px;
--font-doc-h3: 18px;

--font-editor: 13px;
--font-table: 13px;
--font-table-meta: 12px;
--font-code-inline: 12px;
```

Associated line-height rules:

- `overline`: `1.4`
- `meta`: `1.5`
- `dense`: `1.5`
- `body`: `1.6`
- `title`: `1.2`
- `section`: `1.25`
- `page-title`: `1.15`
- `editor`: `1.6`
- `table`: `1.5`
- `code-inline`: `1.4`

## Migration Guidance

The implementation should collapse current typography roles into the governed scale:

- `10px` → `11px`
- `15px` → `16px`
- `17px` → `18px`
- small assistive `clamp(...)` variants → `11px` or `12px`
- dense content `clamp(...)` variants → `13px`
- title-like `clamp(...)` variants → `16px` or `18px`

High-priority adoption points:
- global typography tokens in `styles.css`
- shared chrome utilities such as panel eyebrows, agent identity, segmented controls, and workspace actions
- Monaco and textarea fallback parity
- workspace native table and `jspreadsheet` parity
- protocol and rich-result table parity

## Risks / Trade-offs

- [Some surfaces may feel slightly denser after removing intermediate title sizes] → This is acceptable because the workbench is already a dense operational product and the gain in hierarchy clarity outweighs the loss of micro-variation.
- [`jspreadsheet` and `jsuites` include vendor font-size defaults that can reappear in nested surfaces] → Explicit local overrides should govern the main grid, cell editor, and support elements used by the workbench.
- [Teams may reintroduce raw sizes in future components] → Shared tokens and specification language should make raw component-local typography a deviation rather than the default.
- [Markdown preview could feel visually detached from the shell if it borrows too much document styling] → Keep the document scale scoped to the preview body only and preserve shell chrome around it.

## Migration Plan

- Add the governed font-family and font-size tokens to shared frontend styles.
- Refactor shared chrome and workbench components to consume semantic typography tokens instead of raw values.
- Explicitly align Monaco, textarea fallback, native tables, and `jspreadsheet` table surfaces with the governed editor/table rules.
- Update relevant component tests or visual assertions where typography-related snapshots depend on class/token output.
- Verify the workbench at common laptop and desktop widths to confirm hierarchy consistency across shell, editor, and table surfaces.

## Open Questions

None for this proposal. The typography model, editor/table treatment, and Markdown scope are fixed for implementation.
