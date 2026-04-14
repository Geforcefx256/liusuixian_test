## 1. Backend Workspace File Contracts

- [x] 1.1 Add runtime file-open contracts that return editor-capable payloads for supported `txt`, `csv`, and recognized MML text files.
- [x] 1.2 Add runtime save/update contracts that persist in-place edits for the current workspace file without introducing user-visible version handling.
- [x] 1.3 Extend runtime invocation context handling so workspace follow-up runs can carry an explicit active file in addition to the broader workspace file list.
- [x] 1.4 Add runtime tests for supported file open/save behavior and active-file-aware invocation context.

## 2. Frontend File Review Workspace

- [x] 2.1 Replace the placeholder workspace editor pane with adapter-driven rendering for text, csv, and MML-capable files while preserving the `index-v10` visual structure.
- [x] 2.2 Add artifact-result-card open-file actions that resolve referenced workspace files into the expanded workspace shell.
- [x] 2.3 Add in-place save behavior in the workspace editor, including saved/unsaved state feedback for the current file.
- [x] 2.4 Add frontend tests for opening files from the sidebar and result cards, rendering supported file content, and saving the current file in place.

## 3. MML Header Projection And Follow-Up Flow

- [x] 3.1 Implement frontend MML detection/rendering rules so recognized files expose `网元类型` and `网元版本` controls derived from the file header.
- [x] 3.2 Implement backend MML header parse/update behavior so toolbar edits are written back into the leading header comment on save.
- [x] 3.3 Add a workspace continue-processing action that submits the active file as the primary context for follow-up Agent execution.
- [x] 3.4 Add integration tests covering MML header round-tripping and active-file-driven follow-up Agent processing.
