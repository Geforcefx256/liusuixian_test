## Why

The current workspace editor completes the fallback loop functionally, but its text surface is still a basic textarea. That makes long text and MML files harder to inspect, weakens the product's "human correction" path, and leaves the editor boundary underspecified just as the workbench is becoming a more formal file-review surface.

## What Changes

- Replace the current textarea-based text editor with a Monaco-backed text editing surface for text-class workspace files.
- Limit Monaco usage to `txt` files and the text view of `mml` files so the workbench does not drift into a file-first IDE.
- Keep CSV editing on the existing table-view path rather than merging CSV into Monaco.
- Preserve the current workbench shell responsibilities for tabs, save, continue processing, view switching, and save-state feedback.
- Preserve the current MML toolbar as an external structured projection of the leading header comment instead of moving MML metadata editing into Monaco.
- Keep the frontend file model store-centered so file content, metadata, dirty state, and continue-processing context remain owned by workbench state rather than editor instance state.
- Clarify that toolbar edits do not need to rewrite text in real time and instead converge into the saved file through the existing save path.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `agent-web-workbench`: define Monaco-backed text editing for text-class workspace files, keep MML toolbar responsibilities outside the editor engine, and preserve CSV as a separate table-oriented editing path.

## Impact

- `apps/web` workspace editor components, editor adapter structure, workbench store integration, and related tests.
- The workbench interaction contract for opening, editing, saving, and continuing from text-class files.
- No intended change to workspace ownership, agent conversation flow, or backend file-open/save API shape.
