# GCP Compute Engine and CI/CD Implementation Plan

Status: Draft for approval  
Last updated: 2026-08-20

## 1. Goal

Deploy the Automotive Search application to Google Cloud in an EC2-style
layout, using a Compute Engine VM for the Dockerized application and ParadeDB
database, then automate testing and deployment from GitHub.

The first target is a low-traffic shareable demo. It is not assumed to be
production capacity for the five-million-row workload until the deployed
machine size and query behavior are measured.

## 2. Target architecture

```text
GitHub
  |
  | pull request / push to main
  v
Cloud Build
  |-- quality checks
  |-- Docker image builds
  `-- Artifact Registry push
              |
              v
Compute Engine VM
  |-- HTTPS reverse proxy
  |-- Angular web container
  |-- NestJS API container
  `-- ParadeDB/PostgreSQL container
      `-- persistent database disk
```

The database remains on the VM so the current ParadeDB image, BM25 index, RLS
policies, and persistent volume can be retained. PostgreSQL must never be
publicly exposed.

## 3. Locked deployment decisions

- Compute Engine is the EC2 equivalent and is the first deployment target.
- Docker Compose remains the runtime boundary; Kubernetes is out of scope.
- The Angular build, NestJS API, and ParadeDB database remain separate
  containers.
- Database data uses a persistent disk and is never replaced during an app
  deployment.
- Migrations run as an explicit one-shot deployment step before the API is
  restarted.
- CI runs on pull requests; CD runs only after a protected `main` branch
  change.
- Secrets are injected at runtime and never committed, baked into images, or
  printed in build logs.
- The existing five-million-row dataset is restored from a verified backup;
  it is not regenerated as part of deployment.

## 4. Phases

### Phase GCP-1 — Repository and production-readiness preparation

- Confirm the GitHub repository and protected branch strategy.
- Add production Docker image tags and a deployment Compose override.
- Add a production environment template without real secrets.
- Add a health/readiness check for the API and web service.
- Ensure CORS, secure cookies, trusted origins, and database binding are
  configurable through environment variables.
- Add a deployment-safe migration command and rollback notes.

Exit criteria: the application can be built locally using production-like
configuration without changing the local database volume.

### Phase GCP-2 — GCP project, billing, and VM foundation

- Create or select the GCP project.
- Enable only the required APIs: Compute Engine, Cloud Build, Artifact
  Registry, and Cloud Logging.
- Create a budget alert before provisioning resources.
- Choose a supported free-tier region if the e2-micro demo target is retained.
- Create a Compute Engine VM with a persistent disk and a restricted firewall.
- Allow only HTTPS and controlled administration access; never allow public
  PostgreSQL access.

Exit criteria: a hardened VM exists, has a persistent disk, and can be reached
for controlled administration.

### Phase GCP-3 — Container images and artifact storage

- Create a private Artifact Registry Docker repository.
- Build API and web images with immutable commit or release tags.
- Push images from Cloud Build.
- Give the VM read-only access to the repository through its service account.
- Keep the ParadeDB image pinned to the approved version.

Exit criteria: the VM can pull the exact API and web image digests produced by
CI.

### Phase GCP-4 — First manual deployment

- Install Docker on the VM using a startup script or repeatable setup script.
- Upload the production Compose configuration and runtime environment file
  through a protected channel.
- Restore the verified database backup to the persistent volume.
- Apply checksum-tracked migrations and seeds without regenerating the
  five-million-row catalog.
- Start the API and web containers.
- Configure HTTPS termination and reverse proxy routing.

Exit criteria: the public URL opens, the API health endpoint is healthy, and
the database volume survives a VM restart.

### Phase GCP-5 — Continuous integration

Configure a GitHub Cloud Build trigger for pull requests. CI runs:

```text
npm run format:check
npm run lint
npm run build
npm run test
npm run test:api:e2e
```

CI must not connect to the production database or modify production data.

Exit criteria: a failing check blocks the merge and build logs contain no
secrets.

### Phase GCP-6 — Continuous delivery

Configure a protected `main`-branch trigger:

1. Run the CI checks again.
2. Build API and web images.
3. Push immutable images to Artifact Registry.
4. Connect to the VM using a restricted deployment identity.
5. Pull the new image digests.
6. Run migrations as a one-shot job.
7. Restart only API and web containers.
8. Run health and smoke checks.
9. Automatically stop and report failure if the new revision is unhealthy.

The database container and persistent volume are not recreated by CD.

Exit criteria: a merge to `main` produces a traceable deployment with a
commit-to-image-to-VM audit trail and a documented rollback command.

### Phase GCP-7 — Data, security, and operations validation

- Verify the restored record count is exactly 5,000,000.
- Verify the ParadeDB BM25 index exists and is usable.
- Test all 14 seeded accounts.
- Test Org A/B/C/D isolation, Restricted Viewer company restriction, field
  omission, protected detail routes, and audit events.
- Confirm PostgreSQL is not reachable from the public internet.
- Confirm HTTPS, secure cookies, allowed origins, and request correlation IDs.
- Configure logs, uptime checks, disk alerts, and memory alerts.
- Rehearse backup and rollback on a disposable copy.

Exit criteria: the deployed application passes the existing security and
browser acceptance checks without exposing secrets or unauthorized records.

## 5. Files to add during implementation

These files should be added only when the corresponding phase is approved:

- `cloudbuild.yaml` — pull-request CI and main-branch CD workflow.
- `deploy/compose.gcp.yaml` — production Compose override.
- `deploy/vm-bootstrap.sh` — repeatable VM setup/startup script.
- `deploy/deploy-vm.sh` — safe image pull, migration, restart, and smoke flow.
- `.env.gcp.example` — documented runtime variables with placeholders only.
- `docs/gcp-operations.md` — deployment, backup, rollback, and cost controls.

## 6. Cost and capacity guardrails

- Start with the smallest practical VM only as a demo.
- Set a GCP budget alert before creating resources.
- Monitor persistent-disk size, VM memory, CPU, egress, build minutes, and image
  storage.
- Do not assume the free tier is sufficient for concurrent five-million-row
  search traffic.
- Move to a larger VM before adding more users or promising production
  availability.

## 7. Explicitly out of scope

- GKE/Kubernetes
- Cloud SQL replacement for ParadeDB
- Supabase or Vercel
- Public PostgreSQL access
- Automatic dataset regeneration during deployment
- Production high availability before capacity testing
- Deployment from unreviewed branches

## 8. Approval gates

Before any cloud resource is created or any deployment is performed:

1. Confirm the GitHub repository and branch.
2. Approve the GCP region and VM size.
3. Approve billing and budget-alert setup.
4. Approve the exact CI/CD files and deployment behavior.
5. Approve the database backup/restore window.
