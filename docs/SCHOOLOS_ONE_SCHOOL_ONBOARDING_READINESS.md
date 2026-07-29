# SchoolOS One-School Onboarding Readiness — Wave 0 Baseline

Status document for the controlled one-school pilot (Nepal, Grade 1–10).
Created in Wave 0 (repository audit and readiness baseline), 2026-07-29.

This document is subordinate to: the frozen pilot boundary, root `AGENTS.md`,
`docs/SchoolOS_Controlled_Pilot_Implementation_Priority_Roadmap.md` (section 14.1),
and `docs/production/SCHOOLOS_GA_RELEASE_POLICY.md`. It is a readiness tracker,
not a new canonical requirements document.

## 1. Baseline facts

- Branch: `main`, up to date with `origin/main`, working tree clean at audit start (`git status`: nothing to commit).
- Head commit at audit: `b4d894bd agentmd`.
- Monorepo: `apps/api` (NestJS + Prisma/PostgreSQL + Redis/BullMQ), `apps/web` (Next.js App Router), `apps/schoolos_mobile` (Flutter), `packages/core`.
- Prisma: schema folder `apps/api/prisma/schema/*.prisma` (compiled to `schema.prisma`), 88 active migrations (2026-05-11 → 2026-07-28), `migration_lock.toml` = postgresql.
- Wave 0 evidence class: **Static Inspection only.** No runtime gate (`pnpm test`, `pnpm test:e2e`, `pnpm build`, `pnpm db:validate`, smokes, browser E2E, emulators, devices, backups) was executed in this wave. Every runtime claim below is therefore capped at `Implemented but Unverified` regardless of how complete the code looks.

## 2. Status vocabulary

Statuses: `Not Started` | `Implemented but Unverified` | `Partially Verified` | `Blocked` | `Pilot Ready` | `Disabled for Pilot`.

Evidence labels: Static Inspection, Unit Tested, Integration Tested, API Runtime Tested, Browser Tested, Android Emulator Tested, Physical Android Device Tested, iOS Simulator Tested, Physical iOS Device Tested, Migration Validated, Migration Rehearsed, Backup Created, Backup Restore Rehearsed, Manually Unverified, Externally Blocked.

Rules applied:

- `Pilot Ready` requires every applicable layer verified with runtime-class evidence. Nothing qualifies in Wave 0.
- Test files that exist but were not executed in this wave are recorded as "tests exist" with evidence `Manually Unverified`.
- A confirmed P0 defect or a missing mandatory setup path marks the feature `Blocked`.

Status document for the SchoolOS GA program (Nepal, Grade 1–12).
Updated for owner-approved GA scope, 2026-07-29.

This document tracks GA program progress. It is subordinate to root `AGENTS.md`,
`docs/production/SCHOOLOS_GA_RELEASE_POLICY.md`, and
`docs/SchoolOS_Controlled_Pilot_Implementation_Priority_Roadmap.md` §14.1.
It is a readiness tracker, not a new canonical requirements document.

## 3. Verified GA scope (owner 2026-07-29)

**Program target:** M0–M12 + M15 + M13 (Wave 5); M14 excluded.

**First production milestone:** one real school (Wave 1 core modules).

**Wave 1 enabled modules:** M0, M1, M2, M5, M6, M12, M15.

**Wave-gated (disabled until wave exit):** M3 full (Wave 2), M4 exams (Wave 3), M7–M11 (Wave 4), M13 (Wave 5).

Supported personas (web): School Administrator/Principal, Teacher.
Supported personas (mobile): Principal, Teacher, Parent/Guardian.
No standalone student application.

**Permanently excluded:** preschool, chat (retention-only), inventory, M14 AI, broad Student App.

## 4. Readiness matrix

Layer cells: OK = implemented per static inspection; Partial = incomplete; Missing; N/A. All evidence is Static Inspection unless stated.

| Priority | Area | Feature | Backend | Web | Mobile | Security | Tests | Operational Evidence | Status | Evidence or Blocker |
| -------- | ---- | ------- | ------- | --- | ------ | -------- | ----- | -------------------- | ------ | ------------------- |
| P0 | Platform | Tenant provisioning (school creation) | OK | OK (platform plane) | N/A | Fixed 2026-07-29 (DEF-01 remediated) | Unit Tested | None | Implemented but Unverified | DEF-01 closed at code level: `POST /tenants/register` now requires platform JWT + `PlatformGuard` + `tenants:manage`; CSRF allowlist entry removed; provisioning audited against the acting operator; DTO enforces password complexity. Staging/manual verification pending |
| P0 | Auth | Login, refresh rotation, lockout, logout | OK | OK | OK | Good (bcrypt, rotation, reuse detection, CSRF) | Unit/e2e exist, Manually Unverified | None | Implemented but Unverified | Strong static posture; `mustChangePassword` not enforced server-side (P1) |
| P0 | Auth | Admin/staff account creation + temporary credentials | OK | OK (staff dialog, users workspace) | N/A | Strong password policy on managed users | Tests exist, Manually Unverified | None | Implemented but Unverified | No invite-token flow (admin types temp password); acceptable for pilot |
| P0 | Tenancy | Tenant isolation (request path) | OK (JWT claim + CLS + Prisma scope injection) | OK | OK | Good with gaps | Tests exist, Manually Unverified | None | Implemented but Unverified | Gaps: upsert/aggregate/groupBy/raw not auto-scoped; jobs don't set CLS (`apps/api/src/prisma/prisma.service.ts`) |
| P0 | Tenancy | Suspended tenant / disabled module fail-closed | OK (guard hardened, teacher-workspace gated, job guard fail-closed) | OK (module-locked + honest null sections) | Partial | Fixed 2026-07-29 (DEF-06 remediated) | Unit Tested | None | Implemented but Unverified | DEF-06 closed at code level: `EntitlementGuard` now always runs suspension check and throws without a module declaration; `@NoModuleEntitlement` opt-out added; four teacher-workspace controllers gated; composed services degrade disabled modules to null; `skipSuspendedTenantJob` fails closed on missing tenantId; auth/admissions notification jobs stamped with tenantId; static coverage contract added. `ServiceRequestsController` + five `advanced-operations/*` controllers now use documented `@NoModuleEntitlement`. Staging verification pending |
| P0 | Teachers | Subject-teacher assignment (create/manage) | OK (`POST /teacher-assignments`) | OK (Academics subjects tab) | Read-only | OK | Tests exist, Manually Unverified | None | Implemented but Unverified | Writes both legacy + canonical rows (`academics.service.ts:226-297`) |
| P0 | Teachers | Class-teacher assignment (create/manage) | OK (`PUT/DELETE /sections/:sectionId/class-teacher`) | OK (Classes & sections settings workspace) | Read-only | OK (`academics:update`, `module.students`) | Unit Tested | None | Implemented but Unverified | Fixed 2026-07-29 (DEF-04 remediated): section-scoped assign/reassign/unassign writes canonical `CLASS_TEACHER` rows + dual-writes `Section.classTeacherId`; revoke path uses `REVOKED` status; settings UI on `/dashboard/settings/school/academic-structure`. Staging/manual verification pending |
| P0 | Teachers | Teacher authorization enforcement (central) | OK (`TeacherScopeService`) | UX only | UX only | Good where used | Unit/e2e exist, Manually Unverified | None | Implemented but Unverified | Canonical resolver solid; consumers inconsistent (see attendance, marks) |
| P0 | Students | Manual student creation (admissions wizard) | OK | OK | N/A | OK | Tests exist, Manually Unverified | None | Implemented but Unverified | Preferred path is admissions; raw `POST /students` unused by web |
| P0 | Students | Bulk CSV import | OK (dry-run, batch confirm, error CSV) | OK (iEMIS workspace) | N/A | OK | Tests exist, Manually Unverified | None | Implemented but Unverified | No template download; no rollback of successful rows (per-row commit); duplicate re-import blocked |
| P0 | Guardians | Guardian creation + StudentGuardian linking | OK (ACTIVE+VERIFIED+APPROVED gate, capabilities) | OK (student profile tab) | N/A | Fail-closed defaults | Unit tests exist, Manually Unverified | None | Implemented but Unverified | No DB constraint for single primary guardian (P1) |
| P0 | Guardians | Parent scope enforcement (mobile data plane) | OK (`parent-scope.ts` helpers) | N/A (redirect) | OK (server-derived child list) | Good | Unit + widget tests exist, Manually Unverified | None | Implemented but Unverified | P1-04 post-revoke notification inbox **remediated 2026-07-29**; legacy messaging link checks remain if chat re-enabled |
| P0 | Academic structure | Academic year, classes, sections, subjects | OK | OK (settings workspaces) | Read-only | OK | Tests exist, Manually Unverified | None | Implemented but Unverified | No class rename/delete APIs (P2); attendance hard-fails without current year |
| P0 | Academic structure | Grading scale configuration | OK (settings key validation) | **Missing editor** | N/A | OK | Partial | None | Implemented but Unverified | `grading_scale` not in seed defaults nor policy UI; exams are P2/disabled so not pilot-blocking |
| P0 | Academic structure | Attendance calendar, weekend policy, timezone | OK | OK | N/A | Timezone key writable without validation (P1) | Tests exist, Manually Unverified | None | Implemented but Unverified | Nepal geography reference seeded via script; school profile address is free text (P1) |
| P0 | Attendance | Marking, locks, corrections, reports | OK | OK | OK (drafts + idempotent sync) | Fixed 2026-07-29 (DEF-02 remediated) | Unit Tested | None | Implemented but Unverified | DEF-02 closed at code level: daily attendance writes now require `HOMEROOM_ATTENDANCE_MARK`; `CLASS_ROSTER_READ` kept for reads; `attendance:read_all` no longer authorizes writes; mobile `pendingAttendanceCount` homeroom-only. DEF-04 closed at code level: class-teacher assignment API + settings UI now provision homeroom rows for greenfield schools. Staging verification pending |
| P0 | Data layer | Schema/migration consistency | OK (static) | N/A | N/A | Tenant-scoped uniques mostly present | Migration Validated: NO (not run) | None | Implemented but Unverified | Dual teacher-assignment sources of truth; nullable-unique gaps; soft FKs (payments/admissions/messaging) |
| P0 | Ops | Backup and restore | Scripts + local rehearsal | N/A | N/A | N/A | Backup Created, Backup Restore Rehearsed (local) | Partially Verified | **Remediated 2026-07-29 (sixth slice)**: `pnpm backup:local`, `pnpm restore:local`, `pnpm rehearse:backup-restore:local`; manifest metrics; isolated restore DB `schoolos_db_restore`; evidence in `docs/production/evidence/backup-restore-rehearsal-2026-07-29-local.md`. Staging rehearsal still required for GA |
| P0 | Ops | Production configuration and deployment | Partial (env validation strong) | Partial | Partial | Good env gating | None run | None | Implemented but Unverified | No Dockerfile/app compose; no migrate-fail-closed startup check; Redis auth/TLS unsupported |
| P0 | Ops | Audit logging of sensitive writes | OK (AuditService, opt-in per call site) | Viewer exists | N/A | Good coverage on auth/finance/files | Tests exist, Manually Unverified | None | Implemented but Unverified | Coverage is per-call-site, not automatic |
| P0 | Ops | Observability (health, logging, request IDs) | Partial | N/A | N/A | Safe error envelope confirmed | Filter unit tests exist | None | Implemented but Unverified | `/ready` returns HTTP 200 when degraded; no monitoring/alerting; no log aggregation |
| P0 | Web | Shell stability (session, gates, states) | N/A | OK (cookie auth, client layout gates, shared states) | N/A | No middleware.ts (client-gate only; backend is truth) | E2E suite exists, Manually Unverified | None | Implemented but Unverified | `/dashboard/staff/[staffId]` ungated in layout (P1); Learning nav visible when entitled (P1) |
| P0 | Mobile | Shell stability (login, restore, routing) | N/A | N/A | OK | Persona route guards | 69 test files, Manually Unverified | None | Implemented but Unverified | Cold start with expired access token logs out instead of refreshing (P1) |
| P1 | Homework | Assign, review, submissions | OK | Partial (date filter client-capped at 100) | Partial (create not idempotent) | Subject-scope enforced on writes | Tests exist, Manually Unverified | None | Implemented but Unverified | Web pagination gap; mobile idempotency gap |
| P1 | Notices | Authoring, publishing, delivery (M15→M12) | OK | Partial (approvals page read-only) | OK (inbox) | P1-04 post-revoke inbox **remediated 2026-07-29** | Tests exist, Manually Unverified | None | Implemented but Unverified | Approvals write UI missing |
| P1 | Timetable | Structure, builder, teacher schedule | OK | OK | Read OK | RBAC-gated writes | Tests exist, Manually Unverified | None | Implemented but Unverified | |
| P1 | Parents | Child switching (mobile) | OK (server child list) | N/A | OK | Deep-link scope tested (widget) | Widget tests exist, Manually Unverified | None | Implemented but Unverified | Unknown childId silently falls back to first child (P1 UX/safety) |
| P1 | Offline | Teacher attendance drafts + sync states | OK (clientSubmissionId idempotency) | Attendance offline page exists | OK | Tenant/user-scoped secure drafts | Unit tests exist, Manually Unverified | None | Implemented but Unverified | Only attendance has a write queue; homework offline is read-only (matches claims) |
| P1 | Docs | Onboarding, training, support documentation | N/A | N/A | N/A | N/A | N/A | Runbook §5 exists | Implemented but Unverified | Training/Day-1 script references out-of-boundary modules (M7/M8/M11) — contradiction C1 |
| P1 | QA | Authenticated browser E2E | N/A | Infra exists (~35 Playwright specs) | N/A | N/A | Not executed this wave | None | Implemented but Unverified | Default `test:e2e` omits attendance/fees smokes |
| P1 | QA | Device/emulator validation | N/A | N/A | None | N/A | No integration_test harness | None | Not Started | No emulator/simulator/physical-device evidence exists in repo |
| P1 | QA | Pilot smoke (`pnpm smoke:pilot`) | Script exists | N/A | N/A | N/A | Not executed this wave | None | Implemented but Unverified | Requires live API/DB/Redis |
| P2 | Exams | Marks entry, results, report cards | OK code; **authz defects** | OK code | Read views | DEF-03 remediated at code level (unit-tested); staging verification pending | Tests exist (marks/CAS authz covered) | None | Disabled for Pilot | Keep `module.exams` disabled for pilot tenant until staging validates DEF-03 |
| P2 | Fees | Manual fees + receipts | OK code (idempotent, reversal patterns) | OK code | Parent views | Receipt authz tests exist | Tests exist, Manually Unverified | None | Disabled for Pilot | Conditionally enable only via a dedicated M3 verification wave |
| P2 | Frozen | Chat / conversations | Retention only | Removed-state stubs | No surface (tested) | Legacy link checks weak (P1 if ever re-enabled) | — | — | Disabled for Pilot | Keep removed; do not fix messaging authz by re-enabling |
| P2 | Frozen | M13 Learning | Preserved | Nav appears if entitled | Session-join only | Legacy assignment checks diverge | — | — | Disabled for Pilot | Ensure pilot tenant entitlement off; M14 roadmap-only |
| P2 | Modules | Library, transport, canteen, accounting, payroll | Code exists | Nav entitlement-gated | Some surfaces | Not audited for enablement | — | — | Disabled for Pilot | Do not enable for pilot tenant |

## 5. Readiness percentages

Scoring method (documented so the numbers are reproducible):

- Scope: P0 set = the 22 P0 rows above; P1 set = the 8 P1 rows. `Disabled for Pilot` rows are excluded from both denominators (they are boundary decisions, not readiness debt).
- Points: Pilot Ready = 1.0; Partially Verified = 0.5; Implemented but Unverified = 0.25; Blocked / Not Started = 0.
- Evidence source: Wave 0 static inspection only; existing-but-unexecuted tests do not raise a score above 0.25.

Results:

- **P0 baseline: 17/22 rows at 0.25, 1 Partially Verified, 1 Not Started → ((17 × 0.25) + 0.5) / 22 ≈ 21%.**
  (Partially Verified: backup/restore local; Not Started: device/emulator QA.)
- **P1 baseline: 7/8 rows at 0.25, 1 Not Started → (7 × 0.25) / 8 ≈ 22%.**
- Enabled-pilot-workflow readiness: 0 workflows are end-to-end `Pilot Ready` (none has runtime + operational evidence).
- Non-gating informational estimate of total repository completion: the codebase is broadly feature-complete at the code level across M0–M12/M15 (roughly 70–80% of pilot-relevant code exists per static inspection). This figure is informational only and must not influence go/no-go; the gating numbers are the P0/P1 baselines above.

Counts (updated 2026-07-29 after DEF-01/DEF-02/DEF-03/DEF-04/DEF-05/DEF-06 remediation): Pilot Ready = 0; Partially Verified = 1 (backup/restore local); Blocked = 0; Not Started = 1; Disabled for Pilot = 5 rows (covering ~10 modules); Confirmed P0 defects = 6 (all remediated at code/local-evidence level; staging verification pending for DEF-01–DEF-06).

## 6. Confirmed P0 defects

| ID | Defect | Evidence | Pilot impact | Recommended correction |
|----|--------|----------|--------------|------------------------|
| DEF-01 | Unauthenticated `POST /tenants/register` creates tenant + admin user with weak password rule (MinLength 8 only) | `apps/api/src/tenants/tenants.controller.ts:14-17`; `tenants.service.ts`; `dto/register-tenant.dto.ts`; CSRF allowlist in `csrf.guard.ts` | Anyone on the internet can provision tenants/admin accounts on a pilot deployment | **Remediated 2026-07-29 (first slice)**: route now guarded by `JwtAuthGuard + PlatformGuard` with `tenants:manage` (platform super admin only); CSRF allowlist entry removed; operator audited; DTO password complexity enforced; web operator call authenticated; orphaned public registration form removed. Unit Tested; staging verification pending |
| DEF-02 | Attendance write gate accepts read capability `CLASS_ROSTER_READ` (subjectMatch ANY): any subject teacher assigned to a section can mark/submit/sync daily attendance | `apps/api/src/attendance/attendance.service.ts:5068-5077`; `teacher-scope/teacher-capability.ts` (`PERIOD_ATTENDANCE_MARK` defined but unused) | Attendance correctness + teacher assignment policy violation (AGENTS P0) | **Remediated 2026-07-29 (second slice)**: `checkTeacherAssignment` split into READ/WRITE modes; writes require `HOMEROOM_ATTENDANCE_MARK` only; `attendance:read_all` removed from write bypass; staff correction requests use WRITE mode; mobile `pendingAttendanceCount` homeroom-only. `PERIOD_ATTENDANCE_MARK` remains deferred until period-session model exists. Unit Tested; staging verification pending |
| DEF-03 | Marks-entry authorization cluster: `MarksService.updateMark` has no assignment check (any teacher with `academics:enter_marks` can edit any mark in tenant); CAS create/bulk lack assignment checks; `listMarks`/`getStudentHistory` unscoped for teachers | `apps/api/src/academics/marks.service.ts`; `cas-records.service.ts` | Exam integrity; mitigated for pilot only if `module.exams` stays disabled until staging validates | **Remediated 2026-07-29 (fifth slice)**: `updateMark` requires `MARKS_ENTER` assignment; `listMarks`/`getStudentHistory` scoped via `SUBJECT_RECORD_READ` + homeroom non-draft read; CAS `create`/`bulkUpsert` require `MARKS_ENTER` (subject) or `HOMEROOM_RECORD_WRITE` (homeroom). Unit Tested; staging verification pending |
| DEF-04 | No production write path (API or UI) for class-teacher assignment; `CLASS_TEACHER` rows exist only via seed/backfill scripts | `apps/api/src/academics/academics.service.ts:259-264` (hardcodes SUBJECT_TEACHER); `create-section.dto.ts` (no teacher field) | A greenfield pilot school configured via UI has no class teachers → teacher attendance/homeroom scope is empty/403 | **Remediated 2026-07-29 (third slice)**: `PUT/DELETE /sections/:sectionId/class-teacher` on sections module (`module.students`, `academics:update`); writes canonical `CLASS_TEACHER` rows with revoke/reactivate lifecycle + dual-writes `Section.classTeacherId`; settings UI on academic-structure workspace. Unit Tested; staging verification pending |
| DEF-05 | Backup/restore is documentation only: no scripts, no automation, no Backup Created or Backup Restore Rehearsed evidence | `docs/production/SCHOOLOS_PRODUCTION_RUNBOOK.md` §4; `scripts/backup-schoolos.mjs`, `scripts/restore-schoolos.mjs`, `scripts/rehearse-backup-restore-local.mjs` | Real school data cannot be onboarded without recoverability (AGENTS P0) | **Remediated 2026-07-29 (sixth slice)**: executable backup/restore/rehearsal scripts; local drill into `schoolos_db_restore` with manifest row-count verification; evidence template + dated local record. Staging rehearsal still required for GA |
| DEF-06 | Disabled-module fail-closed was decorator-dependent: `EntitlementGuard` passed when no decorator present; four teacher-workspace controllers ungated; cross-module composed data leaked disabled modules; tenant-less jobs proceeded | `apps/api/src/auth/guards/entitlement.guard.ts`; `teacher-workspace/*`; `processor-tenant.guard.ts:10-12`; `advanced-operations.processor.ts` | "Disabled for pilot" claims (exams, learning, fees) were only trustworthy if fail-closed actually held | **Remediated 2026-07-29 (fourth slice)**: guard hardened (suspension unconditional, missing declaration throws, `@NoModuleEntitlement` opt-out); four teacher-workspace controllers gated (`module.students` / `module.attendance`); `TeacherTodayService` + `HomeroomSummaryService` degrade disabled modules to null with `unavailableModules`; `skipSuspendedTenantJob` skips on missing tenantId; auth OTP + admissions invite jobs stamped with tenantId; `AdvancedOperationsProcessor` suspension check; static coverage contract. `ServiceRequestsController` + five `advanced-operations/*` controllers now use documented `@NoModuleEntitlement`. Unit Tested; staging verification pending |

High P1 register (not exhaustive; see Wave 0 report): `mustChangePassword` not enforced server-side; Prisma auto-scope excludes upsert/aggregate/raw + jobs without CLS; support-override breaks `/auth/me`; post-revoke guardian residual access (notifications inbox, legacy messaging); no primary-guardian DB constraint; nullable-unique gaps on assignment tables; `/ready` 200-when-degraded; no monitoring/alerts; no Redis auth; shallow `verify:openapi` gate; mobile cold-start expired-token logout; mobile homework create idempotency; web notice approvals read-only; homework date-filter client pagination; CSV template download missing; bulk import no rollback; grading-scale UI missing; school profile address not using Nepal geography cascade.

## 7. Documentation contradictions (material)

| # | Files | Conflict | Selected interpretation | Follow-up |
|---|-------|----------|-------------------------|-----------|
| C1 | Controlled-pilot roadmap §14.1 vs Production Runbook §5 vs PRD §7 | Runbook Day-1/training requires M7 payroll, M8 library, M11 accounting; PRD beachhead table includes library/transport/canteen/HR; roadmap boundary excludes them | Roadmap §14.1 pilot boundary wins (matches frozen boundary + AGENTS P0 focus) | Product owner: rewrite Runbook §5 and PRD §7 to the pilot slice |
| C2 | Role Pain-Points roadmap Stage 3/4 vs controlled-pilot roadmap + AGENTS | Stage 3/4 learning/institutional improvement rows claim "Development complete" while pilot roadmap defers/disables that family and P0 is incomplete | Stage 3/4 is out-of-pilot; treat as deferred P2 | Relabel tracker rows; verify improvement modules stay entitlement-hidden |
| C3 | MDD §4.3 "Internal QA ready" closeout vs GA Release Policy | Stage-sounding claim without the release-policy evidence matrix | Local-evidence-only reading; no stage claim | Reword MDD closeout language |
| C4 | Teacher Persona spec ("recommended canonical design", library/biometrics/M13 phases) vs pilot boundary + AGENTS | Persona spec exceeds companion-app and pilot boundary | Persona spec is a non-canonical draft; pilot boundary wins | Demote/trim persona spec; author a Parent persona only if needed |
| C5 | PRD/SRS full persona roster vs pilot roadmap personas | Driver/librarian/canteen/student-session personas active in PRD/SRS | Long-term product scope vs pilot enablement subset — not a defect | Note subset explicitly in pilot docs |
| C6 | PRD "Last reviewed 2026-07-12" cites 2026-07-18 decision | Date hygiene | Content wins; date stale | Refresh review date |

No contradiction required silently overriding a canonical source; all selections follow the mandated precedence. C1 and C2 need explicit product-owner sign-off.

## 8. First implementation slice (selected)

**Slice: close the unauthenticated tenant-provisioning hole (DEF-01).** Completed 2026-07-29.

**Slice: restrict attendance writes to homeroom capability (DEF-02).** Completed 2026-07-29.

**Slice: add class-teacher assignment write path (DEF-04).** Completed 2026-07-29.

**Slice: fail-closed entitlements on ungated controllers (DEF-06).** Completed 2026-07-29.

**Slice: marks-entry and CAS authorization (DEF-03).** Completed 2026-07-29.

**Slice: backup/restore scripts and local rehearsal (DEF-05).** Completed 2026-07-29.

**Wave: staging foundation + GA path artifacts.** Completed 2026-07-29 (local simulation).

Next operational waves (require TLS staging host / real school):

1. Full staging validation on VPS (`verify:env:staging`, smoke, authenticated E2E)
2. Controlled pilot with [CONTROLLED_PILOT_CHECKLIST.md](production/CONTROLLED_PILOT_CHECKLIST.md)
3. Release owner sign-off via [RELEASE_SIGNOFF_CHECKLIST.md](production/RELEASE_SIGNOFF_CHECKLIST.md)

Follow-up engineering: CAS web picker scoping; gate `service-requests` and `advanced-operations` controllers.

## 9. Unverified areas (explicit)

- No test suite, typecheck, lint, build, `db:validate`, OpenAPI gate, smoke, or E2E command was executed in Wave 0.
- No API runtime, browser, emulator, simulator, or physical device execution occurred.
- No database was connected to; migration status (`prisma migrate status`) against any environment is unknown.
- No backup was created or restored.
- CI history/artifacts were not retrieved; whether current `main` is green in CI is unverified.
- Provider integrations (SMS/email/storage/payments) were not exercised.
- Fees (M3) correctness was audited only at schema/pattern level, not for enablement.
