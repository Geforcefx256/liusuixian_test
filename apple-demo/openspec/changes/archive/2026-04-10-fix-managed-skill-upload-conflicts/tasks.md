## 1. Backend Upload Conflict Rules

- [x] 1.1 Extend managed skill upload preflight checks to detect canonical `id` and canonical `name` conflicts against the current catalog.
- [x] 1.2 Preserve overwrite retry only for same-`id` replacement, and keep `name` conflicts blocking even when `overwrite=true`.
- [x] 1.3 Return typed upload conflict payloads from the admin skill upload API with `reason: 'id' | 'name'` and existing managed-skill context.

## 2. Upload Error Normalization

- [x] 2.1 Wrap `/agent/api/admin/skills/upload` middleware failures so non-ZIP and multipart parsing errors return structured JSON with stable `error` and `code` fields.
- [x] 2.2 Keep existing package-validation responses compatible with the normalized upload error path.

## 3. Skill Management UI

- [x] 3.1 Extend admin skill upload API types and error handling to consume the new conflict `reason` field.
- [x] 3.2 Update the Skill 管理 conflict surface to use a generic canonical-conflict heading, show whether the conflict is on `id` or `name`, and only render overwrite confirmation for `id` conflicts.

## 4. Verification

- [x] 4.1 Add backend tests for same-`id` conflict typing, same-`name` conflict rejection, and structured middleware error responses.
- [x] 4.2 Add frontend tests for `id` vs `name` conflict rendering and overwrite-action visibility.
- [x] 4.3 Run the targeted backend and web test suites covering managed skill upload behavior.
