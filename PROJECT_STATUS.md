# Automotive Search — Project Status and Verification

Last updated: 2026-08-20.

## Current position

The project contains completed phases 0–13.

Current database facts:

- Four organizations: Org A, Org B, Org C, and Org D.
- 114 taxonomy categories across 13 security domains.
- Five roles, 13 action permissions, and 31 role-permission grants.
- Four organization category entitlements.
- Fourteen secured development accounts and seventeen organization
  memberships.
- Twenty-five applied, checksum-tracked migrations.
- Ten `authz_*` functions, 31 RLS policies, 20 field-access rules, and narrow
  application audit/archive/taxonomy support functions.
- Exactly 5,000,000 persistent `phase7-generator` catalog records and
  5,207,374 category assignments.
- The completed generation job used `gen-v1`, 2,000-row batches, and atomic
  data/checkpoint commits. It ran for about 16 minutes 11 seconds.
- A permanent 616 MiB ParadeDB BM25 catalog index covers full-text search and
  supported filters, facets, sorts, and authorization fields.
- `POST /api/v1/search` provides exact scoped counts, six self-excluding facet
  types, backend query time, four sort modes, limits from 1–100, and signed
  expiring keyset cursors. Its permission-scoped empty-query mode supports the
  Global Admin's automatic initial catalog view.
- Phase 9 provides protected catalog writes/archive, taxonomy,
  organization/entitlement, user/membership, role, and audit APIs plus OpenAPI
  documentation and a full application-API validator.
- The application Docker stack is running and its named database volume is
  retained.
- The earlier `paradedb-facet-benchmark` container is separate and must not be
  modified by this application.

## Phase summary

| Phase | Name                                  | Status    | Main evidence or future acceptance check                                                        |
| ----: | ------------------------------------- | --------- | ----------------------------------------------------------------------------------------------- |
|     0 | Confirm the written design            | Completed | Architecture, data model, taxonomy, access, auth, and API documents                             |
|     1 | Angular/NestJS workspace              | Completed | Lint, builds, unit tests, API end-to-end test, health endpoint                                  |
|     2 | Local Docker environment              | Completed | Healthy DB/API/web services and retained named database volume                                  |
|     3 | Database foundations                  | Completed | Phase 3 validator: schema, constraints, ownership, roles, forced RLS                            |
|     4 | Automotive taxonomy and minimal seeds | Completed | Phase 4 validator: organizations, categories, roles, permissions                                |
|     5 | Authentication                        | Completed | Phase 5 live authentication and session-security validator                                      |
|     6 | Authorization and PostgreSQL RLS      | Completed | Phase 6 organization/role/field/facet/ParadeDB isolation validator                              |
|     7 | Five-million-row generator            | Completed | Exact totals, deterministic distribution, integrity, RLS samples                                |
|     8 | ParadeDB index and search repository  | Completed | Phase 8 search/access/facet/filter/cursor validator                                             |
|     9 | NestJS application API                | Completed | Phase 9 API/CSRF/RLS/audit/OpenAPI validator                                                    |
|    10 | Angular application                   | Completed | Authenticated browser QA for browse, search, facets, timing, filters, detail, and org switching |
|    11 | Functional and security verification  | Completed | Phase 11 live matrix and isolated clean-install validators                                      |
|    12 | Operational documentation             | Completed | `docs/operations.md` runbook and linked lifecycle procedures                                    |
|    13 | Deterministic demo role accounts      | Completed | Fourteen fixed role accounts bootstrapped and login-verified                                    |

## Completed phases

### Phase 0 — Written design

Completed artifacts:

- `docs/architecture.md`
- `docs/data-model.md`
- `docs/automotive-taxonomy.md`
- `docs/access-control.md`
- `docs/authentication.md`
- `docs/api-contract.md`

Check by reviewing those documents against the locked decisions in
`IMPLEMENTATION_PLAN.md`. Org A must cover all domains; Org B only Braking;
Org C only Tyres and Wheels; and Org D only Steering.

### Phase 1 — Application workspace

Implemented Angular 21 and NestJS 11 workspaces, shared scripts, formatting,
tests, and health endpoints.

Check from `automotive-search/`:

```powershell
npm run lint
npm run build
npm run test
npm run test:api:e2e
```

When the stack is running, the API health check is:

```powershell
Invoke-RestMethod http://localhost:3000/api/v1/health
```

### Phase 2 — Local Docker

Implemented pinned ParadeDB/PostgreSQL, migration/seed/account-bootstrap
one-shot services, API, web, health checks, and the retained volume
`automotive_search_paradedb_data`.

Check without deleting the volume:

```powershell
docker compose up --build -d --wait
docker compose ps
docker volume inspect automotive_search_paradedb_data
docker compose down
```

Never use `docker compose down -v` unless the user explicitly authorizes
deleting the application database.

### Phase 3 — Database foundations

Implemented protected tables, constraints, extensions, migration ownership,
restricted runtime roles, and forced RLS.

Check while the database is running:

```powershell
npm run db:validate:phase3
```

Expected summary includes 25 migrations, 17 protected/forced-RLS tables, the
`automotive_app` runtime role, and all required extensions.

### Phase 4 — Taxonomy and reference data

Implemented four organizations, 114 categories, 13 security domains, five
roles, 13 permissions, 31 grants, and four entitlements.

Check:

```powershell
npm run db:validate:phase4
```

Expected visibility is all 13 domains for Org A and one domain each for Org B,
Org C, and Org D. The validator accepts the persistent Phase 7 catalog and
reports its current count.

### Phase 5 — Authentication

Implemented Argon2id credentials, access cookies, rotating hashed refresh
tokens, CSRF/origin protection, organization switching, session revocation,
account locking, live security changes, and safe authentication audits.

Check while the API is running:

```powershell
npm run db:validate:phase5
```

Expected result is `status: ok` for all authentication checks, 12
authentication functions, six Argon2id credentials, and zero raw refresh tokens
stored. The validator must never print passwords or tokens.

### Phase 6 — Authorization and RLS

Implemented live NestJS permission guards, transaction-bound database context,
organization/category scope, company/category/region user restrictions,
field-level response filtering, direct-ID hiding, safe facets, inactive/internal
visibility rules, and PostgreSQL RLS.

Check while the API is running:

```powershell
npm run db:validate:phase6
```

With the persistent Phase 7 dataset present, the validator creates seven
temporary records for focused API/field tests but does not build a temporary
BM25 index over all 5,000,000 rows. It must prove:

- default deny without a trusted context;
- Org B/C/D isolation;
- Restricted Viewer company `101` scope;
- protected-field omission;
- inactive/internal record handling;
- direct-ID and permission-guard denial;
- the previously implemented authorization boundaries still hold.

It must finish with `status: ok` and remove all seven temporary rows. Permanent
ParadeDB index, facet, and aggregate behavior is covered by the Phase 8
validator.

### Phase 7 — Five-million-row generator

Implemented a deterministic Node.js generator, persisted job state, safe
resume/force behavior, atomic batch checkpoints, disk protection, a 10,000-row
pre-generation smoke mode, and a full validator.

Verified result:

- 5,000,000 total generated records;
- 1,250,000 Braking, 1,250,000 Tyres and Wheels, 1,250,000 Steering, and
  1,250,000 across the other ten domains;
- 5,000,000 exact primary assignments and 207,374 secondary assignments;
- deterministic logical identifiers/content, valid foreign keys and category
  hierarchy, and representative domain vocabulary;
- Org A expected total 5,000,000; Org B/C/D expected total 1,250,000 each;
- Org B Restricted Viewer expected total 10,546 company-`101` records;
- direct-record RLS allow/deny samples passed for every organization across all
  13 domains; and
- the generator did not create an index; the validated Phase 8 index now exists.

Check while the database and API are running:

```powershell
npm run db:validate:phase7
```

The exact owner-derived totals are validated once. RLS behavior is sampled by
indexed direct IDs. Search/facet behavior and aggregate isolation over the
permanent index are covered by Phase 8.

### Phase 8 — ParadeDB index and search repository

Implemented migrations `0014`–`0018`, the permanent
`part_catalog_search_bm25_idx`, a parameterized NestJS search module, structured
DTO validation, exact scoped counts, facets, result projection, filtering,
sorting, and signed 15-minute keyset cursors.

The search aggregate/result functions are security-definer boundaries, but
they do not accept caller-provided authorization scope. Each call revalidates
the bound session, recomputes live organization/user scope, applies that scope
as indexed predicates, and exposes only allowlisted fields and facets. Forced
RLS remains authoritative for direct record reads.

Check while the API is running:

```powershell
npm run db:validate:phase8
```

The validator proves index presence and ParadeDB planning, positive and
negative organization searches, company-`101` Restricted Viewer scope, facet
isolation, protected cost-filter denial, and signed cursor pagination. A
representative validated warm request with an exact count and four facets took
about 279–531 ms on this machine; this is a functional observation, not a
formal benchmark.

### Phase 9 — NestJS application API

Implemented the remaining protected application endpoint groups:

- catalog detail plus create/update/archive with idempotency and `If-Match`;
- visible category tree/detail and Global Admin category administration;
- organization list/detail and entitlement read/atomic replacement;
- organization-scoped users and memberships, restrictions, and roles; and
- bounded, organization-scoped audit-event queries.

All protected writes require the authenticated session's CSRF token. DTOs
reject unknown properties, list operations are bounded, every success/error
includes a request correlation ID, permission denials create redacted audit
events, and SQL remains parameterized behind live session context and forced
RLS. OpenAPI is served at `/api/v1/docs` and `/api/v1/openapi.json`.

Check while the API is running:

```powershell
npm run db:validate:phase9
```

The validator performs real positive and negative API flows for Org B,
Restricted Viewer, and Global Admin. It proves CSRF denial, organization and
taxonomy isolation, catalog idempotency/versioning/archive, user/membership
administration, audit coverage, and entitlement-write boundaries, then removes
its temporary catalog, category, and user fixtures.

## Phase completion notes

There are no remaining planned phases. Future work can be proposed as a new
approved phase; the current application scope is complete.

### Phase 10 — Angular application

Completed on 2026-08-20. The authenticated browser check verified:

- Global Admin initial browse: 25 loaded records, exact `5,000,000` scoped
  matches, and a displayed backend query time.
- `brake` search: 25 loaded records, exact scoped count, six facet groups,
  and displayed query time.
- Category facet selection: the visible count changed to the selected
  category's exact count and the UI showed one active filter.
- Protected detail navigation: a result opened its authenticated part-detail
  route with access-aware fields.
- Organization context switching: Org A and Org B remained isolated, each
  showing its own scoped catalog and `5,000,000` visible matches.
- No visible search error and no browser console errors during the flow.

### Phase 11 — Functional and security verification

Completed on 2026-08-20. The live validator tested eight accounts across the
Global Admin, Org Admin, Analyst, Viewer, and Restricted Viewer roles. It
covered positive and negative domain searches, direct-ID isolation, facet and
total-count isolation, field omission, manipulated filters and cursors,
organization switching, denied writes and administration, disabled and revoked
sessions, and redacted denial audits. The isolated clean-install validator
applied all 25 migrations in a temporary ParadeDB container and confirmed
default-deny runtime access without touching the persistent application volume.

Known limitation: the export endpoint is not part of the current application
slice, so Phase 11 verifies that it is unreachable rather than testing an
implemented export permission.

### Phase 12 — Operational documentation

Completed on 2026-08-20. [`docs/operations.md`](./docs/operations.md) now
covers local startup/shutdown, migration and seed workflows, account bootstrap,
five-million-row dataset creation/resume/recovery, ParadeDB index validation,
safe logical backup and disposable restore rehearsal, secrets, logs,
troubleshooting, and future hosting requirements. It explicitly protects the
application volume and the separate benchmark container from accidental reset.

### Phase 13 — Deterministic demo role accounts and credentials

Completed on 2026-08-20. The bootstrap now creates fourteen fixed accounts:
one Global Admin, four Org Admins, four Analysts, four Viewers, and one Org B
Restricted Viewer. All fourteen credentials were login-verified against the
running API. Real passwords remain only in the ignored local `.env`; no tracked
credential file is used.

## Complete verification sequence for the current state

Start the application from `automotive-search/`:

```powershell
docker compose up --build -d --wait
docker compose ps
```

Run the current quality and security checks sequentially:

```powershell
npm run format:check
npm run lint
npm run build
npm run test
npm run test:api:e2e
npm run db:validate:phase3
npm run db:validate:phase4
npm run db:validate:phase5
npm run db:validate:phase6
npm run db:validate:phase7
npm run db:validate:phase8
npm run db:validate:phase9
npm run db:validate:phase11
npm run db:validate:phase11:clean
```

Confirm the persistent dataset and Phase 8 index state:

```sql
SELECT count(*) FROM catalog.part_catalog
WHERE source_system = 'phase7-generator';
SELECT count(*)
FROM pg_indexes
WHERE schemaname = 'catalog'
  AND indexdef ILIKE '%bm25%';
```

The expected results are `5000000` generated rows and `1` BM25 index.

Stop the application without deleting data:

```powershell
docker compose down
```

## Safety and scope rules

- Obtain explicit approval before every remaining material phase.
- Do not edit an applied migration; add a new numbered migration.
- Never print or commit `.env` secrets.
- Do not delete `automotive_search_paradedb_data` without explicit approval.
- Do not modify the separate `paradedb-facet-benchmark` container/database.
- Do not add Supabase, Vercel, Typesense, performance benchmarking, or bulk user
  generation; these are explicitly out of scope.
- The frontend is never an authorization boundary. NestJS and PostgreSQL RLS
  must continue enforcing access.
