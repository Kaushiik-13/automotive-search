# Database Validation

Phase-specific validation scripts prove database invariants after migrations.

For Phase 3, start the database and run:

```powershell
npm run db:validate:phase3
```

The check verifies migrations, tables, extensions, ownership, constraints,
timestamp triggers, forced Row-Level Security, restricted runtime privileges,
and runtime connectivity. Reference data may exist after Phase 4.

For Phase 4, run:

```powershell
npm run db:validate:phase4
```

This verifies the seed checksum, four organizations, all 114 categories and 13
security domains, five roles, 13 permissions, 31 role grants, and the four
approved entitlements. It reports the current catalog count and proves that
default-deny RLS still hides reference rows from the API database role.

For Phase 5, start the API and run:

```powershell
npm run db:validate:phase5
```

This performs live login, CSRF, origin, refresh rotation/replay, organization
switching, logout, logout-all, account/membership revocation, role-change, lock,
cookie, audit, and credential-storage checks. It never prints passwords or raw
tokens.

For Phase 6, start the API and run:

```powershell
npm run db:validate:phase6
```

This proves default-deny behavior, permission guards, organization/category
scope, the Restricted Viewer company allowlist, protected-field omission, and
direct-ID isolation. With no persistent dataset it also runs the original
temporary facet/BM25 proof. With the persistent Phase 7 dataset it skips
creating a temporary full-catalog index; permanent index/facet verification is
Phase 8. Seven temporary test records are always removed at the end.

For Phase 7, keep the API running and run:

```powershell
npm run db:validate:phase7
```

This verifies the completed generation job, exactly 5,000,000 records, the
1.25M/1.25M/1.25M/1.25M distribution, foreign keys, primary and secondary
category integrity, deterministic samples, representative vocabulary,
default-deny behavior, and direct-record RLS samples across all 13 domains.
It also verifies the Restricted Viewer company scope. Before Phase 8 it accepts
no BM25 index; afterward it accepts exactly the approved Phase 8 index.

The validator intentionally avoids repeated full-table counts through RLS.
The current policy helper evaluates authorization per row, making such counts
an inappropriate pre-index validation workload. Exact totals are owner-derived;
RLS is exercised with indexed allowed and denied IDs. Phase 8 validates indexed
search, facets, and aggregate isolation.

For Phase 8, keep the API running and run:

```powershell
npm run db:validate:phase8
```

This verifies the permanent BM25 index and ParadeDB plan, positive and negative
searches for Org A/B/C/D, the Restricted Viewer company allowlist, facet
isolation, self-excluding category counts while filtering, protected
cost-filter denial, the Global Admin's complete initial catalog browse with
query timing, and signed keyset cursor pagination.
The reported request timings are functional observations only, not a formal
benchmark.

For Phase 9, keep the API running and run:

```powershell
npm run db:validate:phase9
```

This checks health and OpenAPI, organization/category isolation, entitlement
and role visibility, CSRF rejection, catalog idempotency and optimistic
versions, catalog create/update/archive, user/membership administration,
Global Admin taxonomy scope, bounded audit access, and redacted denied-action
auditing. Temporary catalog, category, and user fixtures are removed.

For Phase 11, keep the application stack running and run:

```powershell
npm run db:validate:phase11
npm run db:validate:phase11:clean
```

The security validator tests the complete organization/role matrix, direct-ID
and facet isolation, protected-field omission, manipulated requests, denied
writes and administration, session revocation, and denial-audit redaction. It
creates and removes only temporary validation users. The clean-install
validator starts a labeled temporary ParadeDB container, applies all
migrations, confirms seeded reference data and runtime default-deny behavior,
then removes that container. It does not touch the persistent application
volume or the separate benchmark container.
