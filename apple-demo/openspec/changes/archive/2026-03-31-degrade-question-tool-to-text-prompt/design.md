## Context

`local:question` is intentionally strict: invalid payloads remain visible, and the runtime gives the model a limited correction budget. In the current configuration, `modelRecovery.maxCorrectionCalls` is `1`, so the common path is:

1. model emits invalid `local:question`
2. runtime returns concise validation payload
3. model retries once
4. retry is still invalid
5. runtime raises terminal `model_recovery_exhausted`

That behavior is correct for debugging, but poor for user progress in this specific tool. Unlike write or execution tools, `local:question` only exists to gather missing user input. If structured collection fails repeatedly, the runtime can still let the task continue by explicitly switching to ordinary text collection.

Constraints:

- No silent fallback or fake success
- No best-effort schema repair of invalid `question` payloads
- No frontend-visible tool error payload in the degraded branch
- No new pending interaction or continuation protocol for the degraded branch

## Goals / Non-Goals

**Goals:**

- Keep `local:question` validation strict and observable.
- Stop user-facing dead ends caused by repeated `question` payload validation failures.
- Surface a user-visible assistant text prompt when the `local:question` recovery budget is exhausted by validation failures.
- Keep degraded behavior narrow, explicit, and deterministic.

**Non-Goals:**

- Do not generalize degradation to other tools.
- Do not add heuristic parsing or repair of invalid `question` payloads.
- Do not create a new frontend card or protocol message type.
- Do not recreate a structured question state after degradation.

## Decisions

### 1. Degrade only on a narrow terminal condition

The runtime will trigger degradation only when all of the following are true:

- tool name is `local:question`
- normalized failure code is `question_validation_error`
- stop reason is `model_recovery_exhausted`

Why:

- This keeps the behavior tightly scoped to one tool and one known failure mode.
- It avoids weakening existing terminal failure semantics for unrelated tools.

Alternatives considered:

- Degrade on the first `question` validation failure: rejected because it discards useful model self-correction.
- Degrade all recoverable tool failures after recovery exhaustion: rejected because most tools are not safe to reinterpret as plain text collection.

### 2. Runtime generates a fixed assistant text message

The degraded branch will append a fixed assistant text message, with no payload-derived interpolation:

`结构化提问失败，已切换为文本收集模式。`

`请直接用自然语言补充当前缺失的信息，我会根据你的回复继续处理。`

Why:

- Fixed text cannot fail due to malformed tool input.
- It avoids introducing a second permissive parser for invalid `question` payloads.
- It keeps the degradation semantics explicit to the user.

Alternatives considered:

- Build a richer prompt by parsing failed `question` args: rejected because malformed payloads are exactly the problem, and deeper parsing would create a new failure surface.
- Let the model author the degraded text: rejected because the model is already in a failing correction loop.

### 3. Degraded branch ends the run as a normal assistant output, not a runtime error

The runtime will treat the degraded message like a short-circuit assistant result: append one assistant message, return it to the caller, and wait for the user's next ordinary chat reply.

Why:

- This guarantees frontend visibility through the existing assistant-message channel.
- It avoids exposing internal tool-failure structures in user-facing output.

Alternatives considered:

- Keep throwing a terminal runtime error and also add a side message: rejected because it splits user-visible and API-visible outcomes and complicates clients.
- Create a new degraded-question interaction state: rejected because it would require new protocol semantics and frontend handling.

### 4. Do not persist a pending interaction for degraded questions

The degraded path will not create or preserve a pending question interaction. The next user reply is ordinary run input.

Why:

- The structured question flow failed and should be exited cleanly.
- Keeping a pending interaction would block ordinary chat input and contradict the desired UX.

Alternatives considered:

- Keep the pending interaction and accept plain text as an alternate answer path: rejected because it mixes structured and unstructured continuation semantics.

### 5. Preserve diagnostics only in observability surfaces

The original tool error payload and terminal recovery metadata remain in logs and diagnostics, but not in the assistant message history produced by the degraded branch.

Why:

- Operators still need to analyze why degradation happened.
- Users and later model turns should not be polluted with tool-recovery internals.

Alternatives considered:

- Include the tool error part in the assistant message: rejected because frontend history must not expose it.
- Drop diagnostics entirely: rejected because it harms debugging and regression tracking.

## Risks / Trade-offs

- [Loss of structured answers after degradation] → Accept the trade-off explicitly; the next turn will use ordinary user text instead of `question_response`.
- [Potential confusion about why the UI switched modes] → Use a fixed first sentence that explicitly states structured collection failed and text collection is now active.
- [Spec drift between generic terminal failure handling and question-specific degradation] → Modify the runtime spec to document the `local:question` exception instead of leaving it implicit.
- [Repeated degrade loops across turns] → Keep this change scoped to one exhausted question run; future policy tuning can address repeated cross-turn degradation if it appears in telemetry.

## Migration Plan

1. Update runtime specs to define the question-specific degradation branch.
2. Implement runtime branching so exhausted `local:question` validation loops produce a plain assistant message instead of a terminal tool error.
3. Add tests that prove no pending interaction is created and ordinary user input is accepted after degradation.
4. Roll back by restoring the prior terminal error path if the new branch causes client incompatibility.

## Open Questions

- None.
