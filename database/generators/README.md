# Dataset Generator

Phase 7 provides a deterministic Node.js generator for the persistent
5,000,000-row automotive catalog. The completed `gen-v1` dataset contains:

| Group             |      Rows |
| ----------------- | --------: |
| Braking           | 1,250,000 |
| Tyres and Wheels  | 1,250,000 |
| Steering          | 1,250,000 |
| Other ten domains | 1,250,000 |
| Total             | 5,000,000 |

Every record has exactly one primary category assignment. A deterministic 20%
candidate rule produces 207,374 valid secondary assignments, for 5,207,374
assignments in the completed dataset.

## Commands

Run the 10,000-row smoke workflow only before the full dataset exists:

```powershell
npm run db:generate:catalog:smoke
npm run db:validate:phase7:smoke
```

Generate the full dataset:

```powershell
npm run db:generate:catalog
```

Validate the completed dataset while the API is running:

```powershell
npm run db:validate:phase7
```

Do not run smoke mode beside the completed full catalog because smoke
validation intentionally expects an isolated smoke dataset.

## Resume and replacement

Generation uses 2,000-row transactions. Catalog rows, category assignments,
and the job checkpoint are committed atomically, so a crash cannot leave the
checkpoint behind or ahead of its committed data.

If a matching job is incomplete, the normal command refuses to guess. Resume
it explicitly:

```powershell
node --env-file=.env database/generators/generate-catalog.mjs --resume
```

Resume verifies the generator version, seed, target, batch size, and stored row
position before continuing. To deliberately delete this generator's rows and
start again, use `--force`. Force replacement changes database surrogate IDs;
the stable identifiers are `part_number`, `source_system`, and
`source_record_id`, and generated business content remains deterministic.

Never use `--force` casually on the completed dataset. It is destructive for
the generator-owned rows and must be explicitly approved.

## Controls and state

- `audit.data_generation_jobs` records version, seed, target, completed rows,
  batch size, status, timing, and safe error details.
- Duplicate prevention uses unique business/source identifiers.
- The generator checks free disk space at checkpoints. The default Windows
  system-drive reserve is 1,500 MB.
- Domain vocabulary, companies, locations, years, manufacturers, lifecycle,
  materials, and vehicle programs are seeded and repeatable.
- The generator never creates the permanent BM25 index. Phase 8 now owns and
  validates that separately managed index.

The completed job generated 5,000,000 rows in about 16 minutes 11 seconds on
this development machine. Actual runtime depends on storage and Docker CPU.
