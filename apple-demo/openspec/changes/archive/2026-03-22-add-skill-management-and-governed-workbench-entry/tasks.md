## 1. Managed Skill Registry

- [x] 1.1 Design and add persistence for managed skill records, including canonical skill linkage, production versus experimental surface state, governed display metadata, and agent bindings.
- [x] 1.2 Implement backend import and management APIs that register standard skill packages into the managed registry without altering canonical `SKILL.md` content.
- [x] 1.3 Build the admin-facing skill management UI that lists imported skills, edits governed descriptions and surface state, and configures which agents can use each managed skill.

## 2. Governed Runtime Skill Surface

- [x] 2.1 Update agent catalog and runtime bootstrap flows so agent detail and bootstrap payloads resolve skills from the managed registry rather than raw asset catalog order.
- [x] 2.2 Update planner candidate selection, runtime execution inputs, and `skill:skill` authorization so only governed skills approved for the current agent surface can be loaded or executed.
- [x] 2.3 Ensure end-user-facing runtime payloads expose governed skill descriptions only and never return raw `SKILL.md` bodies outside admin/runtime internals.

## 3. Workbench Governed Entry Framework

- [x] 3.1 Replace the home-stage raw skill list with a governed starter framework that projects visible production skills into the core-network groups of planning, configuration authoring, data transformation, and verification.
- [x] 3.2 Add governed skill search and discovery behavior that operates on the visible managed skill set for the active agent while excluding hidden experimental skills from production users.
- [x] 3.3 Update starter-card copy, icon mapping, and fallback behavior so empty intent groups route users toward governed discovery instead of showing fabricated representative skills.

## 4. Migration And Verification

- [x] 4.1 Seed managed records for the currently imported skills and mark the core-network skills as production-visible while keeping test skills off the production surface.
- [x] 4.2 Add backend and frontend tests covering managed skill import, agent binding enforcement, production versus experimental visibility, starter projection, and skill search behavior.
- [x] 4.3 Verify the end-to-end production flow: admin imports and governs a skill, the bound agent receives it in runtime metadata, the workbench shows only governed descriptions, and end users cannot inspect raw skill content.
