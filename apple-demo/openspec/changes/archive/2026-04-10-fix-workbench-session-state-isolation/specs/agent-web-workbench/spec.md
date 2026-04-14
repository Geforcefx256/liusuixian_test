## ADDED Requirements

### Requirement: Workbench SHALL scope conversation status surfaces to the owning session
The workbench SHALL derive conversation-scoped status text, plan summary, and terminal run state from the owning session rather than from a workspace-global mutable field so that background session activity cannot overwrite the active session's context pane.

#### Scenario: Background session lifecycle updates do not overwrite the viewed session context pane
- **WHEN** session A is running in the background, the user is currently viewing session B, and session A emits a plan snapshot, runtime error, or terminal run event
- **THEN** the workbench MUST keep session B's context pane bound to session B's own status and plan summary
- **AND** the workbench MUST NOT render session A's lifecycle text or plan summary inside session B's context pane

#### Scenario: Returning to a background session restores its own latest conversation status
- **WHEN** session A produces plan or terminal lifecycle updates while another session is active and the user later switches back to session A
- **THEN** the workbench MUST render session A's own latest conversation status and plan summary
- **AND** the workbench MUST NOT require those values to have been visible while another session was active

### Requirement: Workbench SHALL discard stale session hydration responses
The workbench SHALL treat session selection and explicit session reloads as versioned session hydrations and MUST ignore any response that is no longer current for the target session.

#### Scenario: Older response for the same session does not overwrite a newer view
- **WHEN** two or more hydration requests for the same session are in flight and an older response resolves after a newer response has already been applied
- **THEN** the workbench MUST discard the older response
- **AND** the workbench MUST preserve the messages, interactions, and derived session summary from the newer response

#### Scenario: Inactive session hydration does not mutate the current view
- **WHEN** a hydration response resolves after the user has switched to a different active session
- **THEN** the workbench MUST NOT overwrite the current visible session's messages, interactions, or derived conversation summary

### Requirement: Workbench SHALL reconcile run cleanup against the run-owning session
The workbench SHALL bind optimistic assistant placeholders, run activity state, error recovery, and terminal cleanup to the session that created the run instead of to whichever session happens to be active when async work settles.

#### Scenario: Run failure after a session switch clears only the owning session
- **WHEN** session A starts a run, the user switches to session B before that run fails, and the failure is later observed by the frontend
- **THEN** the workbench MUST clear session A's optimistic run state and record the failure against session A
- **AND** the workbench MUST NOT clear session B's run state or overwrite session B's conversation messages because of session A's failure

#### Scenario: Background cancellation or completion leaves unrelated sessions untouched
- **WHEN** a background session reaches cancelled or terminal completion while another session is active
- **THEN** the workbench MUST reconcile lifecycle cleanup against the background session that owns the run
- **AND** the workbench MUST leave the currently viewed session's lifecycle state unchanged unless that viewed session owns the same run
