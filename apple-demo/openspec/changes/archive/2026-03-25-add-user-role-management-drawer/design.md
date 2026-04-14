## Context

The current migrated product exposes authenticated entry, current-user identity, logout, and an admin-only skill-management page, but it does not expose a governed way to inspect existing users or change their role assignments after login. This is a practical gap for SSO-first deployments because first-time OAuth users are provisioned automatically and later need manual promotion from the default role to elevated roles such as `admin`.

The change crosses both `apps/web` and `apps/web-backend`:

- `apps/web` must add an admin-only management surface that fits the existing workbench shell rather than introducing a new standalone admin application.
- `apps/web-backend` must expose the existing user and role management capabilities that already exist in the reference backend model.
- OAuth first-login provisioning must change its default role assignment policy.

The user experience constraint is explicit: user management must be reached from the right-side avatar menu. The backend capability constraint is also explicit: the scope must stay within the user and role management abilities already demonstrated by `ref_code`, excluding new admin powers such as forced password reset, usage analytics, or session operations.

## Goals / Non-Goals

**Goals:**
- Give `admin` and `super_admin` users a first-class UI for finding an existing user and changing that user's role bindings.
- Keep the entry point inside the existing avatar menu so user management remains part of the account-management domain.
- Use a right-side drawer as the management workspace so the product keeps the current workbench context and avoids a separate top-level admin mode.
- Expose only the `Users` and `Roles` concerns in the first version of the drawer.
- Reuse existing role keys (`super_admin`, `admin`, `user`, `guest`) as the permission authority.
- Change first-time OAuth provisioning so new SSO users receive the normal `user` role by default.

**Non-Goals:**
- Adding user creation in this phase.
- Adding session management, usage analytics, or audit views.
- Building a permission-matrix editor or capability-level RBAC system.
- Adding admin-side password reset or force-password-change controls.
- Introducing a new standalone admin page, route family, or secondary application shell.

## Decisions

### Decision: Open user management from the avatar menu into a right-side drawer

The workbench SHALL keep the account-menu entry point and open a right-side drawer instead of a centered modal or a top-level admin page.

Rationale:
- The trigger belongs to account and administrator actions, so the avatar menu is the correct discovery point.
- The management content is too dense for a dropdown or small modal once it includes user search, detail, and role editing.
- A drawer preserves workbench context and matches the existing right-side panel language already used in the product.

Alternatives considered:
- Centered modal: rejected because the density and list-detail flow would outgrow a modal quickly.
- Top-level admin page: rejected because the user explicitly wants the action under the avatar menu and because the current shell does not need a new navigation mode for this scope.

### Decision: First release exposes only `Users` and `Roles` tabs

The drawer SHALL expose only two tabs in this change: `Users` and `Roles`.

Rationale:
- The operational need is to reassign SSO users to elevated roles and maintain role metadata.
- Sessions and usage already exist in the reference backend but are not needed to solve the primary operational problem.
- Limiting the first release reduces design and implementation complexity while still leaving a natural place for future tabs.

Alternatives considered:
- Include sessions and usage now: rejected because the user explicitly deprioritized them.
- Collapse roles into the user detail view only: rejected because role metadata still needs a dedicated maintenance surface.

### Decision: Treat “permission editing” as role-binding management

The UI SHALL present administrator-controlled permissions as user role bindings, not as a permission tree.

Rationale:
- Current backend authorization checks evaluate `roleKey` membership.
- The reference backend already supports replacing a user's role collection and editing role metadata.
- A capability-level permission editor would invent a new backend model beyond the approved scope.

Alternatives considered:
- Permission matrix editor: rejected because no such backend model exists in the approved scope.

### Decision: Reuse existing user and role APIs from the reference model

The migrated backend SHALL expose user and role management APIs aligned to the reference backend surface for listing users, reading user detail, updating user profile fields, updating user status, replacing user roles, listing roles, and updating existing roles.

Rationale:
- The reference backend already defines the intended operational surface.
- The migrated backend already has compatible role seeds, user/session/identity tables, and role-check middleware.
- Reusing the reference model keeps product behavior understandable and lowers migration ambiguity.

Alternatives considered:
- Invent new admin APIs optimized for the current frontend only: rejected because it would diverge from the known reference model without operational benefit.

### Decision: Change default SSO role provisioning from `guest` to `user`

First-time OAuth users SHALL be provisioned with the default `user` role rather than `guest`.

Rationale:
- The deployment expectation is SSO-first access where newly authenticated users should be able to use the workbench without immediate manual promotion.
- Elevated privileges still require explicit admin action through the new management drawer.
- This preserves deterministic provisioning while aligning better with production usage.

Alternatives considered:
- Keep default `guest`: rejected because it adds immediate operational friction for normal SSO users.

### Decision: Restrict elevated role edits by actor role

The drawer SHALL enforce role-edit guardrails in both UI behavior and backend authorization. In particular, `super_admin` assignment or removal must remain restricted to `super_admin` actors.

Rationale:
- Without guardrails, an `admin` user could escalate or de-escalate the highest-privilege role.
- This preserves a minimal but meaningful separation between `admin` and `super_admin`.

Alternatives considered:
- Allow any admin to manage all roles: rejected because it collapses the distinction between the two elevated roles.

## Risks / Trade-offs

- [Risk] Existing migrated backend routes do not yet expose the reference user and role management surface. → Mitigation: keep the spec tightly limited to the reference route set needed by the `Users` and `Roles` tabs.
- [Risk] Changing default OAuth role from `guest` to `user` changes first-login behavior for newly provisioned SSO accounts. → Mitigation: keep the change deterministic, document it explicitly, and avoid changing previously provisioned users.
- [Risk] The drawer could become overcrowded if future admin concerns are added casually. → Mitigation: keep first release limited to two tabs and use list-detail layouts with clear scope boundaries.
- [Risk] Role reassignment is operationally sensitive. → Mitigation: use explicit save actions, visible role descriptions, and actor-role guardrails for elevated roles.

## Migration Plan

1. Expose migrated `users` and `roles` backend routes aligned with the approved reference scope.
2. Add frontend account-menu entry and right-side drawer shell behind admin-only visibility.
3. Add the `Users` tab with user search, list-detail view, status management, and role replacement.
4. Add the `Roles` tab with existing-role list and metadata editing.
5. Change OAuth first-login provisioning to assign the `user` role by default for newly created SSO users.
6. Validate that existing local admin bootstrap users continue to authenticate and retain elevated access.
7. Rollback strategy: disable the frontend drawer entry and revert backend route exposure or OAuth default-role change independently if needed.

## Open Questions

- Should the `Roles` tab allow editing role activation state in the first release, or only role name and description?
- Should a user with both `guest` and `user` ever be valid, or should the UI nudge administrators toward a cleaner single baseline role when granting `admin`?
- Should the user list default filter hide disabled users or show all users on first open?
