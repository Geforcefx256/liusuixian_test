## ADDED Requirements

### Requirement: Workbench composer SHALL expose a single primary action slot
The workbench conversation composer SHALL use one persistent primary action slot at the end of the composer action row, and that slot MUST switch behavior by conversation runtime state instead of rendering separate send and stop actions side by side.

#### Scenario: Idle composer shows only send in the primary action slot
- **WHEN** the active workbench conversation is not running and the composer is not blocked
- **THEN** the composer MUST render a single send action in the primary action slot
- **AND** the composer MUST NOT render a separate stop action beside it

#### Scenario: Running composer shows only stop in the primary action slot
- **WHEN** the active workbench conversation is running and the current run can be cancelled
- **THEN** the composer MUST replace the send action with a stop action in the same primary action slot
- **AND** the composer MUST NOT keep a disabled send action visible beside the stop action

#### Scenario: Stop request keeps the same slot in a pending state
- **WHEN** the user has requested cancellation for the active run and the workbench is waiting for the terminal run result
- **THEN** the primary action slot MUST remain occupied by the stop control in a pending state
- **AND** the stop control MUST prevent repeated cancellation requests until the run reaches a terminal state

### Requirement: Icon-only composer actions SHALL remain explicit and accessible
The workbench conversation composer SHALL use icon-first primary actions for send and stop while preserving clear runtime meaning, keyboard access, and screen-reader names.

#### Scenario: Send action uses icon-first affordance with accessible naming
- **WHEN** the composer renders the idle primary action
- **THEN** the send action MUST present an icon-first affordance rather than a text-only button label
- **AND** the action MUST expose an accessible name equivalent to “发送消息”

#### Scenario: Stop action remains visually distinct from send
- **WHEN** the composer renders the running or stop-pending primary action
- **THEN** the stop action MUST use a stop-specific iconography that is distinct from the send action
- **AND** the action MUST preserve danger-state visual semantics without relying on color alone

#### Scenario: Composer does not render a persistent stop side-effect note
- **WHEN** the composer renders its action row in any runtime state
- **THEN** the composer MUST NOT display a persistent inline note describing stop side effects beneath the primary action row
