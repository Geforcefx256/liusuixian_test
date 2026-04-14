## 1. Question Tool Contract Hardening

- [x] 1.1 Update `apps/agent-backend/src/runtime/tools/local/question.ts` so required `select` fields no longer default to the first option and can preserve field-level `required` metadata in the emitted protocol payload.
- [x] 1.2 Update `apps/agent-backend/src/runtime/tools/local/schemas.ts` and question builder validation so `fields[].required` is supported and invalid question payloads are rejected for duplicate field ids, duplicate select values, illegal empty option values, and invalid field/option combinations.
- [x] 1.3 Keep the current `2-4` closed-choice limit for `select` fields while ensuring question validation errors remain stable and deterministic for model retries.

## 2. Backend Question Answer Validation

- [x] 2.1 Add a minimal question-answer recognizer in the existing backend conversation input path that detects `{ questionId, answer }` payloads without introducing a new standalone reply API.
- [x] 2.2 Validate incoming question answers against the active session question protocol contract, including question identity, allowed fields, allowed select values, and resolved requiredness before continuing the model loop.
- [x] 2.3 Add backend tests covering valid question answers, mismatched `questionId`, unknown fields, invalid select values, and missing required answers.

## 3. Workbench Question Submit Safety

- [x] 3.1 Update the workbench question submit flow so required `select` fields remain unanswered until the user explicitly chooses an option.
- [x] 3.2 Update workbench requiredness resolution to use `field.required ?? question.required ?? false` when validating question protocol forms.
- [x] 3.3 Add or update workbench tests covering explicit selection for required `select`, mixed required/optional fields, successful submit convergence, and blocked submit feedback.

## 4. Model Recovery And Guidance Cleanup

- [x] 4.1 Add a concise provider-side formatter for `local:question` validation failures so the model sees short corrective errors while logs retain detailed validation causes.
- [x] 4.2 Review existing local tool validation errors and keep this change scoped to `local:question`, avoiding unnecessary rewrites of already concise tool-input errors.
- [x] 4.3 Simplify `apps/agent-backend/assets/agents/workspace-agent/CONTEXT.md` question guidance to a short high-signal ruleset aligned with the tool description and the hardened question contract.
