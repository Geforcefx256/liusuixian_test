## 1. Backend Auth Contract

- [x] 1.1 Update OAuth userinfo mapping and local provisioning fallbacks so internal SSO uses `uuid` for identity binding and `uid` for account-facing values.
- [x] 1.2 Disable self-service password change in the web-backend auth surface and remove forced password-rotation semantics that no longer apply.
- [x] 1.3 Update backend auth tests to cover sparse SSO `uuid`/`uid` payloads and rejected password-change requests.

## 2. Frontend Identity Presentation

- [x] 2.1 Remove the password-change action and modal from the workbench header account menu.
- [x] 2.2 Adjust authenticated identity presentation so sparse SSO sessions show the account-derived fallback avatar and suppress empty role copy.
- [x] 2.3 Update frontend component and store tests for the new account-menu behavior.

## 3. Documentation And Change Tracking

- [x] 3.1 Update auth-facing documentation and login guidance to reflect the fixed default local password and disabled password-change flow.
- [x] 3.2 Mark the OpenSpec tasks complete after implementation and verification.
