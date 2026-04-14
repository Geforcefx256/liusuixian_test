## ADDED Requirements

### Requirement: Runtime skill asset tools SHALL expose approved skill-scoped read-only asset access
The runtime SHALL expose model-facing `skill:read_asset`, `skill:find_assets`, and `skill:list_assets` tools for approved skills using explicit `skillName` input and paths rooted at that skill's `baseDir`.

#### Scenario: Execution tool catalog exposes dedicated skill asset tools
- **WHEN** the runtime builds the execution tool catalog for an agent surface with approved skills
- **THEN** the catalog MUST include `skill:read_asset`, `skill:find_assets`, and `skill:list_assets`
- **AND** those tools MUST be described as access to skill-owned read-only assets rather than workspace files

#### Scenario: Asset read and listing resolve inside the approved skill base directory
- **WHEN** the runtime serves `read_asset` or `list_assets` for a request with an approved `skillName`
- **THEN** it MUST resolve the requested path relative to that skill's `baseDir`
- **AND** it MUST return only file content or directory entries that originate from that skill directory tree

#### Scenario: Asset discovery stays inside one approved skill
- **WHEN** the runtime serves `find_assets` for a request with an approved `skillName` and a filename or simple glob pattern
- **THEN** it MUST search only within that skill's `baseDir`
- **AND** it MUST return paths relative to that skill's `baseDir` rather than workspace-relative paths

### Requirement: Runtime skill asset tools SHALL fail explicitly for denied or out-of-scope access
The runtime SHALL reject skill asset requests that target denied skills, missing assets, type mismatches, or paths outside the named skill package instead of silently falling back to workspace-local behavior.

#### Scenario: Unapproved skill asset access is denied
- **WHEN** a request invokes `skill:read_asset`, `skill:find_assets`, or `skill:list_assets` for a canonical skill that exists but is not approved for the current governed runtime surface
- **THEN** the runtime MUST reject the request as denied skill access
- **AND** it MUST NOT expose file contents, directory entries, or match results for that skill

#### Scenario: Skill asset path escape is rejected
- **WHEN** a request supplies `path` or `basePath` that would escape the named skill's `baseDir`
- **THEN** the runtime MUST fail the request explicitly
- **AND** it MUST NOT reinterpret that request against the workspace root or any sibling skill directory

#### Scenario: File and directory mismatches remain explicit
- **WHEN** `skill:read_asset` targets a directory or `skill:list_assets` targets a file
- **THEN** the runtime MUST return an explicit mismatch-style failure
- **AND** it MUST NOT silently coerce the request into a different operation

### Requirement: Planner mode SHALL keep skill asset tools out of its first-version tool surface
The runtime SHALL preserve the current planner-only tool surface for the first version of governed skill asset access.

#### Scenario: Planner tool catalog excludes skill asset tools
- **WHEN** the runtime builds the planner tool catalog
- **THEN** it MUST continue to allow `skill:skill`
- **AND** it MUST NOT expose `skill:read_asset`, `skill:find_assets`, or `skill:list_assets`
