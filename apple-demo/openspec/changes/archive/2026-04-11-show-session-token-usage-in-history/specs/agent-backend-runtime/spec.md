## ADDED Requirements

### Requirement: Runtime SHALL expose admin-only session usage summaries for history inspection
The runtime SHALL provide a dedicated session usage summary query for history inspection that aggregates persisted assistant-message usage within a single session. This query MUST be restricted to `admin` and `super_admin` users and MUST remain independent from the ordinary run execution path.

#### Scenario: Admin requests usage summary for a persisted session
- **WHEN** an `admin` or `super_admin` requests the usage summary for a valid `sessionId`
- **THEN** the runtime MUST aggregate all persisted assistant-message `meta.usage` values for that session
- **AND** the response MUST include the cumulative `totalTokens` for that session

#### Scenario: Empty or pre-reply session returns a zero summary
- **WHEN** an `admin` or `super_admin` requests the usage summary for a session that has no persisted assistant messages with usage metadata
- **THEN** the runtime MUST return a successful summary response for that session
- **AND** the cumulative token counts in that response MUST be `0`

#### Scenario: Non-admin cannot read session usage summary
- **WHEN** a non-admin user requests the session usage summary for any session
- **THEN** the runtime MUST reject the request with an authorization error
- **AND** it MUST NOT expose the session's usage totals in the response body

#### Scenario: Usage query failure does not block ordinary conversation execution
- **WHEN** the dedicated session usage summary query fails for any reason
- **THEN** the runtime MUST surface that failure explicitly on the usage-query path
- **AND** it MUST NOT change run admission, streaming, or message persistence behavior for ordinary conversation requests
