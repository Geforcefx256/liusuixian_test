## Context

The current backend loads canonical skills from packaged `SKILL.md` files under `apps/agent-backend/assets/**`, but the metadata path used for `name` and `description` is not equivalent to `opencode`.

Today the backend:

- parses frontmatter with a hand-rolled line parser rather than a YAML-aware parser
- accepts alternate fields such as `title` for the display name
- silently falls back to manifest ids or empty strings when required metadata is missing
- injects the resulting metadata into multiple runtime surfaces such as skill-tool descriptions, session preload skill lists, planner skill lists, and managed skill canonical metadata

That behavior is convenient for permissive loading, but it breaks parity with canonical `SKILL.md` semantics. It also conflicts with the current repository policy to surface failures clearly instead of silently degrading around invalid configuration.

This change is cross-cutting because the same canonical skill metadata affects:

- `SkillCatalog` loading
- managed skill canonical metadata sync
- governed skill-tool discovery text
- session skill preload instructions
- planner skill summaries

## Goals / Non-Goals

**Goals:**
- Parse canonical `SKILL.md` frontmatter with YAML semantics aligned to `opencode`.
- Define `name` and `description` as required canonical metadata fields for runtime skill exposure.
- Remove silent fallback behavior that replaces missing canonical metadata with manifest ids or empty strings.
- Ensure all runtime surfaces consume the same canonical parsed metadata result.
- Add verification coverage for quoted YAML strings, colon-containing values, block-scalar descriptions, and invalid frontmatter cases.

**Non-Goals:**
- Expanding skill discovery sources to match all of `opencode` discovery behavior such as `.claude/skills`, `.agents/skills`, config paths, or remote skill URLs.
- Redesigning managed skill governance, approval semantics, or agent binding policy.
- Changing the structure or authoring style of existing valid built-in `SKILL.md` assets beyond metadata parsing expectations.
- Changing skill-body loading behavior beyond the metadata contract needed for runtime discovery and preload.

## Decisions

### Decision: Introduce one canonical skill metadata parsing path

The backend SHALL replace the current hand-written frontmatter parser with a single YAML-aware canonical parsing function for `SKILL.md` metadata. That parser will be the only source used to populate canonical skill `name` and `description`.

Rationale:
- One parser eliminates drift between catalog loading and downstream prompt surfaces.
- YAML-aware parsing is required to correctly support quoted values, colon-containing strings, and block-scalar descriptions.
- A single canonical path makes later validation and test coverage straightforward.

Alternatives considered:
- Patch the existing line parser to support a few more YAML patterns.

Why not:
- That would continue a partial YAML reimplementation, leaving further edge cases and making parity with `opencode` fragile.

### Decision: Align required canonical metadata with `opencode`

Canonical runtime skills SHALL require frontmatter `name` and `description`. If either field is missing or cannot be parsed as a string, the skill SHALL be treated as invalid for runtime discovery.

Rationale:
- This matches the effective `opencode` contract for usable skills.
- Required canonical metadata avoids runtime surfaces advertising degraded or fabricated skill identities.
- It follows the repository debug-first rule by surfacing invalid assets instead of hiding the problem behind fallback values.

Alternatives considered:
- Keep falling back to manifest id for `name`.
- Keep falling back to an empty string for `description`.
- Continue accepting `title` as an alternate display-name source.

Why not:
- Those fallbacks make invalid canonical skill packages appear valid and produce metadata that diverges from the source `SKILL.md`.

### Decision: Fail invalid canonical metadata at catalog-ingestion time

The backend SHALL reject invalid canonical skill metadata when building the skill catalog instead of allowing broken entries into downstream runtime surfaces. The runtime should log or otherwise expose the invalid-skill condition, but it should not advertise the skill as available.

Rationale:
- Rejecting early keeps all downstream consumers simple and consistent.
- It prevents planner prompts, skill-tool descriptions, and managed canonical metadata from each inventing different fallback behavior.
- This is the narrowest way to keep the invalid state visible without adding shadow fallback code.

Alternatives considered:
- Permit invalid skills in the catalog and let each consumer decide how to display them.

Why not:
- That would duplicate invalid-state handling across multiple runtime paths and recreate the current drift problem.

### Decision: Keep governed display metadata separate from canonical metadata

Managed skill governance SHALL continue to keep governed display metadata separate from canonical skill metadata. This change only updates how canonical `name` and `description` are parsed and validated before governance records mirror them as canonical values.

Rationale:
- The existing separation between canonical package metadata and governed surface metadata is already a defined product boundary.
- Canonical parsing parity and governed-display policy are separate concerns and should remain decoupled.

Alternatives considered:
- Collapse canonical and governed metadata into a single runtime structure.

Why not:
- That would broaden the change unnecessarily and entangle parsing parity with unrelated administration policy.

### Decision: Update all preload and discovery surfaces to consume canonical metadata directly

The skill-tool description, session skill preload block, planner skill summaries, and canonical managed-registry sync SHALL all consume the same validated canonical metadata emitted by the catalog.

Rationale:
- These surfaces all describe the same canonical skill set and should not drift.
- A shared canonical source makes behavior easier to reason about and test.
- This directly addresses the current mismatch where permissive loading leaks into user- or model-visible discovery text.

Alternatives considered:
- Align only the skill-tool provider first and defer prompt surfaces.

Why not:
- That would leave the system with multiple visible metadata contracts for the same skill set.

## Risks / Trade-offs

- [Previously tolerated invalid skill metadata becomes unavailable] -> Built-in assets are already well-formed; add explicit tests and clear invalid-skill logging so future asset regressions fail visibly.
- [Adding a YAML parser path may change how edge-case values are normalized] -> Lock behavior with tests for quoted strings, colon-containing values, and block-scalar descriptions before implementation completes.
- [Catalog-level rejection could surprise managed-skill sync if an asset regresses] -> Treat that as a desired fail-fast signal and ensure canonical sync tests assert the invalid asset is not imported as a valid canonical skill.

## Migration Plan

1. Introduce the canonical YAML/frontmatter parser and validation contract for skill metadata.
2. Update catalog loading to reject invalid canonical skill metadata instead of falling back.
3. Verify managed-skill sync and runtime preload surfaces consume the same canonical metadata.
4. Run focused tests for valid and invalid `SKILL.md` permutations.

Rollback strategy:
- Revert the parser and catalog validation changes together if an unexpected runtime regression is found.
- Because this change only tightens canonical metadata parsing, rollback does not require data migration.

## Open Questions

- None for proposal scope. The desired contract is to follow `opencode` semantics for canonical `SKILL.md` `name` and `description` parsing and validation.
