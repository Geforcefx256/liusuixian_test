## 1. Vue Frontend Scaffold

- [x] 1.1 Initialize the new `apps/web` Vue frontend scaffold with Vite, TypeScript, and state management conventions aligned with the repo.
- [x] 1.2 Convert the `index-v10.html` information architecture into reusable Vue layout components for the home stage, session rail, chat area, and workspace context area.
- [x] 1.3 Establish frontend API configuration and same-origin/proxy assumptions for `/web/api/*` and `/agent/api/*`.

## 2. Authentication Experience

- [x] 2.1 Implement auth mode discovery, login entry, and authenticated workbench gating against `/web/api/auth/*`.
- [x] 2.2 Implement current-user loading and shell presentation in the workbench header.
- [x] 2.3 Implement logout behavior and authenticated state reset in the Vue frontend.

## 3. Agent Workbench Core

- [x] 3.1 Implement backend-driven agent metadata loading for the workbench home stage.
- [x] 3.2 Implement session listing, session creation, and session switching using the migrated agent backend APIs.
- [x] 3.3 Implement message history loading and streamed run execution rendering in the conversation area.

## 4. Workspace Context And Uploads

- [x] 4.1 Replace the prototype editor/preview region with a phase-1 workspace context panel that focuses on task context, file list, and result/status summaries.
- [x] 4.2 Implement file upload entry points and uploaded file list rendering using `/agent/api/files/upload`.
- [x] 4.3 Ensure the phase-1 workbench remains fully usable without file content preview, table view, or text editing.

## 5. Validation

- [x] 5.1 Add focused frontend tests for auth gating, session loading, and streamed conversation behavior.
- [x] 5.2 Verify end-to-end integration with the migrated backend in local development, including login, session creation, message streaming, and file upload.
