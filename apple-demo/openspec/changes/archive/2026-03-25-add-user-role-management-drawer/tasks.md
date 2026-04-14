## 1. Backend User And Role Administration Surface

- [x] 1.1 Expose migrated `users` and `roles` route families from `apps/web-backend` using the approved reference capability scope only.
- [x] 1.2 Add controllers, service wiring, and repository coverage for user list/detail, user profile update, user status update, user role replacement, role list, and existing-role update.
- [x] 1.3 Enforce actor-role guardrails so only `super_admin` can assign or remove `super_admin`.

## 2. OAuth Default Role Provisioning

- [x] 2.1 Change first-time OAuth provisioning so newly created SSO users receive the default `user` role instead of `guest`.
- [x] 2.2 Preserve existing-role behavior for previously provisioned OAuth users and local users.

## 3. Frontend Account Menu And Drawer

- [x] 3.1 Add an admin-only `用户管理` entry to the workbench avatar menu while keeping password change and logout in the same account action area.
- [x] 3.2 Implement the right-side user-management drawer shell with `Users` and `Roles` tabs only.
- [x] 3.3 Implement the `Users` tab with search, list-detail selection, user profile editing, active-status controls, and role-binding save flow.
- [x] 3.4 Implement the `Roles` tab with existing-role list and editable role metadata form.

## 4. Validation

- [x] 4.1 Add backend tests for user/role route authorization, role replacement, elevated-role guardrails, and default SSO role assignment.
- [x] 4.2 Add frontend tests for avatar-menu visibility, drawer open/close flow, user role editing, and role metadata editing.
- [x] 4.3 Verify that non-admin users cannot discover or use the management surface and that workbench auth/logout behavior remains intact.
