## 1. Rebuild the frontend dependency lockfile

- [x] 1.1 Inspect `apps/web/package-lock.json` and confirm the currently locked `rollup` and Windows platform package versions that cause internal-registry install failure
- [x] 1.2 Regenerate the `apps/web` lockfile against the internal registry so `rollup`, `@rollup/rollup-win32-x64-msvc`, and related build dependencies resolve to the verified available exact versions
- [x] 1.3 Update `apps/web/package.json` only if lockfile regeneration cannot stay deterministic without a minimal compatible version-range adjustment

## 2. Validate installation in the constrained environment

- [x] 2.1 Run `npm install` in `apps/web` with the internal registry configuration and confirm dependency resolution succeeds
- [x] 2.2 Verify the regenerated lockfile does not require public npm registry access for the frontend dependency graph
- [x] 2.3 Run at least one lightweight frontend verification command such as `npm run build` or `npm run type-check` after install succeeds

## 3. Finalize and document the outcome

- [x] 3.1 Review the dependency diff to confirm the change stays within the Vite 5 compatibility line and does not alter application code
- [x] 3.2 Record any environment-specific constraints discovered during relocking, including whether npm or Node version alignment is still required
