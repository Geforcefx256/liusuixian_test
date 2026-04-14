## ADDED Requirements

### Requirement: Runtime SHALL persist short-circuit structured outputs as canonical assistant messages
The runtime SHALL persist each short-circuit structured output as exactly one canonical assistant message that preserves trusted structured payloads separately from model-facing summary text.

#### Scenario: Protocol short-circuit creates one canonical assistant message
- **WHEN** a runtime tool short-circuits a run with protocol output
- **THEN** the runtime MUST persist exactly one assistant message for that structured output
- **AND** the runtime MUST NOT also persist a second assistant message that only mirrors the model's raw `tool_calls` content from the same step

#### Scenario: Domain-result short-circuit creates one canonical assistant message
- **WHEN** a runtime tool short-circuits a run with a structured domain result such as an artifact reference
- **THEN** the runtime MUST persist exactly one assistant message for that structured output
- **AND** that same message MUST remain the authoritative `assistantMessageId` returned by the terminal run result

#### Scenario: Canonical short-circuit message separates structured payload from summary text
- **WHEN** the runtime persists a short-circuit structured output
- **THEN** it MUST preserve the structured payload in an explicit structured form rather than only as raw text JSON
- **AND** any companion assistant text used for previews or later model context MUST be generated from the trusted tool result rather than copied from the model's raw response text

## MODIFIED Requirements

### Requirement: Runtime run results SHALL expose structured outputs needed for rich workbench messages
The runtime SHALL preserve structured terminal result metadata and canonical persisted message metadata so that the workbench can distinguish protocol outputs, structured domain results, and structured runtime failures without reparsing raw assistant text.

#### Scenario: Completed run returns protocol output distinctly
- **WHEN** a run completes with protocol output
- **THEN** the terminal run result MUST identify that output as protocol-capable rather than only plain text

#### Scenario: Completed run returns structured domain result distinctly
- **WHEN** a run completes with a structured domain result such as row preview data or an artifact reference
- **THEN** the terminal run result MUST identify that structured result distinctly from plain text
- **AND** the runtime MUST preserve the structured payload needed by the frontend to render a richer message surface

#### Scenario: Persisted short-circuit structured message remains distinguishable after reload
- **WHEN** session history is later loaded for a run that previously completed with a short-circuit structured output
- **THEN** the runtime MUST return that assistant message as a structured message view rather than only a plain text message
- **AND** the workbench MUST be able to recover the same protocol or domain-result shape without reparsing a raw JSON text bubble

#### Scenario: Failed run returns structured runtime failure metadata
- **WHEN** a run terminates in error
- **THEN** the runtime MUST include structured runtime failure metadata in its terminal failure contract
- **AND** the client MUST be able to distinguish that structured failure context from a generic text-only error string

### Requirement: Runtime protocol outputs SHALL remain compatible with question-tool interaction loops
The runtime SHALL continue to expose protocol outputs for interactive question flows in a shape that a full protocol frontend can execute end-to-end, while keeping the tool-generated protocol payload authoritative over any model-authored imitation content from the same step.

#### Scenario: Question tool emits form-based protocol output
- **WHEN** a runtime tool requests additional user input through the question flow
- **THEN** the runtime MUST be able to return a protocol message that includes a `form` component for that interaction
- **AND** the corresponding action contract MUST identify the submission path as a `question_response` style tool action

#### Scenario: Question short-circuit preserves the trusted protocol payload
- **WHEN** a `local:question` call short-circuits a run
- **THEN** the persisted question message MUST use the tool-generated protocol payload as the authoritative structured content
- **AND** the runtime MUST NOT replace that content with a model-authored protocol-like JSON body from the same tool-calls step

#### Scenario: Question answer returns through the active session conversation loop
- **WHEN** a client later submits a resolved `{ questionId, answer }` payload through the active session conversation flow
- **THEN** the runtime MUST treat that answer as part of the same session interaction loop
- **AND** the runtime MUST allow the next assistant response to continue from that answered state rather than treating it as an unrelated free-form prompt

### Requirement: Runtime migration SHALL preserve the current newui frontend contract
The system SHALL migrate `agent-V2-base` backend capabilities into `apps/agent-backend` without breaking the current `newui` frontend contract that is already consumed by `apps/web`, including the structured short-circuit result path used by the workbench.

#### Scenario: Workspace APIs remain available after backend capability migration
- **WHEN** the migrated `apps/agent-backend` starts successfully
- **THEN** it MUST continue to expose the current workspace-related endpoints used by `apps/web`
- **AND** the runtime MUST continue to return workspace payloads in the `tasks -> groups -> files` structure expected by the current workbench

#### Scenario: Stream and terminal message contracts remain frontend-compatible for structured short-circuit outputs
- **WHEN** the current `newui` frontend invokes the migrated runtime through `/agent/api/agent/run`
- **THEN** the runtime MUST continue to emit stream and terminal events compatible with the current frontend conversation flow
- **AND** protocol or domain-result short-circuit runs MUST NOT require the frontend to consume raw JSON assistant text deltas in order to render the final structured message correctly
