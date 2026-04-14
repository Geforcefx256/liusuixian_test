## 1. Model Simplification

- [x] 1.1 Update managed skill persistence, shared types, and admin API contracts so `displayName` is stored at the managed skill level and `agentBindings` no longer carry per-agent display names
- [x] 1.2 Add migration/compatibility handling for existing managed skill records so current governed names map safely into the new unified field

## 2. Runtime And UI Alignment

- [x] 2.1 Update governed runtime metadata resolution so every bound agent reads the same unified managed skill name and description
- [x] 2.2 Restructure `AdminSkillManagement.vue` so `用户可见名称` lives under `基础信息` and `Agent 绑定范围` only manages binding enablement

## 3. Verification

- [x] 3.1 Update frontend and backend tests for the simplified governance model, including production validation, migration cases, and unified-name runtime exposure
- [x] 3.2 Run targeted test suites for the managed skill registry, admin APIs, runtime exposure, and Skill 管理 UI
