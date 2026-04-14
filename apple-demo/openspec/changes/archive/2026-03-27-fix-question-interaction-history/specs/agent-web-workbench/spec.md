## ADDED Requirements

### Requirement: Workbench SHALL block ordinary composer actions while a pending question exists
The workbench SHALL treat an unresolved question interaction as the only active way to continue the blocked session task and SHALL prevent the user from dispatching ordinary conversation actions for that session until the interaction is answered or rejected.

#### Scenario: Pending question disables normal composer entry points
- **WHEN** the active session contains a pending question interaction
- **THEN** the workbench MUST disable the normal conversation composer, send action, and upload entry points for that session
- **AND** the user MUST be guided to continue through the pending question UI instead of ordinary chat submission

#### Scenario: Pending question does not dispatch a generic conversation run
- **WHEN** the active session contains a pending question interaction and the user attempts to continue the session
- **THEN** the workbench MUST NOT dispatch that attempt as a generic `/agent/run` conversation input
- **AND** the frontend MUST keep reply / reject as the only supported continuation path for that blocked session

### Requirement: Workbench SHALL continue pending question flows through interaction actions and canonical history
The workbench SHALL resolve pending question interactions through dedicated reply or reject actions and SHALL rely on backend-provided session history for later recovery of the resolved interaction context.

#### Scenario: Answered pending question resumes through reply and continuation
- **WHEN** the user submits a valid answer for a pending question interaction
- **THEN** the workbench MUST call the dedicated interaction-reply path for that interaction
- **AND** the workbench MUST start or request a continuation run in the same session after the reply succeeds

#### Scenario: Rejected pending question resumes through reject and continuation
- **WHEN** the user explicitly rejects a pending question interaction
- **THEN** the workbench MUST call the dedicated interaction-reject path for that interaction
- **AND** the workbench MUST start or request a continuation run in the same session after the reject succeeds

#### Scenario: Reload recovers resolved interaction context from session history
- **WHEN** a session is later reloaded after a question interaction has already been answered or rejected and the backend has persisted the normalized resolved-interaction message in session history
- **THEN** the workbench MUST recover that message through the normal session-history mapping path
- **AND** the frontend MUST NOT require a hidden client-only continuation payload to remember the resolved question context
