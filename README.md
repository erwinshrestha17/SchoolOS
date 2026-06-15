# SchoolOS

SchoolOS is a production-grade, multi-tenant SaaS School Operating System for Nepal, with a staged product direction from Kindergarten / Montessori to Grade 12.

It is designed as a modular school operating platform covering admissions, student records, attendance, fees, notices, activity feed, academics, homework, timetable, HR/payroll, accounting, library, transport, canteen, classroom learning, parent engagement, and future intelligence/analytics.

The current implemented core remains focused on controlled pilot readiness for existing management modules. M12 Learning Layer now has a verified backend MVP foundation; KG-12 breadth and Learning frontend/runtime depth remain staged expansion goals, not a claim that every KG-12 feature is already implemented.

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
docs/project/SCHOOLOS_ADVANCED_OPERATIONS_PLAN.md
docs/project/SCHOOLOS_LEARNING_LAYER_PLAN.md
docs/project/SCHOOLOS_COST_PERFORMANCE_IMPLEMENTATION_PLAN.md

docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md
docs/architecture/SCHOOLOS_PLATFORM_OPERATIONS.md

docs/design/SCHOOLOS_UI_UX_GUIDE.md
docs/design/SCHOOLOS_WEB_MOBILE_MASTER_DESIGN_PLAN.md

docs/frontend/SCHOOLOS_FRONTEND_BACKEND_API_CONTRACT_MAP.md

docs/mobile/SCHOOLOS_FLUTTER_APP_PLAN.md

docs/testing/SCHOOLOS_WEB_MOBILE_PERSONA_SMOKE_PLAN.md

docs/production/SCHOOLOS_PRODUCTION_RUNBOOK.md

apps/schoolos_mobile/MOBILE_MASTER_GUIDE.md
apps/web/e2e/README.md
```

Historical/duplicate docs should not be recreated unless the project grows enough to justify splitting them again.

---

## Product Direction

```text
SchoolOS Core Management = runs daily school operations
SchoolOS Academics = manages classes, subjects, timetable, homework, exams, reports, streams, projects, and practicals
SchoolOS Advanced Operations = pre-AI automation, approvals, analytics, mobile/offline reliability, document templates, and Nepal-specific operational depth
SchoolOS Learning Layer = improves classroom teaching and student learning inside school
SchoolOS Intelligence = future teacher-reviewed analytics and safe AI after reliable production data exists
```

KG-12 expansion must be staged:

```text
Stage A: Kindergarten / ECD / Montessori
Stage B: Grade 1-3
Stage C: Grade 4-5
Stage D: Grade 6-8
Stage E: Grade 9-10
Stage F: Grade 11-12
```

The current management modules remain the foundation. The Learning Layer is implemented backend-first as a separate M12 domain that reuses existing students, teachers, classes, subjects, timetable, communication, File Registry, audit, RBAC, and tenant isolation.

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
Pre-AI Advanced Operations: Backend foundation and additive Prisma migration added for approvals, automation, descriptive analytics summaries, mobile/offline reliability foundations, documents, and Nepal-school workflow depth; frontend/mobile workflow depth remains next-phase work
M11 Intelligence/AI: Roadmap only
M12 Learning Layer: Backend MVP foundation implemented and verified; frontend teacher/student/parent screens remain staged
KG-12 Expansion: Product direction added; Grade 11-12 and advanced learning features are staged future scope
```

Latest local verification snapshot:

```text
2026-06-15: Backend package gates pass, root typecheck/build pass, and local smoke suites pass:
- pnpm smoke:pilot
- pnpm smoke:learning
- pnpm smoke:full

Advanced-operations migration status:
- apps/api/prisma/migrations/20260615090000_advanced_operations_foundation exists.
- Migration SQL was reviewed as additive-only for the advanced-operations tables/enums/indexes/foreign keys.
- Staging/pilot migration deployment remains pending; do not claim production-ready until staging migration and pilot checks pass.
```

Current product readiness:

```text
Demo-ready: Yes
Internal QA-ready: Yes
Controlled pilot-ready: Yes, after staging/pilot checks
Multi-school production-ready: Not yet
Full KG-12 SchoolOS product complete: No
```

---

## Edge Case Hardening Checklist

The detailed source of truth for edge cases remains the PRD and FRS module sections. This repo-level checklist must be used before claiming controlled pilot readiness, production readiness, or module completion.

### Global edge cases

- Every tenant-owned database query, file lookup, export, report, queue job, cache read, and background retry must be scoped by authenticated `tenantId`.
- School A must never access School B students, guardians, staff, fees, receipts, payroll, files, reports, notices, transport, canteen, library, learning, or analytics data.
- Same names, phone numbers, admission numbers, receipt numbers, file names, payment references, QR identifiers, activity codes, or session codes across tenants must never cause cross-tenant leakage.
- Suspended tenants must be blocked across dashboard, API, mobile, background jobs, file downloads, report generation, exports, provider actions, and learning sessions.
- Disabled feature routes must fail closed even if opened directly by URL.
- Parent, student, driver, and mobile APIs must be purpose-limited and must not expose admin-shaped responses.
- Expired sessions, slow network retries, refreshes, and double-clicks must not duplicate writes.
- Long forms should preserve drafts where practical and recover safely after login/session renewal.
- Offline or reconnect sync must show deterministic conflict handling instead of silently overwriting server data.
- Background jobs must re-check tenant status, feature status, entity status, permission state, and provider state before executing.
- Retried jobs must not duplicate payments, receipts, messages, notices, reports, exports, payroll postings, accounting entries, canteen/library transactions, or learning attempts.
- Failed jobs, failed exports, failed storage operations, and failed provider actions must expose safe diagnostics without secrets.
- Sensitive actions must be audited with actor, tenant, timestamp, reason, and before/after context where practical.

### Authentication, role, and access edge cases

- Parent can only access currently linked children.
- Guardian removal or replacement must immediately revoke old parent access to child data, messages, files, notices, receipts, report cards, media, and learning summaries.
- Student can only access their own allowed records.
