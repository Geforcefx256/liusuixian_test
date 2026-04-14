## 1. Skill Asset Tools

- [x] 1.1 Extend the `skill` provider catalog with `read_asset`, `find_assets`, and `list_assets`, including explicit `skillName`-based input validation.
- [x] 1.2 Implement approved-skill resolution plus `baseDir`-scoped read/find/list operations for skill-owned assets without expanding `local:*` workspace roots.
- [x] 1.3 Align skill asset tool responses and explicit failure paths with existing local file tool conventions for denied access, path escapes, and file-versus-directory mismatches.

## 2. Runtime Integration

- [x] 2.1 Update execution-facing tool descriptions and runtime prompt guidance so `local:*` clearly means workspace files while `skill:*` asset tools mean read-only skill assets.
- [x] 2.2 Keep planner mode limited to its current whitelist and ensure `skill:read_asset`, `skill:find_assets`, and `skill:list_assets` stay out of the planner tool surface.

## 3. Verification

- [x] 3.1 Add provider and registry tests covering catalog exposure for approved agents and planner exclusion for the new skill asset tools.
- [x] 3.2 Add invocation tests covering successful asset reads/listings/discovery, denied unapproved skill access, path-escape rejection, and explicit type-mismatch failures.
