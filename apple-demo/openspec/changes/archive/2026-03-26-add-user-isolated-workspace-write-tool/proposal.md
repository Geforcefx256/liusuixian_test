## Why

The current runtime can expose user-isolated workspace files, but it still lacks a governed direct write primitive for skills and tool-driven flows. That forces file-producing workflows to rely on command-side effects or opaque artifact JSON paths, which makes the final write location unclear, weakens logging safety, and leaves follow-up file context too implicit.

## What Changes

- Add a local `write` tool with an opencode-like simple API, but scope all writes to the current `user + agent` workspace under `outputs/<relativePath>`.
- Normalize the requested relative path, reject path escapes outside the scoped `outputs/` root, allow nested relative paths, and auto-create parent directories.
- Overwrite the same canonical relative path in place instead of creating duplicate workspace entries, while preserving one stable workspace identity for that path.
- Return a structured `artifact_ref` for successful writes so the existing result-card and workspace-open flow can target the written file directly.
- Surface written files in the workspace sidebar under the output group using the full relative path label, and automatically include them in later follow-up file context without auto-opening the editor.
- Extend workspace file storage/open/save handling so output files are no longer limited to opaque `<fileId>.json` artifact blobs.
- Keep the same aging policy as existing workspace outputs and ensure write-tool logs record metadata only, never file body content or content previews.
- Update affected skill guidance so skills can call `local:write` intentionally and rely on the current workspace file context behavior.
- Exclude repo-root file editing, companion user-workspace read/list/find tools, binary authoring, and broader tool-governance tightening from this change.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `agent-backend-runtime`: add a user-isolated workspace `write` tool, path-addressed output storage, artifact references for written files, and metadata-only logging for write operations.
- `agent-web-workbench`: surface runtime-written workspace outputs in the sidebar and follow-up invocation context without auto-opening the workspace editor.

## Impact

- `apps/agent-backend` local tool provider, tool schemas, file-store metadata, workspace open/save handling, result building, logging, and tests.
- `apps/web` workbench store, workspace refresh/reconciliation behavior, result-card follow-up behavior, API typings, and tests.
- Affected runtime skill assets such as `apps/agent-backend/assets/**/SKILL.md`.
- Existing OpenSpec requirements for `agent-backend-runtime` and `agent-web-workbench`.
