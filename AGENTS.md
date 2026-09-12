# SchoolOS Repository Source of Truth

This file is the single repository-wide source of truth for durable SchoolOS product, architecture, security, data, UX, release, and engineering rules.

## Authority and precedence

- `AGENTS.md` is the only tracked Markdown policy/documentation file permitted in this repository.
- The running code, Prisma schema and migrations, generated contracts, configuration, tests, and CI are the authority for what is actually implemented. This file defines what the repository is expected to preserve and prove.
- Historical design documents, audits, implementation plans, evidence notes, READMEs, wireframes, and nested agent files were consolidated into this document and removed from the working tree. Git history remains the archive.
- Do not infer implementation completion from prose. Verify the relevant code, migration, tests, and current CI result.
- If a durable rule changes, update this file in the same change. Do not create another Markdown specification.

# 1. Product direction

SchoolOS is a Nepal-first school operating system for Nepalese schools. The active product roadmap is strictly Nepal-scoped unless an explicit future roadmap changes this decision.

The delivery sequence is:

1. P0 — safety, correctness, auditability, controlled-pilot readiness.
2. P1 — operational maturity and broader Nepal market readiness, only after P0 passes.
3. P2 — Nepal-wide scale, multi-branch and institutional readiness, only after P1 passes.

P0 is the governing priority while any P0 release gate remains open. Feature breadth must not take priority over safety, correctness, tenant isolation, financial integrity, recovery, or reproducible evidence.

During P0, avoid new expansion work on M8 Library, M9 Transport, M10 Canteen, M13 Learning, open chat/conversations, international curricula, OneRoster/LTI, foreign compliance, or nonessential redesigns. Existing implementation may remain when safely disabled or isolated; do not remove working domain code merely to satisfy roadmap ordering.

Chat/conversations are removed from the active product. M15 owns official notices and announcements. M12 owns notification delivery, retries, provider state, acknowledgement, and delivery diagnostics.

# 2. Repository architecture

Canonical application surfaces:

- `apps/api` — NestJS API and authoritative server-side business rules.
- `apps/web` — Next.js tenant-facing school web application.
- `apps/schoolos_mobile` — Flutter Parent, Teacher, and Principal mobile application.
- `packages/core` — shared contracts, permissions, entitlements, date/localization primitives, and cross-surface types.
- PostgreSQL/Prisma — authoritative persistence and migrations.
- Redis/queues/providers — operational infrastructure where configured by the implementation.

Avoid broad rewrites of this architecture. Prefer bounded changes that preserve working contracts and security boundaries.

## Platform control plane versus school application

The SchoolOS Platform and a school's management system are separate security/application domains even if they share a monorepo, infrastructure, or selected services.

- Platform operators manage the SaaS/control plane: tenants, entitlements, platform operations, provider configuration, releases, compliance policy distribution, security/support operations, and cross-tenant platform audit.
- School personas operate only within a tenant and their own assigned scope.
- A Principal or school Admin is never a Platform Operator merely because they have high privilege inside a school.
- Platform capabilities must not be represented as a hidden extension of ordinary school roles.
- Keep `/platform/*`, school dashboard routes, and school settings responsibilities explicitly separated.
- A separately deployed platform frontend is the preferred long-term control-plane boundary when practical.

Support access into tenant data must be exceptional, reason-bound, scoped, time-limited, auditable, and preferably read-only by default. Never provide an unrestricted permanent "developer can see everything" mode.

# 3. Canonical module taxonomy

The established module taxonomy is M0–M15, with M14 excluded and M13 preserved but frozen unless explicitly reactivated.

- M0 Platform Core
- M1 Admissions and Student Profiles
- M2 Smart Attendance
- M3 Fees and Receipts
- M4 Academics, Exams, CAS, Report Cards
- M5 Activity Feed and Milestones
- M6 Homework and Timetable
- M7 HR and Payroll
- M8 Library
- M9 Transport
- M10 Canteen
- M11 Accounting and Finance
- M12 Notifications and Delivery
- M13 Learning Layer — frozen/disabled by default
- M15 Notices and Announcements

These exact product names are canonical markers: M1 Admissions and Student Profiles; M2 Smart Attendance; M3 Fees and Receipts; M4 Academics, Exams, CAS, Report Cards; M5 Activity Feed and Milestones; M6 Homework and Timetable; M7 HR and Payroll; M8 Library; M9 Transport; M10 Canteen; M11 Accounting and Finance; M12 Notifications and Delivery; M15 Notices and Announcements.

# 4. Persona and surface boundaries

- Parent/Guardian: mobile-first linked-child self-service only.
- Teacher: web and mobile, strictly assignment/capability scoped.
- Admin: web, school configuration and operations within one tenant.
- Principal: web and mobile, oversight, attention items, controlled approvals, and school-level reporting.
- HR: web, staff administration and payroll scope.
- Accountant: web, fees, reconciliation, accounting, finance reporting and permitted payroll posting scope.
- Platform Operator: separate control-plane identity and capability domain.

Mobile is not a shrunken copy of the web application. Mobile owns frequent, time-sensitive, persona-specific workflows. Web owns configuration, bulk processing, dense tables, high-risk changes, governance, complex corrections, exports, and administrative operations.

Navigation visibility is never authorization.

# 5. Non-negotiable security invariants

## Tenant isolation

Every school-owned record and action must be constrained by authenticated/trusted tenant context.

- Never trust a client-supplied `tenantId` as authorization context.
- Tenant scope applies to controllers, services, repositories, queries, files, exports, queues, background jobs, notification resolution, reports, caches, and synchronization.
- Cross-tenant identifiers must fail without disclosing another tenant's data.
- A suspended tenant, unavailable entitlement, disabled entitlement, missing entitlement, or failed entitlement lookup is deny-by-default.
- Module hiding in the UI is not a security control; enforce at API/service/job/export/file/sync boundaries.

## Authorization model

Authoritative operations use explicit capability checks plus resource scope. Do not rely on a generic role condition such as `role === TEACHER` for authoritative writes.

Teacher writes must match the active assignment dimensions relevant to the operation, including tenant, academic year, class, section, subject, period, assessment, and assessment component as applicable.

Examples of durable capability concepts include homeroom attendance marking, period attendance marking, subject homework write, subject marks write, class academic overview, class-teacher remark write, result review, result publish, and marks unlock.

A class-teacher assignment can grant class overview/homeroom duties; it does not grant write authority over every subject.

## Guardian access

Parent access requires an active, verified guardian relationship for the selected student and tenant, the required relationship capability, valid effective dates, and no applicable restriction.

Guardian relationships must support capability distinctions such as academic visibility, attendance, fees, documents, pickup authority, emergency authority, and legal/custody restrictions. Revocation or suspension must take effect immediately at the server and must invalidate inaccessible cached data on clients.

## Sensitive data and protected files

Apply least privilege and need-to-know controls to medical data, disability/support data, custody restrictions, safeguarding records, identity documents, salary/bank information, and other protected records.

- Enforce file authorization on each access, not only when a link is generated.
- Audit sensitive access where required.
- Respect consent and media-consent state.
- Revoke staff/guardian/session access promptly.
- Do not place sensitive content in lock-screen notification previews.

# 6. Authentication and mobile security

Parent, Teacher, and Principal mobile users may use optional device biometrics after a successful credential login.

- Prompt after the first successful login when supported.
- The user may skip and enable biometrics later in Settings.
- Always retain a secure credential/password fallback.
- Use device secure biometric facilities only as local unlock; never collect or store raw fingerprint/face templates.
- Logout, session revocation, tenant/school switch, assignment removal, guardian revocation, and account disablement must purge or make inaccessible any now-unauthorized local data.

# 7. P0 implementation order

Complete and prove these gates in order of risk:

1. Authorization, fail-closed entitlements, and tenant isolation.
2. Student/guardian relationship correctness.
3. Attendance write correctness.
4. Academic/marks authorization and result integrity.
5. Versioned Nepal Compliance Profile.
6. IEMIS readiness and reproducible export.
7. Fee, receipt, payment, and M11 posting integrity.
8. Privacy, safeguarding, consent, and protected files.
9. Offline/synchronization correctness.
10. Backup, restore, clean migration, and operational recovery evidence.
11. Nepal localization and BS/AD correctness.
12. Controlled-pilot certification from an exact release SHA.

Do not use completion of a later feature to waive an earlier gate.

# 8. M2 attendance invariants

Canonical lifecycle:

Draft -> Submitted -> Finalized/Locked -> Correction Requested -> Approved/Reopened -> Corrected -> Re-locked.

Required behavior:

- Homeroom writes require homeroom authority.
- Period writes require the exact active period/class/section/subject authority.
- Roster access is assignment scoped.
- Submissions and offline replay are idempotent.
- Original and corrected values remain auditable.
- Corrections require reason and elevated reopening authority where configured.
- Locked records cannot be silently edited.
- Parent visibility is based on authoritative/finalized state.
- Corrected events produce corrected downstream notifications when appropriate.
- Removing an assignment immediately removes write authority and invalidates stale local scope.

# 9. M4 academics, marks, results, and report cards

Marks writes must be scoped to the exact active assignment and relevant tenant/year/class/section/subject/assessment/component.

Canonical state concepts include:

Draft -> Submitted -> Returned -> Resubmitted -> Reviewed -> Locked -> Published -> Withdrawn/Corrected -> Republished.

- Class teachers may receive completion visibility without authority to edit other teachers' marks.
- Result publication and marks unlock are separate elevated capabilities.
- Unlock/reopen actions require explicit reason and audit history.
- Parents must never receive draft/unpublished results.
- Corrected published results preserve prior versions and publication history.
- Report cards and academic documents are protected files.

# 10. Offline and synchronization policy

SchoolOS must remain useful under poor or absent connectivity, but offline capability does not override authoritative safety or external regulatory requirements.

P0 offline-safe operations are intentionally bounded:

- attendance drafts,
- homework drafts,
- activity drafts,
- cached timetable,
- cached assigned roster,
- read-only notices,
- read-only notifications.

Do not allow high-risk authoritative mutations offline during P0, including:

- fee payments or cashier close,
- accounting journals/posting decisions,
- payroll finalization,
- result publication,
- marks unlocking,
- guardian relationship changes,
- role/permission/entitlement changes,
- institution/compliance configuration,
- government export approval/submission.

Synchronization must carry durable operation identity and version/authorization context as supported by the implementation. Replays must be idempotent. Conflicts must be visible and resolvable. Do not use silent "last write wins" for attendance, marks, finance, guardian relationships, or protected student information.

# 11. Financial integrity: M3, M7, and M11

M11 is the authoritative accounting layer. M3 Fees/Receipts and M7 Payroll hand off controlled, idempotent accounting events into M11.

Non-negotiable rules:

- Server-generated durable financial identifiers.
- Idempotency for payment creation, callbacks, retries, and subledger-to-ledger posting.
- Provider callbacks must be authenticated/verified as required by the integration.
- Pending/unconfirmed payments do not silently become paid.
- Receipt and invoice sequence integrity.
- Issued/posted financial documents and ledger history are immutable in business meaning: do not destructively delete or rewrite history.
- Correct through reversal, refund, credit note, debit note, adjustment, or replacement records with explicit lineage.
- Failed/unposted accounting events remain visible and retryable.
- Cashier sessions and day close reconcile expected versus actual amounts.
- Reconciliation discrepancies remain explicit until resolved.
- Financial reporting must drill down from statement -> account -> ledger -> journal/voucher -> source transaction -> approval/document/audit event.

Do not claim statutory, tax, payroll, CBMS, or IRD compliance merely because calculations or document formats exist in code.

# 12. Nepal IRD and fiscal compliance

Nepal fiscal policy is effective-dated configuration/evidence, not scattered constants.

- Model rule authority, legal/gazette reference, effective period, applicability, rates/exemptions, status, and evidence.
- Historical transactions continue to use the policy valid for their transaction/document date.
- Distinguish ordinary SchoolOS accounting/billing capability from official IRD electronic-billing enlistment/approval.
- Distinguish a locally recorded school transaction from external fiscalization/CBMS confirmation state.
- Never state an external IRD submission succeeded while that authority/provider was unavailable.
- If a tenant requires online fiscalization at document issue time, offline operation must not fabricate compliance.
- Any taxpayer incentive/prize integration must rely on an authorized interface and IRD-issued status/reference; SchoolOS must not invent coupon codes.

# 13. Nepal education compliance and IEMIS

Do not hard-code mutable Nepal education rules throughout application code. Use versioned/effective-dated policy models and explicit evidence.

The Nepal compliance layer must be capable of representing institution regulatory records, curriculum/assessment/grading/promotion policy versions, government field/export schema versions, jurisdiction/effective dates, review/approval state, and evidence.

IEMIS readiness begins with reproducible export, not an unsupported direct synchronization claim.

Required export properties:

- official school identifier and validated source data,
- schema/version awareness,
- required-field and data-quality validation,
- exact immutable source snapshot for a batch,
- checksum/identity of the exported batch,
- reviewer/approval state,
- submission/status record where applicable,
- correction/re-export lineage.

Do not claim direct CEHRD/IEMIS API synchronization unless an officially authorized interface exists and is configured.

# 14. Nepal localization

Preserve Nepal-specific correctness across every surface:

- Nepali Unicode and English,
- Asia/Kathmandu behavior,
- NPR formatting,
- Nepal phone/address validation,
- province, district, local level, and ward hierarchy,
- BS and AD display where required,
- canonical unambiguous server-side date/time storage,
- Nepal academic/fiscal labels and effective periods.

Never implement BS dates as ambiguous strings for authoritative storage.

# 15. UX and accessibility rules

SchoolOS UI is role-aware and task-oriented, not a collection of desktop web screens squeezed into mobile.

- Preserve a shared design language for typography, spacing, controls, states, and navigation.
- Prefer server-authoritative persona projection and permissions; client composition is presentation, not authorization.
- Every important workflow must handle loading, empty, error, unauthorized, disabled-module, expired-session, stale-data, and retry/conflict states where applicable.
- High-risk or dense configuration belongs on web unless there is a specific safe mobile use case.
- Mobile primary actions should support frequent one-handed daily work.
- Target WCAG 2.2 AA principles across priority web flows and equivalent mobile accessibility: labels, keyboard/focus, screen readers, touch targets, text scaling, contrast, reduced motion, non-color-only status, and accessible validation/authentication.
- Old wireframes/design documents are not authority. Verify current components/tokens and improve the implementation directly.

# 16. Release and quality gates

`main` is expected to be green. Never describe a commit as pilot-ready or production-ready solely from prior evidence files.

Canonical Node/web/API gates are defined by current CI/package scripts and include, as applicable:

- generated-artifact compilation,
- deploy environment validation,
- tracked-artifact validation,
- Prisma generation and validation,
- OpenAPI verification,
- lint/format checks,
- core import/distribution checks,
- core/API/web typecheck,
- unit tests,
- API E2E/integration tests,
- production builds,
- web E2E smoke tests.

Mobile-impacting changes must pass current Flutter formatting, analysis, and tests under the repository's pinned CI toolchain.

Security/release evidence must also prove the relevant invariants:

- cross-tenant denial,
- parent/guardian linked-child denial cases,
- teacher assignment/capability denial cases,
- platform/school-domain isolation,
- protected-file authorization,
- stale/revoked authorization behavior,
- offline replay/conflict behavior,
- payment/receipt/posting idempotency,
- refund/reversal lineage and reconciliation,
- IEMIS/localization correctness,
- clean database migration and seed where applicable,
- backup and restore into an isolated clean environment,
- post-restore integrity/smoke verification.

A release decision must identify the exact Git SHA and current results. Historical local/staging evidence may inform investigation but never overrides a failing current gate.

# 17. Universal Definition of Done

A feature or P0 item is not complete until all applicable layers are complete and verified:

- data model/migration,
- domain/service implementation,
- API authorization and validation,
- web/mobile workflow,
- bounded offline behavior where relevant,
- audit events,
- notifications or downstream effects where relevant,
- loading/empty/error/denied/conflict states,
- unit tests,
- integration/E2E tests,
- cross-tenant and persona/resource-scope tests,
- accessibility checks for user-facing flows,
- OpenAPI/shared-contract alignment,
- clean migration/recovery impact where relevant,
- reproducible current evidence and known limitations.

Do not mark work complete because the happy path compiles.

# 18. Database and engineering rules

- The backend is the source of truth for authoritative business rules; never trust client totals, roles, tenant IDs, authorization decisions, or financial calculations.
- Authentication and authorization are separate concerns.
- Use transactions for multi-record invariants and financial state transitions.
- Add database constraints/unique indexes for invariants that can be enforced safely at persistence level.
- Avoid N+1 patterns, unbounded queries, and full-table client-side projection.
- Paginate and project large datasets.
- Use queues/background jobs for long-running work without moving authorization or tenant context out of scope.
- Retrying non-idempotent financial or authoritative operations is forbidden unless a durable idempotency strategy exists.
- Schema changes require migrations; do not manually patch production databases as the deployment strategy.
- Preserve backward compatibility deliberately when shared API/mobile contracts require it; otherwise remove dead compatibility only with tests.
- No secrets, credentials, production tokens, or private keys in Git. Example environment files contain placeholders only.
- Structured logs should carry request/correlation context without leaking sensitive payloads.
- Timeouts and bounded retries are mandatory for external providers.

# 19. Documentation policy

The repository deliberately uses one tracked Markdown document: `/AGENTS.md`.

Do not add:

- `README.md`,
- nested `AGENTS.md`,
- module/design/audit Markdown files,
- Markdown release trackers,
- Markdown evidence directories,
- Markdown runbooks/checklists.

Put durable cross-repository rules here. Put implementation truth in code/tests/config/schema. Put transient evidence in CI artifacts, issue/PR records, logs, machine-readable generated artifacts, or other approved non-Markdown evidence locations rather than adding a second prose authority.

Local scripts that generate ignored Markdown evidence for human inspection do not make those files repository sources of truth and those outputs must not be committed. Prefer machine-readable or log artifacts when modifying those scripts.

Git history is the archive for the removed documentation corpus. Restore historical prose only for investigation; do not reintroduce it as competing authority.

If external tooling absolutely requires another tracked Markdown file, treat that as a repository-governance exception: justify it explicitly, ensure it cannot contradict this document, and update this policy in the same PR.

# 20. Change discipline for coding agents and contributors

Before changing a domain:

1. Inspect the current implementation, schema, shared contracts, permissions, tests, and relevant current CI behavior.
2. Identify the tenant/persona/resource authorization invariant being changed.
3. Make the smallest coherent end-to-end change.
4. Add negative tests, not only happy-path tests.
5. Preserve audit/history and idempotency where the domain is authoritative.
6. Run the narrow relevant checks, then the repository gates required by impact.
7. Report exact commands/results and remaining limitations in the PR/issue rather than creating a new Markdown report.

Do not silently broaden scope, invent regulatory approval, weaken fail-closed behavior, or substitute client-side hiding for authorization.

# 21. Current readiness language

Unless a current release-candidate SHA has passed all required gates and formal pilot acceptance, describe SchoolOS conservatively as Internal QA / controlled-pilot preparation. Do not inherit a historical "PASS" from deleted evidence documents.

The project objective is to make SchoolOS safe, correct, Nepal-ready, recoverable, and defensible for real-school operation before expanding breadth.