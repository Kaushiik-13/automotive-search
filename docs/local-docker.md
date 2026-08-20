# Local Docker Environment

Status: Phase 2 baseline; operational procedures are in
[`docs/operations.md`](./operations.md).  
Last updated: 2026-08-20.

## Services

| Service              | Container port | Default host port | Purpose                                   |
| -------------------- | -------------: | ----------------: | ----------------------------------------- |
| `web`                |           8080 |              4200 | Angular production build served by Nginx  |
| `api`                |           3000 |              3000 | NestJS API                                |
| `migrate`            |              — |                 — | One-shot checksum-verified migrations     |
| `seed`               |              — |                 — | One-shot checksum-verified reference data |
| `bootstrap-accounts` |              — |                 — | Verify six secured development accounts   |
| `db`                 |           5432 |              5433 | PostgreSQL 18 with ParadeDB extensions    |

Host port 5433 is intentional. The original facet-benchmark database already
uses host port 5432, and the application stack must not interfere with it.

## First start

1. Copy `.env.example` to `.env`.
2. Replace every `replace_with_...` value with an independent random value.
3. Start the stack:

   ```powershell
   docker compose up --build -d
   ```

4. Check service health:

   ```powershell
   docker compose ps
   ```

5. Open `http://localhost:4200`.

The database must become healthy before the one-shot migration service runs.
The reference seed runs after migrations, then the development-account
bootstrap runs. The API starts only after all three jobs exit successfully, and
the frontend waits for the API. The frontend proxies `/api` to the private
service named `api`.

Migrations use the owner connection only inside the migration container. The
API receives the restricted `automotive_app` connection whose hostname is the
private service named `db`.

## Stop and restart

Stop containers while keeping the database:

```powershell
docker compose down
```

Start them again:

```powershell
docker compose up -d
```

The named volume `automotive_search_paradedb_data` survives both operations.

## Reset warning

The following operation permanently removes the local application database
volume and must be used only when a complete reset is intended:

```powershell
docker compose down --volumes
```

Ordinary stopping, rebuilding, or restarting must not use `--volumes`.

## Health checks

- Database: `pg_isready` against the configured database and owner
- Migrations: successful one-shot exit after checksum verification
- API: `GET /api/v1/health`
- Web: `GET /health` inside the Nginx container

Validate the Phase 3 database structure and privilege boundary:

```powershell
npm run db:validate:phase3
```

Validate the Phase 4 reference data and entitlement expansion:

```powershell
npm run db:validate:phase4
```

Validate Phase 5 while the API is running:

```powershell
npm run db:validate:phase5
```

## Useful diagnostics

```powershell
docker compose logs --tail=100 db
docker compose logs --tail=100 api
docker compose logs --tail=100 web
```

The Phase 4 reference seed creates organizations, taxonomy, roles, permissions,
and entitlements. Users and catalog records remain approval-gated later phases.
