## 1. Shell Header Restructure

- [x] 1.1 Refactor `apps/web/src/components/workbench/WorkbenchShell.vue` to merge the project logo and backend-driven Xiaoman identity into one primary header cluster.
- [x] 1.2 Move the `鏂板缓浼氳瘽` and `鍘嗗彶浼氳瘽` entry points into the unified header and wire them to the existing workbench store actions.
- [x] 1.3 Remove the permanent left `SessionRail` layout column, its splitter, and the related header/body shell markup that only exists to host the rail.

## 2. History Management Surface

- [x] 2.1 Convert `SessionRail.vue` into an explicit history-management surface triggered from the header, or replace it with an equivalent component that reuses the current session list, select-session, and delete-session flows.
- [x] 2.2 Simplify the history-management surface to search, session list, owner indicator, session selection, and single-session deletion only.
- [x] 2.3 Remove per-session preview rendering and the frontend `娓呯┖鍘嗗彶浼氳瘽` entry while preserving existing delete confirmation and shared-workspace lock behavior.

## 3. Conversation And Layout Cleanup

- [x] 3.1 Remove the standalone Xiaoman identity bar from `apps/web/src/components/workbench/ConversationPane.vue` and adjust empty-state, messages, and composer spacing to fit the new shell hierarchy.
- [x] 3.2 Delete left-rail width state and resize logic from `WorkbenchShell.vue`, keeping only the conversation/editor/sidebar desktop width model.
- [x] 3.3 Verify responsive header wrapping and pane-owned scrolling so the new header actions, history surface, conversation surface, and workspace sidebar remain usable on supported widths.

## 4. Verification

- [x] 4.1 Update workbench component tests to cover header-triggered history opening, session selection, deletion confirmation, and shared-workspace delete locking.
- [x] 4.2 Update layout tests to reflect the absence of a permanent left rail and the retained conversation/editor/sidebar resize behavior.
- [x] 4.3 Run targeted frontend verification for the affected workbench tests and any relevant type-check command before implementation is considered complete.
