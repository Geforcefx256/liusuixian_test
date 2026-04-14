## 1. Startup diagnostics design-in-code

- [x] 1.1 Inventory the effective startup/config values that `apps/web-backend` and `apps/agent-backend` should expose in their startup summary without leaking secrets.
- [x] 1.2 Add service-local helpers or metadata exports that report config source and effective diagnostic values from the existing config loaders.

## 2. Web backend startup logging

- [x] 2.1 Update `apps/web-backend` startup flow to print a clear startup summary with protocol, host, port, base URL, health endpoint, config source, SQLite path, and MML rules paths/settings.
- [x] 2.2 Ensure `apps/web-backend` prints actionable warning/error diagnostics for startup bootstrap failures and process-level warnings or unhandled errors.

## 3. Agent backend startup logging

- [x] 3.1 Extend `apps/agent-backend` entrypoint logging to include host, port, base URL, health endpoint, config source, workspace/database paths, and other key startup diagnostics already available at boot.
- [x] 3.2 Ensure `apps/agent-backend` surfaces process warnings, unhandled rejections, and uncaught exceptions through its existing runtime logging path or stderr summary.

## 4. Verification

- [x] 4.1 Add or update tests for startup/config diagnostic output where practical, especially around config-source reporting and warning/error formatting.
- [x] 4.2 Run the relevant backend test coverage and verify local startup output now exposes config, port, health endpoint, and warning/error information for both services.
