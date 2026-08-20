# Automotive Search Application

Production-oriented automotive catalog application using Angular, NestJS,
PostgreSQL, and ParadeDB.

## Current status

Phases 0–12 are complete: design, application foundation, local Docker,
database foundations, reference data, authentication, authorization/RLS, the
five-million-row deterministic catalog, ParadeDB search, the protected NestJS
application API, the authenticated Angular application, security verification,
and the operations runbook. The workspace contains an Angular 21
frontend, NestJS 11 API, and an isolated PostgreSQL 18/ParadeDB
0.24.3 database with versioned migrations, checksum-tracked seeds, and
restricted runtime access.

The four organizations, 114-category taxonomy, five roles, permission matrix,
four organization entitlements, six secured development accounts, 31 RLS
policies, field-level response rules, and exactly 5,000,000 generated catalog
records are available. The permanent ParadeDB BM25 index, parameterized search
repository, filters, facets, sorting, exact scoped counts, and signed cursor
pagination are implemented.

Phase 9 also provides catalog writes/archive, taxonomy administration,
organization/entitlement reads and administration, user/membership management,
assignable roles, audit queries, consistent request IDs/errors, CSRF-protected
writes, and generated OpenAPI documentation. Phase 10 browser QA verifies
initial browse, search, facets, timing, filtering, protected detail navigation,
organization switching, and a clean browser console. Phase 11 security
verification and the Phase 12 operations runbook are also complete.

Phase 13 adds deterministic Analyst and Viewer development accounts for every
organization. Fourteen development accounts are now bootstrapped; real
passwords remain only in the ignored local `.env` file.

## Run the application

Requirements:

- Node.js 22.12 or newer in the Node 22 line
- npm 11

From this directory:

```powershell
npm install
npm run dev
```

Open `http://localhost:4200`. The Angular development server forwards `/api`
requests to the NestJS API at `http://localhost:3000`.

Useful checks:

```powershell
npm run lint
npm run build
npm run test
npm run test:api:e2e
```

The health endpoint is `GET http://localhost:3000/api/v1/health`.
OpenAPI is available at `http://localhost:3000/api/v1/docs` and
`http://localhost:3000/api/v1/openapi.json`.

## Run with Docker

The ignored local `.env` file contains this machine's development-only values.
To prepare a different machine, copy `.env.example` to `.env` and replace all
placeholder secrets.

```powershell
docker compose up --build -d --wait
docker compose ps
```

Compose starts ParadeDB, applies pending migrations and reference seeds,
verifies the six development accounts in one-shot services, then starts the API
and frontend. Applied migration and seed checksums are verified on every
startup.

Open `http://localhost:4200`. ParadeDB is exposed on host port 5433 so it does
not conflict with the existing facet-benchmark database on port 5432.

Validate the Phase 3 database foundation:

```powershell
npm run db:validate:phase3
```

Validate the Phase 4 reference data and access boundaries:

```powershell
npm run db:validate:phase4
```

Validate the Phase 5 authentication implementation while the API is running:

```powershell
npm run db:validate:phase5
```

Validate the Phase 6 organization, role, row, field, facet, and ParadeDB access
boundaries while the API is running:

```powershell
npm run db:validate:phase6
```

Validate the persistent Phase 7 dataset, deterministic samples, integrity,
distribution, and organization access samples:

```powershell
npm run db:validate:phase7
```

Validate the Phase 8 index, search API, organization/user isolation, facets,
protected filters, and cursor pagination:

```powershell
npm run db:validate:phase8
```

Validate the Phase 9 protected application API and administration boundaries:

```powershell
npm run db:validate:phase9
```

See [`database/generators/README.md`](./database/generators/README.md) before
resuming or replacing a generation job. Do not run the smoke generator beside
the completed full dataset.

Stop the application without deleting its database volume:

```powershell
docker compose down
```

## Agreed scope

- Angular frontend
- NestJS backend
- PostgreSQL with ParadeDB
- Local Docker-based development
- Deterministic five-million-row synthetic automotive catalog
- Four organizations with domain/category entitlements
- Role-, row-, action-, and field-level access controls
- NestJS-managed authentication
- Functional and security testing

## Excluded for now

- Supabase
- Vercel
- Typesense
- Performance benchmarking
- One hundred generated users

## Design documents

- [Implementation plan](./IMPLEMENTATION_PLAN.md)
- [Project status and verification](./PROJECT_STATUS.md)
- [OpenCode continuation prompt](./OPENCODE_CONTINUATION_PROMPT.md)
- [Architecture](./docs/architecture.md)
- [Automotive taxonomy](./docs/automotive-taxonomy.md)
- [Data model](./docs/data-model.md)
- [Access control](./docs/access-control.md)
- [Authentication](./docs/authentication.md)
- [API contract](./docs/api-contract.md)
- [Local Docker environment](./docs/local-docker.md)
- [Operations runbook](./docs/operations.md)
- [GCP Compute Engine and CI/CD plan](./docs/gcp-deployment-plan.md)

## Application folders

- [`apps/web`](./apps/web) — Angular frontend
- [`apps/api`](./apps/api) — NestJS API
