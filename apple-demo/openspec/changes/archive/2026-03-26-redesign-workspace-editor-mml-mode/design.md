## Context

The current workspace-expanded shell spends horizontal space in three places at once: the editor header mixes five information tiers in one flex row, the right workspace sidebar keeps a fixed in-flow width, and the left session rail expands on hover by changing layout width. On laptop-class widths this pushes the editor toolbar into multiple rows and makes the editing surface feel unstable.

The current UI also exposes MML as a file-type concern (`类型 MML`) even though the underlying product model is closer to “text plus optional MML interpretation.” Internally, the workbench already stores MML metadata on the file and reuses the existing save-time MML behavior, so this change can reframe the user experience without inventing a new persistence model.

Constraints:
- `按 MML 解析` only applies to `txt` files in this change.
- Existing MML save/model behavior remains authoritative.
- The UI must not expose technical terms such as `Schema`.
- The editor header must stay single-line in normal workspace-expanded desktop use instead of relying on `flex-wrap`.

## Goals / Non-Goals

**Goals:**
- Reframe MML in the editor UI as an optional parsing mode for `txt` files rather than a permanent user-facing file type.
- Keep the primary editor toolbar width-stable with only high-frequency controls visible by default.
- Preserve discoverability of `网元类型` and `网元版本` through a summary-style MML entry rather than always-visible inline inputs.
- Make the right workspace sidebar yield before the editor loses core working width.
- Stop the left session rail from causing hover-triggered layout jitter.
- Preserve the current backend contracts and existing MML save/writeback behavior.

**Non-Goals:**
- Replacing the internal `WorkspaceEditorMode` model in this change.
- Changing CSV behavior or enabling MML parsing for non-`txt` files.
- Redesigning workbook grid internals or MML table editing semantics beyond entry-state messaging.
- Changing backend APIs, file ownership, or workspace persistence boundaries.

## Decisions

### Decision: Present MML as a parsing-mode entry while preserving the current internal `mml` mode

The UI SHALL present MML through a summary-style `按 MML 解析` entry for `txt` files, but the implementation SHALL continue to use the existing internal `mml` mode and metadata persistence path once the user enables MML handling.

Rationale:
- This keeps the user-facing model aligned with the product truth that a text file can become MML-handled without forcing a broad internal refactor.
- Existing save behavior, metadata parsing, and MML workbook logic already rely on the current `mml` mode and should remain stable for this change.
- It allows text files to surface the MML affordance before activation while minimizing store churn.

Alternatives considered:
- Replace `WorkspaceEditorMode` with a more explicit “text + interpretation” model immediately.

Why not:
- That would widen scope into store, API, and rendering contracts that are not needed to deliver the UX correction in this change.

### Decision: Split the editor chrome into a single-line primary toolbar plus an expandable MML configuration area

The editor SHALL keep the primary toolbar to view switching, the MML summary entry, save state, and save action. `网元类型` and `网元版本` SHALL move into an expandable secondary area below the primary toolbar.

The summary entry SHALL communicate user-facing state only:
- `按 MML 解析：未启用`
- `按 MML 解析：待配置`
- `按 MML 解析：<networkType> · <networkVersion>`
- `按 MML 解析：<networkType> · <networkVersion> · 暂不可用`

Rationale:
- This preserves discoverability without spending always-on toolbar width on two form controls.
- The primary row remains stable and action-oriented.
- Users see the existence and current state of MML handling before they need to edit it.

Alternatives considered:
- Keep the metadata inputs always visible but shrink them.
- Hide MML configuration behind a generic `属性` button.

Why not:
- Shrinking controls does not solve the hierarchy problem.
- A generic `属性` entry weakens information scent and makes the MML affordance too easy to miss.

### Decision: Map internal schema state to task-oriented UI copy

The workbench SHALL keep its internal readiness/error state machinery, but user-visible copy SHALL describe outcomes rather than implementation terms. UI text will refer to readiness of the table view and current support status, not to `Schema`.

Rationale:
- `Schema` is implementation language and does not help operators decide what to do next.
- Outcome-oriented copy aligns with the user task: can this text be handled as MML and can it use table view.

Alternatives considered:
- Surface current internal state labels directly.

Why not:
- It leaks system terminology and weakens usability for non-technical operators.

### Decision: Let side panes yield before the editor toolbar collapses

The workspace-expanded shell SHALL rebalance width in two ways:
- the right workspace sidebar yields first under width pressure and collapses to a re-open affordance before the editor loses its stable toolbar layout
- the left session rail keeps a stable in-flow collapsed width and expands as an overlay panel triggered by deliberate interaction rather than hover-driven width change

Rationale:
- The active document is the highest-value surface during correction work.
- Overlay expansion preserves access to session history without causing editing jitter.
- This change addresses both the editor header overflow and the surrounding layout causes.

Alternatives considered:
- Keep current pane widths and rely on more aggressive control compression.
- Keep hover expansion and accept occasional reflow.

Why not:
- Both approaches preserve the same underlying instability and make the editor feel cramped or jumpy.

## Risks / Trade-offs

- [User may still read MML as a file type because the internal mode remains] → Use the `按 MML 解析` entry as the sole primary wording and remove `类型 MML` from the header entirely.
- [Collapsed right sidebar may hide workspace context too early for some users] → Keep an immediate re-open affordance and preserve manual collapse/expand control.
- [Overlay session rail may affect focus and keyboard flow] → Use explicit open/close interaction, accessible labels, and predictable focus return.
- [Existing tests may assume `mml` files are the only path that exposes MML controls] → Update component tests to cover `txt` entry discovery and activation flows.

## Migration Plan

No backend or persisted-data migration is required. The change is a frontend behavior and copy update that continues to use the existing MML save path. Rollback is a straightforward revert of the UI/layout changes if needed.

## Open Questions

None for this proposal. The user-facing copy, file applicability, and persistence approach have been fixed for implementation.
