## ADDED Requirements

### Requirement: Workbench upload conflict confirmation SHALL use a product-owned confirmation surface
The workbench SHALL replace browser-native confirmation for upload path conflicts with a product-owned confirmation surface so users can decide whether to overwrite an existing workspace file without leaving the workbench interaction model.

#### Scenario: Conflicting upload opens a product confirmation surface
- **WHEN** the normal composer upload flow receives an `UPLOAD_CONFLICT` response for a selected file
- **THEN** the workbench MUST open a product-owned confirmation surface before issuing any overwrite retry
- **AND** the confirmation surface MUST identify the conflicting workspace-relative path
- **AND** the confirmation surface MUST warn that continuing will overwrite the current file content
- **AND** the frontend MUST NOT invoke a browser-native confirmation dialog for that conflict

#### Scenario: Canceling or dismissing upload conflict confirmation does not overwrite the file
- **WHEN** the upload conflict confirmation surface is open and the user clicks `取消`, presses `Esc`, or dismisses the surface by clicking outside it
- **THEN** the workbench MUST close the confirmation surface
- **AND** the workbench MUST NOT retry the upload with overwrite enabled for that file

#### Scenario: Confirmed upload conflict retries overwrite through the existing upload flow
- **WHEN** the upload conflict confirmation surface is open and the user confirms the overwrite action
- **THEN** the workbench MUST retry that same file through the existing upload flow with overwrite enabled
- **AND** a successful retry MUST make the updated file available through the existing workspace refresh path

#### Scenario: Multi-file upload resolves conflicts one at a time
- **WHEN** one file in a multi-file upload selection opens the upload conflict confirmation surface
- **THEN** the workbench MUST pause the remaining upload queue until the user resolves that conflict
- **AND** after the user confirms or cancels that conflict, the workbench MUST continue processing the remaining selected files in order
