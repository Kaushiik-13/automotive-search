# Access Control

Status: Phase 9 read/write authorization, audit boundaries, and PostgreSQL RLS implemented.  
Last updated: 2026-08-17.

## 1. Purpose

This document defines how the application decides which catalog records,
actions, and fields a signed-in user may access. Authorization is enforced in
NestJS and PostgreSQL; the Angular interface only reflects decisions already
made by the backend.

The governing rule is **default deny**. A user receives access only when every
required layer allows it. An explicit restriction always wins over an allow.

## 2. Organizations and domain entitlements

| Organization | Allowed security domains |
| ------------ | ------------------------ |
| Org A        | All automotive domains   |
| Org B        | Braking only             |
| Org C        | Tyres and Wheels only    |
| Org D        | Steering only            |

Every catalog record has exactly one `security_domain_id`. That domain, not a
secondary search tag, decides whether the organization can access the record.
This prevents a Braking organization from receiving a Steering record merely
because the record also carries a brake-related tag.

An organization entitlement may be enabled or disabled without deleting its
history. Disabling it immediately removes the domain from new requests and
increments the organization's authorization version so cached authorization
contexts become invalid.

## 3. Roles

| Role              | Scope                                                       | Intended use                                                      |
| ----------------- | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| Global Admin      | All organizations and domains                               | Platform administration, taxonomy, and cross-organization support |
| Org Admin         | Current organization and its entitled domains               | Manage the organization's users and catalog records               |
| Analyst           | Current organization and its entitled domains               | Search, analyse, and export permitted data                        |
| Viewer            | Current organization and its entitled domains               | Search and view permitted data                                    |
| Restricted Viewer | Current organization, further narrowed by user restrictions | Search and view a deliberately limited subset                     |

`Global Admin` is a platform role. All other roles are attached to a user's
membership in one organization. A person may belong to more than one
organization, but every request runs in one explicitly selected organization
context.

## 4. Permission matrix

`Allowed` below still means the request must pass organization entitlement,
user restriction, row visibility, and field rules.

| Permission                        | Global Admin |          Org Admin           | Analyst | Viewer  | Restricted Viewer |
| --------------------------------- | :----------: | :--------------------------: | :-----: | :-----: | :---------------: |
| Search/view catalog               |   Allowed    |           Allowed            | Allowed | Allowed |      Allowed      |
| Create catalog records            |   Allowed    |           Allowed            | Denied  | Denied  |      Denied       |
| Update catalog records            |   Allowed    |           Allowed            | Denied  | Denied  |      Denied       |
| Archive catalog records           |   Allowed    |           Allowed            | Denied  | Denied  |      Denied       |
| Export catalog data               |   Allowed    |           Allowed            | Allowed | Denied  |      Denied       |
| View organization users           |   Allowed    |           Allowed            | Denied  | Denied  |      Denied       |
| Invite/disable organization users |   Allowed    |           Allowed            | Denied  | Denied  |      Denied       |
| Assign organization roles         |   Allowed    | Allowed, except Global Admin | Denied  | Denied  |      Denied       |
| View entitlements                 |   Allowed    |           Allowed            | Denied  | Denied  |      Denied       |
| Change entitlements               |   Allowed    |            Denied            | Denied  | Denied  |      Denied       |
| View organization audit events    |   Allowed    |           Allowed            | Denied  | Denied  |      Denied       |
| Manage taxonomy                   |   Allowed    |            Denied            | Denied  | Denied  |      Denied       |

Catalog deletion is implemented as an archive/soft-delete operation. Permanent
deletion is not exposed through the initial application API.

## 5. Field-level rules

Fields that are not allowed are omitted from API responses, search documents,
facets, sorting options, filters, exports, and autocomplete. They are not
returned as `null`, because even field presence can disclose information.

| Field group                                      | Global Admin |     Org Admin     | Analyst | Viewer | Restricted Viewer |
| ------------------------------------------------ | :----------: | :---------------: | :-----: | :----: | :---------------: |
| Public catalog identity and description          |     Yes      |        Yes        |   Yes   |  Yes   |        Yes        |
| Vehicle fitment and technical specifications     |     Yes      |        Yes        |   Yes   |  Yes   |        Yes        |
| Supplier and company details                     |     Yes      |        Yes        |   Yes   |   No   |        No         |
| Cost and commercial values                       |     Yes      |        Yes        |   Yes   |   No   |        No         |
| Internal source, ingestion, and version metadata |     Yes      |        No         |   No    |   No   |        No         |
| Audit metadata                                   |     Yes      | Organization-only |   No    |   No   |        No         |

The field policy is stored as named field groups so later changes do not
require duplicating individual column lists across controllers and exports.

## 6. Effective-access decision

For a request in organization `O`, by user `U`, against record `R`, access is
granted only when all of the following are true:

1. The account and selected membership are active.
2. The selected membership includes the action permission required by the API.
3. `O` is entitled to `R.security_domain_id`.
4. `U` has no restriction excluding that domain/category/record.
5. The record is active and satisfies its visibility rule.
6. PostgreSQL Row-Level Security independently permits the row.
7. Requested fields, filters, facets, and sort keys are allowed for the role.

Conceptually:

`effective access = organization entitlement ∩ role permission ∩ user scope ∩ row visibility ∩ field policy`

Any explicit deny produces a deny. Inaccessible record identifiers return
`404 Not Found`, not `403`, to avoid confirming that hidden records exist.

## 7. User restrictions

User restrictions only narrow access; they can never expand an organization's
entitlements. They can deny an entire security domain, a category subtree, or
a named record scope. The initial Org B Restricted Viewer is limited to company
`101`. The same enforcement supports category subtree and region restrictions.

Examples:

- Org B Restricted Viewer can be limited to `Braking > Disc Brakes`.
- Org C Restricted Viewer can be limited to `Tyres and Wheels > Tyres`.
- A restriction cannot grant Org B access to Steering.

## 8. Search, facets, counts, and exports

Authorization is applied inside the database query before ranking,
aggregation, pagination, or export. Therefore:

- search results contain only visible records;
- facet values and counts are calculated only over visible records;
- total hit counts do not reveal hidden rows;
- autocomplete cannot suggest hidden values;
- exports rerun authorization instead of trusting identifiers supplied by the
  browser; and
- pagination cursors cannot be reused across users or organization contexts.

## 9. Write rules

For create and update operations:

- Org Admins may write only within domains their organization is entitled to.
- Only Global Admins may change a record's security domain across organization
  boundaries.
- The selected primary category must belong to the selected security domain.
- Secondary categories do not grant additional visibility.
- Concurrent updates require the current record version.
- Every successful or denied privileged write produces an audit event.

## 10. PostgreSQL enforcement contract

NestJS uses a restricted runtime database role and starts an explicit
transaction for every authorized request. It sets transaction-local values for
the user, organization, membership, role, and authorization version. Row-Level
Security policies read those values and reject rows outside the permitted
scope.

The runtime role must not own protected tables and must not have `BYPASSRLS`.
Protected catalog and security tables use forced RLS where appropriate.
Background jobs use a separate, narrowly scoped role and record their actor and
reason in the audit log.

## 11. Organization switching

A user with multiple memberships first authenticates as a person, then selects
an organization from the memberships returned by `/auth/me`. Switching checks
the membership again and issues a context for that organization. The API never
accepts an arbitrary organization identifier as proof of access.

## 12. Audit requirements

Record at minimum:

- login, logout, refresh-token reuse, and account lockout;
- organization-context changes;
- user, role, restriction, and entitlement changes;
- catalog create, update, and archive operations;
- exports and export downloads; and
- denied administrative actions.

Audit records include actor, organization, action, target type and identifier,
result, timestamp, request correlation identifier, and safe before/after
metadata. Passwords, access tokens, refresh tokens, and secrets are never
logged.

## 13. Minimum Phase 0 security tests

The implementation must prove at least these cases:

1. Org A can find records from every domain.
2. Org B cannot obtain Tyres or Steering records by search, direct ID, facet,
   count, autocomplete, or export.
3. Org C sees only Tyres and Wheels; Org D sees only Steering.
4. Restricted Viewer results are a strict subset of the parent organization.
5. Viewer cannot retrieve supplier or cost fields by manually requesting them.
6. Org Admin cannot assign Global Admin or change entitlements.
7. A stale or disabled membership loses access on the next request.
8. Cross-organization cursors and export identifiers are rejected.
9. Secondary category tags never broaden record visibility.
10. The runtime database role cannot bypass Row-Level Security.

## 14. Initial development accounts

Six named development accounts are available: one Global Admin, one Org Admin
for each organization, and one Org B Restricted Viewer. Seed scripts read
initial passwords from the ignored local environment file; passwords are not
committed to source control.

## 15. Phase 6 implementation evidence

- Protected requests validate permissions against the live selected membership;
  permissions are not trusted from token claims.
- Catalog transactions bind user, session, membership, organization, and role
  identifiers as transaction-local PostgreSQL settings.
- Thirteen RLS policies enforce default deny and organization/category/user
  scope before rows reach NestJS.
- Cost and supplier fields are omitted for Viewer and Restricted Viewer roles;
  internal source metadata is returned only to Global Admin.
- Direct ID reads return the same hidden-row decision as aggregate queries.
- Facets and totals are calculated after RLS.
- The Phase 6 validator creates seven temporary records and a temporary ParadeDB
  BM25 index, proves ParadeDB queries respect RLS for all four organizations,
  and removes both afterward.
