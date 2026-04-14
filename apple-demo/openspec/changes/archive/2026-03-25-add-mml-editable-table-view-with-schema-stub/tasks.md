> Note: These completed tasks belong to the first stubbed MML table rollout. Follow-up workbook realignment and `Jspreadsheet CE` integration are intentionally tracked in `realign-mml-workbook-with-summary-sheet-and-jspreadsheet-ce`.

## 1. Schema Boundary And Stub

- [x] 1.1 Add an internal MML schema API contract keyed by `networkType` and `networkVersion` instead of coupling the frontend directly to a future upstream interface.
- [x] 1.2 Implement a backend stub schema endpoint that returns normalized command metadata for representative MML command sets used in tests.
- [x] 1.3 Add schema normalization logic that merges duplicate command entries by `commandName` and duplicate parameter entries by `paramName`.
- [x] 1.4 Normalize upstream-like field inconsistencies such as enum arrays, required flags, ordering metadata, and misspelled default-value fields before returning data to the frontend.

## 2. MML Parsing And Projection

- [x] 2.1 Implement an MML document parser that splits source text into detachable raw segments and statement segments while preserving original text ranges.
- [x] 2.2 Build a statement model that captures command name, original parameter order, token style, duplicate-parameter detection, unknown-parameter detection, and parse status.
- [x] 2.3 Implement comment-binding rules for leading comments, trailing comments, and detached comment blocks so statement rewrite boundaries remain explicit.
- [x] 2.4 Project parsed statements into workbook-style sheets where each sheet is keyed by the full command head before `:`.

## 3. Row Safety And Schema-Driven Editability

- [x] 3.1 Implement conservative row read-only rules for parse failures, duplicate parameters, unknown parameters, unsupported syntax, and ambiguous comment binding.
- [x] 3.2 Surface row read-only reasons in the table view so users know when they must switch back to text view.
- [x] 3.3 Use schema metadata to determine known parameter columns, column order, control types, and editability for each sheet.
- [x] 3.4 Keep unknown parameters visible in the grid while making those rows read-only and excluding unknown parameters from table editing flows.

## 4. MML Table View UI

- [x] 4.1 Enable the table-view toggle for MML files in the workspace editor shell.
- [x] 4.2 Add the MML workbook summary view, including command-sheet discovery and quick navigation.
- [x] 4.3 Add MML sheet tabs and a per-sheet grid that renders one row per parsed statement.
- [x] 4.4 Implement schema-loading states (`idle`, `loading`, `ready`, `error`, `unavailable`) and degrade the grid to read-only when schema is unavailable.
- [x] 4.5 Use schema-aware controls in editable cells, including select controls for enum-like parameters and text inputs for free-text fields.

## 5. Edit Rules And Serialization

- [x] 5.1 Implement cell clearing as parameter deletion rather than empty-string assignment.
- [x] 5.2 Preserve existing parameter token style whenever possible when known parameter values are edited.
- [x] 5.3 Insert newly added known parameters strictly by `orderParamId`.
- [x] 5.4 Serialize edited statement values using schema-driven defaults for enums, numbers, and string-like values, with conservative fallback quoting when needed.

## 6. Non-Destructive Save Path

- [x] 6.1 Implement statement-level patch generation so only edited statements are re-serialized during save.
- [x] 6.2 Preserve detached raw segments, blank lines, untouched statements, and bound comments during MML table saves.
- [x] 6.3 Keep the existing workspace save contract text-first by submitting rewritten `content` plus current `mmlMetadata` through the existing save path.
- [x] 6.4 Ensure table edits and text edits remain consistent when switching views within the same active file.

## 7. Verification

- [x] 7.1 Add tests for schema stub responses and normalization, including duplicate `commandName` and duplicate `paramName` merging.
- [x] 7.2 Add tests for MML parsing, sheet projection, and conservative row read-only classification.
- [x] 7.3 Add tests covering comment-binding behavior for leading comments, trailing comments, and detached comment blocks.
- [x] 7.4 Add tests verifying that unknown parameters remain visible but force row read-only behavior.
- [x] 7.5 Add tests covering parameter deletion, schema-ordered insertion, enum handling, and original token-style preservation.
- [x] 7.6 Add tests proving that table-view saves rewrite only the targeted statement text and preserve surrounding comments and blank lines.
- [x] 7.7 Add tests for schema-loading failure and unavailable-schema downgrade behavior so users can still inspect the table projection safely.
