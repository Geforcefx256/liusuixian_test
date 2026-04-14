## Context

The current repository state is split:

- runtime validation, schemas, and tool descriptions already accept `select` option lists with at least 2 items and no maximum
- agent context files still instruct models that `select` is only valid for `2-4` options

That mismatch matters because the context files are part of the model-visible contract. Even if runtime accepts larger closed-choice lists, stale guidance can still cause the model to avoid valid `select` payloads or generate incorrect recovery attempts.

This is a narrow corrective change. The runtime contract itself is not being redesigned here; only the remaining guidance and tests are being brought back into sync with the code that already exists.

## Goals / Non-Goals

**Goals:**
- Remove remaining `2-4` wording from model-facing question guidance in runtime agent assets.
- Keep the distinction between closed-choice `select` and open-ended `text`.
- Ensure automated checks cover the corrected minimum-only guidance so this drift does not reappear silently.

**Non-Goals:**
- Do not change the runtime validation semantics again.
- Do not introduce new question field types or alter question lifecycle behavior.
- Do not rewrite unrelated prompt strategy about when to ask questions.

## Decisions

### Decision: Treat this as a guidance-alignment change, not another contract rewrite

The runtime contract has already shifted to minimum-only `select` validation in the current working tree. This change will update the remaining model-visible guidance and verification to match that established behavior.

Alternatives considered:
- Reopen the original archived change and mutate its artifacts.
- Create a broader change that re-audits all question-tool behavior.

Why not:
- Archived artifacts are historical records and should not be rewritten to describe new repository state.
- A broader audit would expand scope beyond the concrete drift now visible in the codebase.

### Decision: Keep the rule boundary based on answer shape, not option count

Updated guidance will continue to say that `select` is for closed choices and `text` is for open-ended input. It will no longer mention a hard ceiling such as 4 choices.

Alternatives considered:
- Remove most guidance and rely only on runtime validation.
- Encourage large option sets without qualification.

Why not:
- Removing guidance would make model behavior less stable and increase recovery churn.
- The important distinction is still closed-choice versus open-ended input, not “as many options as possible.”

### Decision: Verify prompt assets directly

Tests or assertions should cover the actual context or prompt assets that previously carried the stale `2-4` wording.

Alternatives considered:
- Depend only on runtime validation tests.

Why not:
- The bug here is not runtime validation anymore; it is prompt drift.

## Risks / Trade-offs

- [A context file outside the obvious agent assets still carries the old rule] → Search for residual `2-4` wording and update affected assertions in the same change.
- [Future runtime edits reintroduce prompt drift] → Keep test coverage anchored to the actual guidance surfaces, not only validation code.
- [The archived change history remains confusing] → Reference the archived change as historical context in the proposal rather than rewriting archive records.

## Migration Plan

1. Update remaining agent context files to describe `select` as closed-choice input with at least 2 options and no fixed maximum.
2. Update prompt or context-related tests that still encode the obsolete `2-4` ceiling.
3. Run focused backend verification for question guidance and related prompt-loading behavior.

Rollback strategy:
- Restore the previous context wording and related assertions if this alignment unexpectedly harms model behavior.
- No data migration or runtime state migration is involved.

## Open Questions

- None.
