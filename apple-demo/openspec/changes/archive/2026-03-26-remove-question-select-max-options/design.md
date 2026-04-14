## Context

`local:question` currently treats `select` fields as valid only when they contain 2-4 options. That ceiling is enforced in runtime validation, JSON schema metadata, tool descriptions, agent context guidance, and automated tests. The workbench renderer itself does not impose the same ceiling, so the stricter backend contract is an artificial product constraint rather than a UI limitation.

This change needs a design because the limit is encoded across multiple runtime layers and was previously documented as an intentional decision. The new behavior must stay coherent for validation, model guidance, and recovery-oriented error handling.

## Goals / Non-Goals

**Goals:**
- Allow `local:question` `select` payloads to contain any closed-choice option list with at least 2 items.
- Remove the hard `4`-option ceiling consistently from runtime validation, JSON schema, and model-visible guidance.
- Preserve existing question-flow guarantees around explicit user selection, field-level required handling, and answer validation.
- Keep agent instructions and automated tests aligned with the new contract so model behavior does not drift from runtime behavior.

**Non-Goals:**
- Do not change the protocol-based question lifecycle or introduce a new reply API.
- Do not change workbench rendering mechanics for question forms beyond accepting the expanded backend contract.
- Do not relax the rule that open-ended values must use `text` rather than `select`.
- Do not add fallback or silent coercion from invalid select payloads to text fields.

## Decisions

### Decision: Keep a minimum of 2 options and remove only the maximum ceiling

`select` will remain a closed-choice input and MUST still contain at least 2 options. The runtime will no longer reject payloads only because they contain more than 4 options.

Rationale:
- A single option is not a meaningful choice and usually signals that the caller should not be asking a question.
- The user requirement is to broaden the range, not to redefine `select` semantics.
- Preserving the minimum keeps validation simple and avoids low-signal question cards.

Alternatives considered:
- Allow 1 option.
- Change the minimum from 2 to 3.

Why not:
- Allowing 1 option weakens the contract and creates ambiguous UX.
- Raising the minimum to 3 changes semantics beyond the requested scope.

### Decision: Remove quantity-based text guidance but keep type-based guidance

Model-facing descriptions and validation detail will stop saying that values with more than 4 choices must use `text`. Guidance will instead distinguish by answer shape: open-ended values use `text`, closed-choice values can use `select`.

Rationale:
- The old wording becomes false once the ceiling is removed.
- The real product distinction is not option count but whether the answer space is closed or free-form.

Alternatives considered:
- Leave the old wording in agent context and rely on runtime acceptance.
- Remove all guidance about when to use `text`.

Why not:
- Leaving stale wording would cause prompt drift and unnecessary retries.
- Removing all guidance would make question generation less stable.

### Decision: Treat this as a runtime contract change, not a frontend behavior change

The spec delta will modify `agent-backend-runtime` instead of creating a new capability or changing the workbench capability. The workbench already renders arbitrary select lists, so the contract change belongs to the runtime question-tool boundary.

Rationale:
- The hard limit is enforced at tool construction and validation time.
- The frontend contract does not currently encode a 4-option maximum.

Alternatives considered:
- Add a new dedicated capability for question-tool option sizing.
- Modify both runtime and workbench capabilities.

Why not:
- A new capability would fragment one coherent question contract.
- Expanding the workbench capability would overstate the actual behavioral change.

### Decision: Re-anchor recovery tests on the minimum bound

Tests that currently prove invalid `5`-option payloads are recoverable will instead prove invalid `<2`-option payloads are recoverable. Error messages will be updated to the new minimum-only wording.

Rationale:
- The recovery path still matters; only the invalid shape changes.
- This preserves coverage for concise validation messages and model retry behavior.

Alternatives considered:
- Remove the recovery tests entirely.
- Keep the old tests and only adjust production code.

Why not:
- Removing the tests would drop important safety coverage.
- Keeping the old assertions would encode the obsolete contract.

## Risks / Trade-offs

- [Large select lists may be less ergonomic for users than shorter lists] → Keep guidance that open-ended values use `text`, and limit this change to accepting larger closed-choice lists rather than recommending them universally.
- [Prompt and validation drift could persist if only code changes] → Update tool descriptions, agent context files, and test fixtures in the same change.
- [Archived design history already documents the old 2-4 decision] → Capture this as a new change with an explicit spec delta rather than mutating old archived artifacts.

## Migration Plan

1. Update the `local:question` validation constants and model-visible error messages to enforce only the 2-option minimum.
2. Remove `maxItems` from question schemas and rewrite tool descriptions so they no longer mention a 4-option ceiling.
3. Update agent context guidance and tests to reflect the new minimum-only contract.
4. Rebuild generated artifacts such as `dist/` outputs if the implementation workflow requires committed build results.

Rollback strategy:
- Restore the previous runtime validation ceiling and schema metadata.
- Restore the old prompt guidance and test expectations.
- No persisted data migration is involved.

## Open Questions

- None.
