## 1. Backend workspace contracts

- [x] 1.1 Extend workspace metadata types and persistence to represent `input` / `working` groups, hierarchical relative paths, and explicit `working` folder nodes.
- [x] 1.2 Update composer upload handling to accept optional relative paths, preserve UTF-8 paths, and store uploaded files under the scoped `input` tree.
- [x] 1.3 Allow uploaded `input` files to open and save in place through the existing workspace open/save APIs.

## 2. Backend working creation and rename flows

- [x] 2.1 Add `working` creation APIs for folders and blank `TXT` / `MD` / `MML` files under a validated parent directory.
- [x] 2.2 Extend workspace rename handling so nested `input` and `working` files keep their parent directory while changing basename only.
- [x] 2.3 Add constrained `working` folder rename support that preserves descendant content and rejects collisions or parent-directory moves.

## 3. Frontend workspace tree and editing UX

- [x] 3.1 Refactor workbench workspace types and store state to consume hierarchical workspace nodes for both `input` and `working`.
- [x] 3.2 Replace the flat sidebar file rendering with expandable tree rendering for folders and openable file rows in both groups.
- [x] 3.3 Update workspace editor behavior so editable `input` and `working` files auto-save on blur, before file switch, and before file close, with explicit failure visibility.

## 4. Frontend NEW actions and regression coverage

- [x] 4.1 Add a `NEW` control for `working` that creates folders and blank `TXT` / `MD` / `MML` files in the current working-directory context.
- [x] 4.2 Add row-level `working` folder rename UX and refresh tree reconciliation after successful file or folder rename.
- [x] 4.3 Update backend and frontend tests for upload-path preservation, tree rendering, editable `input` saves, `working` creation, folder rename, and auto-save boundaries.
