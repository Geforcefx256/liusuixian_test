## Context

The current workbench run flow already reloads session messages, interactions, and workspace metadata after a successful run. That refresh updates the workspace tree, but it does not invalidate or replace `workspaceEditorFiles[fileId].content` for files that were already opened before the run. As a result, tool-driven changes made through `local:edit` or `local:write` can be visible in the workspace structure while the editor keeps showing stale content until a full page reload clears the store.

The stale-content bug is limited to frontend reconciliation. The backend file write succeeds, and the frontend already calls `getWorkspace()` during `reloadSessionState()`. The fix therefore should stay inside the web store unless a later optimization requires richer backend change metadata.

## Goals / Non-Goals

**Goals:**
- Refresh editor content for open workspace files after a successful run when those files do not contain unsaved local edits.
- Preserve the current active tab, selected file, and open-file list while new content is loaded.
- Prevent automatic refresh from overwriting local unsaved work.
- Add regression tests for stale open-file content and dirty-file protection.

**Non-Goals:**
- Do not change backend tool result schemas or introduce a new frontend/backend file-change protocol.
- Do not refresh files after failed or cancelled runs beyond existing session reload behavior.
- Do not change manual save semantics for dirty workspace files.

## Decisions

### Refresh open non-dirty files immediately after successful session reload
The workbench will extend the post-run success path after `reloadSessionState()` completes. It will inspect the current `openWorkspaceFileIds` and refresh file content for entries whose editor state exists and `isDirty === false`.

This timing is intentional:
- `reloadSessionState()` already refreshes workspace metadata, so file identity and `fileKey` lookups are current before content reload begins.
- Refreshing after the workspace reconciliation keeps the implementation local to `workbenchStore.ts` and avoids protocol changes.

Alternative considered:
- Clear editor cache only and wait for the user to reopen the file. Rejected because the active editor can still show stale content until another user action occurs.

### Reload content through the existing workspace-file open API
The refresh flow will use the existing file-open request path to fetch fresh content for each eligible file rather than introducing a separate endpoint or parallel cache.

Rationale:
- Reuses the established `agentApi.openWorkspaceFile(fileKey)` contract and existing editor-state builder logic.
- Keeps the source of truth for file content unchanged.
- Avoids inventing duplicate file-loading behavior.

Alternative considered:
- Add backend-emitted structured file-change targets and refresh only touched files. Rejected for this change because `local:edit` and `local:write` do not yet provide a unified, frontend-consumable mutation protocol, and that protocol work is larger than the immediate bug fix.

### Dirty files remain authoritative in the browser
Any open file with `isDirty === true` will be excluded from automatic refresh. Local edits remain visible until the user explicitly saves or otherwise resolves them.

Rationale:
- Prevents run-triggered refresh from silently overwriting unsaved user changes.
- Matches the current editor model, where dirty state represents the user's in-progress local source of truth.

Alternative considered:
- Force-refresh dirty files and ask the user to recover from history. Rejected because it would destroy unsaved work and violate current editing expectations.

## Risks / Trade-offs

- [More file-open requests after successful runs] -> Limit refresh scope to files that are both open and non-dirty.
- [Refresh races with agent/session switching] -> Run refresh only after the owning session's reload completes and rely on the store's existing session hydration guards.
- [Partial refresh failure leaves some tabs stale] -> Surface the underlying request failure through existing error handling rather than masking it with fallback content.

## Migration Plan

No data migration is required.

Implementation rollout:
1. Add a helper in the workbench store to refresh eligible open workspace editor states after successful run reconciliation.
2. Invoke that helper from the successful post-run reload path.
3. Add store tests covering refreshed non-dirty files and protected dirty files.

Rollback strategy:
- Revert the frontend store change and associated tests. No backend schema or persisted data changes are involved.

## Open Questions

- None for this proposal. The chosen scope intentionally avoids backend protocol work and targets the confirmed frontend cache bug only.
