# API Contract

Status: Authentication, authorized search/catalog access, catalog writes,
taxonomy, organization/entitlement, user/membership, role, and audit APIs are
implemented through Phase 9. Suggestions and asynchronous exports remain
deferred.  
Last updated: 2026-08-18.

## 1. Contract conventions

- Base path: `/api/v1`
- Transport: JSON over HTTP for API data; streamed files for completed exports
- Authentication: HttpOnly access and refresh cookies
- CSRF: `X-XSRF-TOKEN` is required for state-changing browser requests
- Correlation: clients may send `X-Request-ID`; the API returns the accepted or
  generated identifier in the same header
- Time: ISO 8601 UTC strings
- Identifiers: UUID strings
- Naming: camelCase JSON fields
- Unknown request properties: rejected
- Documentation: generated OpenAPI document from NestJS DTOs and decorators

All results, filters, facets, counts, suggestions, and exports are evaluated in
the active organization context. The server never trusts an organization ID,
role, permission, or field list supplied by the browser.

## 2. Response shapes

Successful single-resource response:

```json
{
  "data": {},
  "meta": {
    "requestId": "3f4077e4-686f-4ef9-a6b0-3866999634ad"
  }
}
```

Successful collection response:

```json
{
  "data": [],
  "meta": {
    "requestId": "3f4077e4-686f-4ef9-a6b0-3866999634ad",
    "nextCursor": null
  }
}
```

Error response:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid values.",
    "details": [{ "field": "limit", "reason": "must be between 1 and 100" }],
    "requestId": "3f4077e4-686f-4ef9-a6b0-3866999634ad"
  }
}
```

Production errors never include stack traces, SQL, secrets, token material, or
hidden record information.

## 3. Standard error codes

| HTTP | Code                      | Meaning                                                  |
| ---: | ------------------------- | -------------------------------------------------------- |
|  400 | `VALIDATION_ERROR`        | Body, query, or header validation failed                 |
|  401 | `AUTHENTICATION_REQUIRED` | Session is absent, expired, or revoked                   |
|  401 | `INVALID_CREDENTIALS`     | Generic sign-in failure                                  |
|  403 | `ACCESS_DENIED`           | Authenticated user lacks an action permission            |
|  403 | `CSRF_FAILED`             | CSRF or allowed-origin check failed                      |
|  404 | `NOT_FOUND`               | Resource is absent or hidden from this context           |
|  409 | `CONFLICT`                | Duplicate or invalid state transition                    |
|  412 | `VERSION_MISMATCH`        | `If-Match` does not match the current record version     |
|  422 | `INVALID_FILTER`          | Filter is known but invalid for this role or combination |
|  429 | `RATE_LIMITED`            | Request limit reached                                    |
|  500 | `INTERNAL_ERROR`          | Unexpected failure with a correlation ID                 |

## 4. Authentication and current context

### `GET /auth/csrf`

Sets the readable `XSRF-TOKEN` cookie used for the first login request. The
browser sends the same value in `X-XSRF-TOKEN`; a mismatch is rejected.

### `POST /auth/login`

Request:

```json
{
  "email": "user@example.test",
  "password": "provided-at-runtime"
}
```

Sets access, refresh, and CSRF cookies. Returns the safe user profile and active
memberships. Incorrect credentials, disabled accounts, and accounts without an
active membership all produce the same public `401` response.

### `POST /auth/refresh`

Rotates the refresh token and returns new access, refresh, and CSRF cookies.
The request has no token in its JSON body.

### `POST /auth/logout`

Revokes the current session and clears its cookies.

### `POST /auth/logout-all`

Revokes all sessions for the current user and clears the current cookies.

### `GET /auth/me`

Response data:

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.test",
    "displayName": "Example User"
  },
  "activeContext": {
    "organizationId": "uuid",
    "organizationName": "Org B",
    "membershipId": "uuid",
    "role": "ORG_ADMIN"
  },
  "memberships": [
    {
      "organizationId": "uuid",
      "organizationName": "Org B",
      "role": "ORG_ADMIN"
    }
  ],
  "capabilities": ["catalog.search", "catalog.read", "catalog.create"]
}
```

Capabilities help Angular hide unavailable controls but do not replace backend
authorization.

### `PUT /auth/organization-context`

Request: `{ "organizationId": "uuid" }`. Validates an active membership,
updates the server session, rotates the access token, and returns the new
context. Global Admin receives an explicitly selected organization context for
ordinary catalog operations as well.

## 5. Catalog search

Phase 6 provides two narrow catalog endpoints:

- `GET /catalog/records/:id` requires `catalog.read`, applies PostgreSQL RLS,
  returns `404` for absent or hidden records, and omits disallowed fields.
- `GET /catalog/facets` requires `catalog.search` and returns security-domain
  counts calculated only from rows visible in the selected organization and
  user scope.

The search contract below is implemented in Phase 8. Suggestions and broader
catalog/administration endpoints remain later-phase work.

### `POST /search`

POST is used because filters are structured and can be large. It is a read-only
operation and does not require an idempotency key.

Request:

```json
{
  "query": "ceramic brake pad",
  "filters": {
    "securityDomainIds": [10],
    "primaryCategoryIds": [101],
    "manufacturerNames": ["Apex Mobility"],
    "companyIds": [1204],
    "regions": ["Europe"],
    "countries": ["Germany"],
    "modelYears": { "from": 2018, "to": 2026 },
    "materials": ["ceramic"],
    "lifecycleStatuses": ["active"],
    "weightKg": { "min": 0.2, "max": 4.0 },
    "cost": { "min": 20, "max": 200 }
  },
  "facets": ["primaryCategory", "manufacturer", "region", "material"],
  "sort": { "field": "relevance", "direction": "desc" },
  "limit": 25,
  "cursor": null
}
```

Response:

```json
{
  "data": {
    "items": [
      {
        "id": 20060,
        "partNumber": "BRK-000001",
        "partName": "Ceramic front brake pad",
        "description": "Synthetic catalog record",
        "securityDomainId": 10,
        "primaryCategoryId": 101,
        "manufacturer": "Apex Mobility",
        "region": "Europe",
        "country": "Germany",
        "modelYear": 2024,
        "material": "ceramic",
        "score": 4.21
      }
    ],
    "facets": {
      "manufacturer": [{ "value": "Apex Mobility", "count": 1823 }]
    }
  },
  "meta": {
    "requestId": "uuid",
    "nextCursor": "opaque-signed-cursor",
    "visibleHitCount": 1823,
    "limit": 25,
    "queryTimeMs": 284.37
  }
}
```

Rules:

- `query` is at most 300 characters. An empty query browses the caller's
  authorized catalog without a text predicate; the Angular application uses
  this automatically only for the Global Administrator.
- `limit` defaults to 25 and is between 1 and 100.
- Filter arrays accept at most 100 unique values.
- Facets are allowlisted to security domain, primary category, manufacturer,
  region, material, and lifecycle status.
- Sort is allowlisted to relevance, part number, model year, and update time;
  record ID is the stable tie-breaker.
- Cost, supplier, or other protected filters are rejected when the caller
  cannot see the corresponding field.
- Category/domain filter IDs are positive database numeric identifiers. Access
  is still intersected with the caller's live organization/user scope.
- Results use keyset pagination. The cursor is opaque, signed, expiring, and
  bound to the user, organization, authorization version, query, filters, and
  sort.
- `visibleHitCount` and every facet count include only rows visible to the
  current user.
- Facets are self-excluding: each facet ignores only its own selected filter
  while retaining the search text, every other filter, and the caller's full
  authorization scope. This keeps alternative category/manufacturer/region/
  material/lifecycle counts visible while refining results.
- The Global Admin UI's automatic initial browse requests no facets so the
  first 25 records, exact total, and query time can render promptly. A search
  or applied filter requests all six facet groups.
- A facet response is bounded to 200 scoped values, which covers the complete
  agreed 114-category taxonomy without creating an unbounded aggregate API.
- `queryTimeMs` is the backend-measured search processing time in milliseconds,
  covering authorization context, exact visible count, result retrieval, and
  requested facets. It does not include browser rendering or network transfer.
- Search count, facets, and item projections revalidate the bound session in
  PostgreSQL before executing the indexed query. Callers cannot supply trusted
  organization or role scope.

### `GET /search/suggestions?q={text}&limit={n}`

Returns at most 20 permitted part names, part numbers, manufacturers, and
categories. Suggestions are authorization-scoped and never use hidden fields.

## 6. Catalog records

### `GET /catalog/parts/{id}`

Returns one visible catalog record. The response includes only fields permitted
for the current role. A missing or inaccessible record returns `404`.

### `POST /catalog/parts`

Requires `catalog.create` and an `Idempotency-Key` header. The security domain
must be entitled to the active organization, the primary category must belong
to that domain, and secondary tags cannot change visibility.

### `PATCH /catalog/parts/{id}`

Requires `catalog.update` and `If-Match: \"{version}\"`. A stale version returns
`412 VERSION_MISMATCH`. Only Global Admin may move a record to a different
security domain.

### `DELETE /catalog/parts/{id}`

Requires `catalog.archive` and `If-Match`. This archives the record; it does not
physically delete it. Success returns `204 No Content`.

## 7. Taxonomy

| Method and path           | Required permission      | Purpose                                                     |
| ------------------------- | ------------------------ | ----------------------------------------------------------- |
| `GET /categories/tree`    | Authenticated membership | Return only taxonomy branches visible in the active context |
| `GET /categories/{id}`    | Authenticated membership | Return a visible category and its lineage                   |
| `POST /categories`        | `taxonomy.manage`        | Create a category                                           |
| `PATCH /categories/{id}`  | `taxonomy.manage`        | Rename, reparent, or change metadata with version checks    |
| `DELETE /categories/{id}` | `taxonomy.manage`        | Archive only when integrity rules allow it                  |

Category movement cannot silently change the security domain of existing
catalog records. Such a migration requires a separately audited administrative
operation.

## 8. Organizations and entitlements

| Method and path                        | Required permission                | Purpose                                               |
| -------------------------------------- | ---------------------------------- | ----------------------------------------------------- |
| `GET /organizations`                   | Global Admin, or own memberships   | List only permitted organizations                     |
| `GET /organizations/{id}`              | Global Admin, or active membership | Read safe organization details                        |
| `GET /organizations/{id}/entitlements` | `organization.entitlements.read`   | Read enabled domain/category entitlements             |
| `PUT /organizations/{id}/entitlements` | `organization.entitlements.update` | Replace entitlements atomically with version checking |

Only Global Admin has `organization.entitlements.update`. Changing entitlements increments
the organization's authorization version and invalidates stale cursors.

## 9. Users, memberships, and roles

| Method and path                | Required permission                                       | Purpose                                                  |
| ------------------------------ | --------------------------------------------------------- | -------------------------------------------------------- |
| `GET /users`                   | `organization.users.read`                                 | List users in the permitted organization scope           |
| `POST /users`                  | `organization.users.manage`                               | Create/invite a user without returning a password        |
| `GET /users/{id}`              | `organization.users.read`                                 | Read a permitted user profile and memberships            |
| `PATCH /users/{id}`            | `organization.users.manage`                               | Change safe profile or account state with version checks |
| `POST /users/{id}/memberships` | `organization.users.manage` + `organization.roles.assign` | Add an organization membership and non-platform role     |
| `PATCH /memberships/{id}`      | `organization.users.manage` + `organization.roles.assign` | Change status, role, or restrictions within scope        |
| `GET /roles`                   | `organization.roles.assign`                               | Return assignable roles and capability descriptions      |

An Org Admin can manage users only in the active organization and cannot grant
Global Admin. User creation accepts either a later recovery/invitation flow or
a locally supplied initial password; the API never generates a password in its
response.

## 10. Audit API

### `GET /audit-events`

Requires `audit.read`. Query parameters support bounded date range, action,
result, actor ID, and target type. Org Admin receives only events for the active
organization; Global Admin may select a permitted organization. Results use
keyset pagination and immutable event identifiers.

Audit event responses expose safe metadata only. Secret fields are redacted at
write time and cannot be recovered through this endpoint.

## 11. Exports

Exports are asynchronous so a large selection does not occupy an HTTP request.

| Method and path              | Required permission | Purpose                                                                  |
| ---------------------------- | ------------------- | ------------------------------------------------------------------------ |
| `POST /exports`              | `catalog.export`    | Create a job from a validated search request; requires `Idempotency-Key` |
| `GET /exports/{id}`          | `catalog.export`    | Return queued/running/completed/failed status                            |
| `GET /exports/{id}/download` | `catalog.export`    | Stream a short-lived completed file after reauthorizing the request      |

The job stores the requesting user, organization, authorization version,
allowed field set, and normalized search. The worker reruns access rules. An
entitlement or role change can cancel or further restrict an unfinished job.
Export files expire and are not served from a public directory.

## 12. Field projection

Clients may request an optional `fields` allowlist on detail and search
operations. The server intersects it with the role's field policy. Requesting a
known but unauthorized field returns `403`; unknown fields return `400`.

If no `fields` value is supplied, the API returns the endpoint's safe default
projection. Field policies apply equally to nested objects, filters, sorts,
facets, highlights, autocomplete, audit metadata, and exports.

## 13. Concurrency and idempotency

- Mutable resources expose an integer `version` and an `ETag`.
- Update/archive requests require `If-Match`; stale writes return `412`.
- Create, entitlement replacement, and export creation use an idempotency key.
- Idempotency keys are scoped to the user, active organization, method, and
  route, and expire after a configured period.
- Retrying with the same key and different content returns `409`.

## 14. Validation and operational limits

- JSON bodies default to a 1 MiB maximum; export definitions remain within the
  same limit.
- IDs, enums, dates, numeric ranges, arrays, and strings are validated before
  database access.
- Search/filter values are always bound parameters; raw ParadeDB or SQL syntax
  is never accepted from a client.
- Endpoints have separate rate-limit groups for login, interactive reads,
  administrative writes, and exports.
- List endpoints use keyset pagination; arbitrary unbounded `offset` is not
  part of the contract.
- OpenAPI examples use synthetic values and contain no real secrets.

## 15. Initial implementation order

1. Health endpoint, common response/error layer, request IDs, and OpenAPI.
2. Authentication, sessions, `/auth/me`, and organization context.
3. Category tree and authorization-aware catalog search/detail.
4. Catalog create/update/archive for administrators.
5. Organization, user, membership, role, and entitlement administration.
6. Audit querying and asynchronous exports.

The DTO names and generated OpenAPI file become the executable contract during
implementation. Any change that broadens data exposure requires an access-
control review and tests before it is accepted.
