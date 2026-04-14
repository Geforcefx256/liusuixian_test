## Why

The current MML parsing path is still driven by a hardcoded backend schema stub, which means the workbench table view and text editor cannot reflect the real command and parameter rules already maintained in backend Excel rule files. The product now needs one authoritative MML rule source so both Monaco text editing and workbook-style table editing can use the same network-version-specific semantics instead of a thin placeholder catalog.

## What Changes

- Replace the current hardcoded MML schema stub with an Excel-backed backend rule pipeline that imports fixed backend rule workbooks into a dedicated SQLite rule database.
- Make Excel the primary MML rule source for `networkType + networkVersion` lookups exposed through the existing `/agent/api/files/mml-schema` route.
- Extend the returned MML schema payload so it remains compatible with the current workbook-style table view while also carrying richer parameter metadata needed for Monaco text completion, hover help, and diagnostics.
- Add backend parsing and normalization for richer rule semantics from Excel, including conditional requiredness, enum values, bitfield options, numeric constraints, length constraints, and case-sensitivity hints.
- Update the MML text editing flow so Monaco can consume backend rule metadata for command completion, parameter completion, value suggestions, and validation feedback.
- Keep the MML table view on the existing text-first authority model while switching its rule source from the current stub to the imported Excel-backed rule database and enabling type-aware spreadsheet behavior such as enum dropdowns, schema-bounded value validation, and template-guided bitfield editing.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `agent-backend-runtime`: change runtime MML schema lookup from hardcoded stub data to Excel-imported rule data stored in a dedicated backend rule database.
- `agent-web-workbench`: change MML text and table editing flows so both consume the same richer backend rule schema for Monaco assistance and workbook-style projection.

## Impact

- `apps/agent-backend/src/files/*`, startup bootstrap, config parsing, and files-route schema lookup.
- New backend rule import, storage, and query modules plus an Excel parsing dependency.
- `apps/web/src/components/workbench/*` Monaco text editing, MML parsing helpers, and workbook projection.
- `/agent/api/files/mml-schema` response assembly and its backend/frontend type definitions.
