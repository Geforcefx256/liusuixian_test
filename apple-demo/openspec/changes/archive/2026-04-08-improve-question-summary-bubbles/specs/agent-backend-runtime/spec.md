## MODIFIED Requirements

### Requirement: Runtime SHALL persist short-circuit structured outputs as canonical assistant messages
The runtime SHALL persist each short-circuit structured output, including protocol, domain-result, and awaiting-interaction question pauses, as exactly one canonical assistant message that preserves trusted structured payloads separately from model-facing summary text.

#### Scenario: Protocol short-circuit creates one canonical assistant message
- **WHEN** a runtime tool short-circuits a run with protocol output
- **THEN** the runtime MUST persist exactly one assistant message for that structured output
- **AND** the runtime MUST NOT also persist a second assistant message that only mirrors the model's raw `tool_calls` content from the same step

#### Scenario: Domain-result short-circuit creates one canonical assistant message
- **WHEN** a runtime tool short-circuits a run with a structured domain result such as an artifact reference
- **THEN** the runtime MUST persist exactly one assistant message for that structured output
- **AND** that same message MUST remain the authoritative `assistantMessageId` returned by the terminal run result

#### Scenario: Awaiting-interaction short-circuit creates one canonical assistant message
- **WHEN** a runtime tool short-circuits a run with a pending question interaction
- **THEN** the runtime MUST persist exactly one assistant message for that structured output
- **AND** that same message MUST remain the authoritative `assistantMessageId` returned by the terminal run result

#### Scenario: Canonical short-circuit message separates structured payload from summary text
- **WHEN** the runtime persists a short-circuit structured output
- **THEN** it MUST preserve the structured payload in an explicit structured form rather than only as raw text JSON
- **AND** any companion assistant text used for previews, persisted history, or replay filtering MUST be generated from trusted tool or interaction data rather than copied from the model's raw response text

### Requirement: Runtime SHALL keep awaiting-interaction placeholders out of future model replay
The runtime SHALL treat awaiting-interaction assistant summaries and awaiting-interaction tool snapshots as technical waiting artifacts rather than as authoritative future conversation context, even when the visible summary text is dynamically generated from the pending question payload.

#### Scenario: Waiting artifact does not become future model context
- **WHEN** the runtime builds model input for a session that previously paused on a pending question
- **THEN** the runtime MUST exclude the assistant waiting-summary text and awaiting-interaction tool snapshot from replay based on structured awaiting-interaction markers rather than exact string matching
- **AND** the persisted resolved `user` message for that interaction chain MUST remain the authoritative semantic replay signal

## ADDED Requirements

### Requirement: Runtime SHALL generate deterministic chat-style summaries for pending question interactions
The runtime SHALL derive the assistant summary text for a pending question interaction from the trusted interaction payload by using stable formatting rules instead of model-generated phrasing or raw option expansion.

#### Scenario: Single text-field question summary identifies the requested input
- **WHEN** the runtime creates awaiting-interaction output for a pending question whose only primary answer field is a `text` field
- **AND** the user-facing prompt is missing or generic
- **THEN** the summary MUST identify the requested input by using that field's user-visible label
- **AND** the summary MUST end with a continuation cue that tells the user the run will continue after the answer is filled

#### Scenario: Single select-field question summary avoids option expansion
- **WHEN** the runtime creates awaiting-interaction output for a pending question whose only primary answer field is a `select` field
- **THEN** the summary MUST identify the requested choice by using the prompt or that field's user-visible label
- **AND** the summary MUST NOT enumerate the select options inside the assistant bubble

#### Scenario: Multi-field question summary enumerates all primary field labels
- **WHEN** the runtime creates awaiting-interaction output for a pending question with multiple primary answer fields
- **THEN** the summary MUST enumerate all primary field labels in the declared field order
- **AND** the summary MUST preserve the user-facing prompt when that prompt is available

#### Scenario: Supplementary notes field does not drive the summary
- **WHEN** a pending question interaction also contains an optional supplementary `notes` field
- **THEN** the runtime MUST exclude that `notes` field from the summary when at least one other primary answer field is present
- **AND** the summary MUST continue to describe the primary information needed to unblock the run

#### Scenario: Degraded question summary stays concise
- **WHEN** the runtime creates awaiting-interaction output for a degraded question interaction
- **THEN** the summary MUST identify the information the user needs to provide by using the trusted prompt or field labels
- **AND** the summary MUST NOT include the degraded failure reason or reference option list in the assistant bubble

#### Scenario: Summary falls back conservatively when trusted metadata is unusable
- **WHEN** trusted prompt and field-label metadata are both unavailable or unusable for a pending question interaction
- **THEN** the runtime MUST fall back to a generic waiting sentence
- **AND** it MUST still preserve the structured pending interaction payload for the question card and continuation flow
