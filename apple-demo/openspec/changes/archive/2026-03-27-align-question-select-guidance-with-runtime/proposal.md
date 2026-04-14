## Why

The repository now contains the runtime-side removal of the `local:question` 4-option ceiling, but some model-facing guidance still tells agents that `select` is limited to `2-4` choices. That prompt drift keeps the product contract inconsistent and can push models toward avoidable retries or incorrect tool payloads.

## What Changes

- Align remaining agent context and prompt guidance with the current runtime contract: `select` requires at least 2 closed-choice options and no longer has a 4-option maximum.
- Update any question-related verification coverage that still assumes the old `2-4` wording in agent-facing guidance.
- Treat the previously archived `remove-question-select-max-options` work as historical context only; this change closes the remaining repository drift based on current code state.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agent-backend-runtime`: model-facing question-tool guidance and verification MUST match the current minimum-only `select` contract already enforced by runtime code.

## Impact

- Affected runtime guidance: `apps/agent-backend/assets/agents/workspace-agent/CONTEXT.md`, `apps/agent-backend/assets/agents/mml-converter/CONTEXT.md`
- Affected verification: question-related prompt or context assertions that still encode the old `2-4` wording
- Affected documentation flow: closes drift left behind by `openspec/changes/archive/2026-03-26-remove-question-select-max-options/`
