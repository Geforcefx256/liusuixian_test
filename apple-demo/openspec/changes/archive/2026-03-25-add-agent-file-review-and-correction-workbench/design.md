## Context

The current product already has the skeleton of a conversation-led workbench: the main shell keeps conversation central, the right-side workspace is scoped by `user + agent`, and Agent runs can already produce `artifact_ref` outputs that land in the workspace. The missing piece is the fallback loop after generation. Users can see that a file exists, but they cannot open real content, make a small correction, save it, and continue the Agent flow against that corrected file.

This change touches both `apps/web` and `apps/agent-backend`, and it also upgrades existing OpenSpec requirements that currently describe the workspace as a minimal shell without editing. It therefore benefits from an explicit design before implementation.

## Goals / Non-Goals

**Goals:**
- Preserve conversation as the primary product entry point while upgrading the workspace into a real fallback file-review surface.
- Keep the visual direction and layout model anchored to `index-v10` instead of introducing a new file-first shell.
- Let users open supported files from conversation results or the workspace tree, inspect real content, make minimal corrections, save the current file in place, and continue the Agent flow against that active file.
- Introduce an explicit active-file model so follow-up Agent actions can prefer the currently opened file over undifferentiated workspace-wide file lists.
- Treat MML as a text-first format with a lightweight structured projection from a standard header comment.

**Non-Goals:**
- File version management, file-history restore, or visible draft/original branching.
- A standalone file workflow that replaces conversation as the primary interaction model.
- Full file-manager behavior such as rename, move, delete, or folder authoring.
- Full MML structural editing, heavy sheet authoring, or complex domain validation derived from ME type or version.
- Recreating the entire `index-v10` prototype behavior where that behavior would add new product surface area rather than completing the fallback loop.

## Decisions

### Decision: Keep the conversation-led shell and insert the file workspace as a side-by-side fallback panel

The expanded workspace will continue to use the current workbench shell layout: history rail on the left, conversation surface in the middle-left, workspace editor in the middle-right, and workspace sidebar on the far right. This preserves the current product hierarchy and matches the desired interpretation of `index-v10`: reuse its visual language and file-area composition without turning the product into a file-first application.

Alternative considered:
- Promote the file workspace to the primary center surface once any file is opened.

Why not:
- That would weaken the "Agent first" mental model and make file handling compete with the conversation flow instead of serving it.

### Decision: Model one explicit active file for follow-up Agent actions

The workbench will distinguish the set of workspace files from the single active file. The active file is the currently opened and selected file tab in the workspace editor. Follow-up Agent actions such as "continue processing" will send that active file as the primary file context, while the broader workspace file list remains supplementary context.

Alternative considered:
- Keep sending every workspace file as undifferentiated context.

Why not:
- That is too ambiguous for a correction-oriented workflow and makes prompt context noisier as the workspace grows.

### Decision: Saving overwrites the current file and does not surface version concepts

The product model will treat save as "overwrite the current file". The UI will not introduce explicit versions, copies, branches, or revision history. If the implementation later chooses to keep an internal recovery trail, that remains a hidden implementation concern and must not become part of user-visible workflow or Agent-facing context.

Alternative considered:
- Create user-visible working copies or new file versions on first edit.

Why not:
- It increases user cognitive load, complicates Agent prompting, and conflicts with the desired simplicity of "open, fix, save, continue".

### Decision: Support a narrow first batch of file adapters: text, csv, and MML-like text

The workspace editor will use lightweight file adapters:
- Text adapter for `txt`-like files with direct text editing.
- CSV adapter for table preview and minimal cell-level correction.
- MML adapter layered on top of text editing with lightweight header projection.

Alternative considered:
- Build a generic editor abstraction for many file kinds from the start.

Why not:
- The current change is about completing a specific fallback loop, not about introducing a general-purpose file platform.

### Decision: Treat MML as a special text file recognized from a standard leading header

MML will not be modeled as an independent rich document system in this change. Instead, the editor will treat it as text content with a recognized leading header comment:

`/* ME TYPE=<type>, Version=<version> */`

The file is considered MML if that header is found in the opening region of a supported text file after ignoring BOM and leading blank lines. `网元类型` and `网元版本` in the toolbar are a structured projection of that header. Changing those toolbar values updates the header on save; changing the header directly in text and saving causes the UI to re-parse and refresh the toolbar values.

Alternative considered:
- Define MML only from extension or make it a fully separate structured file type.

Why not:
- Extension-only detection is incorrect for current product files, and a fully separate document model would make the first iteration much heavier than needed.

### Decision: Use artifact result cards as the primary file-open affordance

Structured result cards for `artifact_ref` will gain a direct "open file" affordance. The existing workspace tree remains a valid secondary entry point through double-click open. This keeps file review attached to the conversation result that produced the file instead of forcing users to mentally switch to the sidebar to find the latest output.

Alternative considered:
- Require users to locate generated files only from the workspace tree.

Why not:
- It weakens the continuity between generation and review, especially when multiple outputs are present.

### Decision: Extend backend file contracts from minimal descriptors to open/save/editor context

The backend currently exposes enough metadata to render a sidebar and identify a file, but not enough to open and save real content. The runtime contract will therefore grow to support:
- file open payloads for supported file kinds,
- save/update of the current file content,
- active-file-aware invocation context for follow-up Agent runs,
- MML header parse/update behavior for supported text files.

Alternative considered:
- Keep file opening entirely client-side using only sidebar metadata and ad hoc fetches.

Why not:
- Generated outputs and uploaded files live in runtime-owned workspace storage, so the runtime needs to stay authoritative over open/save semantics and file-kind interpretation.

## Risks / Trade-offs

- [Visual drift from `index-v10`] → Keep the existing layout, reuse current workbench regions, and add only the minimal actions needed for the fallback loop.
- [Active-file context could conflict with multi-file workflows] → Treat active file as the primary context and keep the rest of the workspace available as secondary context rather than removing it.
- [MML header parsing may be brittle if files use non-standard comments] → Limit first-pass detection to the agreed standard header and fall back to plain text behavior when detection fails.
- [CSV editing can expand into a spreadsheet product] → Keep the first implementation to minimal cell correction and avoid broad table authoring features.
- [Overwrite save increases the cost of accidental edits] → Keep the product model simple but ensure the UI can clearly communicate unsaved vs saved state before further processing.

## Migration Plan

- No user-visible data migration is required.
- Introduce the new backend file-open/save and active-file-context contracts alongside the existing workspace metadata routes.
- Upgrade the frontend workspace editor from placeholder rendering to adapter-driven file rendering using the new runtime contracts.
- Preserve existing workspace sidebar behavior so users can continue opening files from the same entry points.
- If rollback is needed, the frontend can fall back to the current placeholder workspace editor while the runtime continues to expose the older sidebar metadata contract.

## Open Questions

- Whether the first CSV editing pass should allow only direct cell edits or also simple row insertion/removal.
- Whether the MML adapter should ship with any lightweight read-only summary navigation in the first release or remain strictly text-plus-toolbar.
