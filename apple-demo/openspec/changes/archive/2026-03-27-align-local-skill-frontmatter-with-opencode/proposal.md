## Why

The current local skill preload path does not parse `SKILL.md` frontmatter the same way as `opencode`. In particular, `name` and `description` can silently fall back to manifest ids or empty strings, and valid YAML forms such as quoted strings, colon-containing values, and block-scalar descriptions are not handled with `opencode`-equivalent semantics.

This creates a contract mismatch between canonical skill packages and the runtime surfaces that preload skill metadata for models. The backend now needs to align local skill metadata parsing with `opencode` so the governed skill surface reflects the real `SKILL.md` contract rather than permissive parser-specific fallbacks.

## What Changes

- Replace the current hand-rolled local skill frontmatter parsing path with an `opencode`-aligned YAML/frontmatter parsing flow for canonical `SKILL.md` files.
- Require canonical skill metadata to resolve `name` and `description` from frontmatter rather than silently falling back to manifest ids, empty strings, or alternate display fields.
- Ensure runtime skill preload surfaces consume one canonical metadata result for skill tool descriptions, session skill preload prompts, and planning prompts.
- Treat invalid or incomplete canonical skill frontmatter as an explicit invalid-skill condition instead of exposing degraded metadata through runtime discovery.
- Add verification coverage for quoted values, colon-containing values, multiline block-scalar descriptions, and invalid or missing required metadata.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `skill-management`: define canonical `SKILL.md` metadata parsing and validation rules for managed skills so governed runtime surfaces reflect real frontmatter semantics.
- `agent-backend-runtime`: require runtime skill preload and skill-tool discovery surfaces to use canonical parsed skill metadata and avoid silent fallback metadata.

## Impact

- `apps/agent-backend/src/skills/*` frontmatter parsing, catalog loading, and invalid-skill handling.
- `apps/agent-backend/src/runtime/tools/providers/skillProvider.ts` and runtime prompt surfaces that list available skills.
- Managed skill import/governance records that mirror canonical skill name and description from `SKILL.md`.
- Runtime tests covering skill metadata parsing, governed skill exposure, and skill preload output.
