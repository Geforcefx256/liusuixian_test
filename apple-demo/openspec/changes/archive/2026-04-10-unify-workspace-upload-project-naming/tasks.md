## 1. Canonical Runtime Naming

- [x] 1.1 Rename file-store workspace directory constants, group prefixes, source enums, and workspace-relative path generation to `upload` / `project`
- [x] 1.2 Update workspace file open/save payloads, runtime session metadata, and agent route validators to use `upload` / `project` without translation
- [x] 1.3 Rename runtime workspace APIs for project file and folder creation or rename, including server routes and frontend API clients

## 2. Tool And Skill Contract Renaming

- [x] 2.1 Update `local:write` descriptions, schema text, validation errors, and artifact references from `outputs` to `project`
- [x] 2.2 Rename governed skill script path-base names, environment variables, artifact path handling, and validator messages to `uploadDir` / `projectDir`
- [x] 2.3 Update workspace-agent context assets and runtime file-context guidance so models see only `upload/...` and `project/...`

## 3. Frontend Workbench Adoption

- [x] 3.1 Remove frontend group-label normalization and switch workbench types, store logic, and sidebar tree structures to consume `upload` / `project` directly
- [x] 3.2 Update workbench file-opening, conflict handling, and active-file path usage so the frontend emits and displays only canonical `upload` / `project` paths

## 4. Verification

- [x] 4.1 Rewrite backend tests, frontend tests, and skill execution fixtures that currently assert `input` / `working` / `uploads` / `outputs`
- [x] 4.2 Run the targeted test suites covering workspace files, runtime routes, workbench store or sidebar, and skill script execution after the rename
