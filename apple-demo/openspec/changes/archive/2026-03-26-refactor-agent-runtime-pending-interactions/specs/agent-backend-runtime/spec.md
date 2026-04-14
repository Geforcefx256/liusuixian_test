## REMOVED Requirements

### Requirement: Runtime protocol outputs SHALL remain compatible with question-tool interaction loops
**Reason**: Question flows no longer use protocol short-circuit messages and `question_response` actions as the primary runtime contract.
**Migration**: Persist question requests as dedicated pending interactions, resolve them through authenticated reply/reject APIs, and continue the task through a continuation run in the same session.

## ADDED Requirements

### Requirement: Runtime SHALL persist pending question interactions independently from assistant protocol messages
The runtime SHALL persist each `local:question` request as a dedicated pending interaction record instead of encoding the active question contract only inside an assistant protocol message.

#### Scenario: Question tool creates a pending interaction record
- **WHEN** `local:question` is invoked with a valid question contract
- **THEN** the runtime MUST persist a pending interaction record for the current `user + agent + session`
- **AND** that record MUST preserve the question prompt, field contract, allowed values, required metadata, and the originating run context needed for later validation and continuation

#### Scenario: Pending question survives backend restart
- **WHEN** a question interaction remains unresolved and the backend process later restarts
- **THEN** the runtime MUST still be able to return that interaction as pending for the same authenticated session
- **AND** the restored interaction contract MUST remain authoritative for reply validation after restart

### Requirement: Runtime SHALL end question-initiated runs in an explicit awaiting-interaction state
The runtime SHALL treat a valid `local:question` invocation as an explicit waiting boundary rather than as a protocol short-circuit success result.

#### Scenario: Question tool pauses the active run with awaiting-interaction metadata
- **WHEN** a run reaches `local:question` and the question contract is accepted
- **THEN** the runtime MUST end the current run in an awaiting-interaction terminal state that references the persisted pending interaction
- **AND** the runtime MUST NOT require the frontend to parse an assistant protocol message body in order to discover that the run is waiting for user input

#### Scenario: Awaiting-interaction state remains distinct from success and failure
- **WHEN** a run pauses for a pending question
- **THEN** the runtime MUST preserve that pause as a state distinct from generic success, failure, or cancellation
- **AND** logs and terminal metadata MUST identify which interaction is blocking continuation

### Requirement: Runtime SHALL validate question replies against the persisted interaction contract before continuation
The runtime SHALL require question replies to be validated against the original persisted interaction contract before any continuation run is allowed to proceed.

#### Scenario: Valid reply resolves the pending interaction and enables continuation
- **WHEN** a client submits a reply for a pending question interaction whose values satisfy the stored contract
- **THEN** the runtime MUST mark that interaction as answered
- **AND** the runtime MUST make the normalized answer available as authoritative continuation context for the next run in the same session

#### Scenario: Invalid reply is rejected before continuation
- **WHEN** a client submits a reply whose interaction id, field ids, required fields, or closed-choice values do not match the persisted question contract
- **THEN** the runtime MUST reject that reply before any continuation run starts
- **AND** the pending interaction MUST remain unresolved so the user can correct the answer

#### Scenario: Rejected interaction resolves without synthetic success
- **WHEN** a client explicitly rejects a pending question interaction
- **THEN** the runtime MUST mark that interaction as rejected
- **AND** the runtime MUST NOT fabricate an answered question result in session history or continuation context for that interaction

### Requirement: Runtime SHALL continue answered question interactions through continuation runs in the same session
The runtime SHALL resume work after a resolved question by starting a continuation run in the same session rather than by treating the answer as an unrelated free-form user prompt.

#### Scenario: Continuation run uses the resolved question answer as prior interaction context
- **WHEN** a pending question has been answered and continuation starts
- **THEN** the runtime MUST continue within the same `sessionId`
- **AND** the next model loop MUST receive the resolved answer as interaction-owned continuation context rather than as an arbitrary new chat turn with ambiguous semantics

#### Scenario: Continuation run uses a new run identity
- **WHEN** the runtime resumes work after a resolved question
- **THEN** the continuation MUST be allowed to use a new `runId`
- **AND** runtime metadata MUST preserve the linkage between that new run and the interaction that triggered continuation

### Requirement: Runtime SHALL require explicit terminal semantics for structured outputs
The runtime SHALL end a run because of structured output only when that terminal behavior is explicit in the loop contract, not merely because an ordinary tool returned structured JSON.

#### Scenario: Structured write result does not implicitly terminate the active run
- **WHEN** `local:write` completes successfully and returns a structured `artifact_ref`
- **THEN** the runtime MUST treat that result as an ordinary tool result unless the tool call chain explicitly requested terminal structured output
- **AND** the model loop MUST be allowed to continue and issue additional tool calls or assistant text in the same task

#### Scenario: Explicit final structured output still terminates the run
- **WHEN** the active loop reaches an explicit terminal structured-output path
- **THEN** the runtime MUST still be able to complete the run with an authoritative structured terminal result
- **AND** that terminal behavior MUST come from the loop outcome contract rather than from implicit tool-name or JSON-shape inference
