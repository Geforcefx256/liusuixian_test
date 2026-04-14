## Why

`apps/web` currently fails `npm install` in the internal Windows environment because the lockfile resolves `rollup` platform packages to versions that are not fully available from the internal registry. This blocks frontend setup in environments where `apps/agent-backend` already installs successfully, so the dependency graph must be relocked to a registry-compatible version set without widening the change into a frontend toolchain downgrade.

## What Changes

- Regenerate the `apps/web` dependency lockfile to use a verified version set that the internal registry can resolve on Windows.
- Keep the existing Vite 5 based toolchain and current application code unchanged.
- Align `rollup`, Windows platform packages, and related transitive build dependencies to exact versions confirmed available in the internal registry.
- Add validation steps that prove `apps/web` can install with the internal registry constraints after the relock.

## Capabilities

### New Capabilities
- `web-internal-registry-installability`: Defines the requirement that `apps/web` dependency metadata remains installable against the internal npm registry without changing application behavior.

### Modified Capabilities
- None.

## Impact

- Affected code: [`apps/web/package-lock.json`](/Users/derrick92/Documents/code/codex/banana-demo/apple-demo/apps/web/package-lock.json) and, only if required for deterministic relocking, [`apps/web/package.json`](/Users/derrick92/Documents/code/codex/banana-demo/apple-demo/apps/web/package.json)
- Affected systems: internal npm registry resolution for Windows installs, frontend dependency setup, CI or local validation commands that rely on `npm install`
- No intended impact to runtime APIs, UI behavior, or backend services
