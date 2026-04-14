## ADDED Requirements

### Requirement: Canonical skill uploads SHALL reject conflicting canonical identity
The system SHALL treat canonical skill `id` and canonical skill `name` as reserved identities during managed skill ZIP upload because governed runtime surfaces and tooling may resolve canonical skills by either field.

#### Scenario: Same id upload requires explicit overwrite confirmation
- **WHEN** an administrator uploads a canonical skill package whose `id` already exists and the request does not confirm overwrite
- **THEN** the system MUST reject the upload with `409`
- **AND** the conflict response MUST include `reason` set to `id`
- **AND** the conflict response MUST identify the existing managed skill for administrator review before any overwrite retry

#### Scenario: Same name on a different id is rejected explicitly
- **WHEN** an administrator uploads a canonical skill package whose `name` already exists on a different canonical `id`
- **THEN** the system MUST reject the upload with `409`
- **AND** the conflict response MUST include `reason` set to `name`
- **AND** the system MUST NOT persist the uploaded package or mutate any managed governance state

#### Scenario: Overwrite cannot bypass a name conflict
- **WHEN** an administrator submits `/agent/api/admin/skills/upload?overwrite=true` but the uploaded package still conflicts on canonical `name` with a different existing skill
- **THEN** the system MUST continue to reject the upload as a `name` conflict
- **AND** the system MUST NOT replace any canonical package as part of that request

### Requirement: Skill management upload conflict UI SHALL distinguish overwriteable and blocking conflicts
The skill management UI SHALL present a generic canonical conflict surface for managed skill uploads while disclosing whether the conflict is caused by canonical `id` or canonical `name`, and SHALL only offer overwrite retry for overwrite-safe `id` conflicts.

#### Scenario: Id conflict keeps explicit overwrite confirmation
- **WHEN** the management UI receives a managed skill upload conflict with `reason = id`
- **THEN** the UI MUST state that the conflict is caused by an existing canonical `id`
- **AND** the UI MUST keep the explicit overwrite confirmation action available

#### Scenario: Name conflict blocks overwrite retry
- **WHEN** the management UI receives a managed skill upload conflict with `reason = name`
- **THEN** the UI MUST state that the conflict is caused by an existing canonical `name`
- **AND** the UI MUST NOT present the overwrite confirmation action for that conflict

### Requirement: Managed skill upload API SHALL normalize upload middleware failures
The admin skill upload API SHALL return structured JSON error payloads for upload middleware failures so that the skill management UI can handle invalid file selections and multipart failures through the same product-owned error path used for other upload validation responses.

#### Scenario: Non-ZIP file rejection remains structured
- **WHEN** an administrator submits a non-ZIP file to `/agent/api/admin/skills/upload`
- **THEN** the API MUST respond with JSON rather than raw middleware text or an HTML error page
- **AND** the response payload MUST include stable `error` and `code` fields

#### Scenario: Multipart middleware failure remains structured
- **WHEN** multipart parsing or upload middleware fails before business validation completes
- **THEN** the API MUST respond with JSON rather than exposing raw middleware output
- **AND** frontend consumers MUST be able to handle that failure through the existing structured upload-error branch
