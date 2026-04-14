## Why

The current auth surface still exposes self-service password change even though the product will not support password updates in either local or SSO mode. The current SSO userinfo mapping also does not align with the internal provider contract, where `uuid` is the stable external identifier and `uid` is the user account shown to operators.

## What Changes

- Disable self-service password change across all authentication modes and remove the related UI, API behavior, tests, and documentation that describe password updates as supported.
- Align internal SSO userinfo mapping so `uuid` remains the stable identity key and `uid` becomes the canonical account identifier used for local provisioning and default display.
- Update authenticated workbench identity presentation so sparse SSO sessions still render a deterministic avatar from the first character of the visible account name.
- Stop showing role placeholder copy in the header account menu when the authenticated session does not have user-facing role information to present.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `agent-web-auth`: Adjust authenticated identity presentation and remove self-service password management from the workbench shell.
- `web-auth-identity-binding`: Align sparse SSO provisioning with the internal `uuid` and `uid` contract.
- `web-auth-session-governance`: Disable password-change behavior and remove password-change session governance expectations.

## Impact

- Affected frontend: `apps/web` auth store, login copy, and header account menu.
- Affected backend: `apps/web-backend` OAuth userinfo mapping, auth routes, auth service behavior, and auth tests.
- Affected shared contract and documentation: auth-facing copy and README guidance for local credentials.
