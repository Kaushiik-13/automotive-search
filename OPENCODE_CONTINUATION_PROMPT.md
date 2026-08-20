# Application Continuation Prompt

This is a fallback handoff prompt. The project is currently continuing in
Codex.

```text
Continue the Automotive Search application located at:
D:\Projects\paradedb_facet_benchmark\automotive-search

Read IMPLEMENTATION_PLAN.md, PROJECT_STATUS.md, README.md, every file under
docs/, and the README files under database/ before proposing changes.

Current state:

- There are 14 phases numbered 0–13; all planned phases are complete.
- Angular 21, NestJS 11, PostgreSQL 18.4, and ParadeDB/pg_search 0.24.3 run in
  local Docker Compose.
- The application database is on host port 5433 and its retained volume is
  automotive_search_paradedb_data. The separate paradedb-facet-benchmark
  container on port 5432 must not be modified.
- Twenty-five checksum-tracked migrations are applied. Never edit an applied
  migration; create the next numbered migration for additive database work.
- Exactly 5,000,000 deterministic catalog records and 5,207,374 category
  assignments exist. Do not regenerate them without explicit approval.
- Fourteen deterministic development accounts exist: one Global Admin, four
  Org Admins, four Analysts, four Viewers, and one Org B Restricted Viewer.
  Their passwords exist only in the ignored local `.env` file.
- The permanent part_catalog_search_bm25_idx is approximately 616 MiB.
- POST /api/v1/search supports structured filters, six self-excluding facet
  types, four sort modes, exact scoped counts, backend query time, limits
  1–100, signed 15-minute cursors, and an authorization-scoped empty-query
  browse mode used for the Global Admin's initial catalog view.
- Phase 9 implements catalog create/update/archive; category tree and taxonomy
  administration; organization and entitlement APIs; user, membership,
  restriction, and role APIs; audit queries; request IDs; consistent errors;
  CSRF-protected writes; and OpenAPI at /api/v1/docs and
  /api/v1/openapi.json.
- npm run db:validate:phase3 through npm run db:validate:phase9 all pass.

Locked scope:

- Org A sees all domains; Org B only Braking; Org C only Tyres and Wheels; Org D
  only Steering. The Org B Restricted Viewer is additionally company-101-only.
- NestJS, PostgreSQL RLS, and session-revalidated database functions are the
  security boundaries; Angular only reflects those decisions.
- Supabase, Vercel, Typesense, performance benchmarking, bulk-user generation,
  asynchronous exports, and search suggestions remain out of scope for Phase
  10.
- Preserve the five-million-row volume and the separate benchmark container.

The planned implementation is complete. If continuing, first inspect the
current docs and validators, preserve the five-million-row volume and separate
benchmark container, and propose a new explicitly approved phase for any
additional scope. Do not silently add Supabase, Vercel, Typesense, performance
benchmarking, bulk-user generation, asynchronous exports, or search
suggestions.
```
