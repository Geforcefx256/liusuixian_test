## ADDED Requirements

### Requirement: Workbench SHALL preserve the visible running assistant placeholder while rehydrating an active session
The workbench SHALL preserve a session's local running assistant placeholder when the user reopens a still-running session before authoritative persisted assistant history is available.

#### Scenario: Switching back to a running session keeps the assistant placeholder visible
- **WHEN** the user sends a prompt in `sessionA`, switches to another session, and quickly switches back while `sessionA` is still in `running` or `stop-pending`
- **AND** the reloaded session history does not yet contain the persisted assistant message for that run
- **THEN** the workbench MUST continue showing the local assistant placeholder bubble for `sessionA`
- **AND** the workbench MUST NOT regress to showing only the user bubble for that in-flight turn

#### Scenario: Background stream updates continue targeting the preserved placeholder
- **WHEN** a running session's local assistant placeholder has been preserved during session rehydration
- **AND** later stream events for that same run arrive after the user has switched away and back
- **THEN** the workbench MUST continue applying those updates to the preserved assistant placeholder
- **AND** the visible assistant bubble MUST continue reflecting the latest streamed state for that run

#### Scenario: Authoritative persisted history replaces the transient placeholder without duplication
- **WHEN** the workbench later reloads a running session and the authoritative session history now contains the persisted assistant message for that run
- **THEN** the workbench MUST prefer the persisted assistant message as the visible record
- **AND** the workbench MUST remove the transient local placeholder for that run
- **AND** the workbench MUST NOT render duplicate assistant bubbles for the same turn
