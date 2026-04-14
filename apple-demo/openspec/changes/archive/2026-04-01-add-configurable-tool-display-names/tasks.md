## 1. Backend runtime configuration

- [x] 1.1 Extend `apps/agent-backend` runtime config loading to support `runtime.tools.displayNames`.
- [x] 1.2 Seed default Chinese display names for the built-in `local:*` and `skill:*` tools in `apps/agent-backend/config.json`.
- [x] 1.3 Add backend tests covering configured-name lookup and fallback behavior for unmapped tools.

## 2. Runtime metadata and stream events

- [x] 2.1 Update tool invocation display-name resolution so `tool.started.displayName` prefers the configured full-tool mapping.
- [x] 2.2 Extend runtime bootstrap payload/types to publish the tool display-name mapping to the frontend.
- [x] 2.3 Add or update backend tests to verify bootstrap and stream events expose consistent tool display names.

## 3. Workbench header rendering

- [x] 3.1 Update frontend runtime bootstrap types/store state to retain the backend-provided tool display-name mapping.
- [x] 3.2 Update completed assistant header summary rendering to resolve tool names from the bootstrap mapping before falling back to normalized names.
- [x] 3.3 Add frontend tests covering both configured display names and fallback display behavior.

## 4. Validation

- [x] 4.1 Run targeted backend and frontend test suites for the tool display-name change.
- [x] 4.2 Manually verify that `skill:read_asset` renders as `读取技能文件` and `local:question` renders as `等待你回答` in both in-flight and completed assistant headers.
