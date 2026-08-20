# Reference-data seeds

`0001_reference_data.sql` creates the four organizations, complete initial
automotive taxonomy, five built-in roles, permission catalog, role grants, and
organization category entitlements.

Run it with:

```powershell
npm run db:seed
```

The runner records a checksum in `public.seed_history`, applies each numbered
seed transactionally, and refuses to continue if an already-applied file was
changed. Add a new numbered file for future reference-data changes.

`bootstrap-development-accounts.mjs` creates or verifies the six approved local
accounts after the reference seed. Passwords come only from the ignored local
environment, are stored as Argon2id hashes, and are never overwritten merely
because the bootstrap service restarts.

Run the account bootstrap manually with:

```powershell
npm run db:bootstrap:accounts
```
