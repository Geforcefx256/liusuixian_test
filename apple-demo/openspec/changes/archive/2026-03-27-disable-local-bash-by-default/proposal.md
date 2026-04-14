## Why

The shipped runtime currently exposes `local:bash` even though the only implemented sandbox backend is `macos-seatbelt`. This makes default agent flows route into a tool that is unavailable in common validation environments and blocks teams that only need to verify non-shell business flows.

## What Changes

- **BREAKING**: Add `local:bash` to the shipped `apps/agent-backend/config.json` runtime tool deny list so it is hidden and non-invocable by default.
- Preserve the existing local tool provider implementation so operators can explicitly re-enable `local:bash` later by changing configuration.
- Keep non-shell local tools such as `local:write`, `local:read_file`, `local:list_directory`, `local:find_files`, and `local:question` available under shipped defaults.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-backend-runtime`: Change the shipped runtime deny defaults so `local:bash` is excluded from runtime catalog and invocation unless operators explicitly remove that deny entry.

## Impact

- Affects `apps/agent-backend/config.json` shipped defaults for runtime tool visibility.
- Affects runtime bootstrap/catalog expectations and tests that currently assume `local:bash` is visible by default.
- Affects operator documentation for default tool availability and explicit re-enablement.
