## 1. Establish The New Package Skeleton

- [x] 1.1 Create the `apps/agent-backend` package skeleton with service-local directories for `src`, `assets`, `scripts`, `extensions`, `tests`, `workspace`, `data`, and `dist`.
- [x] 1.2 Create the `apps/web/public/templates` directory and stage the frontend template location required by migrated skills.
- [x] 1.3 Copy the standalone npm package metadata (`package.json`, `tsconfig.json`, `README.md`) into `apps/agent-backend` and update them for the new package root.

## 2. Migrate Runtime Code And Assets

- [x] 2.1 Migrate `ref_code/apps/agent-backend/src/**` into `apps/agent-backend/src/**` without changing runtime behavior.
- [x] 2.2 Migrate `assets/agents/**`, including agent manifests, `AGENT.md`, `CONTEXT.md`, `SKILL.md`, skill scripts, and references, into `apps/agent-backend/assets/**`.
- [x] 2.3 Migrate runtime support files including `extensions/**`, `tests/**`, `config.json`, `gateway.config.json`, and `scripts/download-vec.js` into the new package.
- [x] 2.4 Migrate the frontend template asset `ne-sampleV1.csv` into `apps/web/public/templates/`.

## 3. Rewire Paths, Config, And Dist Packaging

- [x] 3.1 Update `config.json` so workspace-root, memory, and auth settings preserve the original runtime design semantics under `apps/`.
- [x] 3.2 Update `tsconfig.json` and any source-path assumptions so build output resolves to `apps/agent-backend/dist`.
- [x] 3.3 Migrate and adjust `build-agent-dist.mjs` for the new source, dist, assets, and template paths.
- [x] 3.4 Migrate and adapt `runtime-node-modules.mjs` so dist packaging still assembles runtime dependencies for the standalone npm package.
- [x] 3.5 Update any `SKILL.md` source-path references and dist rewrite rules so skill execution works in both source and dist modes.

## 4. Validate Runtime Parity End-To-End

- [x] 4.1 Install the standalone package dependencies and verify the migrated backend builds and starts successfully.
- [x] 4.2 Verify authenticated route behavior, including `/agent/api/*` access and server-side lookup of `/web/api/auth/me`.
- [x] 4.3 Verify core runtime behavior parity: agent catalog, runtime bootstrap, session creation, agent run execution, and planner/build phase transitions.
- [x] 4.4 Verify tool bus parity across local, gateway, MCP, and skill providers, including skill-script execution and template references.
- [x] 4.5 Verify dev logs, memory initialization/search, sqlite-vec handling, and dist-mode startup.
