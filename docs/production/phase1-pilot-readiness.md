# SchoolOS Phase 1 Pilot Onboarding Runbook

This runbook is for onboarding a controlled pilot school onto the Phase 1 SchoolOS dashboard. It assumes the staging deployment has passed the deployment runbook, `verify:production`, health checks, and smoke checks.

Phase 1 pilot scope:

- Auth, RBAC, tenant context, and cookie-first browser session.
- M1 Admissions and Student Directory/Profile.
- M2 Attendance with a clear class/section/date register, present-by-default support, exception marking, draft/submit states, and correction/conflict handling.
- M3 Fee Collection with invoices, receipts, and ledger boundary.
- M5 Activity Feed and milestones.
- M10 Notices, Events, Delivery Records, and Consent Management.

Out of scope for this pilot: Phase 2 academics/exams/report cards, full parent mobile app, Angular dashboard migration, AI features, and payment gateways.

## 1. Local/Staging Startup Quick Reference

Install dependencies:

```bash
pnpm install
```

Start Docker PostgreSQL and Redis:

```bash
docker compose up -d postgres redis
docker compose ps
```

Prepare database:

```bash
pnpm db:generate
pnpm db:validate
pnpm db:migrate
pnpm db:seed
```

Start apps:

```bash
pnpm dev
```

Expected local URLs:

| Service | URL |
| --- | --- |
| Web | `http://localhost:3000` |
| API | `http://localhost:4000/api/v1` |
| Swagger | `http://localhost:4000/api/v1/docs` |
| Health | `http://localhost:4000/api/v1/health` |
| Readiness | `http://localhost:4000/api/v1/ready` |

Connectivity smoke:

```bash
pnpm smoke:phase1
SMOKE_LOGIN=true pnpm smoke:phase1
```

Seeded local accounts:

| Tenant | Email | Password | Purpose |
| --- | --- | --- | --- |
| `default-school` | `admin@schoolos.com` | `admin123` | Tenant admin |
| `default-school` | `superadmin@schoolos.com` | `superadmin123` | Full-access admin |

## 2. Pre-Pilot Checklist

Complete this before staff training:

- Confirm school/tenant name is correct.
- Confirm branding/logo expectations. If logo upload is not yet configured, document the placeholder state.
- Confirm current academic year.
- Create or verify classes.
- Create or verify sections.
- Create or verify fee heads.
- Create or verify fee plans for pilot classes.
- Create or verify admin users.
- Create or verify teacher users.
- Create or verify accountant/cashier users.
- Verify notification providers are intentionally stubbed/logged or explicitly configured.
- Verify `FRONTEND_ORIGIN`, cookies, CORS, and HTTPS settings for staging.
- Verify `LOCAL_STORAGE_ROOT` exists and is backed up.
- Run `pnpm verify:production`.
- Run `pnpm smoke:phase1`.
- Run browser smoke with PDF checks.

Go/no-go rule: do not invite pilot staff until health, readiness, smoke, and browser checks pass.

## 3. Staff Training Checklist

Train in this order so staff understand the daily school flow:

- Admin Command Center: KPIs, setup alerts, quick actions, and delivery health.
- Settings: academic year, class, and section setup.
- Student Directory/Profile: filter roster, search by name/SCH ID, open profile, open ID card PDF, jump to fee collection.
- New Enrollment: multi-step admission, guardian phone, iEMIS disability confirmation, duplicate warning, document upload, success actions.
- Attendance: class/section/date register, present-by-default support, absent/late/leave exceptions, draft/submit result, lock/conflict state.
- Fee Collection: invoice search, outstanding amount, overpayment block, partial/full payment, receipt PDF, ledger preview.
- Activity Feed: audience targeting, 1-5 image rule, private media object-key behavior, feed preview, delivery records.
- Notices/Communications: normal/urgent/emergency notice, event creation, delivery records, guardian consent capture/revoke.
- Logout/session behavior: logout from avatar menu; dashboard redirects to login when unauthenticated.

## 4. Day-1 Pilot Script

Run this with one admin, one teacher, and one accountant:

1. Log in as admin.
2. Confirm academic year, class, section, fee head, and fee plan exist.
3. Admit 2-5 test students with guardian phone numbers.
4. Confirm each student receives a generated `SCH-YYYY-NNNN` ID.
5. Open one Student ID Card PDF from Student Directory/Profile.
6. Confirm first invoice exists when a fee plan applies.
7. Log in or act as accountant.
8. Collect one partial fee payment.
9. Open the generated receipt PDF.
10. Log in or act as teacher.
11. Open Attendance for the class/section.
12. Mark one student absent, one late, and one leave if enough students exist.
13. Submit attendance and verify notification queued messaging.
14. Publish one normal notice.
15. Create one event.
16. Capture and revoke one guardian consent record.
17. Create one activity post with one image.
18. Confirm delivery records appear for notice/activity/attendance/fee events.
19. Log out and confirm direct dashboard access redirects to login.

Record screenshots for ID card PDF, receipt PDF, admission success, attendance success, payment success, notice delivery, and activity post.

## 5. Browser QA Checklist

Authentication:

- Login works with cookie-first auth.
- No raw `accessToken` or `refreshToken` appears in browser storage.
- Logout clears local session metadata.
- Unauthenticated dashboard access redirects to login.

Setup:

- Academic year exists or can be created.
- Class exists or can be created.
- Section exists or can be created.
- Fee head and fee plan exist or can be created.
- Dashboard setup alerts clear when setup is complete.

Admissions and student profile:

- Student Directory is the default Students / Admissions tab.
- Search by name and `SCH-YYYY-NNNN` works.
- Profile panel shows guardians, documents, invoices, attendance, and activity sections.
- ID Card PDF opens successfully.
- New enrollment requires guardian phone and iEMIS disability confirmation.
- Duplicate warnings and roll conflict errors are clean.
- Raw backend JSON is not shown to staff.

Attendance:

- Roster loads for class/section.
- All students default to Present.
- Exceptions cycle through absent, late, sick leave, excused leave, and unexcused leave.
- Future dates are blocked.
- Submit succeeds and queues notification event.
- Locked session shows clear state.

Fees:

- Invoice search works.
- Overpayment is blocked before submit.
- Partial payment succeeds.
- Receipt success panel appears.
- Receipt PDF opens successfully.
- Ledger preview remains labeled preview-only.

Activity:

- Class/section/student targeting is clear.
- Upload blocks more than 5 images.
- Activity post with one image publishes successfully.
- Feed preview shows new post.
- Delivery record is queued or visible.

Communications:

- Normal notice publishes.
- Scheduled notice can be created if required.
- Emergency warning appears for emergency priority.
- Event creation works.
- Delivery records list statuses.
- Guardian consent capture/revoke works.

## 6. Known Pilot Limitations

- Phase 2 academics, exams, CAS, report cards, timetable/homework, HR/payroll, and advanced accounting are not part of this pilot.
- No full parent mobile app is included yet.
- No Angular dashboard migration is included yet.
- Real SMS, FCM, and external email are disabled unless explicitly configured.
- Payment gateways are deferred; use cash/bank/manual collection.
- AI captions/narratives are deferred.
- PDF generation is functional and validated, but visual certificate/receipt design polish is deferred.
- Local storage is acceptable only with backups for the pilot; object storage can be enabled later.
- Activity image upload should be manually checked in the final target browser because automated browser runtimes may not attach local files reliably.

## 7. Support Process

Bug report format:

- Tenant/school.
- User email and role.
- Page URL.
- Exact steps to reproduce.
- Expected result.
- Actual result.
- Screenshot or screen recording.
- Approximate timestamp and timezone.
- API request ID if shown in logs.
- Browser and operating system.

Severity levels:

- S0: Data loss, cross-tenant data exposure, login unavailable for all users, or financial corruption. Stop pilot writes and escalate immediately.
- S1: Admissions, attendance, fee collection, or notices blocked for pilot staff. Fix before next live school day.
- S2: Workaround exists but staff workflow is degraded. Schedule same-week fix.
- S3: Copy, visual polish, minor layout, or deferred enhancement. Backlog unless it affects trust during training.

Rollback/disable options:

- Disable staff access by pausing pilot credentials.
- Stop API/web traffic at reverse proxy.
- Roll back to previous release commit/image.
- Restore database/storage from backup only after traffic is frozen and data impact is understood.
- Keep provider stubs/log mode if external notifications misbehave.

## 8. Browser QA Result - 2026-04-29

Manual retest confirmed:

- Student ID Card PDF opens successfully.
- Receipt PDF opens successfully.
- PDF response validation blocks invalid/non-PDF blobs.
- PDF visual design/user-friendly layout remains deferred.

Current decision: Phase 1 is ready for controlled pilot preparation, pending final staging deployment checks and school-specific onboarding data.
