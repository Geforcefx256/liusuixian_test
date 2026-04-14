## Context

The current workbench already has the correct high-level product frame: a conversation-first shell with a history rail, a central conversation area, a workspace editor that opens only when files are opened, and a persistent right-side workspace sidebar. The remaining problems are mostly about shell clarity and pane ergonomics rather than missing product direction.

The current right sidebar mixes multiple naming layers for the same concept: the tab says `工作空间`, the eyebrow says `工作区文件`, and the computed title becomes something like `小曼智能体工作区`. At the same time, the primary workspace entry action is visually framed as `增加文件`, but the implementation only triggers upload. This creates a misleading promise that the workbench can create files even though the current backend only supports upload, open, and save.

The layout also still relies on fixed ratios and fixed clamps. That keeps implementation simple, but it makes low-resolution laptop behavior brittle: the sidebar tabs can wrap, the editor has no user-controlled reclaiming mechanism, and the shell can only respond by compressing or auto-collapsing panes.

This change crosses `apps/web`, `apps/agent-backend`, and the `agent-web-workbench` spec, so it benefits from explicit technical decisions before implementation.

## Goals / Non-Goals

**Goals:**
- Keep `工作空间` as the peer tab to `模板`, while removing redundant right-sidebar headings that repeat workspace meaning.
- Introduce a single governed `新增` entry point that accurately represents both upload and new-file creation flows.
- Add backend-supported blank file creation for TXT, MD, and MML workspace files.
- Remove the low-value `关闭工作区` action from the primary editor shell.
- Add manual pane resizing so users can tune width allocation in the desktop workbench.
- Improve low-resolution laptop behavior without abandoning the current conversation-first shell.

**Non-Goals:**
- Replacing the current workbench shell with a route-driven multi-page editor experience.
- Reworking the template library beyond keeping it as the peer tab to `工作空间`.
- Introducing a full document manager with rename, move, duplicate, or delete in this change.
- Redesigning the conversation composer, session model, or protocol runtime.

## Decisions

### Decision: The right sidebar becomes a title-light region

The right sidebar will keep the top-level tab label `工作空间`, but it will not render an additional headline such as `工作区文件` or `小曼智能体工作区` above the file tree.

Rationale:
- The tab already identifies the region type.
- The main conversation surface already shows the active agent identity.
- Removing the extra heading reduces low-resolution pressure and prevents repeated phrasing with no new information.

Alternatives considered:
- Keep `小曼智能体工作区` and only remove `工作区文件`: rejected because it still repeats the workspace concept and keeps unnecessary visual weight in a narrow panel.
- Rename the tab from `工作空间` to `工作区`: rejected because the user explicitly wants `工作空间` to stay as the peer label to `模板`.

### Decision: Replace upload-first framing with a unified `新增` action model

The workbench will use a single `新增` trigger for workspace file entry. That trigger will open a menu containing `上传文件`, `新建 TXT`, `新建 MD`, and `新建 MML`.

Rationale:
- `上传文件` is too narrow because it describes only one of the intended entry paths.
- `增加文件` implies a broader capability than the current implementation actually provides.
- `新增` is short enough for the constrained sidebar header and accurately represents a mixed action menu.

Alternatives considered:
- Keep separate `上传` and `新建` buttons: rejected because the sidebar header is already space-constrained and would regress low-resolution behavior.
- Keep the button labeled `增加文件`: rejected because the wording is longer, less precise, and still ambiguous.

### Decision: Blank workspace file creation uses the existing file surface with one new backend create operation

The backend will keep upload, open, and save behavior on the existing workspace-file surface, but it will add one explicit create-empty-file operation for TXT, MD, and MML files. The frontend will treat uploaded files and newly created files as first-class workspace files in the same sidebar tree and editor shell.

Rationale:
- The current backend already owns workspace file identity, persistence, and open/save flows.
- Creating empty files through the same surface avoids inventing a separate document subsystem.
- New TXT/MD/MML files should behave exactly like uploaded files once created.

Alternatives considered:
- Fake new-file creation entirely in the frontend until first save: rejected because the workspace sidebar and editor are already backend-backed and need stable file identity.
- Create files through a generic agent runtime tool instead of an HTTP API: rejected because file creation here is a deterministic workspace shell action, not an agent-run task.

### Decision: Pane resizing is user-controlled on desktop, with minimum widths and fallback collapse

The desktop workbench will add draggable splitters between the session rail and main content, between the conversation pane and workspace editor, and between the workspace editor and workspace sidebar. The implementation will honor minimum pane widths and preserve the existing sidebar collapse behavior as a fallback when the viewport becomes too constrained.

Rationale:
- Manual resizing solves the exact problem users are reporting: fixed ratios do not fit all laptop widths or task mixes.
- Minimum widths prevent drag interactions from destroying editor usability.
- Keeping collapse as a fallback preserves current small-width resilience.

Alternatives considered:
- Increase only the default sidebar width and keep fixed ratios: rejected because it improves one complaint but still prevents users from reallocating space for editing-heavy tasks.
- Make only the editor/sidebar boundary resizable: rejected because the session rail width is also a user-controlled reading trade-off in this shell.

### Decision: Workspace dismissal becomes file-led rather than shell-led

The editor shell will remove the dedicated `关闭工作区` primary action. Users will continue to close individual files from tabs, and the workspace-expanded state will naturally end when no file remains open.

Rationale:
- The shell-level close action does not represent a durable user goal.
- It competes with more important editor controls in a width-constrained toolbar.
- Closing the last file already provides a clearer mental model for exiting the expanded workspace state.

Alternatives considered:
- Keep `关闭工作区` but move it into an overflow menu: rejected because the action remains low-value and still complicates the shell.

## Risks / Trade-offs

- [Resizable panes add more layout state and drag complexity] → Mitigation: keep the splitter model simple, desktop-only, and bounded by explicit minimum widths.
- [Adding blank-file creation requires new backend API behavior] → Mitigation: extend the existing workspace file surface instead of introducing a separate document service.
- [Removing right-sidebar headings could make context feel too sparse] → Mitigation: retain the explicit `工作空间` tab and the visible file groups so the panel still reads clearly without a duplicate title.
- [Different file-entry modes may create inconsistent post-create behavior] → Mitigation: standardize post-create flow so new files appear in the same tree, become selectable immediately, and open directly in the editor.

## Migration Plan

1. Update the `agent-web-workbench` spec to define the new workspace naming, entry action, and pane resizing behavior.
2. Add backend support for blank workspace file creation for TXT, MD, and MML files on the existing file surface.
3. Update the frontend workspace shell to use the `新增` menu, remove redundant headings, and remove the `关闭工作区` action.
4. Introduce resizable splitters and width state in the desktop shell while preserving minimum widths and collapse fallback.
5. Validate low-resolution laptop behavior and confirm that the `工作空间` / `模板` tabs no longer wrap in supported desktop widths.

Rollback strategy:
- If drag-resize behavior proves unstable, disable splitters and keep the widened defaults while preserving the other naming and action improvements.
- If blank-file creation blocks implementation, the change can be paused before rollout because the new `新增` menu depends on backend support.

## Open Questions

- Should pane widths persist per browser session only or across reloads via local storage?
- Should new files use fixed default names such as `未命名.md` with local collision handling, or should creation require explicit naming up front?
