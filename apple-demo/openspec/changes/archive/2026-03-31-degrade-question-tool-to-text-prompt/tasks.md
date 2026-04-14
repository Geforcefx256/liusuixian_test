## 1. Runtime Degradation Branch

- [x] 1.1 Add a question-specific terminal branch in the agent loop/tool runner that converts exhausted `question_validation_error` chains into a normal assistant text result instead of throwing a terminal tool invocation error.
- [x] 1.2 Centralize the fixed degraded assistant message text so the runtime emits one stable user-visible message without parsing failed `question` payloads.

## 2. Question State And Diagnostics

- [x] 2.1 Ensure the degraded branch does not create a pending interaction, awaiting-interaction outcome, or `question_response` continuation dependency.
- [x] 2.2 Preserve original question failure diagnostics only in runtime logs/telemetry, not in frontend-visible assistant message history or future model replay.

## 3. Verification

- [x] 3.1 Add or update tests covering exhausted `local:question` validation loops, including the returned assistant text, absence of pending interaction state, and acceptance of ordinary user follow-up input.
- [x] 3.2 Add or update tests proving non-question terminal failures still return structured runtime failure metadata unchanged.
