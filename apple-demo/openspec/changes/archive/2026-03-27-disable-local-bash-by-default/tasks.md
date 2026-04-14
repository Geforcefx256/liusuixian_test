## 1. Runtime Defaults

- [x] 1.1 Add `local:bash` to the shipped `apps/agent-backend/config.json` `runtime.tools.deny` list.
- [x] 1.2 Keep the shipped local runtime surface limited to non-bash tools so `local:write`, `local:read_file`, `local:list_directory`, `local:find_files`, and `local:question` remain available by default.

## 2. Verification

- [x] 2.1 Update or add tests that assert shipped runtime bootstrap/catalog payloads do not expose `local:bash` by default.
- [x] 2.2 Update or add tests that assert denied invocation of `local:bash` and continued availability of non-bash local tools under shipped defaults.

## 3. Documentation

- [x] 3.1 Update operator-facing documentation to state that `local:bash` is disabled by default and requires explicit configuration changes to re-enable.
