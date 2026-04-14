## 1. Grid View Model

- [x] 1.1 Add a grid-oriented MML sheet view model that layers spare rows on top of persisted workbook rows without changing the existing text-authoritative workbook model.
- [x] 1.2 Update the active workbook grid component to render spare-row-backed incomplete state, including invalid/missing-required highlighting and status feedback.
- [x] 1.3 Define the first-release spare-row policy, including initial spare-row count and replenishment behavior when the user nears the bottom of the active sheet.
- [x] 1.4 Add component-local incomplete new-row state keyed by file, command sheet, and grid row so partial input survives tab and view switching within the current workspace session.

## 2. Table Authoring And Paste

- [x] 2.1 Refactor MML table paste into an explicit transaction planner that can target persisted rows and spare rows within one rectangular paste operation.
- [x] 2.2 Replace transaction-local spare-row candidate assembly with spare-row incomplete-state updates that record only explicitly touched columns.
- [x] 2.3 Preserve all-or-nothing semantics for hard failures such as blocked persisted rows, invalid values, and out-of-range paste, while allowing spare-row-backed rows to remain incomplete.
- [x] 2.4 Allow direct single-cell typing, paste, and deletion in spare rows to use the same incomplete-row authoring flow.

## 3. Row Materialization

- [x] 3.1 Add shared normalization helpers for typed workbook values, including enum, numeric, and composite/bitfield columns.
- [x] 3.2 Replace default-seeded spare-row materialization with explicit-value-only materialization that leaves incomplete rows in table state until they satisfy required and conditional-required rules.
- [x] 3.3 Add command-block append logic that places newly created statements after the last persisted statement of the active command sheet only.
- [x] 3.4 Ensure only complete valid new rows are appended to text, while incomplete rows are removed from text serialization entirely.

## 4. Workbook Feedback

- [x] 4.1 Update workbook status messaging so spare-row selection explains table-based new-row authoring and incomplete-state feedback.
- [x] 4.2 Add paste-result feedback that distinguishes updated existing rows from newly created rows.
- [x] 4.3 Add concrete incomplete-row feedback for missing required and conditional-required parameters, without auto-filling values on the user's behalf.
- [x] 4.4 Block save while incomplete new rows remain and explain that those rows must be completed or cleared first.

## 5. Verification

- [x] 5.1 Update unit coverage for explicit-value-only row materialization, incomplete-row preservation, and command-block append behavior without default seeding.
- [x] 5.2 Add frontend interaction tests for spare-row direct typing, partial-column paste, incomplete-row highlighting, and mixed update-plus-incomplete-row flows.
- [x] 5.3 Add regression tests proving that incomplete new rows survive tab/view switching, block save, and never serialize partial statements into text.
