## Why

The current workbench only provides a minimal workspace shell, which lets users see workspace files and open a placeholder pane but does not let them inspect or correct real Agent-generated file content. That leaves a gap in the core workflow: users can ask the Agent to generate files, but when the output needs human review or repair there is no first-class fallback loop inside the product.

## What Changes

- Upgrade the current minimal workspace shell into a dialog-driven file fallback workbench that preserves conversation as the primary entry point.
- Allow users to open referenced output files directly from structured conversation results instead of relying only on the right-side file tree.
- Replace the workspace placeholder pane with real file-opening behavior for supported `txt`, `csv`, and MML-like text files.
- Add minimal file correction behavior so users can edit and save the current file in place, then continue the Agent workflow against that active file.
- Introduce an explicit active-file model so follow-up Agent actions can prefer the currently opened file instead of treating every workspace file as equal context.
- Recognize MML files from a standard leading text header such as `/* ME TYPE=UNC, Version=20.11.2 */`, expose `网元类型` and `网元版本` as structured toolbar controls, and write those values back into the file header when the file is saved.
- Keep the `index-v10` visual direction and layout model for the expanded workspace instead of introducing new high-complexity panels or a separate file-first product mode.
- Exclude file version management, history restore, full file-manager operations, complete MML structural editing, and a standalone non-dialog file workflow from this change.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `agent-web-workbench`: upgrade workspace opening from a placeholder shell to a real file review-and-correction surface, add result-card file opening, preserve conversation-led layout, and introduce active-file-driven follow-up actions.
- `agent-backend-runtime`: extend workspace file contracts beyond minimal descriptors so the frontend can open, save, and continue processing supported files, including MML header detection and active-file-aware invocation context.

## Impact

- `apps/web` workbench shell, result-card interactions, workspace editor components, workbench store state, and related tests.
- `apps/agent-backend` workspace file routes, file-open/save contracts, active-file invocation context, and MML header parsing/update behavior.
- Existing OpenSpec requirements for `agent-web-workbench` and `agent-backend-runtime`.
