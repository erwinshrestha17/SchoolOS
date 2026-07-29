# Backup/Restore Rehearsal Evidence Template

Use this template when recording backup and restore drill evidence. Do not commit backup artifact files or credentials.

## Record

- **Date:**
- **Environment:** `local` | `staging` | `production`
- **Operator:**
- **Git SHA / release tag:**
- **Result:** `PASS` | `FAIL`

## Source

- **Database host/name:**
- **Storage root / provider:**
- **Manifest path:** (local path only; do not commit artifacts)

## Restore target

- **Restore database URL host/name:** (no passwords)
- **Restore storage root:**

## Metrics

| Metric | Source | Restored | Match |
| --- | ---: | ---: | --- |
| Tenant | | | |
| Student | | | |
| User | | | |
| AuditLog | | | |
| storageFileCount | | | |

## Durations

- Backup pg_dump (ms):
- Backup storage archive (ms):
- Restore pg_restore (ms):
- Total rehearsal duration:

## Verification

- [ ] `pnpm backup:local` completed
- [ ] `pnpm restore:local -- --manifest <path>` or `pnpm rehearse:backup-restore:local` completed
- [ ] Row counts match manifest
- [ ] Storage file counts match manifest
- [ ] Optional: `/api/v1/ready` OK against restore environment
- [ ] Optional: login + tenant spot-check

## Commands run

```bash
# paste exact commands
```

## Follow-up

- Staging rehearsal required before GA
- Object storage (S3/R2) backup procedure if not using local storage
- Redis persistence note if queue state matters for the environment
