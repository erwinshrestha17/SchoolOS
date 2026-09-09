# Backup/Restore Rehearsal Evidence (Local)

- Date: 2026-09-09T03:31:50.855Z
- Environment: local
- Operator: automated rehearsal script
- Git SHA: e9c05ca4
- Result: **PASS**

## Source

- Database: schoolos_db@localhost:5433
- Storage root: /Users/erwin/Projects/SchoolOS/apps/api/storage
- Manifest: /Users/erwin/Projects/SchoolOS/.backups/202609090916/manifest.json

## Restore target

- Database: schoolos_db_restore@localhost:5433
- Storage root: /Users/erwin/Projects/SchoolOS/.backups/restore-storage/2026-09-09T03-31-44-710Z

## Metrics

| Metric | Source | Restored |
| --- | ---: | ---: |
| Tenant | 7 | 7 |
| Student | 2223 | 2223 |
| User | 3928 | 3928 |
| AuditLog | 11797 | 11797 |
| storageFileCount | 3535 | 3535 |

## Durations

- Backup pg_dump: 1480ms
- Backup storage archive: 2302ms
- Rehearsal started: 2026-09-09T03:31:40.727Z
- Rehearsal finished: 2026-09-09T03:31:50.855Z

## Optional API check

- Checked: no
- /ready OK: n/a

## Verification command

```bash
docker compose up -d postgres
pnpm db:migrate && pnpm db:seed
pnpm backup:local
pnpm rehearse:backup-restore:local
```

## Follow-up

- Repeat on staging with production-like storage provider before GA.
- Keep backup artifacts outside the repo workspace in real deployments.
