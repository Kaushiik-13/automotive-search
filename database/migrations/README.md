# Database Migrations

Migrations are ordered SQL files whose names begin with a four-digit version.
`migrate.mjs` applies each file once, stores its SHA-256 checksum in
`public.schema_migrations`, and refuses to continue if an already-applied file
has changed.

Docker Compose runs migrations automatically after ParadeDB becomes healthy
and before the API starts. To run them from the host while the database is
available:

```powershell
npm run db:migrate
```

Migration rules:

- Never edit an applied migration; add a new numbered file.
- Each migration runs in its own transaction.
- Application/reference data does not belong in Phase 3 migrations.
- Secrets must come from environment variables, never SQL files.
- The migration connection owns objects; `automotive_app` never does.

Phase 6 adds `0010_authorization_rls.sql` for live permission checks,
transaction-bound authorization context, scope functions, field rules, and 13
RLS policies. `0011_field_access_alignment.sql` makes internal source metadata
Global-Admin-only. `0012_catalog_visibility_rls.sql` hides inactive records and
restricts internal records to Global Admin.

Phase 7 adds `0013_data_generation_jobs.sql`, which creates the protected
`audit.data_generation_jobs` table used for generator versioning, progress,
atomic checkpoints, resume validation, completion state, and safe error
details. It is the thirteenth applied migration and must not be edited after
application.

Phase 8 adds migrations `0014`–`0018`: request-bound indexed authorization
scope, the permanent BM25 catalog index, session-revalidated count/facet/result
functions, and the empty company-deny-list compatibility fix required by the
pinned ParadeDB 0.24.3 release. There are now 18 applied migrations.

Phase 9 adds migrations `0019`–`0022`: optimistic resource versions,
request-scoped idempotency storage, administration/write RLS policies,
application audit events, taxonomy integrity support, the runtime trigger grant
required for catalog inserts, and a narrowly scoped security-definer catalog
archive boundary, and administration policy hardening that prevents an Org
Admin from changing a Global Admin. There are now 22 applied migrations.

Phase 10 adds `0023_expand_search_facet_counts.sql`, increasing the bounded
authorization-scoped facet result from 50 to 200 values so the complete
114-category taxonomy can be counted during category filtering.
`0024_authorized_catalog_browse.sql` adds an empty-text browse mode that skips
only the BM25 text predicate while retaining the caller's complete live
authorization and filter scope. `0025_fix_browse_dynamic_sql_quotes.sql`
repairs the nested dynamic-SQL quoting for that browse path. There are now 25
applied migrations.
