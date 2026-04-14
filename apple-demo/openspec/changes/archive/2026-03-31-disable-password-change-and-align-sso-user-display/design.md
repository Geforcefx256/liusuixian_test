## Context

`apps/web` derives entry behavior from `/web/api/auth/mode`, loads the authenticated session through `/web/api/auth/me`, and renders account actions in the workbench header menu. `apps/web-backend` currently supports local login, OAuth login, and a password-change endpoint. For OAuth provisioning, the code accepts minimal userinfo, but it does not treat the internal provider's `uid` field as the canonical account string.

The requested product contract is narrower than the current implementation:

- Password change is not supported in any auth mode.
- Internal SSO returns `uuid` as the stable external identity key.
- Internal SSO returns `uid` as the stable account identifier shown to users, such as `x3008892398`.
- SSO users may have no avatar and no user-facing role definition.

## Goals / Non-Goals

**Goals:**
- Remove self-service password change from the web product surface and backend capability set.
- Keep local login available with the documented default password, without prompting users to rotate it.
- Map internal SSO userinfo deterministically using `uuid` for identity binding and `uid` for account-facing fields.
- Render sparse SSO identity information cleanly in the header menu without placeholder role copy.

**Non-Goals:**
- Introduce mixed auth-mode session semantics or per-user auth-provider capabilities.
- Add a new profile page or broaden the shared auth payload beyond what this change needs.
- Change the internal authorization model beyond current minimum-role provisioning.

## Decisions

### Decision: Disable password change at both UI and backend layers

The frontend will remove the password-change action and modal from the header menu. The backend will stop exposing password change as a supported capability by rejecting or removing the route behavior, and docs/tests will be updated accordingly.

Rationale:
- Hiding the UI alone leaves an unsupported capability reachable.
- Backend rejection keeps behavior explicit and aligned with the product contract.

Alternative considered:
- Hide the UI only in OAuth mode. Rejected because the requested product contract disables password change in all modes.

### Decision: Treat `uuid` as identity key and `uid` as account/display fallback

OAuth provisioning will continue to key identities by provider plus external stable identifier, using `uuid`. When `login_name`-style fields are missing, the backend will read `uid` as the canonical account value used for `userCode`, `userAccount`, and default `displayName`.

Rationale:
- This matches the internal SSO contract without changing identity-key stability.
- It prevents fallback values like `oauth-<uuid>` from leaking into operator-visible UI when `uid` is already present.

Alternative considered:
- Keep `uid` only in raw userinfo and continue deriving account names from fallback values. Rejected because it would keep the visible account inconsistent with the upstream system.

### Decision: Keep fallback avatar generation in the frontend and suppress empty role presentation

The header menu will keep using the first visible character from the display string as the avatar fallback. The menu will no longer show role placeholder copy when there is no meaningful role label to show for the session.

Rationale:
- The avatar fallback already exists and only needs deterministic source data.
- Suppressing placeholder role text avoids presenting invented profile information for sparse SSO accounts.

Alternative considered:
- Add new backend flags such as `canChangePassword` or `hasDisplayRoles`. Rejected because the repository does not need mixed-mode or per-session capability negotiation for this product contract.

## Risks / Trade-offs

- [Risk] Existing tests and docs assume password change is supported. -> Mitigation: update auth route tests, component tests, and README guidance in the same change.
- [Risk] Some current OAuth fixtures may only provide `login_name` and not `uid`. -> Mitigation: make `uid` additive as a preferred fallback without breaking existing recognized fields.
- [Risk] Internally provisioned minimum roles may still exist for authorization while being hidden in the account menu. -> Mitigation: scope the suppression to presentation only and keep authorization behavior unchanged.

## Migration Plan

1. Update OpenSpec requirements, then implement backend auth and frontend menu changes in one release.
2. Keep local admin bootstrapping unchanged except for removing forced password-rotation semantics.
3. Roll back by restoring the password-change route/UI and previous OAuth fallback mapping if the product contract changes.

## Open Questions

- None for implementation. The product contract is explicit: no password change, `uuid` as identity key, `uid` as account identifier.
