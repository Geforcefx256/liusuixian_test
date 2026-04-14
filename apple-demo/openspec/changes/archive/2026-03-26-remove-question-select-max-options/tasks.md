## 1. Update question runtime contract

- [ ] 1.1 Remove the `local:question` 4-option maximum from runtime validation while keeping the minimum option count at 2.
- [ ] 1.2 Remove `maxItems` from question tool schemas and update model-facing validation/tool descriptions to match the new minimum-only contract.

## 2. Align prompts and tests

- [ ] 2.1 Update workspace-agent and mml-converter question guidance so `select` is described as closed-choice input with at least 2 options, without a 4-option ceiling.
- [ ] 2.2 Update question-related tests to treat fewer than 2 options as invalid and to reflect the revised error wording and recovery expectations.

## 3. Verify implementation outputs

- [ ] 3.1 Run the affected automated tests for local question validation, agent-loop recovery, and agent context loading.
- [ ] 3.2 Rebuild generated runtime artifacts such as `dist/` outputs if the implementation workflow requires committed build results.
