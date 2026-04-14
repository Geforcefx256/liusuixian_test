## Context

The backend already has a real `user + agent` workspace boundary through `fileStore`, with files stored under `apps/agent-backend/workspace/users/<userId>/agents/<agentId>/...`. Uploaded files and generated outputs can appear in the workbench sidebar, and the frontend already sends workspace files back to the runtime through `invocationContext.fileAssets`. That gives us most of the isolation model we want.

What is missing is a governed direct write primitive. Today, runtime-generated outputs mainly arrive through `run_command`/skill-side artifact flows backed by opaque output files, while local filesystem tools such as `read_file` and `find_files` still target the global product workspace root. That means a new `write` tool cannot simply copy opencode's repo-editor behavior. It needs the same simple authoring ergonomics, but it must write into the scoped user workspace instead of the repository.

There is also a logging constraint. The current local-tool and agent-loop logging paths record raw args and summary previews, which is acceptable for read/search-style tools but unsafe for a file-writing tool whose payload body may contain user data or generated configuration content. This change therefore needs an explicit design before implementation.

## Goals / Non-Goals

**Goals:**
- Add a simple `local:write` tool that skills can call directly.
- Ensure every write is isolated to the current `user + agent` workspace under the `outputs/` subtree.
- Allow nested relative paths and automatic parent-directory creation.
- Overwrite the same canonical path in place while preserving one stable workspace identity for that file.
- Return an `artifact_ref` that works with the existing workbench result-card and workspace-open flow.
- Make successful writes appear in the workspace sidebar and automatically join later `fileAssets` context without forcing the file editor open.
- Prevent write payload bodies from leaking into provider logs, agent-loop previews, or devlogs.

**Non-Goals:**
- Turning `write` into a repository file editor like opencode's general workspace writer.
- Adding companion user-workspace `read`, `list`, or `find` tools in the same change.
- Supporting binary payloads, base64 transport, or non-text editing flows.
- Tightening the broader local-tool permission model in this change.
- Cleaning up every existing generated-file naming or source-label inconsistency outside the new write flow.

## Decisions

### Decision: Keep the tool name as `write`, but define it as a workspace asset writer instead of a repo editor

The model-facing tool should remain `write` because that is the clearest authoring verb and matches the opencode mental model the user referenced. The difference will live in the contract: this `write` tool writes only into the current scoped workspace output area, not into the repository or arbitrary runtime paths.

Alternative considered:
- Expose a more explicit but awkward name such as `write_workspace_output`.

Why not:
- It solves a naming concern by making skill authoring materially worse. The real safety boundary is the path contract, not an ugly verb.

### Decision: Resolve `path` relative to the current scoped `outputs/` root and reject every escape

The tool input will accept a full relative path such as `reports/final/result.txt`. The runtime will canonicalize that path, reject absolute paths and traversal attempts, and then write to:

`apps/agent-backend/workspace/users/<userId>/agents/<agentId>/outputs/<canonicalRelativePath>`

Parent directories will be created automatically on demand.

Alternative considered:
- Reuse opencode's absolute-path-or-repo-relative model.

Why not:
- That would bypass the product's existing workspace-isolation contract and reopen repo-root editing questions that this change is specifically avoiding.

### Decision: Overwrite by canonical path and preserve one stable workspace identity for that path

The write tool should treat the canonical relative path as the overwrite key inside a given `user + agent` scope. Writing the same path again should update the existing tracked file instead of creating a second workspace entry. The stored workspace identity should remain stable enough for sidebar entries, result cards, and opened editor state to continue referring to the same file.

The tracked entry should use the canonical relative path as its display label and should refresh its tracked timestamp when a write succeeds.

Alternative considered:
- Allocate a new output entry and file id on every write.

Why not:
- That would fill the workspace with duplicates for iterative workflows and make "overwrite" mean "create another file," which conflicts with the user's chosen model.

### Decision: Return `artifact_ref` for write success and reuse the existing workbench open flow

Successful writes should return an `artifact_ref` with the workspace file identity needed by the current result-card and open-file flow. The user-facing file label should be the full relative path inside `outputs/`, such as `reports/final/result.txt`, rather than an opaque generated JSON name.

Alternative considered:
- Return a plain success string and require the user to find the file from the sidebar.

Why not:
- The existing artifact result flow already solves the "open what was just produced" problem. Reusing it is lower-risk and keeps generation and review connected.

### Decision: Auto-include written files in follow-up context, but do not auto-open the editor

After a successful write result, the frontend should refresh workspace metadata so the written file becomes part of the current workspace file set. Because the workbench already sends workspace files through `invocationContext.fileAssets`, that makes the file available to later runs automatically. However, the file should not become the `activeFile` and should not force the workspace-expanded editor open unless the user explicitly opens or selects it.

Alternative considered:
- Require manual checkbox-style selection before the written file enters context.
- Automatically open the written file immediately after the tool returns.

Why not:
- Manual selection adds friction to the common iterative workflow. Auto-open is too aggressive and breaks the user's preference to keep editor entry explicit.

### Decision: Keep generated-file source labeling unchanged for now

The current workbench maps workspace outputs into the model-facing file context as `source: "skill"`. That label is semantically imperfect, but it is the established generated-file bucket in the invocation contract. This change will keep that contract unchanged so the write tool can land without widening the frontend/backend file-asset enum in the same pass.

Alternative considered:
- Introduce a new `output` or `workspace` source enum immediately.

Why not:
- It would expand this change into a broader prompt, typing, and skill-contract migration that is not required to deliver isolated workspace writing.

### Decision: Treat `write` as a metadata-only logging path

The write tool must not log `content`, content previews, or model-visible file bodies through the local provider, agent loop, or bridged devlogs. Logging should record metadata only, such as canonical path, scope, created-vs-overwritten status, file identity, byte or character counts, request id, and timing.

Alternative considered:
- Reuse the generic local-tool logging behavior that records raw args and summary previews.

Why not:
- That would leak user content into operational logs and violate the intended workspace-data boundary.

### Decision: Keep the first iteration text-only

The first write tool iteration should accept text content only and rely on the existing workspace open/save adapters for `text`, `csv`, and MML-like text interpretation after the file is written.

Alternative considered:
- Add binary-safe or base64-aware write semantics immediately.

Why not:
- The current workbench editing and follow-up model is text-first. Expanding transport semantics now adds complexity without a confirmed need.

## Risks / Trade-offs

- [Canonical path normalization bugs could allow path aliasing or traversal] → Centralize normalization and reject any path that escapes the scoped `outputs/` root.
- [Stable overwrite-by-path requires a file-store schema change] → Extend the output-entry metadata carefully and keep legacy output records readable during migration.
- [Metadata-only logging reduces direct body inspection when debugging] → Log path, size, identity, overwrite status, and trace ids so failures stay diagnosable without exposing content.
- [Keeping generated files labeled as `skill` in invocation context is semantically imperfect] → Document that behavior in tool and skill guidance and defer enum cleanup to a later dedicated change.
- [Existing output handling is optimized for `<fileId>.json` artifacts] → Update workspace file resolution so both legacy artifact outputs and path-addressed write outputs remain openable and savable.

## Migration Plan

- No user-visible data migration is required.
- Extend workspace output metadata so new path-addressed write outputs can coexist with legacy generated artifact outputs.
- Keep the backend able to read legacy output records during rollout instead of silently dropping existing workspace files.
- Ship the backend write contract and workspace metadata changes together with the frontend workspace refresh/update behavior so successful write results appear consistently in the sidebar and later invocation context.
- If rollback is required, existing legacy artifact outputs must remain readable; new write-tool output entries may become inert until the feature is re-enabled, but they must not corrupt the broader workspace store.

## Open Questions

- None for proposal readiness. The remaining trade-offs are implementation choices within the decisions above rather than blockers to `/opsx:apply`.
