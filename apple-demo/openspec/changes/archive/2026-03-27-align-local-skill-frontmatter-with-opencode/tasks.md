## 1. Canonical Skill Metadata Parsing

- [x] 1.1 Replace the current hand-rolled skill frontmatter parsing logic with a YAML/frontmatter parsing path aligned to `opencode` semantics for canonical `SKILL.md` metadata.
- [x] 1.2 Enforce canonical `name` and `description` as required string metadata for runtime-valid skills, removing silent fallback to manifest ids, empty strings, or alternate display fields.
- [x] 1.3 Ensure canonical parsing correctly handles quoted values, colon-containing values, and YAML block-scalar descriptions for `SKILL.md`.

## 2. Skill Catalog And Governance Wiring

- [x] 2.1 Update `SkillCatalog` ingestion so invalid canonical skill metadata is rejected at catalog-build time instead of being exposed through degraded `SkillCatalogEntry` metadata.
- [x] 2.2 Keep managed skill governance sync consuming canonical parsed skill metadata while preserving the existing separation between canonical metadata and governed display metadata.
- [x] 2.3 Add explicit invalid-skill logging or error exposure so broken canonical `SKILL.md` files fail visibly without introducing silent fallback behavior.

## 3. Runtime Surface Alignment

- [x] 3.1 Update skill-tool discovery text to use canonical parsed `name` and `description` only.
- [x] 3.2 Update session skill preload instructions and planner skill summaries to consume the same canonical metadata emitted by the skill catalog.
- [x] 3.3 Verify invalid canonical skills are excluded from governed runtime discovery and preload surfaces rather than advertised with synthesized metadata.

## 4. Verification

- [x] 4.1 Add focused tests for canonical skill metadata parsing covering quoted strings, colon-containing values, multiline block-scalar descriptions, and invalid YAML/frontmatter cases.
- [x] 4.2 Add catalog and governance tests proving missing `name` or `description` invalidates a canonical skill rather than falling back to manifest metadata.
- [x] 4.3 Add runtime surface tests proving skill-tool discovery, session preload, and planner preload remain aligned on the same canonical parsed metadata.
