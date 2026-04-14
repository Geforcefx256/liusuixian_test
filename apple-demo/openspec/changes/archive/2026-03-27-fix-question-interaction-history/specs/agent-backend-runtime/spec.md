## ADDED Requirements

### Requirement: Runtime SHALL persist resolved question interactions as canonical session messages
The runtime SHALL append a normalized `user` session message for each answered or rejected question interaction before the continuation run re-enters the model loop, so later turns can replay the resolved interaction from session history instead of relying on a transient interaction side channel.

#### Scenario: Answered question is appended to session history before continuation
- **WHEN** a client submits a valid reply for a pending question interaction
- **THEN** the runtime MUST mark that interaction as answered
- **AND** the runtime MUST append a normalized `user` message in the same session that records the authoritative resolved interaction context before continuation is allowed to start

#### Scenario: Rejected question is appended to session history before continuation
- **WHEN** a client explicitly rejects a pending question interaction
- **THEN** the runtime MUST mark that interaction as rejected
- **AND** the runtime MUST append a normalized `user` message in the same session that records the rejected interaction context before continuation is allowed to start

#### Scenario: Later model replay uses persisted session history rather than temporary continuation injection
- **WHEN** a build-phase or planner-phase model step is prepared after a question interaction has already been resolved
- **THEN** the runtime MUST source that resolved interaction context from persisted session messages in the same session
- **AND** the runtime MUST NOT require a temporary continuation-only message injection to reconstruct the resolved answer for model replay

### Requirement: Runtime SHALL keep awaiting-interaction placeholders out of future model replay
The runtime SHALL treat placeholder-only awaiting-interaction assistant text and awaiting-interaction tool snapshots as technical waiting artifacts rather than as authoritative future conversation context.

#### Scenario: Waiting placeholder does not become future model context
- **WHEN** the runtime builds model input for a session that previously paused on a pending question
- **THEN** the runtime MUST avoid replaying placeholder-only waiting text or awaiting-interaction tool snapshots as later model input
- **AND** the persisted resolved `user` message for that interaction chain MUST remain the authoritative semantic replay signal

### Requirement: Runtime SHALL reject ordinary run input while a pending question blocks the session
The runtime SHALL refuse new ordinary conversation input for a session that still contains an unresolved question interaction, so the session cannot fork into a competing task chain before the blocking interaction is resolved.

#### Scenario: Pending question blocks a free-form run request
- **WHEN** a session still has a pending question interaction and a client submits ordinary `/agent/run` conversation input for that same session
- **THEN** the runtime MUST reject that run request explicitly
- **AND** the runtime MUST NOT start a competing model run that bypasses the pending interaction

#### Scenario: Dedicated continuation path remains allowed for the blocked session
- **WHEN** the same session resumes through the dedicated reply or reject flow followed by a continuation run that references the resolved interaction
- **THEN** the runtime MUST allow that continuation path
- **AND** the resumed execution MUST remain in the same session rather than being treated as an unrelated new conversation
