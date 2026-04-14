## ADDED Requirements

### Requirement: History rail single-session deletion SHALL use a contextual confirmation surface
The workbench SHALL replace browser-native confirmation for single-session deletion with a product-owned lightweight confirmation surface rendered in the history rail context, so the user can verify the specific session being removed without leaving the sidebar flow.

#### Scenario: Delete action opens a contextual confirmation for the selected session
- **WHEN** the user triggers delete for a session from the expanded history rail
- **THEN** the workbench MUST open a lightweight confirmation surface anchored within the history rail context
- **AND** the confirmation surface MUST include the target session title or equivalent identifying context
- **AND** the destructive action label MUST read `删除会话`

#### Scenario: Canceling or dismissing the contextual confirmation does not delete the session
- **WHEN** the lightweight single-session confirmation is open and the user clicks `取消`, presses `Esc`, or dismisses the surface by clicking outside it
- **THEN** the workbench MUST close the confirmation surface
- **AND** the workbench MUST NOT issue a delete request for that session

#### Scenario: Confirmed single-session deletion removes the target session
- **WHEN** the lightweight single-session confirmation is open and the user confirms `删除会话`
- **THEN** the workbench MUST issue the existing delete action for the targeted session
- **AND** a successful delete MUST remove that session from the visible history list

### Requirement: History rail bulk-clear SHALL use a formal confirmation surface with scoped messaging
The workbench SHALL replace browser-native confirmation for `清空历史会话` with a product-owned formal confirmation surface that uses the same visual language as single-session deletion while clearly expressing the broader scope of the action.

#### Scenario: Bulk-clear action opens a formal confirmation surface
- **WHEN** the user triggers `清空历史会话` from the expanded history rail
- **THEN** the workbench MUST open a formal confirmation surface distinct from the lightweight single-session delete surface
- **AND** the confirmation content MUST state that only historical sessions for the active agent will be deleted
- **AND** the confirmation content MUST state that the current session will not be affected

#### Scenario: Canceling or dismissing the bulk-clear confirmation does not clear history
- **WHEN** the formal bulk-clear confirmation is open and the user clicks `取消`, presses `Esc`, or dismisses the surface by clicking outside it
- **THEN** the workbench MUST close the confirmation surface
- **AND** the workbench MUST NOT issue the bulk-clear request

#### Scenario: Confirmed bulk clear keeps the current session selected
- **WHEN** the formal bulk-clear confirmation is open and the user confirms the clear action
- **THEN** the workbench MUST issue the existing bulk-clear action for historical sessions of the active agent
- **AND** the workbench MUST keep the current session selected and visible after the clear completes
