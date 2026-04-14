## Why

The current product only exposes authentication and logout, which leaves administrators without a first-class way to find an existing user and change that user's role after login. This becomes a blocking operational gap in SSO-first deployments where users are provisioned on first login and must later be promoted from the default role to roles such as `admin`.

## What Changes

- Add an admin-only user-management entry to the existing header avatar menu in the Vue workbench.
- Add a right-side management drawer that opens from the avatar menu instead of introducing a separate top-level admin page.
- Add a `Users` tab in that drawer for listing users, filtering users, viewing user detail, editing user profile fields, enabling or disabling users, and replacing a user's role bindings.
- Add a `Roles` tab in that drawer for listing roles and editing existing role metadata.
- Keep password change in the existing avatar-menu account actions instead of moving it into the management drawer.
- Exclude user creation, session management, usage analytics, role creation, role deletion, and permission-matrix editing from this change.
- Change first-time SSO provisioning so newly created OAuth users receive the default normal-user role policy instead of the current low-permission guest policy.

## Capabilities

### New Capabilities
- `web-user-role-administration`: Admin-only user and role management from the existing workbench account menu, including a right-side drawer, user-role reassignment, user status management, and role metadata editing.

### Modified Capabilities
- `web-auth-identity-binding`: Change the first-login OAuth default access policy so newly provisioned SSO users receive the normal user role by default.

## Impact

- Frontend workbench shell, header account menu, and new user-management drawer components in `apps/web`.
- Web-backend user and role management routes, controllers, services, and repository exposure in `apps/web-backend`.
- OAuth first-login provisioning logic and default-role assignment policy in `apps/web-backend`.
- Existing role seeds and role-based access checks remain the authority for permission evaluation.
