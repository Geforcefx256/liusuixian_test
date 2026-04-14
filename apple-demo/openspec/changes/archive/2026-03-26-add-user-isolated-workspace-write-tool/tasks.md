## 1. Backend Write Tool And Workspace Storage

- [x] 1.1 Add the local `write` tool manifest, schema, and invocation path so text content is written to `outputs/<relativePath>` within the current `user + agent` workspace.
- [x] 1.2 Implement canonical relative-path normalization, parent-directory auto-creation, and explicit rejection of absolute or escaping paths.
- [x] 1.3 Extend workspace output storage metadata so overwrite-by-path preserves one stable workspace file identity and legacy generated outputs remain readable.
- [x] 1.4 Return `artifact_ref` for successful writes and make written outputs available through the existing workspace list/open/save flows with the current aging policy.

## 2. Logging And Runtime Contracts

- [x] 2.1 Add metadata-only logging for `write` in the local tool provider, agent loop, and bridged devlog path so file bodies and previews are never emitted.
- [x] 2.2 Keep the current generated-file invocation-context contract working for write outputs and update affected runtime skill guidance to use `local:write` intentionally.
- [x] 2.3 Add backend tests covering nested writes, overwrite stability, artifact references, legacy output compatibility, and log redaction behavior for write calls.

## 3. Frontend Workspace Integration

- [x] 3.1 Update the workbench workspace refresh/reconciliation flow so successful write results appear in the output group with full relative path labels.
- [x] 3.2 Ensure later runs automatically include workspace-written files in `invocationContext.fileAssets` while only explicit user selection sets `activeFile`.
- [x] 3.3 Preserve explicit workspace entry by avoiding automatic editor opening after a write result, while keeping existing artifact-card open-file behavior available.
- [x] 3.4 Add frontend tests for sidebar appearance, no-auto-open behavior, artifact-card opening, and follow-up auto-context after write results.
