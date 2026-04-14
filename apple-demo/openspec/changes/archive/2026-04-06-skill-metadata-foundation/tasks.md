## 1. Canonical Metadata Contract

- [x] 1.1 Expand `apps/agent-backend/src/skills/frontmatter.ts` to parse the new canonical metadata set, enforce kebab-case canonical field names, and reject governed metadata fields in `SKILL.md`.
- [x] 1.2 Update skill frontmatter types and validation helpers so required fields stay strict while optional metadata remains valid when omitted.
- [x] 1.3 Update parser-focused tests to cover YAML parsing, legacy field-name rejection, optional-field omission, and governed-field rejection.

## 2. Catalog And Managed Registry Mirror

- [x] 2.1 Extend `apps/agent-backend/src/skills/catalog.ts` skill entry types and catalog construction to carry the new canonical metadata mirror fields.
- [x] 2.2 Extend `apps/agent-backend/src/skills/managedTypes.ts`, `managedRegistry.ts`, and `managedRegistryStorage.ts` so managed records persist the mirrored canonical metadata without changing governed ownership rules.
- [x] 2.3 Add or update managed-registry tests to verify canonical metadata sync, overwrite reset behavior, and persisted-registry compatibility for the new mirror fields.

## 3. Runtime Metadata Surfaces

- [x] 3.1 Extend `apps/agent-backend/src/agent/types.ts` and `apps/agent-backend/src/agents/service.ts` so agent detail and execution catalog expose the new canonical passthrough metadata.
- [x] 3.2 Verify the runtime continues to treat these metadata fields as passthrough-only and does not activate new planner, permission, model-selection, or forking behavior in this change.

## 4. Canonical Assets And Verification

- [x] 4.1 Update bundled `apps/agent-backend/assets/skills/**/SKILL.md` files to the new canonical metadata naming contract.
- [x] 4.2 Update any canonical skill documentation that references old field names so repo docs match the new contract.
- [x] 4.3 Run targeted verification for parser, managed-registry, and runtime metadata surfaces, and confirm the OpenSpec change artifacts remain apply-ready.
