# Operations Runbook

Status: Phase 12 completed.  
Last updated: 2026-08-20.

This runbook covers the local Angular/NestJS/ParadeDB application in
`automotive-search`. The application database uses host port `5433`. The
separate `paradedb-facet-benchmark` database uses host port `5432` and must not
be stopped, reset, or operated through this Compose project.

## 1. Current verified state

- 25 checksum-tracked migrations
- 4 organizations and 114 taxonomy categories
- 5 roles and 13 action permissions
- Exactly 5,000,000 persistent catalog records
- Permanent `catalog.part_catalog_search_bm25_idx` ParadeDB index
- Restricted API runtime role (`automotive_app`) with forced RLS
- Web: `http://localhost:4200`
- API health: `http://localhost:3000/api/v1/health`
- OpenAPI: `http://localhost:3000/api/v1/docs`

## 2. Secrets and environment

Create the ignored local environment file once:

```powershell
Copy-Item .env.example .env
```

Replace every placeholder. Use independent values for the owner database
password, runtime database password, access-token secret, refresh-token secret,
and each development account password. Generate random secret material with
Node.js, for example:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Never commit `.env`, paste its contents into tickets, or print it in logs.
`MIGRATION_DATABASE_URL` is owner-only; the API must use the restricted
`DATABASE_URL` connection. Production must use a secret manager, TLS, secure
cookies, a production origin allowlist, and production identities instead of
the development accounts.

## 3. Start, inspect, and stop

From `automotive-search/`:

```powershell
docker compose up --build -d --wait
docker compose ps
```

Compose waits for ParadeDB, applies migrations, runs reference seeds,
bootstraps the six development accounts, and then starts the API and web
services. Open `http://localhost:4200` after the services are healthy.

Stop while retaining the database volume:

```powershell
docker compose down
```

Restart without rebuilding:

```powershell
docker compose up -d --wait
```

Never use `docker compose down --volumes` during ordinary development. It
permanently deletes `automotive_search_paradedb_data` and all 5,000,000 rows.

## 4. Migrations and reference data

Migrations run automatically in Compose. To run the checksum-verified runner
manually while the database is available:

```powershell
npm run db:migrate
npm run db:seed
npm run db:bootstrap:accounts
```

Applied migration and seed files are immutable. Never edit an applied file;
add the next four-digit migration or seed file. The migration owner creates
objects and the API runtime role must not own protected tables.

Inspect the applied migration count without changing data:

```powershell
docker compose exec -T db psql -U automotive_owner -d automotive_search -c "SELECT version, applied_at FROM public.schema_migrations ORDER BY version;"
```

## 5. Dataset creation, resume, and recovery

The completed dataset is the deterministic `phase7-generator` 5,000,000-row
catalog. Confirm it with:

```powershell
docker compose exec -T db psql -U automotive_owner -d automotive_search -c "SELECT source_system, count(*) FROM catalog.part_catalog GROUP BY source_system ORDER BY source_system;"
npm run db:validate:phase7
```

Only use the 10,000-row smoke workflow before a full dataset exists. Do not run
smoke mode beside the completed catalog:

```powershell
npm run db:generate:catalog:smoke
npm run db:validate:phase7:smoke
```

For an interrupted matching full job, resume explicitly:

```powershell
node --env-file=.env database/generators/generate-catalog.mjs --resume
```

`--force` deletes generator-owned rows and changes surrogate IDs. It requires
explicit approval and a fresh backup. Do not use it to troubleshoot a normal
startup problem.

## 6. ParadeDB index and application validation

The permanent BM25 index is created by migration `0015` and validated by the
Phase 8 search check. Do not create a second ad-hoc index for the application.

```powershell
npm run db:validate:phase8
```

Run the complete quality and security sequence while the stack is healthy:

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

Phase 11 creates temporary users and a separate clean-install container; its
cleanup output must report `persistentApplicationVolumeTouched: false`.

## 7. Backup and restore expectations

Take a logical custom-format backup before destructive maintenance. This writes
the dump inside the database container first so PowerShell does not reinterpret
binary output:

```powershell
New-Item -ItemType Directory -Force .\backups | Out-Null
$DbContainer = docker compose ps -q db
docker compose exec -T db pg_dump -U automotive_owner -d automotive_search -Fc -f /tmp/automotive_search.dump
docker cp "$DbContainer`:/tmp/automotive_search.dump" .\backups\automotive_search.dump
```

Verify that the backup exists and is non-empty before any destructive action.
For a restore rehearsal, use a disposable database rather than overwriting the
active application database:

```powershell
docker compose exec -T db createdb -U automotive_owner automotive_restore_test
docker cp .\backups\automotive_search.dump "$DbContainer`:/tmp/automotive_search.dump"
docker compose exec -T db pg_restore -U automotive_owner -d automotive_restore_test --clean --if-exists /tmp/automotive_search.dump
```

Check the restored migration count, catalog count, and BM25 index before
removing the rehearsal database. A production backup plan must additionally
provide encrypted off-host storage, retention, restore drills, and—if the
service requires a low recovery-point objective—WAL/PITR support. A Docker
volume copy is not a substitute for a tested database backup.

## 8. Logs and troubleshooting

```powershell
docker compose ps
docker compose logs --tail=200 db
docker compose logs --tail=200 migrate
docker compose logs --tail=200 api
docker compose logs --tail=200 web
Invoke-RestMethod http://localhost:3000/api/v1/health
```

Common cases:

| Symptom                        | Safe response                                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| API does not start             | Inspect `migrate`, `seed`, and `bootstrap-accounts` logs; do not delete the volume first.                                    |
| Checksum mismatch              | Restore the original applied file or create a new migration; never edit the applied file.                                    |
| Port 5433 is busy              | Stop the unrelated process or choose a new `DB_HOST_PORT` in `.env`; do not switch to the benchmark container.               |
| Search index/query check fails | Keep the dataset, inspect DB logs, and run Phase 8; do not create a duplicate index casually.                                |
| Login fails                    | Confirm the account is active, the bootstrap variables are present, and the API uses the same `.env`; never print passwords. |
| Dataset generation stops       | Inspect `audit.data_generation_jobs`, then use the validated `--resume` path only for a matching incomplete job.             |
| UI shows stale assets          | Rebuild the web container and hard-refresh the browser; database state is independent of the frontend bundle.                |

## 9. Future hosting requirements

The current Compose stack is the supported local environment. A hosted version
needs a ParadeDB-compatible PostgreSQL service, persistent encrypted storage,
private database networking, TLS, managed secrets, a migration job with a
single-writer lock, backups/PITR, monitoring, rate limiting, and a separate
worker plan for large dataset generation. The Angular static frontend and
NestJS API may be deployed separately, but the API must reach the database over
a private connection and must keep the restricted runtime role model.

Supabase, Vercel, and Typesense are outside the current implementation scope;
do not replace ParadeDB with a generic hosted Postgres service unless its
extension and index compatibility has been verified first.
