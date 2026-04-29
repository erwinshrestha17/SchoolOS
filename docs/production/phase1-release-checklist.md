# SchoolOS Phase 1 Release Checklist

Use this checklist before staging, pilot training, and controlled pilot launch. A release is not ready if any required item is unchecked.

## 1. Release Metadata

- Release commit SHA:
- Release branch/tag:
- Date:
- Release owner:
- Target environment:
- Pilot school/tenant:
- Rollback commit/image:

## 2. Code Verification

Required commands:

```bash
pnpm db:generate
pnpm db:validate
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify:production
```

Checklist:

- `pnpm db:generate` passed.
- `pnpm db:validate` passed.
- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed.
- `pnpm test:e2e` passed.
- `pnpm build` passed.
- `pnpm verify:production` passed.
- No tracked build artifacts or cache files are dirty.
- No unrelated local changes are included in the release.

## 3. Database Migration

- Current database backup completed before migration.
- Migration target database confirmed.
- `pnpm db:migrate` completed successfully.
- Prisma schema validation passed after migration.
- API starts after migration.
- `/api/v1/ready` passes after migration.
- Migration rollback plan is documented.

## 4. Seed And Baseline Data

- Seed is required for this environment.
- Seed was intentionally run, or intentionally skipped.
- Roles and permissions exist.
- Super admin/admin user exists for pilot support.
- Tenant/school record exists.
- Academic year exists.
- Classes and sections exist.
- Fee heads and fee plans exist.
- Chart/ledger baseline exists if finance is enabled.

Seed warning: do not run seed against a live environment unless the release owner confirms the intended add/update behavior.

## 5. Smoke Tests

Required when Docker/API is running:

```bash
pnpm smoke:phase1
SMOKE_LOGIN=true pnpm smoke:phase1
```

Checklist:

- PostgreSQL connectivity passed.
- Redis connectivity passed.
- API `/health` passed.
- API `/ready` passed.
- Seeded login smoke passed if seed data is expected.
- Swagger/API docs reachable if enabled.

## 6. Browser QA

Authentication:

- Login works.
- Logout works.
- Unauthenticated dashboard access redirects to login.
- Browser storage does not contain raw access/refresh tokens.

Setup:

- Academic year setup works.
- Class setup works.
- Section setup works.
- Fee head setup works.
- Fee plan setup works.

Student workspace:

- Student Directory opens by default.
- Search by name works.
- Search by `SCH-YYYY-NNNN` works.
- Student Profile opens.
- New Enrollment works.
- Guardian phone validation works.
- iEMIS disability confirmation is required.
- Duplicate warning behavior works.
- Bulk Import panel remains available.
- Recent Admissions remains available.

Attendance:

- Roster loads.
- Present-by-default behavior works.
- Absent/late/leave exception flow works.
- Future date is blocked.
- Submission success is visible.
- Lock/conflict state is visible when applicable.

Fees:

- Invoice search works.
- Overpayment is blocked.
- Partial payment succeeds.
- Full payment succeeds when applicable.
- Receipt success panel appears.
- Ledger preview is preview-only.

Activity:

- Class/section/student targeting works.
- 1-5 image rule is visible.
- One-image activity post publishes.
- Feed preview updates.
- Delivery record appears or queues.

Communications:

- Notice publishes.
- Emergency warning appears.
- Event creation works.
- Delivery records list statuses.
- Consent capture works.
- Consent revoke works.

## 7. PDF Checks

- Student ID Card PDF opens.
- Receipt PDF opens.
- Browser does not show "Failed to load PDF document."
- Invalid document kind returns clean error.
- Missing/unauthorized PDF request returns clean error.
- PDF visual design polish is understood as deferred.

## 8. Security Checks

- HTTPS configured for staging/pilot.
- `FRONTEND_ORIGIN` matches the public web origin.
- CORS credentials are restricted to expected origin.
- Cookie settings are environment-appropriate.
- JWT secrets are strong and not example values.
- Medical encryption key is strong and not example value.
- `TRUST_PROXY=true` is set behind reverse proxy.
- PostgreSQL is not publicly exposed.
- Redis is not publicly exposed.
- Storage directory is not publicly exposed.
- RBAC roles for admin, teacher, and accountant have been sanity checked.
- Cross-tenant access is covered by automated tests.

## 9. Backup Check

- PostgreSQL backup completed.
- Storage artifact backup completed.
- Environment/proxy config backup completed.
- Restore command documented.
- Backup location is outside the VPS or synced off-server.
- Release commit SHA saved with backup.
- Rollback owner assigned.

## 10. Logs And Monitoring

- API logs accessible.
- Web logs accessible.
- Postgres logs accessible.
- Redis logs accessible.
- Reverse proxy logs accessible.
- Notification processor logs accessible.
- Failed delivery inspection path known.
- Request ID correlation path known.

## 11. Pilot Go/No-Go

Go criteria:

- All required verification commands pass.
- Health/readiness/smoke pass.
- Browser QA pass is recorded.
- PDF checks pass.
- Backup exists and restore path is documented.
- Pilot users and support contacts are ready.
- Known limitations have been explained to school stakeholders.

No-go criteria:

- Failed migration, failed readiness, or failed smoke.
- Login/session instability.
- Cross-tenant data exposure risk.
- Admissions, attendance, or fee collection blocked.
- Receipt or ID card PDFs fail to open.
- Backup missing before migration/deploy.
- Unreviewed production secrets or public database/Redis exposure.

Final decision:

- Go:
- No-go:
- Approver:
- Notes:
