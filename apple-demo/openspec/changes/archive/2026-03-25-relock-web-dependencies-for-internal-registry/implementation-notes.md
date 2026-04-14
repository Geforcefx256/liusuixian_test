## Implementation Notes

### Outcome

- Added a minimal `overrides.rollup = "4.59.0"` entry in `apps/web/package.json` because npm 11 would otherwise continue selecting the unavailable `4.59.1` patch from the `vite` transitive range.
- Regenerated `apps/web/package-lock.json` with `npm_config_omit_lockfile_registry_resolved=true` so the lockfile no longer embeds `registry.npmjs.org` tarball URLs.
- Verified the installed Vite 5 toolchain remains on the same compatibility line: `vite 5.4.21`, `@vitejs/plugin-vue 5.2.4`, `vitest 2.1.9`, `vite-node 2.1.9`, `esbuild 0.21.5`, and `rollup 4.59.0`.

### Environment Constraints

- The local sandbox blocked outbound registry access; lockfile regeneration required an approved networked `npm install --package-lock-only`.
- Validation succeeded on Node `v24.8.0` with npm `11.6.0`.
- The repository does not carry a committed internal registry URL. Installability is preserved by removing lockfile `resolved` URLs, so the approved registry can supply packages without the lockfile forcing public npm hosts.
- The relock still assumes the approved internal registry serves `rollup@4.59.0` and the required Windows package `@rollup/rollup-win32-x64-msvc@4.59.0`.
