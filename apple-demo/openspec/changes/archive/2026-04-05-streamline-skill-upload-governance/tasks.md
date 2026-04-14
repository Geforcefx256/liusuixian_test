## 1. Canonical Skill Schema And Catalog

- [x] 1.1 Update canonical skill parsing to require `SKILL.md` frontmatter fields `id`, `name`, and `description`, and reshape existing repository skill fixtures/packages to the new schema.
- [x] 1.2 Refactor `SkillCatalog` to discover canonical skill packages from the shared skill library layout instead of `skills/manifest.json`, and add an explicit in-process reload path.
- [x] 1.3 Update runtime path resolution and related tests so source and dist execution both resolve canonical skills from the new shared skill library layout.

## 2. Admin Upload, Overwrite, And Delete APIs

- [x] 2.1 Implement the admin single-zip upload flow with temporary extraction, archive safety checks, one-skill package validation, and structured validation error responses.
- [x] 2.2 Implement conflict reporting and explicit overwrite confirmation for duplicate canonical `skillId`, replacing the canonical package only after confirmation.
- [x] 2.3 Implement confirmed delete for managed skills that removes both the canonical package and managed governance record, then reloads the catalog before returning success.

## 3. Managed Registry Sync And Runtime Projection

- [x] 3.1 Update managed registry sync and admin payloads so upload-backed canonical packages create or refresh managed records without manifest import while preserving the current `生产 / 测试` governance contract.
- [x] 3.2 Preserve existing governed display metadata, starter metadata, surface state, and agent bindings when confirming overwrite of an existing canonical skill, while refreshing canonical metadata and runtime catalog state.
- [x] 3.3 Update bootstrap metadata and runtime/tool authorization to consume the reloaded canonical catalog without requiring a backend restart.

## 4. Admin UI And Verification

- [x] 4.1 Incrementally extend the existing `Skill 管理` page from manual import to upload/overwrite/delete actions while preserving the current list-detail layout, governance form sections, and existing `生产 / 测试` editing model.
- [x] 4.2 Add inline upload conflict confirmation, structured validation error presentation, and destructive delete confirmation within the existing admin page instead of introducing a new route or wizard.
- [x] 4.3 Add or update backend and frontend tests covering upload validation, reload behavior, overwrite preservation, and delete removal from governed runtime surfaces.
