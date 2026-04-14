## ADDED Requirements

### Requirement: Runtime SHALL persist hidden injected skill-context messages separately from visible tool traces
The runtime SHALL allow governed skill loads to inject canonical skill content into session history as hidden skill-context messages that remain available to subsequent model turns and session recovery without appearing as ordinary user-visible assistant chat bubbles.

#### Scenario: Successful skill load persists both trace and hidden context
- **WHEN** `skill:skill` successfully loads an approved governed skill
- **THEN** the runtime MUST persist the normal successful tool trace for that invocation
- **AND** the runtime MUST also persist a separate hidden skill-context message containing the canonical skill content for later context reuse

#### Scenario: Subsequent turns receive hidden skill context
- **WHEN** a later model turn is built from session history after a successful `skill:skill` invocation
- **THEN** the runtime MUST include the persisted hidden skill-context message in the model-visible session message pool
- **AND** the runtime MUST NOT require the model to recover that skill context by reparsing an old tool summary string

#### Scenario: Failed skill load does not persist hidden skill context
- **WHEN** `skill:skill` fails because the skill is missing, denied, or invalid
- **THEN** the runtime MUST NOT persist a hidden skill-context message for that failed invocation

### Requirement: Runtime session history views SHALL hide runtime-only skill-context messages from the workbench
The runtime SHALL keep hidden skill-context messages available for internal context reconstruction while excluding them from the ordinary session-history view returned to the workbench.

#### Scenario: Workbench history omits hidden skill-context messages
- **WHEN** a client requests session message history for a session that contains persisted hidden skill-context messages
- **THEN** the runtime MUST exclude those hidden skill-context messages from the returned ordinary session-history view
- **AND** the returned visible message stream MUST continue to contain the normal user-visible text, protocol, and result messages

#### Scenario: Session recovery still retains hidden skill-context messages internally
- **WHEN** the runtime later rebuilds context for the same persisted session
- **THEN** it MUST still be able to read the hidden skill-context messages from internal session storage
- **AND** the omission from the workbench history view MUST NOT remove those messages from internal context reconstruction
