# System Architecture

Status: Phase 0 design baseline  
Last updated: 2026-08-15

## Purpose and scope

This application searches a deterministic 5,000,000-row automotive catalog
with Angular, NestJS, PostgreSQL, and ParadeDB. It enforces organization,
automotive-domain, role, user, row, action, and field restrictions.

Included:

- Org A global catalog access
- Org B Braking access
- Org C Tyres and Wheels access
- Org D Steering access
- Search, filters, facets, sorting, cursor pagination, catalog details,
  permitted administration, and audit history
- Local Docker-based development and portable deployment artifacts

Excluded for now:

- Supabase, Vercel, Typesense, performance benchmarking, bulk user generation,
  and production hosting selection

## Component responsibilities

| Component  | Responsibility                                                                          | Must not do                                             |
| ---------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Angular    | Render UI, collect input, show permitted actions                                        | Decide authorization or hold database credentials       |
| NestJS     | Authenticate, authorize, resolve scope, validate DTOs, query data, filter fields, audit | Trust organization/category IDs supplied by the browser |
| PostgreSQL | Store state, enforce constraints and Row-Level Security                                 | Expose owner/superuser credentials to the application   |
| ParadeDB   | BM25 search, filtering, sorting, and aggregations over permitted rows                   | Become the only authorization boundary                  |
| Generator  | Create deterministic data through controlled jobs                                       | Run through a public HTTP request                       |

## Logical architecture

```text
Angular browser application
        |
        | HTTPS + JSON + secure cookies
        v
NestJS API
  Authentication and sessions
  Organization/role permission guards
  Data-scope resolver
  DTO validation and field projection
  Audit writer
        |
        | Parameterized SQL in a transaction
        | Trusted transaction-local security context
        v
PostgreSQL + ParadeDB
  Application and authorization data
  Five-million-row catalog
  Row-Level Security
  BM25 index
  Audit events
```

## Local topology

```text
Angular development server  : localhost:4200
NestJS API                   : localhost:3000
ParadeDB/PostgreSQL          : localhost:5432
```

PostgreSQL runs in Docker with a named persistent volume. Angular and NestJS
may run on the host for fast reloads. Only NestJS receives application database
credentials; PostgreSQL is never exposed to browser code.

## Request flow

1. Angular sends a request with secure session cookies.
2. NestJS validates the access token and server-side session.
3. NestJS loads the active user, membership, role, and authorization version.
4. NestJS resolves the effective organization and permitted action.
5. NestJS opens a transaction using a restricted database runtime role.
6. NestJS sets trusted transaction-local user, membership, organization,
   session, authorization-version, and request context.
7. PostgreSQL RLS applies the final row boundary.
8. ParadeDB executes search/filter/facet work within permitted rows.
9. NestJS returns only fields allowed for the role.
10. NestJS writes a safe allow/deny audit event and returns a correlation ID.

Client-provided organization IDs never grant access. Organization switching is
accepted only when an active membership permits it.

## Catalog security model

Every part has one required security domain, one required primary category in
that domain, and optional secondary category tags. The security domain and
primary category determine visibility. Secondary tags improve discovery but
never broaden access.

Example:

```text
ABS wheel-speed sensor
Security domain: Braking
Primary category: Braking / ABS / Sensors
Secondary tags: Electrical / Sensors, Safety / Active Safety
```

Org B sees the record because its security domain is Braking. Secondary tags
may be removed from the response when their taxonomy branches are not visible.

## Authorization layers

1. Route permission: may the role perform the action?
2. Organization scope: is the membership active?
3. Domain/category entitlement: which rows may the organization access?
4. User restriction: is the membership narrowed by category/company/region?
5. RLS: does the row pass PostgreSQL's default-deny policy?
6. Field projection: which columns may appear in the response?

Explicit deny rules override allows. Global users still use the restricted
database role; they never receive database owner or `BYPASSRLS` privileges.

## Search design

NestJS exposes one search service/repository using parameterized SQL for:

- BM25 text search
- Security-domain and category filtering
- Company, region, year, material, status, numeric, and boolean filters
- Facets calculated only from visible rows
- Allowlisted sort choices
- Cursor/keyset pagination
- Direct part lookup under the same security context

Large `OFFSET` pagination is not the product default because the existing
ParadeDB work identified deep offsets as the most expensive query pattern.

## Authentication

NestJS owns email/password authentication. Sessions use HTTP-only secure
cookies, short-lived access tokens, rotating refresh tokens, and server-side
session records. Tokens identify the user/session but do not contain a durable
permission list. Current permissions are resolved from the database so account,
membership, role, and session revocation take effect promptly.

See `authentication.md` for the lifecycle.

## Data generation and indexing

The generator is an administrative process, not an API route. It uses stable
IDs/seeds, restartable batches, job state, domain-specific vocabulary, and
validation before ParadeDB index creation.

The normalized taxonomy is authoritative. Search-critical security/filter
fields are also stored directly on `part_catalog` so RLS and ParadeDB do not
require a many-to-many join for every search.

Phase 7 completed this administrative workflow with exactly 5,000,000 rows.
Generator batches and job checkpoints commit atomically, and resume verifies
the stored source-row position before continuing. Stable business/source
identifiers are deterministic; bigint table IDs remain database surrogates.
Phase 8 added the permanent BM25 index after dataset validation. Search result,
count, and facet functions revalidate the transaction-bound session and apply
live authorization as indexed predicates; direct record access remains under
forced RLS.

## API conventions

- Base path `/api/v1`
- JSON except file downloads
- Reject unknown DTO fields
- Cursor pagination with enforced limits
- Stable error codes and a correlation ID
- Inaccessible direct resources return `404` to avoid existence disclosure
- OpenAPI generated from implemented controllers and DTOs

## Audit and failure behavior

Security-relevant authentication, search, detail, export, mutation, user, role,
entitlement, and denial events are append-only to normal runtime roles. Never
log passwords, tokens, hashes, or unrestricted sensitive payloads.

| Failure                       | Expected behavior                                             |
| ----------------------------- | ------------------------------------------------------------- |
| Database unavailable          | Controlled service-unavailable response; no insecure fallback |
| Revoked/expired session       | Clear cookies and require login/refresh as appropriate        |
| Unknown organization/category | Reject without broadening scope                               |
| Authorization lookup failure  | Deny by default                                               |
| ParadeDB failure              | Controlled search error with correlation ID                   |
| Partial generation job        | Mark failed and resume/replace through the job workflow       |

## Future deployment shape

```text
Angular static assets or web container
NestJS API container
ParadeDB/PostgreSQL with persistent storage
TLS reverse proxy/load balancer
```

Hosting, high availability, backups, and production sizing are deferred until
the local functional/security milestone.

## Locked Phase 0 decisions

- One shared catalog, not one copy per organization
- One mandatory security domain per part
- Secondary categories never expand access
- NestJS and RLS enforce security; frontend controls are convenience only
- One restricted application database role; owner credentials are migration-only
- Search, facets, totals, details, exports, and mutations share the same scope
- Keyset pagination by default
- Authentication remains inside NestJS/PostgreSQL
