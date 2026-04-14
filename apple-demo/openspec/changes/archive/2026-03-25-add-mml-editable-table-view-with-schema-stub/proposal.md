> Note: This completed change delivered the first stubbed MML table surface and the underlying schema-driven text-first rewrite model. Follow-up workbook realignment, fixed-leftmost `汇总` sheet behavior, and `Jspreadsheet CE` command-sheet grid integration are tracked separately in `realign-mml-workbook-with-summary-sheet-and-jspreadsheet-ce`.

## Why

The workbench can now open and edit MML files in text view, but it still lacks the structured table-style editing surface implied by the `index-v10` workbook model. That leaves a gap for users who need to review command-oriented MML content as grouped command sheets, make safe parameter-level edits, and continue working without dropping back to raw text for every simple change.

At the same time, this feature cannot be implemented as a naive table overlay. MML files remain text-first documents with comments, blank lines, command ordering, and partially structured content that users expect to preserve. A table view that rewrites whole files would risk destroying those authoring details. The product therefore needs a conservative structured projection that can edit only safe rows, preserve comments and non-edited text, and fall back to text view when structure is unclear.

The long-term design also depends on command parameter schema by `网元类型 + 网元版本`, but the real upstream schema interface is not yet available. To keep progress moving, the system should first establish a stable internal schema-fetch boundary and exercise the full table-editing flow against stubbed schema responses, so the UI model, row safety rules, and non-destructive save behavior can be validated before the real integration arrives.

## What Changes

- Add an editable MML table view to the workspace editor, alongside the existing text view, using an `index-v10`-style workbook model with summary, command-group sheet tabs, and a per-sheet grid.
- Keep the existing workbench shell hierarchy where the conversation rail stays to the left of the file workspace and the MML workbook lives inside the central file editor region rather than replacing the broader shell layout.
- Parse MML text into a structured projection where each sheet represents the full command head before `:`, and each row represents one MML statement.
- Preserve text as the only authoritative document source; the table view acts as a structured projection that reads from and writes back to MML text rather than becoming a separate file model.
- Introduce conservative row safety rules so rows become read-only when the statement contains unknown parameters, duplicate parameters, unsupported syntax, ambiguous comment binding, or any other structure that cannot be safely rewritten.
- Treat an empty table cell as parameter deletion rather than an empty-string assignment.
- Keep `网元类型` and `网元版本` visible as separate user-facing workbench controls, while leaving internal metadata, schema, and parse-model details hidden from the user.
- Add schema-aware parameter editing rules so known parameters can use metadata-driven controls, ordering, and serialization behavior instead of relying on frontend guesswork.
- Reserve an internal MML schema API boundary keyed by `networkType` and `networkVersion`; in this change the backend will provide normalized stub schema responses rather than calling the real upstream service.
- Normalize repeated schema command entries by merging them on `commandName` and then on `paramName`, so duplicated upstream-like payloads can still drive a stable table model.
- Require newly inserted parameters to follow `orderParamId` strictly when written back into the statement.
- Preserve unknown parameters as visible but non-editable table content, and require users to switch back to text view when those rows need modification.
- Keep the sheet page close to the `index-v10` Excel-like interaction model, using a minimal workbook surface of tabs, grid, and status bar instead of adding extra explanatory panels above the grid.
- Surface sheet-level and row-level editability summaries primarily in the bottom status bar so the sheet body remains focused on spreadsheet-style interaction.
- Implement statement-level non-destructive save behavior so the system rewrites only the edited MML statement text and preserves surrounding comments, blank lines, statement order, and untouched raw segments.
- Constrain TypeScript-side spreadsheet modeling and workbook operations for this change to `exceljs` as the only spreadsheet-oriented third-party dependency.
- Exclude direct integration with the real schema service, row insertion/removal, sheet authoring, aggressive auto-repair of malformed MML, and any whole-file regeneration strategy from this change.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `agent-web-workbench`: extend MML workspace editing from text-only review to a schema-aware editable table projection with conservative row safety, workbook-style navigation, and statement-level non-destructive save behavior.
- `agent-backend-runtime`: add an internal MML schema stub contract and normalization layer so the frontend can exercise schema-driven MML table editing before the real upstream schema integration exists.

## Impact

- `apps/web` workspace editor components, MML view-state modeling, MML parsing/projection logic, schema-loading state, and related frontend tests.
- `apps/agent-backend` schema stub routing or adapter logic, schema normalization behavior, and related backend tests.
- Existing OpenSpec requirements for `agent-web-workbench`, especially around MML editing boundaries, fallback behavior, and safe save semantics.
- No intended change yet to the real upstream schema dependency, row-level command execution, or the existing rule that MML files are still saved as text content with structured header metadata.
