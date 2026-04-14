## ADDED Requirements

### Requirement: Workbench working-group `NEW` menu SHALL support explicit dismiss interactions
The workbench SHALL allow users to dismiss the working-group `NEW` creation menu through standard pointer and keyboard interactions, and MUST NOT require a second click on the same trigger as the only closing path.

#### Scenario: Outside pointer interaction closes the opened `NEW` menu
- **WHEN** the user opens the working-group `NEW` menu in the workspace sidebar
- **AND** the user performs a primary pointer interaction outside the `NEW` trigger and dropdown region
- **THEN** the workbench MUST close the `NEW` menu

#### Scenario: Escape key closes the opened `NEW` menu
- **WHEN** the user opens the working-group `NEW` menu in the workspace sidebar
- **AND** keyboard focus remains within the workbench document
- **AND** the user presses `Escape`
- **THEN** the workbench MUST close the `NEW` menu

#### Scenario: Trigger toggle behavior remains available
- **WHEN** the user opens the working-group `NEW` menu and clicks the same `NEW` trigger again
- **THEN** the workbench MUST close the `NEW` menu

#### Scenario: Choosing a creation action closes the menu before inline creation state
- **WHEN** the user opens the working-group `NEW` menu and selects a creation action
- **THEN** the workbench MUST close the dropdown menu
- **AND** the workbench MUST enter the corresponding inline creation input state
