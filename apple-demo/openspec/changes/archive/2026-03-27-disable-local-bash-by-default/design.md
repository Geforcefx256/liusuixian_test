## Context

`apps/agent-backend` already supports a runtime tool deny list, and the shipped configuration uses it to hide selected local, gateway, and MCP tools. At the same time, the local tool provider still exposes `local:bash` by default even though the only implemented sandbox backend is `macos-seatbelt`, which is not usable in Linux validation environments and is unavailable on Windows.

The immediate need is narrower than cross-platform sandbox support: make the shipped runtime safe for non-shell validation flows by default while keeping `local:write` and the other non-shell local tools available.

## Goals / Non-Goals

**Goals:**

- Disable `local:bash` by default through shipped runtime configuration.
- Preserve the current deny-list mechanism as the only control surface for this change.
- Keep non-shell local tools visible and invocable under shipped defaults.
- Leave an explicit path for operators to re-enable `local:bash` later by editing configuration.

**Non-Goals:**

- Implement a Linux or Windows sandbox backend.
- Remove the `bash` implementation from code or from the local tool provider.
- Change skill governance, skill catalog contents, or planner/build routing behavior.
- Add fallback execution paths or silent degradation for shell commands.

## Decisions

### 1. Use shipped runtime deny defaults instead of code-path conditionals

Add `local:bash` to `apps/agent-backend/config.json` under `runtime.tools.deny` and rely on the existing tool registry deny behavior to hide it from runtime catalog and invocation.

This keeps the change small and aligned with an already-governed control plane. It also avoids introducing environment-specific branching into provider registration.

Alternative considered:

- Add platform checks to conditionally hide `local:bash`: rejected because tool availability would become implicit and harder to reason about than an explicit shipped config value.

### 2. Keep the provider implementation packaged but unreachable by default

The `local:bash` provider entry remains implemented and testable, but the shipped defaults make it unavailable unless operators explicitly remove the deny entry.

This preserves future flexibility for Linux sandbox work without broadening the current runtime surface.

Alternative considered:

- Delete or comment out `local:bash`: rejected because it would mix a temporary runtime-surface decision with irreversible implementation removal.

### 3. Do not couple this change to skill-level pruning

This change only affects runtime tool exposure. Skills that describe `local:bash` may still exist in the governed catalog, but the runtime will not expose the tool itself by default.

This keeps the scope limited to the operator-approved request and avoids introducing larger governance changes into a config-defaults fix.

Alternative considered:

- Also hide or rewrite bash-dependent skills: rejected for now because it expands scope beyond the requested default runtime behavior change.

## Risks / Trade-offs

- [Bash-dependent skills remain discoverable while `local:bash` is denied] → Limit current validation to non-bash flows and treat broader skill-governance cleanup as separate work.
- [Existing tests or docs may assume `local:bash` is present by default] → Update shipped-default assertions and operator documentation in the same change.
- [Operators may mistake the default deny as implementation removal] → Document that re-enablement is an explicit config change, not a code restoration task.

## Migration Plan

1. Update the shipped runtime deny list to include `local:bash`.
2. Update spec text and verification coverage for the new shipped default.
3. Update runtime/operator documentation to explain that `local:bash` is disabled by default but may be re-enabled by configuration.

Rollback strategy:

- Remove `local:bash` from the shipped runtime deny list to restore the prior default.

## Open Questions

- Whether bash-dependent governed skills should eventually be hidden when `local:bash` is denied remains open and is intentionally out of scope for this change.
