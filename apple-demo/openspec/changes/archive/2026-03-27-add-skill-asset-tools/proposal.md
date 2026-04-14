## Why

The runtime currently separates `skill:skill` from `local:*` tools, but that split stops at `SKILL.md`. A skill can instruct the model to load supplementary assets such as `reference/*.md`, while the only available read/find tools are rooted at the user workspace, causing predictable `outside workspace` failures when the model follows the skill literally.

We need an explicit skill-scoped asset access surface so the model can read governed skill assets without weakening the workspace boundary or overloading `local:*` semantics.

## What Changes

- Add governed read-only skill asset tools: `skill:read_asset`, `skill:find_assets`, and `skill:list_assets`.
- Require these asset tools to accept an explicit `skillName` and resolve paths only within that approved skill's `baseDir`.
- Keep `local:read_file`, `local:find_files`, and `local:list_directory` scoped to the current `user + agent` workspace and do not expand them to runtime skill directories.
- Align runtime prompts and skill discovery guidance so models understand `local:*` is for workspace files while `skill:*` asset tools are for skill-owned read-only files.
- Ensure governed approval rules for `skill:skill` also apply to skill asset access so hidden, disabled, or unbound skills cannot expose their assets.
- Add tests for approved asset access, denied skill access, path-escape rejection, and file-versus-directory validation.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `agent-backend-runtime`: define model-facing read/find/list behavior for governed skill-owned assets alongside the existing workspace-local file tools.
- `skill-management`: require governed skill approval and binding checks to apply to skill asset access, not only `SKILL.md` loading.

## Impact

- `apps/agent-backend/src/runtime/tools/providers/skillProvider.ts` and related runtime tool wiring, validation, and logging.
- Runtime prompt surfaces and planner/runtime tool catalogs that describe available skill and local file tools.
- Managed skill governance checks that decide which skills and skill assets are accessible for a given agent surface.
- Tests covering tool catalogs, tool invocation behavior, approval enforcement, and path boundary failures.
