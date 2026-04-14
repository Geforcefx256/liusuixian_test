## Context

The runtime already has two distinct file access models:

- `local:*` tools operate on the authenticated `user + agent` workspace.
- `skill:skill` loads the governed `SKILL.md` body for an approved skill.

That split is intentional, but it is incomplete. Skills can reference supplementary files such as `reference/*.md` or sibling assets under the same skill package, while the runtime does not expose any governed way to browse or read those assets. The current `skill` tool even returns a `Base directory` hint and sample file list, which encourages the model to treat skill assets as readable, but the only general-purpose read tools remain rooted at the workspace and correctly reject those paths.

This change is cross-cutting because it touches:

- skill tool catalog and invocation behavior
- governed skill approval checks
- prompt/tool guidance for execution versus planning
- runtime error contracts and tests for path boundaries

## Goals / Non-Goals

**Goals:**

- Add a governed, read-only skill asset access surface for discovery, listing, and reading.
- Keep workspace-local tools strictly scoped to the workspace and avoid mixing runtime skill assets into `local:*`.
- Reuse managed skill approval and agent binding checks for skill asset access.
- Make the model-facing contract explicit enough that path errors become rare and debuggable.
- Keep the first version narrow: read, find, and list only.

**Non-Goals:**

- Adding skill-scoped write, search, bash, or question tools.
- Letting asset tools read across multiple skills or across the full runtime root.
- Giving planner mode direct access to skill asset tools in the first version.
- Introducing implicit "last loaded skill" state into tool invocation.

## Decisions

### Decision: Add three dedicated skill asset tools under the `skill` provider

The runtime will add:

- `skill:read_asset`
- `skill:find_assets`
- `skill:list_assets`

These tools live alongside `skill:skill` rather than under `local:*`.

Why:

- The semantics are different from workspace files.
- The access path is governed by skill approval, not workspace scope.
- Distinct names reduce model confusion compared with mirroring `read_file` / `find_files` / `list_directory`.

Alternatives considered:

- Expand `local:*` to include runtime skill directories: rejected because it collapses workspace and runtime boundaries into one tool family.
- Add mirrored names such as `skill:read_file`: rejected because the tool names remain too easy to confuse with `local:*`.

### Decision: Require explicit `skillName` on every skill asset request

Each asset tool will require the caller to pass `skillName` explicitly. The runtime will resolve that name using the same governed skill lookup path used by `skill:skill`.

Why:

- Requests stay stateless and replayable.
- Logs and failures remain easy to interpret.
- The runtime does not need hidden "last loaded skill" session state.

Alternatives considered:

- Bind asset access to the most recently loaded skill: rejected because it creates hidden state and ambiguous recovery behavior.

### Decision: Root asset access at the approved skill `baseDir` only

Once the runtime resolves an approved skill, all asset paths will be interpreted relative to that skill's `baseDir`. Path escapes outside that directory will fail explicitly.

Why:

- It preserves per-skill isolation.
- It matches the mental model already implied by `Base directory`.
- It avoids turning one approved skill into permission to inspect sibling skills.

Alternatives considered:

- Root at the agent-level `skills/` directory: rejected because one skill could browse unrelated skill packages.
- Root at the runtime repository: rejected because it breaks governed least-privilege boundaries.

### Decision: Keep asset tools read-only and shape-compatible with local file tools

`read_asset`, `find_assets`, and `list_assets` will remain read-only and should return payloads aligned with `local:read_file`, `local:find_files`, and `local:list_directory` wherever practical.

Why:

- The model already understands the local file tool response shapes.
- Logging, tool-failure classification, and frontend summaries stay consistent.
- The first version solves the actual missing access path without creating new execution semantics.

Alternatives considered:

- Return custom ad hoc payloads per tool: rejected because it increases recovery complexity and parser surface.

### Decision: Expose asset tools to execution surfaces, not planner mode

The runtime execution catalog may expose the new skill asset tools, but planner mode will keep its current whitelist and continue to allow only `local:question`, `local:read_file`, `local:find_files`, and `skill:skill`.

Why:

- Planner exists to decide what to do, not to perform deep runtime asset inspection.
- This keeps the first version small and avoids broadening the planning prompt and tests unnecessarily.

Alternatives considered:

- Add asset tools to planner immediately: rejected because it increases planner complexity without being required to solve the current runtime failure mode.

## Risks / Trade-offs

- [More tool surface can increase model confusion] -> Use clearly differentiated names (`*_asset*`) and update prompt/tool descriptions to keep workspace and skill scopes separate.
- [Behavior duplication between local and skill file access paths] -> Reuse validation and response-shape patterns where possible, but keep the roots and approval logic distinct.
- [Some skills may assume broader runtime file visibility] -> Fail explicitly on out-of-scope access so broken assumptions surface during testing rather than being silently tolerated.
- [Planner and execution surfaces diverge slightly] -> Keep the divergence intentional and documented; planner only needs `SKILL.md`, while execution may need skill-owned assets.

## Migration Plan

1. Extend the `skill` provider catalog with `read_asset`, `find_assets`, and `list_assets`.
2. Reuse governed skill resolution to authorize `skillName` and compute the target `baseDir`.
3. Implement read/find/list operations rooted at that `baseDir`, with explicit path-escape and type-mismatch failures.
4. Update execution-facing tool descriptions and runtime prompts so the model understands `local:*` versus `skill:*`.
5. Keep planner tool filtering unchanged.
6. Add focused tests for catalog exposure, approved access, denied access, and boundary errors.

Rollback strategy:

- Remove the new tool manifests from the `skill` provider and revert the prompt/tool description updates together.
- Do not relax `local:*` workspace boundaries as a fallback.

## Open Questions

- None for the first version. The current scope is intentionally limited to governed read/find/list asset access.
