## 1. Remove deleted tool semantics from runtime configuration

- [x] 1.1 Remove `transform_rows`-specific shipped configuration and runtime deny remnants from `apps/agent-backend` config files
- [x] 1.2 Remove gateway / MCP `defaultTool` type and config parsing semantics that can silently restore deleted tools

## 2. Tighten invocation behavior

- [x] 2.1 Update MCP execution to fail explicitly when `tool` is missing instead of falling back to an implicit default tool
- [x] 2.2 Verify runtime bootstrap and tool catalog paths no longer expose `transform_rows` through parsed defaults or fallback behavior

## 3. Clean repository semantics and verification

- [x] 3.1 Replace `transform_rows` with neutral surviving sample tool identifiers in affected backend tests and fixtures
- [x] 3.2 Run targeted backend tests and type checks covering gateway/MCP config parsing, catalog exposure, and explicit invocation failure paths
