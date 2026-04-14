## ADDED Requirements

### Requirement: Workbench SHALL gate run creation by shared-workspace occupancy
The workbench SHALL treat active execution ownership as a shared-workspace concern for the current `user + agent` scope, so only the owning session may continue the in-progress flow while other sessions remain draft-only.

#### Scenario: Secondary session remains draft-editable but cannot send while the workspace is occupied
- **WHEN** one session for the current shared workspace has an active run or an unresolved pending question and the user opens a different session
- **THEN** the workbench MUST allow the user to keep editing draft text in that secondary session
- **AND** the workbench MUST prevent that secondary session from starting a new run until the workspace is no longer occupied

#### Scenario: New conversation remains draft-only while the workspace is occupied
- **WHEN** the user creates a new conversation while another session still occupies the shared workspace
- **THEN** the workbench MUST enter the normal blank-draft conversation shell
- **AND** the workbench MUST NOT create a backend session until the user can actually submit a first prompt
- **AND** the workbench MUST keep first-send unavailable until the shared workspace is no longer occupied

#### Scenario: Returning to the owner session restores the stop affordance
- **WHEN** the user switches away from and later returns to the session that owns the active shared-workspace run
- **THEN** the workbench MUST restore the stop affordance for that owner session
- **AND** the workbench MUST NOT transfer run-stop control to a different session merely because it became the active view

#### Scenario: Unlock after completion is silent for non-owner sessions
- **WHEN** the active shared-workspace run completes, or the owning pending question is resolved, while the user is viewing a different session
- **THEN** the currently viewed session MUST become sendable again without requiring a page reload
- **AND** the workbench MUST NOT show a transient toast solely to announce that unlock

### Requirement: Workbench SHALL expose shared-workspace scope and lock reasons through hover/focus help
The workbench SHALL keep shared-workspace explanations lightweight by using hover/focus help on relevant surfaces instead of persistent instructional banners or toast-based explanations.

#### Scenario: Workspace area is labeled as shared
- **WHEN** the user views the workspace sidebar or workspace-open shell for the active agent
- **THEN** the user-visible workspace title MUST render as `共享工作区`
- **AND** the explanation that files, uploads, and generated outputs are shared across sessions for that agent MUST appear only through hover/focus help

#### Scenario: Locked send action explains workspace occupancy on hover or focus
- **WHEN** the send action is unavailable because another session still occupies the shared workspace
- **THEN** the workbench MUST expose hover/focus help that explains another run is active in the shared workspace
- **AND** the workbench MUST NOT rely on a transient toast as the primary explanation for that locked state

#### Scenario: Locked destructive actions explain their unavailable state on hover or focus
- **WHEN** session deletion or bulk-clear history is unavailable because the shared workspace is occupied
- **THEN** the workbench MUST expose hover/focus help that explains history management is locked until the active work is no longer occupying the workspace
- **AND** the locked actions MUST remain visually unavailable even before the help is requested

### Requirement: Workbench SHALL keep history-management actions aligned with shared-workspace execution ownership
The workbench SHALL reflect shared-workspace occupancy in the history rail so users can locate the run-owning session and cannot perform destructive history operations while that occupancy remains active.

#### Scenario: History rail identifies the session that owns the active run
- **WHEN** the shared workspace has an active run and the user is currently viewing a different session
- **THEN** the history rail MUST identify which session currently owns that active run
- **AND** the user MUST be able to navigate back to that owner session without losing the owner indicator

#### Scenario: Session deletion is unavailable while the shared workspace is occupied
- **WHEN** any session in the current shared workspace has an active run or an unresolved pending question
- **THEN** the workbench MUST render per-session delete actions as unavailable
- **AND** the workbench MUST NOT issue a delete request while that occupied state remains active

#### Scenario: Bulk-clear history is unavailable while the shared workspace is occupied
- **WHEN** any session in the current shared workspace has an active run or an unresolved pending question
- **THEN** the workbench MUST render the bulk-clear history action as unavailable
- **AND** the workbench MUST NOT issue a bulk-clear request while that occupied state remains active
