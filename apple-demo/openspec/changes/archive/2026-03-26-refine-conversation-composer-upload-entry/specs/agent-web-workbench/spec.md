## ADDED Requirements

### Requirement: Workbench conversation composer SHALL use an upload-first file entry model
The authenticated workbench SHALL treat the conversation composer as an upload-first surface for workspace files rather than as a mixed upload-and-create entry point.

#### Scenario: Composer primary file action is upload-only
- **WHEN** the user views the conversation composer in either the base shell or the workspace-expanded shell
- **THEN** the primary left-side file action MUST be labeled `上传文件`
- **AND** the composer MUST NOT present blank-file creation actions in that same primary file-entry surface

#### Scenario: Blank file creation remains owned by the workspace area
- **WHEN** the workbench needs to expose blank-file creation for the current `user + agent` workspace
- **THEN** those creation entry points MUST remain in the right-side workspace area rather than in the conversation composer
- **AND** removing create actions from the composer MUST NOT imply that blank-file creation is unavailable elsewhere in the workbench

### Requirement: Workbench conversation composer SHALL disclose supported upload formats through a compact upward help affordance
The authenticated workbench SHALL expose supported composer upload formats through a compact adjacent help affordance instead of a permanently visible inline description.

#### Scenario: Upload help opens upward near the viewport bottom
- **WHEN** the user hovers, focuses, or clicks the composer upload-format help affordance
- **THEN** the workbench MUST open the help surface upward from the composer row
- **AND** the help interaction MUST remain usable from both pointer and keyboard input

#### Scenario: Visible help matches the governed upload contract
- **WHEN** the workbench renders supported-format guidance for the composer upload entry
- **THEN** the visible help copy MUST list only `TXT / MD / CSV`
- **AND** the composer MUST NOT keep a stale always-visible inline support description that competes with the primary action row

### Requirement: Workbench conversation composer SHALL preserve a width-stable primary action row
The authenticated workbench SHALL keep the composer action row stable on supported desktop widths so that upload and send controls remain readable without deforming the primary send action.

#### Scenario: Send action keeps a stable horizontal shape at constrained desktop widths
- **WHEN** the workbench is rendered in a supported laptop-width desktop layout with limited horizontal space
- **THEN** the send action MUST retain a readable horizontal button shape
- **AND** the workbench MUST NOT collapse that action into a narrow vertical pill solely because adjacent upload controls or help text compete for width

#### Scenario: Passive upload guidance does not consume permanent primary-row width
- **WHEN** the composer needs to explain supported upload formats
- **THEN** that explanation MUST live in the secondary help affordance rather than as a permanent inline row label
- **AND** the upload-entry cluster MUST preserve enough room for the send action to remain visually stable
