# Release Rollback Procedure

Use when a staging or production deployment introduces a regression that cannot be corrected forward quickly.

## 1. Stop traffic

1. Disable new sessions at the reverse proxy or set maintenance mode on web.
2. Drain or pause API workers if queue corruption is suspected.
3. Record incident start time, release SHA, and operator.

## 2. Application rollback

1. Redeploy the previous known-good API and web image/commit SHA.
2. Do **not** run destructive database migrations on rollback.
3. Confirm `/health` returns 200 and `/ready` returns 200 only when database and redis are healthy.

## 3. Data rollback decision

| Situation | Action |
| --- | --- |
| Bad code only, schema unchanged | Application rollback sufficient |
| Corrupt/incompatible writes landed | Restore Postgres + storage from last verified backup |
| Financial/attendance/audit records affected | Prefer corrective records; restore only with owner approval |

Database restore:

```bash
pnpm restore:local -- --manifest /backups/<timestamp>/manifest.json
# On VPS: use RESTORE_DATABASE_URL pointed at an isolated restore DB first, verify, then swap.
```

Never hard-delete financial, attendance, student, or audit records during rollback.

## 4. Verification after rollback

1. `pnpm smoke:pilot` against rolled-back API
2. Login checks for admin, teacher, parent personas
3. Spot-check attendance and student records modified during the incident window
4. Record rollback duration and outcome in `docs/production/evidence/`

## 5. Communication

- Notify pilot school admin if user-visible downtime occurred
- File incident report with root cause and prevention action

## Rehearsal requirement

Before GA, execute one documented rollback drill (application-only minimum; data restore optional) and store evidence alongside backup/restore records.
