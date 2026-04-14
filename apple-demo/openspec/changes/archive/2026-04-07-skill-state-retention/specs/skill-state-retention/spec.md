## ADDED Requirements

### Requirement: Runtime SHALL reconstruct retained skills from persisted successful skill-load messages
The runtime SHALL reconstruct invoked-skill retention from persisted session messages by scanning successful `skill:skill` tool results in the current session. It MUST ignore skill listing/discovery signals, MUST ignore failed skill-load calls, and MUST keep only the latest successful retained content for each skill name.

#### Scenario: Latest successful load wins for the same skill
- **WHEN** one session contains multiple successful `skill:skill` tool results for the same skill name
- **THEN** the runtime MUST retain only the latest successful content for that skill name
- **AND** earlier retained content for that same skill name MUST NOT be injected as an additional retained entry

#### Scenario: Failed skill load does not create retained content
- **WHEN** a `skill:skill` tool call fails for a skill name in the current session
- **THEN** that failed call MUST NOT create or replace retained skill content

#### Scenario: Skill listing and discovery do not create retained content
- **WHEN** the session contains skill listing, discovery, or recommendation-only messages without a successful `skill:skill` result
- **THEN** the runtime MUST NOT create retained skill content from those messages

### Requirement: Runtime SHALL inject retained skills as a dedicated post-compaction reminder
When the runtime builds context for a session that already has a compacted summary and retained skills are available, it SHALL inject retained skill content through a dedicated reminder message that is separate from the summary content.

#### Scenario: Compacted session receives retained-skill reminder
- **WHEN** a session has an existing compacted summary and at least one retained skill reconstructed from prior successful `skill:skill` results
- **THEN** the runtime MUST add a dedicated retained-skill reminder message to the built context
- **AND** that reminder MUST remain separate from the `【会话摘要】` message rather than being merged into the summary text

#### Scenario: Session without summary does not receive duplicate retained reminder
- **WHEN** a session has not yet entered the compacted-summary path
- **THEN** the runtime MUST NOT inject an extra retained-skill reminder message

#### Scenario: Retained-skill injection respects dedicated budget
- **WHEN** retained skill content exceeds the dedicated retention budget for the built context
- **THEN** the runtime MUST keep only the retained skill entries that fit within that budget
- **AND** the runtime MUST NOT silently move the overflowed skill content into the compacted summary

### Requirement: Runtime SHALL emit diagnostic logs for skill retention decisions
The runtime SHALL emit explicit diagnostic logs for retained-skill extraction and injection decisions so operators can determine whether retention was reconstructed, injected, skipped, or budget-trimmed for a given session.

#### Scenario: Extraction log reports reconstructed skills
- **WHEN** the runtime reconstructs retained skills from persisted session messages
- **THEN** it MUST emit a retention extraction log entry that identifies the session scope and the retained skill names

#### Scenario: Injection log reports injected skills
- **WHEN** the runtime injects a retained-skill reminder into built context
- **THEN** it MUST emit a retention injection log entry that includes the injected skill names and reminder size

#### Scenario: Skip log reports why retained skills were not fully injected
- **WHEN** the runtime skips retained-skill injection because no retained skills exist, no compacted summary exists, or part of the retained content exceeds budget
- **THEN** it MUST emit a retention skip log entry that records the reason for that decision
