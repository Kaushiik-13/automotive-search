# Data Model

Status: Phase 0 design baseline  
Last updated: 2026-08-15

## Principles

- PostgreSQL is the single source of truth.
- Catalog records are stored once and exposed through entitlements.
- Authorization data is normalized and constrained.
- Search-critical security fields are stored directly on `part_catalog`.
- Protected tables use a restricted runtime role and Row-Level Security.
- Business/security records are normally deactivated rather than hard deleted.
- Audit events are append-only to runtime roles.
- Timestamps use `timestamptz` in UTC.
- Application entities use UUIDs; catalog/category IDs use compact integers.

Recommended schemas are `app`, `catalog`, `security`, and `audit`, owned by a
migration role rather than the application runtime role.

## Identity and organization tables

### `organizations`

`id uuid PK`, `code text UNIQUE`, `name text`, `status text`, `created_at`, and
`updated_at`. Status is `active`, `suspended`, or `disabled`.

Org A's global access is represented by a root entitlement, not a hard-coded
organization bypass.

### `app_users`

`id uuid PK`, `email citext UNIQUE`, `display_name`, `status`,
`authorization_version bigint`, `last_login_at`, `created_at`, `updated_at`.

Status is `invited`, `active`, `locked`, or `disabled`. Increment
`authorization_version` after security-sensitive changes.

### `user_credentials`

`user_id uuid PK/FK`, `password_hash`, `password_changed_at`,
`failed_login_count`, and `locked_until`. Only the Argon2id encoded hash is
stored.

### `user_sessions`

`id uuid PK`, `user_id`, `token_family_id`, `refresh_token_hash`,
`authorization_version`, `created_at`, `last_used_at`, `expires_at`,
`revoked_at`, `revocation_reason`, `replaced_by_session_id`, optional
`ip_hash`, and length-limited `user_agent`.

### `organization_memberships`

`id uuid PK`, `user_id`, `organization_id`, `role_id`, `status`, `is_default`,
`valid_from`, `valid_until`, `created_at`, and `updated_at`.

Status is `active`, `suspended`, or `revoked`. Enforce one active membership
per `(user_id, organization_id)` and at most one default membership per user.

## Roles and permissions

### `roles`

`id uuid PK`, optional `organization_id`, stable `code`, `name`, `is_system`,
`status`, `created_at`, and `updated_at`. A null organization identifies a
system role template.

### `permissions`

`code text PK`, `description`, and `risk_level` (`low`, `medium`, `high`).

### `role_permissions`

Composite primary key `(role_id, permission_code)` with `created_at` and
`created_by_user_id`.

## Taxonomy

### `categories`

| Column                     | Type/meaning                            |
| -------------------------- | --------------------------------------- |
| `id`                       | `bigint` primary key                    |
| `parent_id`                | Nullable self-reference                 |
| `slug`                     | Immutable, unique among siblings        |
| `name`                     | Display name                            |
| `path`                     | `ltree` materialized hierarchy path     |
| `depth`                    | Non-negative small integer              |
| `is_security_domain`       | True only for direct Automotive domains |
| `status`                   | `active` or `inactive`                  |
| `created_at`, `updated_at` | UTC timestamps                          |

Indexes cover parent, path, and active slug lookup.

## Catalog

### `part_catalog`

The existing catalog fields remain. Add:

- `security_domain_id bigint NOT NULL`
- `primary_category_id bigint NOT NULL`
- `visibility_status text NOT NULL`
- `source_system text NOT NULL`
- `source_record_id text`
- `document_version integer NOT NULL`

Existing fields include `id`, `company_id`, `tenant_id`, `part_number`,
`part_name`, `description`, `commodity`, `sub_commodity`, `manufacturer`,
`vehicle_program`, `region`, `country`, `plant`, `model_year`, `material`,
`lifecycle_status`, `supplier_status`, `cost_usd`, `weight_kg`, `active`,
`created_at`, and `updated_at`.

Constraints require:

- Security domain references an active domain category.
- Primary category descends from the security domain.
- Unique part number.
- Unique `(source_system, source_record_id)` when source ID exists.
- Positive document version and non-negative cost/weight.

### `part_categories`

`part_id bigint`, `category_id bigint`, `assignment_type` (`primary` or
`secondary`), `source` (`generated`, `manual`, `imported`), and `created_at`.

Composite primary key `(part_id, category_id)`. A partial unique index ensures
one primary assignment. Deferred validation keeps it equal to
`part_catalog.primary_category_id`.

## Entitlements and restrictions

### `organization_category_entitlements`

`id uuid PK`, `organization_id`, `category_id`, `effect` (`allow` or `deny`),
`include_descendants`, `valid_from`, `valid_until`, `created_by_user_id`, and
`created_at`.

Org A gets Automotive with descendants. Org B/C/D get their respective domain
roots with descendants.

### `user_scope_restrictions`

`id uuid PK`, `membership_id`, `scope_type` (`category`, `company`, `region`),
`effect`, nullable `category_id`, nullable `company_id`, nullable `region`,
`include_descendants`, `valid_from`, `valid_until`, and `created_at`.

A check constraint requires exactly one target matching `scope_type`. Explicit
deny wins over allow.

### `field_access_rules`

`role_id`, `resource_type`, `field_name`, `access` (`allow`, `omit`, `mask`),
and `created_at`. Composite key `(role_id, resource_type, field_name)`.

## Audit and administrative jobs

### `audit_events`

`id bigint PK`, `occurred_at`, `request_id`, nullable `actor_user_id`, nullable
`organization_id`, nullable `session_id`, `action`, `decision` (`allow`,
`deny`, `error`), nullable `resource_type`, nullable `resource_id`, and
sanitized/size-limited `metadata jsonb`.

Runtime roles may insert but not update/delete these events.

### `data_generation_jobs`

Stores generator version, target rows, seed, batch size, completed rows, status,
timestamps, and safe error details. It allows controlled resume and prevents
partial data from being treated as complete.

### `export_jobs`

Stores requester, membership, authorized filter snapshot, status, output
reference, row count, expiry, and audit linkage. Export execution remains
deferred until a safe background-job mechanism exists.

## Relational and ParadeDB indexes

Relational indexes cover active user email, memberships, role permissions,
entitlements, restrictions, category path, security domain, primary category,
company, region, status, and update time.

The permanent ParadeDB index includes the primary key, searchable text,
security domain/category, and every supported field used for filtering,
faceting, sorting, visibility, and scoped aggregation. It is implemented as
`catalog.part_catalog_search_bm25_idx` against pinned `pg_search` 0.24.3.

## RLS context contract

After session validation, NestJS uses a restricted runtime database role and
sets transaction-local context for user ID, session ID, membership ID,
organization ID, and role ID. The context-binding function first validates the
current authorization version and active session/membership. Policy functions
derive access from trusted tables. The browser never supplies a trusted
`can_view_all` value. Missing or invalid context denies access.

Migration/owner roles are never used for API traffic.

## Minimal seed data

- Four organizations
- Root taxonomy and controlled domains
- Five built-in roles and the permission catalog
- Organization category entitlements
- Six development accounts created by the Phase 5 secure bootstrap

Passwords are supplied/generated at runtime and never committed in migrations.

## Phase 3 implementation status

The database foundation was implemented on 2026-08-15 as six checksum-tracked
SQL migrations. The 15 Phase 3 protected tables exist under `app`, `catalog`,
`security`, and `audit`; all are owned by the migration owner, not the
`automotive_app` runtime login.

Forced Row-Level Security was initially enabled with no allow policies,
producing a default-deny runtime baseline. Phase 6 later added the narrowly
scoped policies described below. Phase 7 later added
`audit.data_generation_jobs`; `export_jobs` remains deferred until its workflow
is implemented.

## Phase 4 reference-data status

Phase 4 was implemented on 2026-08-15 as a checksum-tracked, transactional
reference seed. It contains four organizations, 114 taxonomy categories across
13 security domains, five built-in roles, 13 action permissions, 31 role
grants, and four organization category entitlements. Development users and
catalog records remain empty.

## Phase 5 authentication status

Phase 5 added three migrations after the six Phase 3 foundation migrations.
Sessions now store a selected membership, CSRF hash, idle expiry, and absolute
expiry. Twelve narrowly scoped authentication functions provide the runtime API
with login/session operations without granting direct table visibility.
Security-change triggers revoke sessions when an account or selected
membership changes. Six users, six Argon2id credentials, and nine memberships
are bootstrapped; the Global Admin has one membership in each organization.

## Phase 6 authorization status

Phase 6 added three migrations on 2026-08-17. Ten security functions bind and
validate request context, calculate live permissions, evaluate organization and
user scope, and resolve field access. Thirteen SELECT policies cover the
organization, identity, taxonomy, catalog, authorization reference, and audit
tables while all undeclared operations remain denied. Twenty field rules govern
four protected catalog response fields across five roles. Inactive rows are
hidden, and internal rows require Global Admin. The Org B Restricted Viewer has
an additional company `101` allowlist.

The API performs catalog work inside read-only transactions after calling the
context binder. Direct record reads and facet aggregation therefore receive the
same RLS decision. ParadeDB BM25 behavior under these policies is covered by the
Phase 6 and Phase 8 functional validators.

## Phase 7 dataset status

Phase 7 added migration `0013_data_generation_jobs.sql`, bringing the current
total to 13 checksum-tracked migrations and 16 protected, forced-RLS tables.
The completed `gen-v1` job generated exactly 5,000,000 persistent catalog rows
and 5,207,374 category assignments. Each row has exactly one primary category;
207,374 rows also have a deterministic secondary assignment.

Stable regeneration identity is carried by `part_number`, `source_system`, and
`source_record_id`. The bigint `id` remains a database surrogate and may change
after an explicitly forced replacement. Batch rows, assignments, and progress
checkpoints commit atomically. Phase 8 later added the permanent BM25 index.

## Phase 8 search status

Phase 8 added migrations `0014`–`0018`, bringing the current total to 18
checksum-tracked migrations. The approximately 616 MiB BM25 index covers
`part_number`, `part_name`, `description`, literal text filters, numeric/date
filters, active/visibility fields, and organization/user scope fields.

Exact counts, facets, and ranked result projections use narrowly granted
security-definer functions. They revalidate the bound session and recompute
live scope before applying it as indexed predicates. They do not accept an
organization, role, or entitlement from the browser. Direct record reads
continue through the forced-RLS table policy.

## Phase 9 application API status

Phase 9 added migrations `0019`–`0022`, and Phase 10 added the bounded facet
expansion in `0023` plus authorization-scoped catalog browsing in `0024`,
followed by its dynamic-SQL quote repair in `0025`. This brings the current
total to 25 checksum-tracked migrations and 17 protected, forced-RLS tables.
Organizations,
users, memberships, and categories now carry optimistic resource versions;
catalog records continue using `document_version`. `app.idempotency_keys`
stores 24-hour request hashes and completed create identifiers inside the
active user/organization RLS context.

The schema now has 31 policies covering both authorized reads and narrow
application writes. Catalog archive uses a session-revalidated
security-definer function because archived rows immediately leave the active
SELECT policy. Application audit writes and taxonomy subtree integrity checks
also use narrowly granted functions. Entitlement or membership changes advance
authorization versions so stale access tokens and search cursors stop working.

## Migration order

1. Required extensions and schemas
2. Owner and restricted runtime roles
3. Organizations and identities
4. Roles and permissions
5. Taxonomy
6. Catalog
7. Entitlements and restrictions
8. Authentication/session support
9. Audit and job tables
10. Relational constraints/indexes
11. RLS functions/policies
12. Minimal reference seeds
13. ParadeDB index after catalog validation
