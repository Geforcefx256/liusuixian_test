## 1. Monaco Text Engine Setup

- [x] 1.1 Add the Monaco frontend dependency and create a reusable text-editor adapter component for workspace text-class files.
- [x] 1.2 Route `text` and `mml` workspace files through the Monaco-backed text adapter while preserving the existing CSV table-view path.

## 2. Workspace Shell Integration

- [x] 2.1 Integrate the Monaco-backed text adapter into the workspace editor shell without changing tab, save, continue-processing, or save-state responsibilities.
- [x] 2.2 Keep MML toolbar controls shell-owned and wire Monaco text changes into the existing store-centered `content` update flow.
- [x] 2.3 Preserve the current save-time convergence model so toolbar metadata edits round-trip through the existing save path instead of forcing immediate text rewrites.

## 3. Verification

- [x] 3.1 Update workspace editor and store tests to cover Monaco-backed text/MML editing, CSV path preservation, and store-centered save behavior.
- [x] 3.2 Verify that continue-processing still saves dirty Monaco-edited files first and uses the latest saved active-file state as follow-up context.
