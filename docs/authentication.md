# Authentication

Status: Phase 5 implemented.  
Last updated: 2026-08-15.

## 1. Scope

NestJS owns authentication for the initial local application. It supports
email/password sign-in, protected browser sessions, organization selection,
session revocation, account disabling, rate limiting, and security audit
events. Social login, SSO, MFA, and external identity providers are deferred.

Authorization is separate from authentication. A valid session identifies a
person and session; the backend still evaluates the selected organization,
membership, role, restrictions, and Row-Level Security on every request.

## 2. Password handling

- Normalize email addresses by trimming and applying a consistent lowercase
  comparison; store the original display form separately if needed.
- Require passwords from 12 to 128 characters and permit spaces and password
  managers. Do not require arbitrary character-composition rules.
- Hash passwords with Argon2id using parameters measured for the deployment
  environment and stored with the hash so they can be upgraded later.
- Never log, return, or store plaintext passwords.
- Compare credentials in a way that avoids revealing whether an email exists.
- A password change or administrator reset increments the user's auth version
  and revokes every existing session.

The six future development accounts receive passwords through ignored local
environment variables. No default password is committed to the repository.

## 3. Browser session model

The browser receives two opaque, HttpOnly cookies:

| Cookie         | Lifetime                      | Purpose                                                      |
| -------------- | ----------------------------- | ------------------------------------------------------------ |
| Access cookie  | 15 minutes                    | Short-lived signed access token identifying user and session |
| Refresh cookie | 7 days idle, 30 days absolute | Rotating opaque secret used only at the refresh endpoint     |

Production cookies use `Secure`, `HttpOnly`, `SameSite=Lax`, explicit paths,
and the narrowest viable domain. Local HTTP development may disable only the
`Secure` flag through an explicit development setting.

The access token contains only stable identifiers and validation data: issuer,
audience, user ID (`sub`), session ID (`sid`), auth version (`av`), issued time,
and expiry. It does not embed roles, entitlements, field permissions, or the
active organization because those values can change before the token expires.

Refresh tokens are random high-entropy values. Only a keyed hash of each token
is stored in PostgreSQL. A refresh token is never used as an access token.

## 4. CSRF and browser protections

Because authentication uses cookies, every state-changing request requires a
CSRF token using the double-submit pattern. Angular reads a non-HttpOnly CSRF
cookie and sends it in the `X-XSRF-TOKEN` header; NestJS verifies that header
against the session-bound value.

The API also validates allowed origins, rejects unexpected content types, sets
security headers, and does not enable permissive cross-origin credentials.

## 5. Login flow

1. The browser sends email, password, and CSRF material to `/api/v1/auth/login`.
2. NestJS applies account/IP rate limits and verifies the password.
3. It checks that the account is active and has at least one active membership.
4. It creates a session and the first refresh-token family.
5. It sets access, refresh, and CSRF cookies.
6. It returns the safe user profile and available organization memberships.
7. It records a successful or failed login audit event without sensitive data.

Login errors use a generic message so callers cannot determine whether the
email, password, account state, or membership caused the failure.

## 6. Organization context

After login, `/auth/me` returns active memberships. If exactly one membership
exists, it may become the selected organization automatically. Otherwise the
user chooses one through `/auth/organization-context`.

Selection validates the membership server-side and stores only the selected
membership identifier in the server session. Changing context rotates the
short-lived access token. Sending an organization header or URL parameter does
not change context by itself.

## 7. Refresh rotation and replay detection

Every successful refresh:

1. verifies the stored hash, session state, idle lifetime, and absolute
   lifetime;
2. marks the presented token as consumed;
3. creates a new refresh token in the same family; and
4. returns new access, refresh, and CSRF cookies.

Presenting an already consumed refresh token indicates possible theft. NestJS
revokes the entire token family and session, records a high-severity audit
event, clears cookies, and requires a fresh login.

## 8. Logout and revocation

- `POST /auth/logout` revokes the current session and clears all auth cookies.
- `POST /auth/logout-all` increments the auth version, revokes every session
  for the user, and clears the current browser cookies.
- Disabling a user, disabling a membership, changing a password, or detecting
  refresh replay invalidates the affected sessions immediately.
- The access guard checks session state and auth version, so revocation does
  not wait for the 15-minute token expiry.

## 9. Failed-login controls

Initial configurable defaults:

- allow no more than 5 failed attempts per account in 15 minutes;
- temporarily lock that account for 15 minutes after the threshold;
- apply a separate IP/network rate limit to reduce distributed guessing; and
- use increasing delays without blocking the NestJS event loop.

Successful authentication resets the ordinary failed-attempt counter. Global
Admins can disable an account, but cannot retrieve or set a user's existing
password.

## 10. Password recovery

Email delivery is outside the first local implementation, but the data model
reserves a secure recovery flow:

- create a single-use, random recovery token;
- store only its keyed hash;
- expire it after 15 minutes;
- invalidate it immediately after use; and
- revoke all sessions after the password is replaced.

Until email delivery is implemented, development resets use an explicit local
administrator command that records an audit event and never prints the new
password to application logs.

## 11. API failure behavior

| Condition                                      | HTTP status | Public behavior                                    |
| ---------------------------------------------- | ----------- | -------------------------------------------------- |
| Invalid credentials or disabled account        | 401         | Generic authentication failure                     |
| Missing/expired access session                 | 401         | Client may attempt one refresh                     |
| Invalid/replayed refresh token                 | 401         | Session revoked and cookies cleared                |
| Valid identity without permission              | 403         | Only for actions whose existence is safe to reveal |
| Hidden record or cross-organization identifier | 404         | Do not reveal existence                            |
| CSRF or origin validation failure              | 403         | Generic request rejection                          |
| Login/request rate limit                       | 429         | Include a safe retry interval                      |

## 12. Secrets and configuration

Signing keys, refresh-token hashing keys, cookie settings, database credentials,
and initial development passwords come from environment variables or a future
secret manager. `.env.example` documents variable names but never contains
working secrets. Startup fails closed when required secrets are absent or too
weak outside the local development profile.

## 13. Required audit events

Record login success/failure, lockout, refresh, refresh replay, logout,
logout-all, organization switch, password change/reset, account disable/enable,
membership disable/enable, and session revocation. Store request correlation
identifier, actor/user when known, session identifier where safe, timestamp,
result, and coarse client metadata. Never store credentials or raw tokens.

## 14. Required authentication tests

The implementation must verify:

1. Passwords are never stored or logged in plaintext.
2. Generic login failures do not enumerate accounts.
3. Access expires and refresh rotation produces a new token.
4. Reusing an old refresh token revokes its complete family.
5. Logout, logout-all, user disable, and membership disable take effect on the
   next request.
6. CSRF-protected endpoints reject missing or mismatched tokens.
7. An organization context cannot be selected without an active membership.
8. A role or entitlement change is observed without waiting for token expiry.
9. Production cookie flags and origin rules are enforced by configuration.
10. Rate limits and lockouts recover after their configured windows.

## 15. Phase 5 implementation status

Implemented on 2026-08-15:

- `GET /api/v1/auth/csrf` pre-authentication CSRF bootstrap;
- login, current profile, organization switching, refresh, logout, and
  logout-all endpoints;
- Argon2id password hashing with secrets supplied by ignored local environment
  variables;
- signed 15-minute access cookies and opaque rotating refresh cookies;
- session-bound double-submit CSRF, allowed-origin checks, security headers,
  strict JSON validation, and bounded request bodies;
- database-backed account lockout plus an independent in-process IP failure
  window;
- refresh replay detection that revokes the complete token family;
- immediate session revocation after account or membership security changes;
- narrowly scoped security-definer database functions while direct runtime
  table reads remain blocked by RLS; and
- authentication audit events without raw credentials or tokens.

The six development identities are `global.admin@example.test`, one Org Admin
for each of Org A–D, and `orgb.restricted@example.test`. Their passwords remain
only in the ignored `.env` file. Password recovery/email delivery, MFA, and SSO
remain deferred.
