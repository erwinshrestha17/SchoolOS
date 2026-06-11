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

### M2 Attendance edge cases

- Teacher marks the same class twice.
- Two teachers submit attendance for the same class/date.
- Attendance is submitted after lock window.
- Offline draft conflicts with already-synced server data.
- Student joins class after attendance was already taken.
- Student transfers class mid-month.
- Half-day attendance is required by policy.
- Attendance attempted on holiday, weekend, or exam-only day.
- Parent tries to view attendance for non-linked child.
- Export generation fails after report entry is created.
- Duplicate attendance submissions must be blocked or merged by deterministic conflict rules.
- Late edits must go through correction workflow and preserve audit history.

### M3 Fees and Receipts edge cases

- Parent pays partially against multiple invoice lines.
- Parent overpays and should receive credit/advance according to policy.
- Cashier double-clicks payment submit.
- Same payment reference is submitted twice.
- Receipt PDF generation fails after payment is saved.
- Receipt is reprinted multiple times.
- Receipt reversal is attempted after cashier close.
- Already-reversed payment is reversed again.
- Refund is greater than original payment.
- Student changes class after invoice generation.
- Scholarship/discount is applied after invoice issue.
- Online payment webhook arrives twice, forged, delayed, or out of order.
- Redirect/callback suggests payment success before provider verification.
- Gateway provider is disabled but UI attempts payment collection.
- Cashier close is submitted concurrently by two users.
- Dues, student ledger, receipt, refund, reversal, cashier close, and accounting must remain reconciled.

### M4 Academics, Exams, CAS, and Report Cards edge cases

- Teacher enters marks for unassigned subject/class.
- Marks submitted after lock.
- Student absent from exam must be different from zero marks.
- Retest or make-up exam required.
- CAS record incomplete.
- Grade rounding differs from tenant policy.
- Report card regenerated after correction.
- Old report card version must remain available.
- Student has unpaid dues and result is withheld by policy.
- Promotion decision differs from automatic calculation.
- Report card file generation succeeds but storage registration fails.
- Parent/student tries to view unpublished result.
- Result publication, correction, marks unlock, and report regeneration must be explicit and auditable.

### M5 Activity Feed and Milestones edge cases

- Teacher posts media for wrong class/student.
- Parent lacks photo/media consent.
- Activity media URL is shared externally.
- Post is approved, then student is removed from class.
- Post is archived or moderated after notification was sent.
- Attachment upload succeeds but post creation fails.
- Parent tries to access another child’s tagged media.
- Moderated or removed content still appears in cached feed.
- Low-bandwidth image loading fails.
- Wrong milestone/mood log is entered for a student.
- Removed or archived posts must disappear from feed and detail views.

### M6 Homework and Timetable edge cases

- Homework due date is before publish date.
- Homework is deleted after reminder job is queued.
- Attachment is too large, wrong type, missing, or externally shared.
- Student submits after deadline.
- Parent views homework for wrong child.
- Teacher is assigned to two classes at the same time.
- Room is assigned to multiple classes at the same time.
- Teacher is on leave but still assigned in timetable.
- Published timetable is edited without versioning.
- Substitute teacher lacks subject/class permission.
- Reminder jobs must re-check assignment status before sending.
- Timetable publish must block teacher, room, workload, and absence conflicts.

### M7 HR and Payroll edge cases

- Staff joins mid-month.
- Staff leaves mid-month.
- Leave without pay affects payroll.
- Salary structure changes after payroll draft is created.
- Payroll is approved and then staff data changes.
- Payroll is posted twice.
- Payroll reversal does not reverse accounting.
- Unauthorized user views salary or bank details.
- Staff document access crosses tenant or role boundary.
- Duplicate payroll run is created for same period.
- Payslip generated but file registration fails.
- Staff self-service opens another staff member’s record.
- Approved payroll must be locked from unsafe edits.
- Payroll posting and reversal must be idempotent and accounting-safe.

### M8A Library edge cases

- Same physical copy is issued twice.
- Book copy is lost or damaged while issued.
- Student leaves school with borrowed book.
- Overdue fine calculation crosses holidays or weekends.
- Staff borrower follows different rules from student borrower.
- QR resolves to revoked student credential.
- Library fine posts twice to fees.
- Fine is paid in fees but library status does not update.
- Borrower belongs to a different tenant.
- Book copy deletion after issue history must be blocked or archived.
- Fine posting and payment reconciliation must be idempotent.

### M8B Transport edge cases

- Student is assigned to two active routes accidentally.
- Different morning and evening routes are required.
- Driver marks wrong student boarded.
- GPS device sends too many updates.
- GPS stops updating mid-trip.
- Parent sees stale location as if it is live.
- Bus route changes for one day only.
- Student is absent but route assignment exists.
- Parent tries to track a non-linked child.
- Live map is disabled but route is still accessible.
- Vehicle/driver is assigned to overlapping trips.
- Trip completed but GPS updates still arrive.
- Driver/mobile offline boarding sync conflicts with server state.

### M8C Canteen edge cases

- Student wallet has insufficient balance.
- POS sale is submitted twice.
- Meal plan overlaps with existing active plan.
- Meal plan is cancelled after M3 invoice is issued.
- Wallet reversal would create negative balance.
- Inventory stock goes negative.
- Wastage entry is created after stock close.
- Student QR is revoked but used at canteen.
- Parent daily/monthly spending control is exceeded.
- Receipt reprint creates duplicate transaction.
- Supplier purchase bill is edited after stock movement.
- Allergy/medical warning exists for selected menu item.
- Menu item disabled but still appears from POS cache.
- Student leaves school with remaining wallet balance.

### M9 Accounting and Finance edge cases

- Unbalanced journal is submitted.
- Decimal precision causes one-paisa mismatch.
- Backdated transaction is attempted in closed fiscal period.
- Posted journal is edited directly.
- Fee receipt reversal does not reverse accounting.
- Payroll posts twice.
- Canteen, library, or transport source maps to wrong account.
- Default chart of accounts is missing for a tenant.
- Large ledger export times out.
- Bank reconciliation auto-match suggests wrong transaction.
- Fiscal year is reopened after reports were already exported.
- Opening balance changes after transactions exist.
- Financial reports disagree with source ledgers.
- Posted accounting records must be immutable and corrections must use reversal/correction entries.

### M10 Notices, Communication, and Messaging edge cases

- Notice sent to wrong class or recipient group.
- Admin sends high-impact notice before previewing recipients.
- Parent removed from student but still has old message link.
- Attachment URL is shared externally.
- Provider is disabled but UI shows delivered state.
- Provider callback is duplicated or forged.
- Message delivery fails but read status is shown.
- Abuse report is submitted against teacher/parent.
- Retention policy deletes old messages but audit requirement remains.
- Unread recipient list includes removed guardians.
- Teacher sees message thread for unassigned student.
- Notification queued then notice is archived.
- Delivery retry must not duplicate messages.

### M11 Intelligence and Analytics edge cases

- Analytics uses incomplete pilot data.
- AI insight exposes sensitive student/staff data.
- Prediction is treated as final decision.
- Cross-tenant aggregation leaks tenant identity.
- Financial analytics disagree with accounting reports.
- Student risk indicator is used for punishment without human review.
- Staff/class analytics are visible to unauthorized roles.
- AI/analytics must stay roadmap-only until reliable production data exists.

### Reporting, export, and pilot-readiness edge cases

- CSV/Excel import has duplicate students, invalid dates, missing required fields, mixed scripts, or partial failures.
- Official/IEMIS export readiness must fail when school profile, student identity, guardian, class/section, staff roster, scholarship, special flags, or required fields are incomplete.
- Unsupported official fields must be documented instead of guessed.
- Export failure must not create false success state.
- Exported artifacts must be tenant-scoped and stored/downloaded through protected File Registry when retained.
- Large reports must use background export where needed.
- Re-generated PDFs should preserve history where legally or operationally required.
- Controlled pilot must manually verify tenant isolation, parent child-scope, QR revoke/rotate, payment correctness, cashier close, attendance conflict/correction, marks/report publication, payroll reversal, canteen double-submit, library duplicate issue, stale GPS, protected notice attachments, suspended tenant blocking, provider reconciliation, disabled/mock provider behavior, and official-readiness validation.

---

Recommended next direction:

```text
Strict Phase Gate 0 from docs/project/SCHOOLOS_IMPLEMENTATION_STATUS_AND_PLAN.md
→ stabilize verification, migrations, seed data, smoke tests, and stale docs
→ harden controlled pilot reliability across M0 and Phase 1 core
→ run staging browser/manual QA for Homework/Timetable, HR/Payroll, Library, Canteen, and Transport
→ deepen existing modules one vertical at a time based on pilot evidence
```

Do not start broad new product fronts until the full verification gate is clean.

Explicitly deferred unless requested:

```text
Angular migration
AI/ML implementation
Deep parent/mobile module expansion beyond the started Flutter companion app
Driver live-trip workflow beyond the started mobile shell
Live transport map/WebSocket UI
Microservices
Biometric workflows
```
