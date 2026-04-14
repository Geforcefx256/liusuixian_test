# web-user-role-administration Specification

## Purpose
TBD - created by archiving change add-user-role-management-drawer. Update Purpose after archive.
## Requirements
### Requirement: Workbench account menu SHALL expose admin-only user management entry
The system SHALL expose a user-management action from the authenticated workbench avatar menu only for users who hold an administrative role.

#### Scenario: Administrative user sees the management entry
- **WHEN** an authenticated `admin` or `super_admin` opens the workbench avatar menu
- **THEN** the menu MUST display a `用户管理` entry in addition to account actions such as password change and logout

#### Scenario: Non-administrative user does not see the management entry
- **WHEN** an authenticated user without `admin` or `super_admin` opens the workbench avatar menu
- **THEN** the menu MUST NOT display the `用户管理` entry

### Requirement: User management SHALL open as a right-side drawer with scoped tabs
The system SHALL open user management from the avatar menu into a right-side drawer and SHALL scope the first release of that drawer to `Users` and `Roles` tabs only.

#### Scenario: Opening the management surface preserves workbench context
- **WHEN** an administrator activates the `用户管理` entry from the avatar menu
- **THEN** the frontend MUST open a right-side drawer over the existing workbench shell
- **AND** the workbench MUST remain visible behind that drawer

#### Scenario: First release excludes unrelated admin tabs
- **WHEN** the user-management drawer is opened
- **THEN** the drawer MUST expose `Users` and `Roles` tabs
- **AND** it MUST NOT expose session-management or usage-analytics tabs in this change

### Requirement: Users tab SHALL support existing-user search, inspection, and role replacement
The system SHALL allow administrators to find an existing user, inspect that user's account details, change the user's active status, and replace the user's role bindings using the approved role set.

#### Scenario: Administrator finds an SSO user and promotes that user to admin
- **WHEN** an administrator searches the `Users` tab for an existing OAuth-provisioned user
- **THEN** the frontend MUST display that user in the result list
- **AND** selecting that user MUST show a role-binding editor that allows the administrator to save an updated role collection including `admin`

#### Scenario: User detail shows source and role context
- **WHEN** an administrator selects a user from the `Users` tab
- **THEN** the detail panel MUST show the user's basic profile fields, current active status, identity source information, and current role bindings

#### Scenario: Administrator updates user active status
- **WHEN** an administrator changes a user's status between active and disabled from the `Users` tab
- **THEN** the system MUST persist the updated status
- **AND** subsequent user detail and list views MUST reflect that new status

### Requirement: Role reassignment SHALL enforce elevated-role guardrails
The system SHALL prevent administrators from using the user-management surface to grant or revoke `super_admin` unless the acting administrator is already a `super_admin`.

#### Scenario: Admin cannot assign super_admin
- **WHEN** an `admin` user edits another user's role bindings
- **THEN** the user-management flow MUST prevent that actor from assigning or removing the `super_admin` role

#### Scenario: Super admin can manage super_admin bindings
- **WHEN** a `super_admin` edits another user's role bindings
- **THEN** the user-management flow MUST allow that actor to assign or remove the `super_admin` role subject to normal save confirmation

### Requirement: Roles tab SHALL support existing-role maintenance
The system SHALL allow administrators to view existing roles and update metadata for existing roles without introducing a permission-matrix editor.

#### Scenario: Administrator edits an existing role description
- **WHEN** an administrator selects an existing role from the `Roles` tab
- **THEN** the drawer MUST show the role's current key, names, description, and activation state
- **AND** the administrator MUST be able to save updates to the editable role metadata supported by the backend

#### Scenario: Role maintenance does not expose capability-level permission editing
- **WHEN** an administrator is using the `Roles` tab
- **THEN** the interface MUST limit editing to existing role metadata
- **AND** it MUST NOT expose a permission tree, route matrix, or other capability-level RBAC editor in this change

