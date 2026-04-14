## MODIFIED Requirements

### Requirement: Workbench SHALL provide Markdown preview in the workspace editor
The workbench SHALL provide a dedicated Markdown preview path for workspace files identified as Markdown and SHALL default those files into preview whenever they become the current active workspace file, so users can review rendered document structure without leaving the workspace shell.

#### Scenario: Markdown file defaults to preview when activated
- **WHEN** the user opens or re-activates a Markdown workspace file in the expanded shell
- **THEN** the editor MUST show the preview view by default for that file
- **AND** the editor MUST still provide an edit view for that same file inside the standard workspace shell

#### Scenario: Markdown file can switch between edit and preview views
- **WHEN** the user switches a Markdown workspace file into edit view and later returns it to preview view
- **THEN** the editor MUST provide both an edit view and a preview view for that file
- **AND** switching to preview MUST render the current workspace file content rather than a stale saved snapshot

#### Scenario: Markdown re-activation does not depend on remembered per-file view state
- **WHEN** the user manually switches a Markdown workspace file into edit view, activates another file, and later re-activates the original Markdown file
- **THEN** the editor MUST return that Markdown file to preview by default
- **AND** the workbench MUST NOT require per-file remembered view state to restore the Markdown default

#### Scenario: Markdown preview remains inside the standard workspace shell
- **WHEN** the user views a Markdown workspace file in preview view
- **THEN** the workbench MUST keep the surrounding workspace shell, tabs, save controls, and conversation surface visible
- **AND** the workbench MUST NOT navigate the user into a separate document page or standalone viewer
