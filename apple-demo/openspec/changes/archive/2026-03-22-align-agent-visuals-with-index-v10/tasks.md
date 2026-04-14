## 1. Shared Agent Visual Primitives

- [x] 1.1 Extend `apps/web/src/styles.css` with the shared Agent visual tokens and utility classes needed for badge, title/subtitle, status pill, panel eyebrow, soft input shell, and Agent rail surface styling.
- [x] 1.2 Update `apps/web/src/components/workbench/WorkbenchShell.vue` to reduce top-header visual weight and pass the existing Agent title/subtitle props into the active conversation pane without changing shell layout or behavior.

## 2. Home And Conversation Alignment

- [x] 2.1 Update `apps/web/src/components/workbench/ConversationPane.vue` to add a persistent Agent identity bar above the message list and restyle the message rail and composer to match the shared Agent visual language.
- [x] 2.2 Update `apps/web/src/components/workbench/HomeStage.vue` so the home header, skill cards, composer, and status treatment align with the same Agent identity and input styling used in the conversation pane.

## 3. Workspace Context And Verification

- [x] 3.1 Update `apps/web/src/components/workbench/WorkspaceContextPane.vue` so its section headers, upload action, file list rows, and summary text read as a lightweight workbench side panel without introducing new workspace behavior.
- [x] 3.2 Verify the aligned visuals at desktop and compact breakpoints, ensuring the home stage and active session preserve consistent Agent identity, unchanged prompt/upload behavior, and phase 1 lightweight workspace scope.
