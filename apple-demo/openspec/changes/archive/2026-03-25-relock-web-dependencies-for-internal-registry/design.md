## Context

`apps/web` currently uses a Vite 5 based frontend toolchain. The checked-in lockfile resolves `rollup` and Windows platform packages to `4.59.1`, while the internal npm registry used by the target Windows environment has been verified to provide `4.59.0` for `rollup` and `@rollup/rollup-win32-x64-msvc`, along with the currently locked `esbuild 0.21.5`, `vite 5.4.21`, `@vitejs/plugin-vue 5.2.4`, `vitest 2.1.9`, and `vite-node 2.1.9`.

The installation failure occurs during dependency resolution, not during application build or runtime. `apps/agent-backend` installs successfully in the same environment, which narrows the issue to the frontend dependency graph and lockfile contents rather than general npm connectivity.

## Goals / Non-Goals

**Goals:**
- Restore `npm install` success for `apps/web` in the internal Windows registry environment.
- Keep the existing Vite 5 toolchain and frontend runtime behavior unchanged.
- Produce a deterministic lockfile that resolves to exact dependency versions confirmed to exist in the internal registry.
- Validate the relocked dependency graph with install-focused checks.

**Non-Goals:**
- Upgrading or downgrading the frontend toolchain beyond the minimum relock needed.
- Modifying application source code, UI behavior, backend APIs, or runtime features.
- Introducing registry-specific fallback logic into application code or scripts.

## Decisions

### Rebuild the lockfile around a verified exact version set
The change will regenerate `apps/web/package-lock.json` so `rollup` and the Windows platform package resolve to `4.59.0`, while retaining the existing compatible Vite 5 ecosystem versions.

Why this decision:
- The internal registry has been verified to serve the needed tarballs for `rollup@4.59.0`, `@rollup/rollup-win32-x64-msvc@4.59.0`, `esbuild@0.21.5`, and `@esbuild/win32-x64@0.21.5`.
- The current failure is caused by exact-version mismatch in the lockfile, so relocking targets the root cause directly.

Alternatives considered:
- Wait for the registry to mirror `rollup@4.59.1`: rejected because it keeps developer setup blocked and depends on external timing.
- Downgrade the full toolchain to Vite 4 / Rollup 3: rejected because it expands the blast radius into `@vitejs/plugin-vue`, `vitest`, and `vite-node` compatibility work.

### Preserve package manifests unless deterministic relocking requires a minimal version pin adjustment
The preferred implementation changes only the lockfile. `apps/web/package.json` will only be adjusted if npm cannot produce the required lockfile without a minimal version-range update that still preserves the Vite 5 toolchain.

Why this decision:
- The issue is currently observed in transitive resolution, not in the direct dependency declarations.
- Avoiding manifest churn reduces review scope and lowers regression risk.

Alternatives considered:
- Force direct pins for multiple transitive packages in `package.json`: rejected because it adds maintenance burden without first proving it is necessary.

### Validate with install-centric checks before considering broader dependency changes
Success criteria focus on `npm install` in `apps/web` under the constrained registry environment, followed by basic build or type-check verification if install succeeds.

Why this decision:
- Install failure is the blocking defect.
- A lockfile-only change must prove that setup works before broader verification is useful.

Alternatives considered:
- Treat lockfile regeneration as sufficient without validation: rejected because the root problem only manifests in the target environment.

## Risks / Trade-offs

- Internal registry metadata may still be inconsistent beyond the versions already verified. -> Mitigation: validate the exact relocked dependency graph in the target environment immediately after regeneration.
- npm 11 on Node 24 may still surface resolver bugs even with available tarballs. -> Mitigation: keep the version set explicit and narrow; if failure persists, isolate whether the issue is npm-version-specific before widening the change.
- Lockfile regeneration on a non-Windows machine may not fully match Windows optional dependency layout. -> Mitigation: prefer regenerating or validating the final lockfile in the target Windows environment using the internal registry.
- A minimal `package.json` adjustment may become necessary if npm keeps selecting an unavailable patch release. -> Mitigation: keep any manifest change scoped to the smallest compatible range change and document it in implementation.

## Migration Plan

1. Remove the current frontend lockfile or regenerate it from a clean install state.
2. Recreate `apps/web/package-lock.json` against the internal registry so the resolved `rollup` package family lands on the verified available versions.
3. Run `npm install` in `apps/web` on the target Windows environment to confirm setup succeeds.
4. Run at least one lightweight follow-up validation such as `npm run build` or `npm run type-check` if install completes.
5. If relocking fails because npm still selects unavailable versions, reassess whether a minimal direct version adjustment in `package.json` is required.

## Open Questions

- Whether lockfile regeneration alone is sufficient, or whether `package.json` must be narrowed to prevent npm from drifting back to an unavailable `rollup` patch.
- Whether the target environment should also standardize on a lower-risk Node/npm combination after this relock, even if the dependency change resolves the immediate install failure.
