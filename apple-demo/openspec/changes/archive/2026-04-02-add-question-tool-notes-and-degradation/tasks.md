## 1. Backend Question Contract

- [x] 1.1 Extend the question interaction payload builder so select-based questions include one optional `notes` field with stable identity and semantics.
- [x] 1.2 Add lossless `options` string-array normalization in the backend question contract and emit explicit warning diagnostics when normalization is applied.
- [x] 1.3 Implement degraded question interaction payload generation for exhausted `local:question` validation chains, including preserved prompt, degradation reason, extracted reference option text, required text `answer`, and optional `notes`.

## 2. Backend Recovery and Continuation Flow

- [x] 2.1 Replace the current plain-assistant-text degradation path with degraded pending question interactions in the runtime tool failure handling flow.
- [x] 2.2 Update question answer validation and continuation context handling so normal select questions and degraded text-answer questions both preserve `notes` as supplementary context.
- [x] 2.3 Keep runtime failure and observability metadata explicit for normalization and degraded-question paths without introducing silent fallback behavior.

## 3. Workbench Pending Question Experience

- [x] 3.1 Update the pending question card and related frontend types to render a single optional `notes` field for select questions.
- [x] 3.2 Add degraded question card rendering that shows the degradation reason, original prompt, reference option text, required text `answer`, and optional `notes`.
- [x] 3.3 Ensure pending-question submission, reject flow, and blocked-composer behavior continue to use the dedicated interaction reply/reject APIs for both normal and degraded questions.

## 4. Verification

- [x] 4.1 Add backend unit tests for notes injection, lossless normalization, degraded interaction creation, and degraded continuation handling.
- [x] 4.2 Add frontend tests for select questions with notes and degraded question card submission behavior.
- [x] 4.3 Run the relevant backend and frontend test suites covering question interactions and workbench pending-question flows.
