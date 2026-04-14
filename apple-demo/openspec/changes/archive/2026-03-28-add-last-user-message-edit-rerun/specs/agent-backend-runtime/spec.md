## ADDED Requirements

### Requirement: Runtime SHALL support same-session reruns that replace the last real user message
The runtime SHALL allow a client to rerun an existing session by replacing only the last real persisted user message for that session, deleting that message and the later session tail, and then continuing execution in the same session with the replacement input.

#### Scenario: Valid edit-context run rewrites the session tail inside the same session
- **WHEN** a client submits a run request that targets the last real persisted user message for replacement and provides new input for the same session
- **THEN** the runtime MUST delete the targeted old user message and every later persisted session message before appending the replacement user message
- **AND** the runtime MUST continue execution under the same `sessionId` rather than creating a new session

#### Scenario: Runtime rejects edit-context rerun for a non-terminal user message
- **WHEN** a client submits an edit-context rerun request for a user message that is not the session's last real persisted user message
- **THEN** the runtime MUST reject that request
- **AND** the runtime MUST leave the existing persisted session history unchanged

#### Scenario: Runtime rejects edit-context rerun while a pending interaction exists
- **WHEN** a client submits an edit-context rerun request for a session that still has a pending interaction awaiting answer or rejection
- **THEN** the runtime MUST reject that request
- **AND** the runtime MUST avoid mutating the persisted session history for that rejected attempt

### Requirement: Runtime SHALL clear stale derived session state when replacing the last user message
The runtime SHALL remove or recompute session-derived state that overlaps the deleted tail of an edit-context rerun so that stale previews, summaries, plans, and interactions do not survive after the old user message is replaced.

#### Scenario: Tail truncation recomputes surviving session metadata
- **WHEN** the runtime accepts an edit-context rerun and truncates a session tail
- **THEN** the runtime MUST recompute or refresh the surviving session preview, update timing, and message-count metadata from the remaining session history
- **AND** the runtime MUST NOT keep preview metadata that depends on deleted messages

#### Scenario: Overlapping derived state is removed with the deleted tail
- **WHEN** the deleted tail overlaps persisted summaries, interaction records, or plan records derived from that discarded portion of history
- **THEN** the runtime MUST remove or replace that overlapping derived state before continuing the rerun
- **AND** later reads of the session MUST NOT return stale summary, interaction, or plan state that depends on deleted messages

#### Scenario: Session rewrite does not roll back workspace side effects
- **WHEN** the runtime performs an edit-context rerun for a session
- **THEN** it MUST leave previously written `user + agent` workspace files and other external side effects untouched
- **AND** the session rewrite flow MUST NOT pretend that conversation-history truncation has reverted those side effects
