## 1. Auth Mode Contract

- [x] 1.1 Extend backend auth configuration to represent `local_only`, `oauth_preferred`, and `oauth_only` as explicit modes.
- [x] 1.2 Update `/web/api/auth/mode` to return allowed login mechanisms without creating OAuth login state.
- [x] 1.3 Enforce backend login gating so local password login is rejected when the system runs in `oauth_only` mode.
- [x] 1.4 Reconcile default local admin behavior with the new auth mode semantics for development versus non-development environments.

## 2. OAuth Login Transactions

- [x] 2.1 Add persisted storage for OAuth login transactions, including `state`, expiration, and consumed status.
- [x] 2.2 Refactor `/web/api/auth/login-url` to create and return a dedicated OAuth login transaction.
- [x] 2.3 Update OAuth callback handling to validate, consume, and reject expired or reused login transactions.
- [x] 2.4 Remove reliance on the in-memory OAuth state store from the active login flow.

## 3. Session Lifecycle Governance

- [x] 3.1 Extend the session data model and repository layer to support bulk invalidation and explicit revocation checks.
- [x] 3.2 Invalidate all existing sessions when a local user changes their password.
- [x] 3.3 Ensure requests for disabled users are rejected consistently across existing sessions.
- [x] 3.4 Verify logout, expiration, and post-revocation behavior consistently clear or reject stale sessions.

## 4. Identity Binding And Provisioning

- [x] 4.1 Refine OAuth first-login flow so external identities are keyed by provider plus external user identifier.
- [x] 4.2 Implement explicit identity-conflict handling for login name and account collisions during first-time OAuth login.
- [x] 4.3 Prevent automatic account merging based only on mutable profile fields such as email or login name.
- [x] 4.4 Make first-login role provisioning deterministic and preserve roles for already-bound OAuth users.

## 5. Frontend Contract And Validation

- [x] 5.1 Update the Vue auth store and login UI to use the new auth mode and explicit OAuth login-start behavior.
- [x] 5.2 Add backend tests for auth mode enforcement, OAuth transaction lifecycle, session invalidation, and identity-conflict paths.
- [x] 5.3 Add frontend tests for login entry behavior across `local_only`, `oauth_preferred`, and `oauth_only` modes.
- [x] 5.4 Verify end-to-end local development behavior for mode discovery, OAuth login start, callback completion, logout, and password-change invalidation.
