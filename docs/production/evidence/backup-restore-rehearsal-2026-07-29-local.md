# Backup/Restore Rehearsal Evidence (Local)

- Date: 2026-07-29T11:40:33.457Z
- Environment: local
- Operator: automated rehearsal script
- Git SHA: b4d894bd
- Result: **PASS**

## Source

- Database: schoolos_db@localhost:5433
- Storage root: /Users/erwin/Projects/SchoolOS/apps/api/storage
- Manifest: /Users/erwin/Projects/SchoolOS/.backups/202607291725/manifest.json

## Restore target

- Database: schoolos_db_restore@localhost:5433
- Storage root: /Users/erwin/Projects/SchoolOS/.backups/restore-storage/2026-07-29T11-40-29-307Z

## Metrics

| Metric | Source | Restored |
| --- | ---: | ---: |
| Tenant | 3 | 3 |
| Student | 694 | 694 |
| User | 812 | 812 |
| AuditLog | 3589 | 3589 |
| storageFileCount | 3146 | 3146 |

## Durations

- Backup pg_dump: 475ms
- Backup storage archive: 2344ms
- Rehearsal started: 2026-07-29T11:40:26.273Z
- Rehearsal finished: 2026-07-29T11:40:33.457Z

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
