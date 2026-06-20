# SchoolOS Module Design Catalog

**Status:** Canonical MDD catalog
**Owner/audience:** CTO, product manager, module leads, backend/web/mobile leads, QA, security, support/operations
**Scope:** Active M0-M14 module ownership, stage applicability, module boundaries, cross-module rules, code-evidence gap matrix, and stage-aware implementation roadmap.
**Precedence:** Module ownership and architecture boundaries live here. Functional details remain in `../product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md`; product intent remains in `../product/SCHOOLOS_PRODUCT_REQUIREMENTS.md`; implementation sequencing remains in `../project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md`; current readiness remains in `../project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md`.
**Inputs/source documents:** `../product/SCHOOLOS_BRD.md`, `../product/SCHOOLOS_PRODUCT_REQUIREMENTS.md`, `../product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md`, `../product/SCHOOLOS_BACKEND_WEB_MOBILE_FEATURE_ALLOCATION.md`, `SCHOOLOS_ARCHITECTURE_AND_SECURITY.md`, `SCHOOLOS_NOTIFICATION_ARCHITECTURE.md`, `SCHOOLOS_PLATFORM_OPERATIONS.md`, `../requirements/SCHOOLOS_SRS.md`, repository source inspected on 2026-06-20.
**Out-of-scope content:** Endpoint URL invention, Prisma migrations, code changes, sprint tasks not in the next-phase plan, and GA readiness claims.
**Last reviewed date:** 2026-06-20

---

## 1. Module Taxonomy

| Module | Name | Canonical owner |
|---|---|---|
| M0 | Platform Core | Tenancy, plans, modules, users/RBAC, support override, File Registry, providers, queues, settings, audit, platform operations. |
| M1 | Admissions and Student Profiles | Student, guardian, enrollment, lifecycle, documents, QR/ID, admission cases, duplicate review, iEMIS readiness. |
| M2 | Smart Attendance | Student/staff attendance, sessions, drafts, corrections, registers, anomalies, attendance alerts. |
| M3 | Fees and Receipts | Fee plans, invoices, payments, receipts, refunds, reversals, cashier close, parent fee visibility. |
| M4 | Academics, Exams, CAS, Report Cards | Subjects, teacher assignments, exams, marks, CAS, report cards, promotion, +2 academic extensions. |
| M5 | Activity Feed and Milestones | Activity posts, media, consent, observations, milestones, parent feed, moderation. |
| M6 | Homework and Timetable | Homework, submissions, timetable, substitutions, conflict detection, teacher workload. |
| M7 | HR and Payroll | Staff records, contracts, leave, attendance, payroll, payslips, staff self-service. |
| M8 | Library | Catalogue, copies, circulation, reservations, fines, labels, library reports. |
| M9 | Transport | Routes, stops, vehicles, drivers, assignments, trips, boarding/deboarding, status/GPS readiness. |
| M10 | Canteen | Menu, meal plans, wallet/POS, serving, allergy warnings, stock/vendor workflows. |
| M11 | Accounting and Finance | Chart of accounts, journals, vouchers, fiscal locks, reconciliation, accounting reports. |
| M12 | Notifications, Notices, Communication, Chat | Event intake, recipient resolution, templates, preferences, delivery, retries, read state, notices, chat, moderation. |
| M13 | Learning Layer | Teacher activities, smart-board, lab/session mode, attempts, progress, resources, parent summaries. |
| M14 | Intelligence / AI | Deferred roadmap only. |

`M8A`, `M8B`, and `M8C` are obsolete. Inventory & Asset Management is not active scope.

## 2. Module And Stage Matrix

| Module | `PRESCHOOL` | `SCHOOL` Grade 1-10 | `HIGHER_SECONDARY` Grade 11-12 |
|---|---|---|---|
| M0 Platform Core | Required | Required | Required |
| M1 Admissions and Student Profiles | Required, with guardians/emergency/pickup expansion | Required | Required, with stream/program context proposed |
| M2 Smart Attendance | Required, arrival/absence/checkout proposed | Required | Required, theory/lab attendance detail proposed |
| M3 Fees and Receipts | Required | Required | Required |
| M4 Academics, Exams, CAS, Report Cards | Light milestones only by default | Required | Required, streams/combinations/practicals/projects proposed |
| M5 Activity Feed and Milestones | Required, consent-safe activity/milestone focus | Optional/required by school policy | Optional/required for updates/projects |
| M6 Homework and Timetable | Light/optional | Required | Required, theory/lab timetable proposed |
| M7 HR and Payroll | Required for staff coverage | Required | Required |
| M8 Library | Usually optional | Common | Common |
| M9 Transport | Where enabled | Where enabled | Where enabled |
| M10 Canteen | Optional, allergy-safe serving where enabled | Where enabled | Where enabled |
| M11 Accounting and Finance | Optional/advanced | Optional/advanced | Optional/advanced |
| M12 Notifications, Notices, Communication, Chat | Required, parent trust and safety | Required | Required |
| M13 Learning Layer | Teacher-led/screen-light only | Teacher-led/lab/session | Lab/project support where approved |
| M14 Intelligence / AI | Deferred | Deferred | Deferred |

## 3. Cross-Module Design Rules

1. `tenantId` is the tenant boundary for modules, jobs, files, exports, reports, notifications, cache, mobile, and learning.
2. Backend authorization and module entitlement are authoritative.
3. Files follow `Feature module -> FileRegistryService -> StorageService -> StorageAdapter`.
4. Money modules use backend/database totals, idempotency, audit, and reversal/correction.
5. M12 owns notification delivery; source modules emit normalized events only.
6. M13 remains separate and reuses core students, staff, classes, subjects, timetable, communication, files, RBAC, and audit.
7. M14 is roadmap-only and must not be implemented as incidental analytics or AI inside another module.

## 4. Module Design Catalog

| Module | Current code evidence | Stage-aware design note | Key gaps |
|---|---|---|---|
| M0 Platform Core | Platform, plans, tenants, settings, File Registry, reports, support override, provider, queue code exists. | Owns tenant program offerings, module entitlement, platform provider readiness, and experience-pack enablement when designed. | Program offering and experience capability schema is proposed. Staging/provider/backup proof missing. |
| M1 Admissions and Student Profiles | Student, guardian, enrollment, admissions, documents, QR/ID, lifecycle code and schema exist. | Shared student/enrollment record must classify program/stage without separate student systems. Preschool needs emergency/pickup depth; +2 needs stream enrollment context. | Authorized pickup contacts, temporary pickup changes, and program/stage fields need schema/API design. |
| M2 Smart Attendance | Attendance sessions, records, drafts, corrections, registers, teacher mobile endpoints, staff attendance exist. | Preschool arrival/late/absence/checkout must extend attendance without replacing it. +2 lab/practical attendance may need timetable context. | Pickup/drop exceptions and preschool checkout are not verified. Offline mobile attendance sync needs continued idempotency proof. |
| M3 Fees and Receipts | Fee heads/plans/invoices/payments/receipts/refunds/reversals/cashier close and parent mobile fee surfaces exist. | Same ledger supports all stages; preschool invoices may be monthly/simple, +2 may include stream/lab/project fees. | Staging provider/payment proof and seed/pilot financial smoke missing. |
| M4 Academics, Exams, CAS, Report Cards | Academic years/classes/sections/subjects, exams, assessment components, marks, CAS, report cards, promotion records exist. | Grade 1-10 owns normal exams/report cards; Preschool defaults to supportive milestones, not heavy exams; +2 needs configurable streams, combinations, practicals/projects. | Stream/combination/practical/project lifecycle needs schema, API, OpenAPI, web/mobile, tests. |
| M5 Activity Feed and Milestones | Activity posts, attachments, tagged students, reactions, mood logs, developmental milestones, stage-filtered templates exist. | Preschool P0 surface: activity diary, simple observations, consent-safe photos, supportive milestones. | Preschool-specific policy, media consent enforcement in browser/mobile, and pickup-linked updates need verification/design. |
| M6 Homework and Timetable | Homework, submissions, attachments, reminders, periods, rooms, versions, slots, substitutions, workload limits exist. | School Grade 1-10 and +2 are primary; Preschool uses light parent updates or teacher notes only where policy enables. | +2 theory/lab/practical timetable composition and stream filters need design. |
| M7 HR and Payroll | Staff, contracts, attendance, leave, salary structures, payroll, payslips, staff self-service exist. | Preschool needs classroom/staff coverage and care-alert visibility for authorized staff. | Staff coverage dashboard by experience/program needs backend summary design. |
| M8 Library | Library catalogue, copies, issues, fines, reservations, settings, reports exist. | Mostly School/+2; Preschool optional for classroom libraries. | Parent/mobile library depth and scanner/device proof pending. |
| M9 Transport | Routes, stops, vehicles, driver assignments, enrollments, trips, statuses, GPS pings exist. | Parent child-route scope applies to all stages; preschool pickup handover must not be confused with transport trips. | Live map/provider/load proof missing; pickup exception workflow belongs outside transport unless designed. |
| M10 Canteen | Menu, meal plans, enrollments, wallet, serving, POS, suppliers, inventory, stock movement exist. | Preschool can use allergy-safe serving where enabled, but mandatory meal/nap/toileting logs are not default scope. | Mobile/POS device proof and wallet/payment staging proof pending. |
| M11 Accounting and Finance | Chart accounts, journals, periods, fiscal years, reports, bank statements, mappings exist. | Shared accounting receives approved source events; it is not a stage-specific ledger. | End-to-end live reconciliation and backup/restore proof missing. |
| M12 Notifications, Notices, Communication, Chat | Communications, notification center, deliveries, notices, consents, parent-teacher messaging, delivery retry services exist. | Preschool parent trust, School communications, and +2 board-readiness notices all route through M12. | Provider sandbox/staging proof, callback robustness, and device push proof pending. |
| M13 Learning Layer | Learning activities, sessions, participants, attempts, progress, resources, parent summaries exist. | Preschool remains teacher-led/screen-light; School uses classroom/lab; +2 can support lab/project resources after approval. | Device/browser/staging proof pending; no AI tutor/adaptive runtime. |
| M14 Intelligence / AI | No active runtime should be added. | Deferred for all stages. | Requires future privacy, safety, review, cost, data-quality, and audit design. |

## 5. Stage-Aware Structures: Existing Evidence And Recommended Ownership

| Structure | Existing model/evidence | Gap | Recommended owner | Migration impact | Security/API/Web/Mobile/Test impact |
|---|---|---|---|---|---|
| Tenant program offering | Tenant, plan, entitlements, module enablement exist. | No canonical `PRESCHOOL`/`SCHOOL`/`HIGHER_SECONDARY` offering model verified. | M0 Platform Core with M1/M4 consumers. | New tenant-scoped model/indexes likely. | Backend resolver, OpenAPI/core DTO, web settings, mobile projection, tenant/module tests. |
| Class experience profile | `Class.name`, `Class.level`, `Section.capacity` exist. | No stage/program field verified. | M0/M4 academic structure. | Backfill from class levels/names may be needed. | Web academic settings and ExperienceContext; teacher/principal/mobile filters; cross-stage assignment tests. |
| Active enrollment stage | `Enrollment` links student/year/class/section. | No program/stage/stream link verified. | M1 with M4 academic policy. | Migration/backfill required after program/class profile design. | Parent child switch, teacher assigned context, reports, student lifecycle tests. |
| +2 stream / subject combination | `Subject.hasPractical`, theory/practical marks, assessment components exist. | No stream/combination model verified. | M4 Academics. | New models and uniqueness/index rules likely. | OpenAPI/core contracts, web setup, report cards, parent/student views, migration replay tests. |
| Practical/project tracking | Exam components and report cards exist. | No separate project/practical lifecycle verified. | M4 Academics, File Registry for evidence. | New models or extension of assessment components needs design. | Teacher assignment scope, protected evidence files, publication workflow, tests. |
| Preschool pickup/drop | Attendance and transport exist; student emergency fields exist. | No authorized pickup, temporary pickup change, checkout exception model verified. | M1/M2 with M12 notifications; M9 only for transport trips. | New models/indexes likely. | Parent app, teacher/admin web, audit, notification, child-safety tests. |
| Care/allergy visibility | Student medical/allergy fields and canteen allergy warnings exist. | Stage-specific care-alert permission boundary needs verification/design. | M1 data owner; M10 serving; M7 staff coverage. | May need structured care alert model later. | Narrow RBAC, mobile teacher/admin display, audit/access tests. |
| ExperienceContext | Conceptual only. | No DTO/API/schema verified. | M0 Platform Core with all modules consuming. | Depends on offering/profile/enrollment design. | Contract-first implementation, web/mobile shell composition, permission tests. |

## 6. Code-Evidence Gap Matrix

| Finding | Classification | Evidence | Recommendation |
|---|---|---|---|
| Single shared core exists for students/guardians/enrollment/classes/subjects/modules. | IMPLEMENTED_UNVERIFIED | Prisma schema and NestJS modules. | Keep as foundation; verify with seed, browser, mobile, staging, and tenant-scope tests. |
| Three experience packs are not implemented as a backend-owned resolver. | PROPOSED | No program-offering or ExperienceContext contract found. | Design schema/contracts after current smoke/staging blockers; do not fake in UI. |
| Preschool activity/milestone foundation exists. | IMPLEMENTED_UNVERIFIED | M5 schema/services include activity posts, media, milestones, stage-filtered templates. | Verify consent-safe parent/media behavior and define preschool classroom diary UX. |
| Preschool pickup/drop and authorized pickup are absent as verified code. | NEEDS_SCHEMA_DESIGN | No dedicated pickup/handover models found. | Design M1/M2/M12-owned workflow with audit, reason, expiry, and mobile/web surfaces. |
| School Grade 1-10 operational modules broadly exist. | IMPLEMENTED_UNVERIFIED | API/web/mobile surfaces and tests recorded in audit. | Focus on pilot seed, authenticated browser E2E, mobile device QA, staging proof. |
| +2 practical marks have partial foundation. | IMPLEMENTED_UNVERIFIED | `Subject.hasPractical`, theory/practical marks, assessment components. | Confirm contracts and report-card behavior before expanding UI. |
| +2 streams/subject combinations/projects are not verified. | NEEDS_SCHEMA_DESIGN | Docs mention future scope; schema lacks stream/combination/project lifecycle. | Design school-configurable M4 structures and migration/index plan. |
| Parent/teacher/principal mobile surfaces exist. | IMPLEMENTED_UNVERIFIED | Flutter route tree and mobile controllers/repositories. | Device QA against live seeded backend remains required. |
| Safe file architecture exists. | IMPLEMENTED_UNVERIFIED | File Registry service/controller and web protected-file helpers. | External storage/provider/staging verification remains required. |
| GA readiness is not achieved. | DOCUMENTED_ONLY | Readiness audit records missing staging, provider, browser auth, mobile device, smoke, backup/restore, pilot proof. | Keep current release stage Internal QA ready. |

## 7. Prioritized Implementation Roadmap

This roadmap does not replace `../project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md`; it adds stage-aware architecture dependencies.

| Priority | Work | Required proof |
|---|---|---|
| P0 | Preserve current evidence-based release posture and complete smokeable seed/browser/mobile/staging gates from the next-phase plan. | `pnpm smoke:pilot`, authenticated browser E2E, mobile device QA, staging migration/provider/backup evidence. |
| P1 | Design backend-owned `ExperienceContext` and program/stage data model without code changes in this pass. | Architecture decision, Prisma design, OpenAPI/core DTO plan, RBAC/tenant tests, migration/backfill plan. |
| P1 | Preschool safety design: authorized pickup, temporary pickup change, arrival/checkout, pickup exceptions, care-alert permission boundaries. | Schema/API/UX/test design reviewed by security/product; no runtime claim until implemented. |
| P1 | Higher Secondary design: streams/programs, subject combinations, lab/practical timetable, practical/project tracking. | Configurable schema/API design, M4 ownership, report-card/reporting impact, migration/index plan. |
| P2 | Stage-aware web dashboard composition over one shared shell. | Backend context contract, web route state tests, no fake totals, authenticated browser proof. |
| P2 | Stage-aware mobile context switch for parent/teacher/principal. | Purpose-limited DTOs, device QA, offline/read-cache boundaries, child/assignment scope tests. |
| P3 | Stage-aware reporting and operational analytics. | Server-owned summaries, pagination/index proof, queued reports, File Registry exports. |
| Deferred | M14 Intelligence / AI. | Separate future approval after production-quality data, safety, privacy, human review, cost, and audit controls. |

