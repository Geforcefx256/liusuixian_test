## MODIFIED Requirements

### Requirement: Runtime SHALL reconstruct retained skills from persisted hidden skill-context messages
The runtime SHALL reconstruct invoked-skill retention from persisted session messages by reading hidden skill-context messages created by successful governed `skill:skill` loads in the current session. It MUST ignore skill listing/discovery signals, MUST ignore failed skill-load calls that did not create hidden skill-context messages, and MUST keep only the latest retained content for each skill name.

#### Scenario: Latest successful hidden skill context wins for the same skill
- **WHEN** one session contains multiple hidden skill-context messages for the same skill name created by repeated successful `skill:skill` loads
- **THEN** the runtime MUST retain only the latest hidden skill-context content for that skill name
- **AND** earlier retained content for that same skill name MUST NOT be injected as an additional retained entry

#### Scenario: Failed skill load does not create retained content
- **WHEN** a `skill:skill` tool call fails for a skill name in the current session
- **THEN** that failed call MUST NOT create or replace retained skill content

#### Scenario: Skill listing and non-context tool traces do not create retained content
- **WHEN** the session contains skill listing, discovery, recommendation-only messages, or successful tool traces without a persisted hidden skill-context message
- **THEN** the runtime MUST NOT create retained skill content from those messages alone

### Requirement: Runtime SHALL inject retained skills as a dedicated post-compaction reminder
When the runtime builds context for a session that already has a compacted summary and retained skills are available, it SHALL inject retained skill content reconstructed from persisted hidden skill-context messages through a dedicated reminder message that is separate from the summary content.

#### Scenario: Compacted session receives retained-skill reminder
- **WHEN** a session has an existing compacted summary and at least one retained skill reconstructed from prior persisted hidden skill-context messages
- **THEN** the runtime MUST add a dedicated retained-skill reminder message to the built context
- **AND** that reminder MUST remain separate from the `【会话摘要】` message rather than being merged into the summary text

#### Scenario: Session without summary does not receive duplicate retained reminder
- **WHEN** a session has not yet entered the compacted-summary path
- **THEN** the runtime MUST NOT inject an extra retained-skill reminder message

#### Scenario: Retained-skill injection respects dedicated budget
- **WHEN** retained skill content exceeds the dedicated retention budget for the built context
- **THEN** the runtime MUST keep only the retained skill entries that fit within that budget
- **AND** the runtime MUST NOT silently move the overflowed skill content into the compacted summary
