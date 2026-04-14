## 1. Backend Scaffold

- [x] 1.1 Create `apps/web-backend` with package, TypeScript, runtime config, and Express bootstrap on port `3200`.
- [x] 1.2 Add minimal shared utilities for config loading, API responses, validation errors, and password hashing.

## 2. Auth Data And Services

- [x] 2.1 Implement SQLite initialization for roles, users, identities, and sessions with a default `admin` seed user.
- [x] 2.2 Implement repository and auth service logic for local login, current-user lookup, logout, and password change.
- [x] 2.3 Implement session cookie handling, same-origin protection, and auth middleware.

## 3. HTTP Integration

- [x] 3.1 Expose `/web/api/auth/*` routes and keep response shape compatible with the Vue frontend and agent backend.
- [x] 3.2 Keep OAuth-related compatibility endpoints available without making them the primary local-dev path.
- [x] 3.3 Add a basic health/root response for local diagnostics.

## 4. Frontend And Validation

- [x] 4.1 Add explicit favicon handling in `apps/web` to remove the local `404`.
- [x] 4.2 Add focused backend tests for auth mode, login, cookie session lookup, and logout.
- [x] 4.3 Validate the local end-to-end path with `apps/web`, `apps/web-backend`, and `apps/agent-backend`.
