## Why

The current conversation composer mixes upload, blank-file creation, support-copy, and send actions into one cramped bottom row. That creates four user-facing problems at once: the primary button is mislabeled as `新增文件`, the visible support-copy does not match the product's intended supported formats, the long inline description wastes scarce horizontal space, and the send button deforms under common laptop-width workbench layouts.

This is especially problematic because the composer sits at the bottom edge of the workbench. Any attempt to solve the copy problem by adding a larger dropdown or richer mixed-action menu to the composer risks running into viewport-bottom clipping and makes the interaction harder to trust.

## What Changes

- Refine the conversation composer so its primary left-side action is `上传文件` rather than the current mixed `新增文件` framing.
- Remove blank-file creation actions from the composer and keep file-creation entry points in the right workspace area, where they match workspace-management intent better.
- Replace the current always-visible support-copy with a compact adjacent info affordance that explains supported upload formats without consuming the main composer row.
- Make the upload help affordance open upward from the composer and support hover, focus, and click so it remains usable near the viewport bottom.
- Align the visible upload-format contract across frontend and backend with the intended supported formats for this surface, currently `TXT / MD / CSV`.
- Rework the composer action-row layout so the send button keeps a stable shape on laptop-width workbench layouts and does not collapse into a narrow vertical pill when the center pane becomes constrained.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-web-workbench`: refine the conversation composer entry model, upload help presentation, and low-width action-row behavior in the authenticated workbench shell.

## Impact

- Affected frontend code in `apps/web`, especially `ConversationPane`, `WorkspaceEntryMenu`, shared button/layout styles, and related composer tests.
- Affected backend and API contract in `apps/agent-backend` and `apps/web` if the current upload allowlist is narrowed to the intended `TXT / MD / CSV` surface contract for this composer flow.
- Affected workbench UX contract in `openspec/specs/agent-web-workbench/spec.md`, because the composer entry semantics and low-width behavior change from a mixed create/upload model to an upload-first model.
