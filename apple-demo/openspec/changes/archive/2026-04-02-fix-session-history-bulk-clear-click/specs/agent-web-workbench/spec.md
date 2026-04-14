## ADDED Requirements

### Requirement: History rail bulk-clear action SHALL remain activatable through menu interactions
When the history rail renders `清空历史会话` as available, the workbench SHALL keep that action reachable and activatable throughout the menu interaction flow, so real user input can reliably open the bulk-clear confirmation surface before any request is issued.

#### Scenario: Available bulk-clear action is keyboard focusable
- **WHEN** the user opens the history rail actions menu while `清空历史会话` is available
- **THEN** the bulk-clear menu item MUST remain reachable through standard keyboard focus navigation
- **AND** activating it from keyboard input MUST open the bulk-clear confirmation surface

#### Scenario: Primary pointer activation opens confirmation before the menu is dismissed
- **WHEN** the user clicks the available `清空历史会话` menu item with a primary pointer
- **THEN** the workbench MUST open the bulk-clear confirmation surface for that action
- **AND** the menu item MUST NOT lose activation before its click handling completes
- **AND** the workbench MUST NOT dismiss the interaction in a way that prevents the confirmation surface from appearing

#### Scenario: Opening the bulk-clear confirmation does not issue the request early
- **WHEN** the user activates `清空历史会话` and the confirmation surface opens
- **THEN** the workbench MUST NOT issue the bulk-clear request until the user explicitly confirms from that surface
