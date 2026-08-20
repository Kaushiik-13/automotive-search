# Automotive Search Application — Implementation Plan

For the current completion state, verification commands, and handoff details,
see [PROJECT_STATUS.md](./PROJECT_STATUS.md). For continuing this project in
OpenCode, use [OPENCODE_CONTINUATION_PROMPT.md](./OPENCODE_CONTINUATION_PROMPT.md).

## 1. Objective

Build a production-oriented automotive catalog application that searches a
deterministic five-million-row dataset through ParadeDB while enforcing
organization, category, role, user, action, and field restrictions.

The application must never rely on frontend filtering for security. NestJS and
PostgreSQL must enforce every access decision.

## 2. Locked decisions

| Area            | Decision                                             |
| --------------- | ---------------------------------------------------- |
| Frontend        | Angular with TypeScript                              |
| Backend         | NestJS with TypeScript                               |
| Database        | PostgreSQL with ParadeDB/pg_search                   |
| Authentication  | Implemented by NestJS                                |
| Development     | Local Docker Compose                                 |
| Dataset         | 5,000,000 deterministic synthetic automotive records |
| Organizations   | Four                                                 |
| Search engine   | ParadeDB only for now                                |
| Hosting         | Deferred                                             |
| Benchmarking    | Out of scope                                         |
| Supabase/Vercel | Out of scope                                         |
| Typesense       | Out of scope                                         |

## 3. Organization model

| Organization | Catalog entitlement                    |
| ------------ | -------------------------------------- |
| Org A        | All automotive domains                 |
| Org B        | Braking and its descendants            |
| Org C        | Tyres and wheels and their descendants |
| Org D        | Steering and its descendants           |

Organization membership alone does not grant unrestricted actions. The user's
role and optional personal restrictions further narrow the entitlement.

## 4. Initial roles

| Role                       | Scope                                       | Main permissions                            |
| -------------------------- | ------------------------------------------- | ------------------------------------------- |
| Global Administrator       | All organizations and categories            | Full administration and catalog access      |
| Organization Administrator | Own organization's allowed categories       | Manage own users; catalog read/write/export |
| Analyst                    | Own organization's allowed categories       | Search, view, facet, and export             |
| Viewer                     | Own organization's allowed categories       | Search and view                             |
| Restricted Viewer          | Explicit subset of organization entitlement | Search and limited view                     |

Initial development accounts should remain small: one or two accounts per
organization, sufficient to verify each access path. Bulk user generation is
not required.

## 5. Effective access rule

For every request, access is the intersection of:

1. The user's active organization membership.
2. The organization's category entitlements.
3. The role's action permissions.
4. Any user-specific category, company, region, or field restrictions.
5. The record's active/visibility state.
6. PostgreSQL Row-Level Security policies.

Explicit deny rules take precedence over allow rules.

## 6. Target architecture

```text
Angular browser application
        |
        | HTTPS/JSON
        v
NestJS API
  - authentication
  - authorization
  - organization context
  - field filtering
  - auditing
        |
        | parameterized SQL + transaction-local security context
        v
PostgreSQL + ParadeDB
  - application data
  - authorization metadata
  - five-million-row catalog
  - BM25 index
  - Row-Level Security
  - audit events
```

## 7. Proposed repository layout

```text
automotive-search/
|-- apps/
|   |-- web/                 # Angular
|   `-- api/                 # NestJS
|-- database/
|   |-- migrations/
|   |-- seeds/
|   |-- generators/
|   `-- validation/
|-- docs/
|   |-- architecture.md
|   |-- data-model.md
|   |-- automotive-taxonomy.md
|   |-- access-control.md
|   |-- authentication.md
|   `-- api-contract.md
|-- compose.yaml
|-- .env.example
|-- IMPLEMENTATION_PLAN.md
`-- README.md
```

## 8. Delivery phases

### Phase 0 — Confirm the written design

Status: Completed and approved on 2026-08-15.

Deliverables:

- Architecture document
- Automotive category hierarchy
- Data model
- Organization entitlement matrix
- Role/permission matrix
- Authentication design
- Initial API contract

Exit criteria:

- Org A/B/C/D rules are unambiguous.
- Sensitive fields are identified.
- Record and category relationships are agreed.
- The user approves implementation of the project skeleton.

### Phase 1 — Create the Angular/NestJS workspace

Status: Completed on 2026-08-15. Phase 2 remains gated by explicit user
approval.

Deliverables:

- Angular application under `apps/web`
- NestJS application under `apps/api`
- Shared linting and formatting conventions
- Development scripts
- Health endpoints

Exit criteria:

- Both applications start locally.
- Angular can call the NestJS health endpoint.
- No database or authentication functionality is assumed complete.

### Phase 2 — Local Docker environment

Status: Completed on 2026-08-15. Phase 3 remains gated by explicit user
approval.

Deliverables:

- ParadeDB container pinned to an approved version
- Persistent database volume
- Backend/frontend service definitions where useful
- Health checks
- Safe example environment variables

Exit criteria:

- Services start predictably.
- Database state survives a restart.
- Secrets are not committed.

### Phase 3 — Database foundations

Status: Completed on 2026-08-15. Phase 4 remains gated by explicit user
approval.

Create migrations for:

- `organizations`
- `app_users`
- `user_credentials`
- `user_sessions`
- `organization_memberships`
- `roles`
- `permissions`
- `role_permissions`
- `categories`
- `part_catalog`
- `part_categories`
- `organization_category_entitlements`
- `user_scope_restrictions`
- `field_access_rules`
- `audit_events`

Exit criteria:

- Migrations run from a clean database.
- Foreign keys and uniqueness constraints are present.
- Created/updated timestamps are standardized.
- Application runtime roles do not own protected tables.

### Phase 4 — Automotive taxonomy and minimal seeds

Status: Completed on 2026-08-15. Phase 5 remains gated by explicit user
approval.

Create a hierarchical taxonomy including:

- Braking: pads, rotors, calipers, lines, master cylinders, ABS
- Tyres and wheels: tyres, rims, hubs, bearings, valves, TPMS
- Steering: racks, columns, EPS, pumps, tie rods
- Other domains: engine, transmission, suspension, electrical, battery,
  body, interior, safety, ADAS, and thermal

Seed:

- Org A/B/C/D
- Initial roles and permissions
- Organization category entitlements
- A minimal set of development accounts after secure credential bootstrapping
  exists in Phase 5

Exit criteria:

- Category ancestry is queryable.
- Child-category access follows parent entitlement.
- No organization receives access outside its agreed scope.

### Phase 5 — Authentication

Status: Completed on 2026-08-15. Phase 6 remains gated by explicit user
approval.

Implement:

- Email/password login
- Argon2id password hashing
- Short-lived access tokens
- Rotating refresh tokens stored as hashes
- Logout and session revocation
- Account activation/deactivation
- Login rate limiting
- Security audit events

Exit criteria:

- Plaintext passwords and refresh tokens are never stored.
- Disabled accounts cannot authenticate.
- Reused/revoked refresh tokens are rejected.
- Browser sessions use secure HTTP-only cookies where applicable.

Password reset and email delivery can be added after the local authentication
flow is stable; they must not be implemented as insecure placeholders.

### Phase 6 — Authorization and PostgreSQL RLS

Status: Completed on 2026-08-17.

Implement:

- NestJS guards for action permissions
- Organization and category scope resolution
- User-level restrictions
- Field-level response filtering
- PostgreSQL Row-Level Security policies
- Separate database owner and restricted runtime roles
- Default-deny behavior

Exit criteria:

- Removing a frontend or API category filter cannot expose protected rows.
- Org B cannot retrieve tyre/steering records.
- Org C cannot retrieve braking/steering records.
- Org D cannot retrieve braking/tyre records.
- Viewer roles cannot obtain protected fields such as cost or supplier data.
- Unauthorized facets and totals do not leak protected counts.

ParadeDB search behavior under RLS must be verified functionally before the
full dataset is generated.

### Phase 7 — Five-million-row generator

Status: Completed and validated on 2026-08-18.

Extend the deterministic generator to create exactly 5,000,000 records with
domain-specific vocabulary and reproducible distribution.

Initial target distribution:

| Domain                   |      Rows |
| ------------------------ | --------: |
| Braking                  | 1,250,000 |
| Tyres and wheels         | 1,250,000 |
| Steering                 | 1,250,000 |
| Other automotive domains | 1,250,000 |

Requirements:

- Stable business identifiers and seeded content; database surrogate IDs may
  change after an explicitly forced regeneration
- Realistic names and descriptions per domain
- Multi-category records where appropriate
- Balanced company, region, status, year, material, and manufacturer values
- No broken foreign keys
- Repeatable regeneration

Exit criteria:

- Exact total and category counts validate.
- Representative text searches return correct domains.
- Org visibility totals match entitlements.
- Generation is restartable or transactional enough to avoid ambiguous partial
  state.

Implemented result:

- Exactly 5,000,000 `phase7-generator` rows.
- Exactly 1,250,000 rows in each major distribution group.
- 5,207,374 category assignments: one primary per record and 207,374
  deterministic secondary assignments.
- Atomic batch/checkpoint commits, persisted generation jobs, guarded resume,
  explicit force replacement, and a disk-space guard.
- Phase 7 validation passed for exact counts, distribution, foreign keys,
  primary assignments, deterministic samples, representative vocabulary,
  default deny, and indexed direct-record RLS samples across all 13 domains.
- Expected visible totals are Org A 5,000,000; Org B/C/D 1,250,000 each; and
  the Org B Restricted Viewer 10,546 rows for company `101`.
- No permanent BM25 index was created during Phase 7; Phase 8 added it after
  dataset validation.

### Phase 8 — ParadeDB index and search repository

Status: Completed and validated on 2026-08-18. Phase 9 remains gated by
explicit user approval.

Implement:

- ParadeDB BM25 index
- Indexed text fields
- Literal/filter fields
- Numeric/date/boolean filters
- Category and entitlement fields
- Search repository in NestJS using parameterized SQL

Exit criteria:

- Search, facets, sorting, and pagination work.
- Deep pagination is not the default UI pattern; prefer cursor/keyset behavior.
- Search results respect RLS and application authorization.
- Index health and row coverage can be validated.

Implemented result:

- A 616 MiB permanent BM25 index covers full-text fields and all supported
  filter, facet, sort, authorization, and visibility fields.
- `POST /api/v1/search` supports parameterized keyword search, structured
  filters, six facet allowlists, relevance/part-number/year/update sorting,
  limits from 1–100, and signed 15-minute keyset cursors.
- Exact hit counts, facet buckets, and safe result projections use
  session-revalidated, security-definer database functions with explicit
  organization and user scope. Direct record reads remain protected by forced
  RLS.
- Cost filters are rejected for roles that cannot view cost.
- The Phase 8 validator proved ParadeDB plans, organization isolation,
  Restricted Viewer company-`101` isolation, facet isolation, protected-filter
  denial, and tamper-resistant pagination.
- Representative authenticated warm requests with exact counts and four
  facets completed in roughly 279–531 ms during functional validation. These
  observations are not a formal performance benchmark.

### Phase 9 — NestJS application API

Status: Completed and validated on 2026-08-18.

Initial endpoint groups:

- `/auth`
- `/me`
- `/search`
- `/catalog`
- `/categories`
- `/organizations`
- `/users`
- `/roles`
- `/audit-events`

Requirements:

- DTO validation
- Parameterized database access
- Consistent error responses
- Pagination limits
- Request correlation IDs
- Permission checks on every protected route
- OpenAPI documentation

Exit criteria:

- API contracts match `docs/api-contract.md`.
- Direct-ID lookup and search return identical access decisions.
- Unauthorized access is logged without exposing protected content.

Delivered:

- Added the protected catalog create/update/archive contract with DTO
  validation, idempotent creation, optimistic versions, entitlement checks,
  field filtering, and audited changes.
- Added visible taxonomy tree/detail and Global-Admin-only category
  create/update/archive, including safe subtree integrity checks.
- Added organization listing/detail, entitlement reads, and atomic
  Global-Admin-only entitlement replacement with authorization-version
  invalidation.
- Added organization-scoped user listing/detail/create/update, membership and
  restriction management, assignable roles, and bounded audit-event queries.
- Added session-bound CSRF enforcement for protected writes, redacted audit
  events for denied actions, request IDs in success and error responses,
  bounded pagination, consistent database error mapping, and OpenAPI UI/JSON
  at `/api/v1/docs` and `/api/v1/openapi.json`.
- Added migrations `0019`–`0022` and `npm run db:validate:phase9`. The validator
  passed real positive and negative flows and removed its temporary catalog,
  category, and user fixtures.
- Async exports and search suggestions remain intentionally deferred because
  they require later background-job/UI work; they are not unsafe placeholders.

### Phase 10 — Angular application

Status: Completed on 2026-08-20. The authenticated shell, scoped
search/result/detail experience, role-aware administration pages, backend
query timing, self-excluding facet counts, and the Global Admin's
authorization-scoped initial catalog view are implemented and verified in the
authenticated browser. The initial view defers the expensive six-facet
aggregate until a search or filter is applied.

Implement:

- Login/logout
- Authenticated application shell
- Search page
- Facet/filter panel
- Result list
- Part details
- Role-aware navigation
- User management for permitted administrators
- Organization entitlement management for the Global Administrator
- Audit view for permitted roles

Exit criteria:

- UI does not display forbidden actions.
- Backend enforcement remains authoritative.
- Loading, empty, error, and denied states are clear.
- Deep links to protected records remain protected.
- Authenticated browser QA passes for initial browse, search, facets, timing,
  category filtering, organization switching, protected detail navigation, and
  console-error checks.

### Phase 11 — Functional and security verification

Status: Completed on 2026-08-20.

This phase is not a performance benchmark.

Verify:

- Correct positive access for each organization and role
- Cross-organization/category denial
- Direct-ID denial
- Facet and total-count isolation
- Field hiding
- Unauthorized create/update/delete/export denial
- Disabled-user and revoked-session behavior
- Manipulated request parameters
- Audit coverage
- Migration and clean-install behavior

Exit criteria:

- Zero unauthorized rows, fields, or aggregate counts are returned.
- All critical access-control tests are automated.
- Known limitations are documented. The export route is intentionally absent
  from this application slice, so the validator confirms it is unreachable.

### Phase 12 — Operational documentation

Status: Completed on 2026-08-20.

Document:

- Local startup and shutdown
- Migration workflow
- Dataset creation and recovery
- User bootstrap process
- Index creation and validation
- Backup/restore expectations
- Secret handling
- Logs and troubleshooting
- Future hosting requirements

The completed runbook is [`docs/operations.md`](./docs/operations.md). It
documents the supported local lifecycle, immutable checksum workflows,
five-million-row dataset recovery, account bootstrap, BM25 validation, safe
logical backup/restore rehearsal, secret handling, diagnostics, and hosting
requirements.

### Phase 13 — Deterministic demo role accounts and credentials

Status: Completed on 2026-08-20 with explicit approval.

Add predictable development accounts so every supported organization role can
be tested without changing the existing security model or generating users
randomly. The implemented account matrix is:

- Keep the existing Global Admin, four Org Admins, and Org B Restricted Viewer.
- Add one Analyst and one Viewer for each of Org A, Org B, Org C, and Org D.
- Keep the Org B Restricted Viewer restricted to company `101`.
- Store each development password only in the ignored local `.env` file and
  pass it to the idempotent bootstrap job; no credentials are committed or
  placed in a tracked text document.

Implementation scope:

- Extend `database/seeds/bootstrap-development-accounts.mjs` with the eight
  fixed Analyst/Viewer accounts and their memberships.
- Add corresponding password variables to `.env.example` with placeholders;
  real values belong only in the developer's local `.env`.
- Ensure rerunning bootstrap is idempotent, uses Argon2id hashes, and never
  returns passwords from the API.
- Update the People & roles documentation and account map; retain the existing
  Phase 11 role/security validators and add login coverage for every seeded
  account.

Exit criteria:

- Fourteen accounts exist after bootstrap: one Global Admin, four Org Admins,
  four Analysts, four Viewers, and one Restricted Viewer.
- Every Analyst/Viewer can authenticate only in its assigned organization and
  receives exactly its role permissions and field restrictions.
- The Restricted Viewer remains limited to Org B and company `101`.
- No password is printed in logs, API responses, tracked files, or validation
  output.

## 9. Approval gates

Work should proceed one phase at a time. Before each material phase:

1. Present the intended changes.
2. Obtain explicit approval.
3. Implement only that approved scope.
4. Verify the outcome.
5. Report created/changed files and unresolved decisions.

Creating this planning scaffold does not approve dependency installation,
database replacement, five-million-row generation, or container changes.

## 10. Major risks and controls

| Risk                                | Control                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------ |
| Cross-category data leakage         | Default-deny RLS plus NestJS authorization and negative tests            |
| Facet/count leakage                 | Apply entitlement scope before aggregation and test totals               |
| Table owner bypassing RLS           | Separate owner and restricted runtime roles; force RLS where appropriate |
| Stale role/session permissions      | Short access-token life and server-side session revocation               |
| Five-million-row partial generation | Deterministic batches, job state, validation, and safe restart behavior  |
| ParadeDB index/query mismatch       | Functional RLS/search proof before full generation                       |
| Deep pagination cost                | Cursor/keyset pagination as the product default                          |
| Sensitive field exposure            | Explicit DTO projections and field-access tests                          |
| Insecure local secrets              | `.env.example`, ignored real environment files, no committed credentials |

## 11. Definition of done

The first production-capable development milestone is complete when:

- The complete stack starts locally.
- Five million validated automotive records exist.
- ParadeDB search, facets, sorting, and pagination work.
- Org A sees all allowed domains.
- Org B/C/D see only their entitled domains.
- Roles and field restrictions are enforced by the API and database.
- Authentication and session revocation work.
- Critical security tests pass with zero protected-data leakage.
- Administrators can manage only their permitted scope.
- Setup, recovery, and operational procedures are documented.
