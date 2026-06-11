# SchoolOS

SchoolOS is a production-grade, multi-tenant SaaS School Management System for Nepal, targeting Montessori to Class 10.

It is designed as a modular school operating system covering admissions, student records, attendance, fees, notices, activity feed, academics, homework, timetable, HR/payroll, accounting, library, transport, canteen, and future intelligence/analytics.

---

## Source of Truth

The consolidated active documentation set is:

```text
README.md
AGENTS.md

docs/product/SCHOOLOS_PRODUCT_REQUIREMENTS.md
docs/product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md

docs/project/SCHOOLOS_PROJECT_STATUS.md
docs/project/SCHOOLOS_IMPLEMENTATION_PLAN.md
docs/project/SCHOOLOS_LEARNING_LAYER_PLAN.md

docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md
docs/architecture/SCHOOLOS_PLATFORM_OPERATIONS.md

docs/design/SCHOOLOS_UI_UX_GUIDE.md

docs/production/SCHOOLOS_PRODUCTION_RUNBOOK.md

apps/schoolos_mobile/MOBILE_MASTER_GUIDE.md
apps/web/e2e/README.md
```

Historical/duplicate docs should not be recreated unless the project grows enough to justify splitting them again.

---

## Current Stage

```text
Phase 0: Completed
Phase 1A: Completed / Pilot-Ready
Phase 1B: Completed / Pilot-Ready
M0 Platform Core Foundation Depth: Completed
M4 Academics backend/admin UI: Completed / Pilot-Ready
M6 Homework/Timetable: Completed / Pilot-Ready
M7 HR/Payroll: Completed / Pilot-Ready
M8A Library, M8B Transport, M8C Canteen: Admin/backend foundations implemented with hardening depth
M9 Accounting: Completed / Pilot-Ready
M10 Notices/Communication/Chat: Foundation plus provider/attachment/retry depth implemented
M11 Intelligence/AI: Roadmap only
M12 Learning Layer: Product/architecture plan added; implementation should start only after current phase gates remain stable
```

Current product readiness:

```text
Demo-ready: Yes
Internal QA-ready: Yes
Controlled pilot-ready: Yes, after staging checks
Multi-school production-ready: Not yet
Full SchoolOS product complete: No
```

---

## Edge Case Hardening Checklist

The detailed source of truth for edge cases remains the PRD and FRS module sections. This repo-level checklist must be used before claiming controlled pilot readiness, production readiness, or module completion.

### Global edge cases

- Every tenant-owned database query, file lookup, export, report, queue job, cache read, and background retry must be scoped by authenticated `tenantId`.
- School A must never access School B students, guardians, staff, fees, receipts, payroll, files, reports, notices, transport, canteen, library, or analytics data.
- Same names, phone numbers, admission numbers, receipt numbers, file names, payment references, or QR identifiers across tenants must never cause cross-tenant leakage.
- Suspended tenants must be blocked across dashboard, API, mobile, background jobs, file downloads, report generation, exports, and provider actions.
- Disabled feature routes must fail closed even if opened directly by URL.
- Parent, student, driver, and mobile APIs must be purpose-limited and must not expose admin-shaped responses.
- Expired sessions, slow network retries, refreshes, and double-clicks must not duplicate writes.
- Long forms should preserve drafts where practical and recover safely after login/session renewal.
- Offline or reconnect sync must show deterministic conflict handling instead of silently overwriting server data.
- Background jobs must re-check tenant status, feature status, entity status, permission state, and provider state before executing.
- Retried jobs must not duplicate payments, receipts, messages, notices, reports, exports, payroll postings, accounting entries, or canteen/library transactions.
- Failed jobs, failed exports, failed storage operations, and failed provider actions must expose safe diagnostics without secrets.
- Sensitive actions must be audited with actor, tenant, timestamp, reason, and before/after context where practical.

### Authentication, role, and access edge cases

- Parent can only access currently linked children.
- Guardian removal or replacement must immediately revoke old parent access to child data, messages, files, notices, receipts, report cards, and media.
- Student can only access their own allowed records.
- Teacher can only access assigned classes, sections, subjects, homework, attendance sessions, marks, and communication threads unless explicit permission allows more.
- Cashier must not access full accounting/admin areas unless separately permitted.
- Staff salary, bank, identity, payroll, leave, and sensitive HR fields must be masked unless permission allows full view.
- Platform/support override must require explicit tenant, reason, audit, and time-bound expiry where possible.
- User role changes while a session is active must be enforced by backend permission checks, not only frontend route hiding.
- Shared links, signed URLs, browser caches, and mobile deep links must not bypass ownership or role checks.

### File Registry and storage edge cases

- Student photos, documents, receipts, report cards, payslips, notices, chat attachments, activity media, exports, and official-reporting artifacts must use protected file access.
- Raw storage keys, permanent public URLs, and internal file IDs must not be exposed to unauthorized clients.
- Signed URLs must be short-lived and refreshed only after permission re-check.
- File upload succeeds but database save fails: cleanup or mark orphan for cleanup.
- Database save succeeds but file upload fails: show failed/incomplete state; never show false availability.
- File Registry points to a missing object: show safe diagnostic and allow admin recovery; never leak storage secrets.
- Sensitive file preview/download must be permission-gated and audited.
- Low-bandwidth media failure must degrade gracefully with placeholder/retry state.

### M0 Platform Core / SaaS edge cases

- Tenant suspend/activate without reason must be blocked.
- API key secret must be shown only once and stored hashed.
- Revoked API key must fail future requests.
- Provider misconfiguration must disable dependent actions.
- Disabled/mock provider mode must be explicit and must not pretend to send real notifications, payments, or storage actions.
- Queue retry for archived tenant, suspended tenant, disabled feature, deleted entity, or unauthorized action must fail safely.
- SaaS billing/subscription state inconsistencies must surface in platform diagnostics.
- Platform SaaS billing must never mix with school fee collection.

### M1 Admissions and Student Profile edge cases

- Same student entered twice with spelling, script, spacing, or guardian-phone differences must be flagged as duplicate candidates.
- Same admission number created by two admins concurrently must be prevented by transaction/unique constraint.
- Siblings sharing guardian phone must be allowed without merging students incorrectly.
- Guardian phone reused across unrelated families must not auto-link children.
- Student class transfer mid-year must preserve old attendance, fees, report cards, documents, timetable, and accounting history.
- Student withdrawal, graduation, archive, or rejoin must preserve lifecycle history.
- Student QR screenshot, rotation, revocation, expiry, or cross-tenant scan must fail closed.
- Legacy import with duplicate or incomplete identities must go to review instead of silent merge.
- iEMIS/export required fields missing or unsupported must fail readiness validation instead of guessing.
