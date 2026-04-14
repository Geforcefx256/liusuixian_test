## 1. Align runtime guidance

- [x] 1.1 Update `apps/agent-backend/assets/agents/workspace-agent/CONTEXT.md` so `local:question` guidance describes `select` as closed-choice input with at least 2 options and no 4-option ceiling.
- [x] 1.2 Update `apps/agent-backend/assets/agents/mml-converter/CONTEXT.md` so its question-tool rules no longer require `select` option counts to stay within `2-4`.

## 2. Align verification

- [x] 2.1 Update prompt or context-related tests and assertions that still encode the obsolete `2-4` guidance.
- [x] 2.2 Search for and remove any remaining repository-owned model-facing wording that still implies a 4-option maximum for `local:question` `select` inputs.

## 3. Verify repository state

- [x] 3.1 Run focused backend tests covering question guidance, prompt loading, or related assertions affected by this alignment.
- [x] 3.2 Review the final repository state to confirm runtime validation, schemas, tool descriptions, and agent context guidance all describe the same minimum-only contract.
