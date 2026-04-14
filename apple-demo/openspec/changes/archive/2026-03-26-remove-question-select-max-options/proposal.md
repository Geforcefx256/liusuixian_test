## Why

The current `local:question` contract limits `select` fields to 2-4 options, which is stricter than the actual workbench UI and forces agents to switch to `text` for many closed-choice questions that still have a bounded option set. That mismatch now blocks legitimate question flows and makes the runtime guidance harder to follow consistently.

## What Changes

- Relax the `local:question` select-option contract from `2-4` items to `at least 2` items with no maximum.
- Update runtime validation, schema metadata, and model-facing tool descriptions to remove the hard `4`-option ceiling while keeping the minimum closed-choice requirement.
- Keep the existing rule that open-ended values must still use `text` rather than `select`, even after the max-option ceiling is removed.
- Update agent context guidance and automated tests so runtime behavior, model instructions, and validation expectations stay aligned.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-backend-runtime`: change the question-tool contract so `select` inputs accept any closed-choice option list with at least 2 items instead of enforcing a 4-item maximum.

## Impact

- Affected code: `apps/agent-backend/src/runtime/tools/local/questionContract.ts`, `apps/agent-backend/src/runtime/tools/local/schemas.ts`, `apps/agent-backend/src/runtime/tools/providers/localProvider.ts`
- Affected runtime guidance: `apps/agent-backend/assets/agents/workspace-agent/CONTEXT.md`, `apps/agent-backend/assets/agents/mml-converter/CONTEXT.md`
- Affected tests: local question provider validation, agent-loop recovery coverage, agent catalog/context assertions, and related question validation classifier coverage
