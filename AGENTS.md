# SchoolOS Agent Operating Contract

This root `AGENTS.md` is the **single repository-wide source of truth** for durable SchoolOS product boundaries, architecture invariants, security rules, engineering behavior, roadmap boundaries, verification policy, and autonomous-agent execution behavior.

It is written for autonomous software-engineering agents such as GPT-6 Astra/Codex. Keep it high-signal, explicit, and stable.

---

# 1. Authority and Instruction Precedence

Follow this order:

1. Higher-priority runtime, platform, safety, and tool instructions.
2. The project owner's explicit instruction for the current task.
3. This root `AGENTS.md`.
4. Scoped repository playbooks explicitly recognized by this file.
5. Running code, Prisma schema/migrations, generated contracts, configuration, tests, CI, and Git history as evidence of current implementation.

Important distinctions:

- `AGENTS.md` defines durable repository rules and invariants.
- Code, schema, migrations, configuration, tests, and CI define what is actually implemented now.
- Prose never proves implementation completion.
- A current task may intentionally change a durable rule; when it does, update this file in the same change.
- Do not create another repository-wide Markdown source of truth.
- If repository evidence conflicts with this file, do not silently choose one. Preserve safety, identify the conflict, and resolve it within scope when possible.

## 1.1 Recognized scoped execution playbooks and master roadmap

Exactly three root-level scoped execution playbooks are recognized:

- `SCHOOLOS_RBAC_AUTHORIZATION_IMPLEMENTATION.md` — scoped to authorization architecture and implementation across `apps/api`, `packages/core`, Prisma/migrations, security-sensitive server contracts, and the authorization projections consumed by Web/Mobile.
- `SCHOOLOS_WEB_DESIGN_ASTRA.md` — scoped to `apps/web` and SchoolOS web UX/frontend design.
- `SCHOOLOS_APP_DESIGN_ASTRA.md` — scoped to `apps/schoolos_mobile` and SchoolOS Flutter mobile UX/frontend design.

One coordinated root-level execution roadmap is also recognized:

- `SCHOOLOS_PHASE_WISE_IMPLEMENTATION_MASTER_PLAN_WITH_EDGE_CASES.md` — sequences implementation across authorization, backend contracts, Web, Mobile, finance, offline, governance, testing, and production hardening. It defines phase dependencies, edge-case gates, risk-based verification, and recommended Codex session order. It does not create new product/security authority and must remain subordinate to this `AGENTS.md` and the applicable scoped playbooks.

These files are **specialized execution documents, not independent repository sources of truth**.

Authority is intentionally partitioned:

- `AGENTS.md` defines durable product, security, domain, roadmap, compliance, offline, and verification invariants.
- `SCHOOLOS_RBAC_AUTHORIZATION_IMPLEMENTATION.md` defines how those authorization invariants are implemented: permission vocabulary, typed scopes, policy evaluation, relationship checks, sensitive-data projections, separation of duties, delegation, support access, audit, migration, and authorization testing.
- `SCHOOLOS_WEB_DESIGN_ASTRA.md` defines how authorized capabilities/data are presented and operated on Web.
- `SCHOOLOS_APP_DESIGN_ASTRA.md` defines how authorized capabilities/data are presented and operated on Mobile, including truthful offline/sync UX.

The Web/App playbooks MAY refine:

- visual hierarchy;
- interaction patterns;
- navigation structure;
- page/screen composition;
- responsive/adaptive behavior;
- design-system implementation;
- accessibility details;
- surface-specific visual QA.

The RBAC playbook MAY refine implementation details for:

- permission catalog and naming;
- role templates;
- scope/relationship policy;
- authorization decision contracts;
- field/data projections;
- separation of duties;
- delegation/JIT/support access;
- security audit/observability;
- authorization migration/testing.

No scoped playbook may override this file on:

- Nepal-only roadmap scope;
- module status or product scope;
- canonical personas;
- tenant isolation;
- authentication/authorization invariants;
- financial/accounting integrity;
- privacy/protected data;
- compliance behavior;
- offline safety boundaries;
- backend authority;
- source-of-truth decisions;
- release/verification requirements.

Conflict rules:

1. If any scoped playbook conflicts with `AGENTS.md`, **`AGENTS.md` wins**.
2. If RBAC and a design playbook conflict on access, scope, sensitive data, approval authority, or backend/client responsibility, **the RBAC playbook wins within `AGENTS.md` authority**.
3. If RBAC and a design playbook differ only on presentation/interaction, the relevant Web/App playbook governs that surface.
4. Web and App may intentionally differ when platform-appropriate; neither design playbook has authority over the other surface.

---

# 2. Rule Strength

- **MUST / MUST NOT** — hard invariant.
- **SHOULD / SHOULD NOT** — default engineering policy.
- **MAY** — optional implementation choice.

Security, tenant isolation, financial integrity, authoritative history, protected-data access, fail-closed authorization, and high-risk offline restrictions are MUST-level.

---

# 3. Agent Operating Mode

Bias toward action and completion.

When asked to implement, fix, audit, refactor, harden, migrate, redesign, investigate, prepare a PR, or make SchoolOS production-ready:

1. Read this `AGENTS.md` first.
2. For roadmap/phase implementation, production-readiness programs, or work spanning multiple domains/surfaces, read `SCHOOLOS_PHASE_WISE_IMPLEMENTATION_MASTER_PLAN_WITH_EDGE_CASES.md` and start from the earliest incomplete prerequisite/phase slice.
3. If the task touches authorization, roles, permissions, scopes, entitlements, relationship checks, sensitive-data projection, support access, delegation, exports/search authorization, approval authority, or offline re-authorization, also read `SCHOOLOS_RBAC_AUTHORIZATION_IMPLEMENTATION.md`.
4. If the task touches `apps/web`, also read `SCHOOLOS_WEB_DESIGN_ASTRA.md`.
5. If the task touches `apps/schoolos_mobile`, also read `SCHOOLOS_APP_DESIGN_ASTRA.md`.
6. When a task crosses these boundaries, read **all applicable execution documents before editing** and implement one coherent end-to-end contract rather than separate client/server interpretations.
7. Inspect relevant implementation before editing.
8. Trace affected backend, database, contracts, web, mobile, and tests as required by impact.
9. Infer routine implementation details from repository evidence and existing patterns.
10. Prefer the smallest coherent end-to-end change over speculative redesign.
11. Continue until requested scope is complete, verified, or blocked by a legitimate external dependency.
12. Fix directly related defects when required for correctness.
13. Do not broaden into unrelated cleanup.
14. Never weaken authorization, validation, tests, or quality gates merely to make work pass.

For long-running work, progress updates should be concise and factual.

---

# 4. Decision Hierarchy

When requirements compete, optimize in this order:

1. Security and tenant isolation.
2. Data integrity and auditability.
3. Authorization correctness.
4. Financial and compliance correctness.
5. Privacy and protected-data safety.
6. Recovery and synchronization safety.
7. Functional correctness.
8. Backward compatibility and contract stability.
9. Maintainability and observability.
10. Performance and scalability.
11. UX/accessibility quality.
12. Implementation convenience.

A lower item MUST NOT override a higher one for convenience.

---

# 5. Product Mission and Roadmap Boundary

SchoolOS is a **Nepal-first, multi-tenant school operating system** for Nepalese schools.

Current roadmap:

1. **P0** — safety, correctness, auditability, controlled-pilot readiness.
2. **P1** — operational maturity and broader Nepal market readiness after P0.
3. **P2** — Nepal-wide scale, multi-branch and institutional readiness after P1.

The active roadmap is strictly Nepal-scoped unless the project owner explicitly changes that boundary.

While P0 gates remain open, feature breadth MUST NOT outrank:

- tenant isolation;
- authorization;
- guardian correctness;
- attendance correctness;
- academic integrity;
- financial integrity;
- privacy;
- offline safety;
- compliance correctness;
- backup/recovery;
- reproducible verification.

During P0, do not expand M8 Library, M9 Transport, M10 Canteen, M13 Learning, international curricula, OneRoster/LTI, foreign compliance, or unrelated breadth unless requested work directly resolves a P0 risk.

Existing code for deferred modules may remain safely isolated or disabled.

Chat/conversations are not part of the active product. M15 owns official notices/announcements. M12 owns delivery, retries, provider state, acknowledgements, and delivery diagnostics.

---

# 6. Canonical Repository Architecture

- `apps/api` — NestJS backend and authoritative business rules.
- `apps/web` — Next.js tenant-facing school web application.
- `apps/schoolos_mobile` — Flutter Parent, Teacher, and Principal mobile application.
- `packages/core` — shared contracts, permissions, entitlements, localization/date primitives, and cross-surface types where appropriate.
- PostgreSQL/Prisma — authoritative persistence, constraints, and migrations.
- Redis/queues/providers — operational infrastructure where configured.

Architecture rules:

- Backend services MUST remain authoritative for authorization, financial calculations, state transitions, conflict decisions, and sensitive business rules.
- Clients are presentation and interaction surfaces, not security authorities.
- Client-supplied tenant, ownership, role, permission, totals, or authoritative status MUST NOT be trusted.
- Existing repository/domain patterns SHOULD be preferred before adding new abstractions.
- Broad rewrites SHOULD be avoided when a bounded change preserves contracts and invariants.

---

# 7. Source-of-Truth Matrix

| Concern | Authoritative source |
| --- | --- |
| Authenticated identity | server authentication context |
| Tenant identity | trusted server tenant/auth context |
| Authorization | backend capability + resource-scope checks |
| Database structure | Prisma schema + migrations |
| Persistence invariants | DB constraints/indexes + domain logic |
| Money calculations | backend/domain services with precise monetary types |
| Accounting state | M11 authoritative accounting/ledger records |
| Teacher scope | active authoritative assignment data |
| Guardian scope | active verified guardian relationship + capability |
| Feature entitlement | server entitlement resolution |
| API contract | backend/OpenAPI/shared contracts |
| Compliance policy | versioned/effective-dated authoritative configuration/evidence |
| Education policy/curriculum/grading | versioned/effective-dated Nepal education-policy configuration + evidence |
| Employment terms | effective-dated employment/contract records |
| Teacher professional eligibility | active employment + verified qualification/licence evidence + applicable policy decision |
| HR statutory policy | versioned/effective-dated Nepal HR/legal policy configuration + evidence |
| Payroll statutory inputs | approved effective-dated payroll/HR policy configuration |
| External government authority state | relevant external authority (for example NEB/IEMIS/TSC); SchoolOS stores mappings, submissions, reconciliation and evidence rather than replacing that authority |
| School timezone/day semantics | school configuration; Nepal defaults when appropriate |
| UI composition | client presentation state only |
| Offline cached authorization | never authoritative; re-check on sync |

Fix defects at the authoritative source rather than layering client workarounds over incorrect server state.

---

# 8. Platform Control Plane vs School Application

The SchoolOS Platform/control plane and each school's application are separate security domains.

- Platform Operators manage tenants, entitlements, providers, releases, compliance-policy distribution, support/security operations, and platform audit.
- School personas operate only within one tenant and authorized scope.
- Principal/Admin privilege never implies Platform privilege.
- Platform routes/capabilities MUST remain separate from ordinary school roles and dashboards.
- Support access into tenant data MUST be exceptional, reason-bound, scoped, time-limited, auditable, and read-only by default where possible.
- Never implement a permanent unrestricted “developer can see everything” mode.

The Web design playbook may style Platform surfaces, but visual convenience MUST NOT collapse this security separation.

---

# 9. Canonical Modules and Personas

Canonical modules:

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
- M13 Learning Layer — frozen/disabled by default unless explicitly reactivated
- M15 Notices and Announcements

Canonical persona/surface boundaries:

- **Parent/Guardian** — mobile-first, linked-child self-service only.
- **Teacher** — web + mobile, assignment/capability scoped.
- **Admin** — web, tenant-scoped configuration and operations.
- **Principal** — web + mobile, oversight, attention, controlled approvals, reporting.
- **HR** — web, staff administration and payroll scope.
- **Accountant** — web, fees, reconciliation, accounting, permitted payroll-posting scope.
- **Platform Operator** — separate control-plane identity/capability domain.

Mobile is **not a compressed copy of Web**.

- Mobile SHOULD prioritize frequent, time-sensitive, one-handed persona workflows.
- Web SHOULD own dense configuration, bulk operations, high-risk changes, complex corrections, governance, exports, and administrative workflows unless a safe mobile use case is explicit.

Navigation visibility is never authorization.

---

# 10. Cross-Surface Design Contract

Web and Mobile should feel like one SchoolOS product while remaining platform-native.

Shared across Web and Mobile:

- SchoolOS brand character: calm, precise, trustworthy, modern, operational.
- Canonical terminology and labels for the same business concepts.
- Semantic status meaning.
- Success/warning/error/critical semantics.
- Draft/submitted/finalized/locked/published/reversed/conflicted meanings.
- Nepali + English typography quality.
- Accessibility principles.
- Sensitive-data treatment.
- Loading/error/empty-state language principles.
- Consistent icon meaning where the same concept exists.
- Consistent date/time/currency meaning.
- Consistent identity context for school, user, child, class, and academic year.

Do **not** force pixel-level parity between platforms.

Web MAY use:

- sidebars;
- dense tables;
- multi-column layouts;
- bulk actions;
- desktop-first forms;
- hover/focus patterns;
- high-density dashboards.

Mobile MAY use:

- bottom navigation;
- compact lists;
- bottom sheets;
- one-handed actions;
- gesture-aware interactions;
- adaptive iOS/Android conventions;
- offline/sync status affordances.

A shared concept does not require a shared visual component implementation.

---

# 11. Tenant Isolation and Authorization

Every tenant-owned read, write, file, export, report, cache, queue job, notification resolution, and synchronization operation MUST derive tenant authority from trusted authenticated context.

- Client-supplied `tenantId` MUST NOT determine authorization.
- Cross-tenant identifiers MUST fail without exposing another tenant's data.
- Suspended tenants and unavailable/disabled/missing entitlement state MUST fail closed.
- UI hiding is not a security control.
- Authentication and authorization are separate concerns.
- Sensitive operations require explicit capability checks plus resource scope.

### Teacher scope

Teacher authority MUST match active assignments across relevant dimensions such as tenant, academic year, class, section, subject, period, assessment, or assessment component.

Teacher identity and authority MUST remain separated across these concepts:

```text
Person
→ Employee
→ Employment
→ Teacher Profile
→ Qualification
→ Teaching Licence
→ Professional Eligibility
→ Academic Assignment
→ SchoolOS Permission
```

- A `Teacher` persona/role does not prove employment, qualification, licence, eligibility, assignment, or permission.
- Employment position, organizational responsibility, academic assignment, and SchoolOS authorization are independent concepts.
- Where the applicable effective-dated policy requires qualification/licensing, authoritative teaching writes MUST require active employment, current professional eligibility, and the matching academic assignment.
- An existing assignment MUST NOT override an expired/revoked employment or eligibility condition.
- Professional-eligibility requirements MUST be resolved from the applicable jurisdiction, school type, post/employment type, and policy version rather than one universal hard-coded Nepal rule.
- Homeroom authority does not grant every subject write.
- Subject teaching does not grant homeroom attendance automatically.
- Assignment or eligibility removal MUST remove affected authority immediately and invalidate affected cached/offline scope.

### Guardian scope

Parent access requires an active, verified guardian relationship, applicable capability, valid effective period, matching tenant/student, and no blocking restriction.

- Never substitute a different linked child when requested child access is unauthorized.
- Guardian revocation/suspension MUST take effect immediately server-side and invalidate now-inaccessible local data.

---

# 12. Sensitive Records and Mobile Authentication

Apply least privilege to medical, disability/support, custody/safeguarding, identity documents, salary/bank, and other protected records.

- Authorize every protected-file access.
- Respect consent/media-consent state.
- Audit sensitive access where required.
- Do not expose sensitive content in lock-screen notification previews.
- Revocation MUST promptly render inaccessible any now-unauthorized local data.

Parent, Teacher, and Principal mobile users MAY enable optional device biometrics after successful credential authentication.

- Prompt after first successful login when supported.
- User may skip and enable later.
- Keep secure credential fallback.
- Use OS biometric facilities only; never store raw biometric templates.

---

# 13. Domain Integrity

## M2 Attendance

Canonical lifecycle:

`Draft -> Submitted -> Finalized/Locked -> Correction Requested -> Approved/Reopened -> Corrected -> Re-locked`

Required:

- exact homeroom/period authority;
- assignment-scoped roster;
- idempotent submission/replay;
- preserved original/corrected values;
- reason-bound corrections;
- controlled reopen;
- finalized parent visibility;
- stale assignment write rejection.

## M4 Academics / Marks / Results

Canonical concepts:

`Draft -> Submitted -> Returned -> Resubmitted -> Reviewed -> Locked -> Published -> Withdrawn/Corrected -> Republished`

- Marks writes require exact active assignment/resource scope.
- Class teachers do not gain other teachers' write authority.
- Publication and marks unlock are distinct elevated capabilities.
- Parents MUST NOT see unpublished marks/results.
- Corrected published results preserve prior versions.

## M7 HR / Teacher Professional Eligibility / Payroll

M7 MUST maintain a trustworthy staff/employment foundation before payroll becomes authoritative.

- Person/staff identity, employment, organizational position, contract, professional qualification, teaching licence, eligibility, academic assignment, attendance, leave, compensation, statutory membership, and authorization are separate concepts.
- Employment, contract, compensation, leave-policy and statutory-membership records that affect authoritative outcomes MUST be effective-dated and historically reproducible.
- Qualifications and teaching licences are professional evidence, not permission grants.
- Teacher eligibility decisions MUST reference the applicable policy version/evidence and MUST NOT be inferred from the `Teacher` role alone.
- For teaching staff, approved leave MUST surface academic/timetable impact and substitution requirements; leave approval is not the end of the school-operational workflow.
- Payroll readiness depends on trustworthy employment dates, effective compensation, attendance/leave outcomes, statutory/tax configuration, approval state, and immutable audit history.
- M7 may calculate and approve payroll obligations, but M11 remains the authoritative accounting/ledger layer. Payroll MUST post approved liabilities/expenses into M11 through controlled idempotent accounting events rather than maintain a second ledger.
- Fully validated statutory payroll MUST NOT be enabled merely because a calculation screen exists; applicable policy/rate evidence must be current and approved.

---

# 14. Offline and Synchronization

SchoolOS MUST remain useful with unreliable or absent connectivity without converting stale client state into authority.

P0 offline-safe scope is intentionally bounded to workflows such as:

- attendance drafts;
- homework/activity drafts;
- cached timetable;
- cached assigned roster;
- read-only notices/notifications.

High-risk mutations MUST NOT occur offline during P0, including:

- fee payment/cashier close;
- accounting posting;
- payroll finalization;
- result publication;
- marks unlocking;
- guardian relationship changes;
- role/permission/entitlement changes;
- compliance activation;
- government export approval/submission.

Offline rules:

- cache keys/storage remain tenant + identity + resource scoped;
- sensitive cached data uses secure storage appropriate to platform;
- offline writes use durable operation identity/idempotency;
- sync re-checks current server authority;
- teaching mutations re-check active employment, applicable professional eligibility, and academic assignment when those conditions govern the action;
- employment/licence/eligibility/assignment revocation invalidates affected offline authority and cached sensitive projections;
- conflicts are explicit and resolvable;
- no silent last-write-wins for authoritative sensitive records;
- never serve one user/child/tenant's cached data as fallback for another.

The App design playbook controls how offline/sync state is communicated, but it may not relax these boundaries.

---

# 15. Financial Integrity

M11 is the authoritative accounting layer. M3 Fees/Receipts and M7 Payroll hand off controlled, idempotent accounting events into M11. M7 MUST NOT become a parallel accounting ledger.

Non-negotiable:

- precise monetary types; never floating point for authoritative money;
- server-generated durable financial identifiers;
- idempotent payment creation, callbacks, retries, and posting;
- verified provider callbacks;
- pending/unconfirmed payment is not paid;
- immutable receipt/invoice sequence meaning;
- posted/issued financial history is not destructively rewritten;
- corrections use reversal/refund/credit/debit adjustment/replacement with lineage;
- failed/unposted events remain visible and retryable;
- reconciliation differences remain explicit until resolved;
- multi-record financial transitions use DB transactions where atomicity is required.

Do not claim IRD, tax, payroll, CBMS, or statutory compliance merely because calculations or formats exist.

---

# 16. Nepal Education, HR Policy and Localization

Treat mutable Nepal education, employment, payroll, social-security, tax, local-government and fiscal policy as versioned/effective-dated configuration backed by authoritative evidence, not scattered constants.

Canonical policy resolution MUST support the hierarchy:

```text
National legal/policy baseline
→ Province/local-government profile where applicable
→ School type
→ Academic or employment/post context
→ Employee/student/record-specific effective-dated terms
```

Rules:

- Historical records MUST continue to be interpreted under the policy/curriculum/grading/employment version that applied when the authoritative event occurred.
- A school-level setting MUST NOT silently override a statutory minimum or mandatory national/local requirement.
- Curriculum versions, grading rules, assessment structures, promotion rules, academic calendars, government-reporting mappings, employment policies, leave rules, statutory schemes and payroll rules MUST be modeled so effective dates and evidence can change without rewriting history.
- Nepal school employment MUST NOT be represented as one universal employee policy; applicability may vary by school type, approved/community post status, institutional/private employment, local jurisdiction and employment/post type.
- NEB, IEMIS/CEHRD, TSC and other government bodies remain external authorities for the functions legally assigned to them. SchoolOS may validate, map, export, reconcile and retain submission evidence, but MUST NOT claim to replace those authorities.
- Do not claim live government/API integration, approval, IRD/CBMS status, teacher licensing verification or statutory payroll compliance without authorized current evidence.

Support correctly where applicable:

- Nepali Unicode;
- English;
- Nepal timezone;
- NPR;
- Nepal phone formats;
- province/district/local level/ward;
- BS and AD date presentation with unambiguous canonical storage.

Policy configuration and historical evidence are business records and MUST be auditable, effective-dated and protected from silent destructive overwrite.

---

# 17. Engineering Rules

Prefer:

- small cohesive modules;
- explicit domain boundaries;
- dependency inversion;
- DB constraints for invariants;
- transactions for multi-record consistency;
- idempotency for retriable writes;
- bounded pagination;
- indexed production queries;
- structured logging;
- request/correlation IDs;
- explicit timeout handling;
- reusable design primitives within each client surface.

Avoid:

- controllers containing domain logic;
- business logic duplicated across clients;
- N+1 queries;
- unbounded list endpoints;
- broad swallowed exceptions;
- speculative abstractions;
- duplicate UI systems for equivalent patterns;
- client-only security decisions.

---

# 18. Design-Task Execution Rules

For Web design work:

1. Read this file.
2. Read `SCHOOLOS_WEB_DESIGN_ASTRA.md`.
3. Audit the actual rendered application before broad redesign.
4. Improve shared primitives before duplicating page-specific fixes when appropriate.
5. Preserve backend/security/domain authority.
6. Verify visually and functionally.

For Mobile design work:

1. Read this file.
2. Read `SCHOOLOS_APP_DESIGN_ASTRA.md`.
3. Audit the actual Flutter routes, shared widgets, theme, and persona flows.
4. Improve shared mobile primitives before screen-by-screen duplication when appropriate.
5. Preserve offline/auth/security boundaries.
6. Verify on representative device sizes and affected platforms.

For changes touching both Web and Mobile:

- keep terminology and semantic states aligned;
- preserve platform-appropriate interaction differences;
- do not force one surface's component architecture onto the other;
- verify each surface independently.

---

# 19. Cross-Playbook Coordination and Delivery Gates

The three scoped playbooks MUST work toward one product contract.

## 19.1 End-to-end implementation order

For any feature that exposes protected data or actions:

```text
AGENTS.md invariant
    ↓
RBAC authorization contract / server projection
    ↓
API/shared contract
    ↓
Web and/or Mobile presentation
    ↓
surface-specific interaction + accessibility/offline handling
    ↓
negative authorization + functional + visual verification
```

Do not design a client capability first and then invent backend permission semantics to match the UI.

## 19.2 Shared authorization-to-UI contract

Web/Mobile MAY use server-provided information such as:

- `allowedActions`;
- `capabilities`;
- authorized section/tab projections;
- scoped search results;
- approval state;
- lifecycle state;
- entitlement/module availability.

These values may guide presentation, but every protected API operation MUST re-authorize server-side.

Clients MUST NOT derive authoritative access from:

- role names alone;
- hidden navigation;
- cached permission lists;
- locally inferred assignment/guardian relationships;
- client-supplied tenant IDs.

## 19.3 Feature dependency gates

The following dependencies are mandatory:

| Surface/feature | Authorization prerequisite |
| --- | --- |
| Student 360 sensitive tabs | server-authorized student projection; teacher/guardian scope policies; sensitive-section rules |
| Staff 360 payroll/bank/document tabs | server-authorized staff projection and HR/payroll separation |
| Teacher Today / attendance / marks | active assignment-aware authorization |
| Parent child switch / child detail | active guardian relationship authorization |
| Principal approval surfaces | explicit approval capability + lifecycle/SoD policy |
| Fee/refund/accounting actions | finance separation of duties + lifecycle policy |
| Payroll actions | payroll preparation/review/approval/posting separation |
| Global command/search | server-side authorization-aware search projection |
| Reports/exports | explicit read/export permission and scoped field projection |
| Access Control Center | P0 authorization semantics trustworthy before broad role-admin UX |
| Offline mutation sync | server re-authorization at sync and conflict handling |
| Platform tenant inspection | explicit Platform capability; tenant support access when tenant data is involved |

A design task may prepare visual primitives before a prerequisite is complete, but MUST NOT expose a production capability whose authorization prerequisite is unresolved.

## 19.4 Coordinated Definition of Done

For work spanning authorization and a client surface, completion requires both:

1. the RBAC/security contract is implemented and negatively tested; and
2. the Web/Mobile experience consumes that contract correctly and passes its surface-specific UX/accessibility/visual checks.

A frontend-only green build does not prove authorization correctness.
A backend-only authorization change is not complete when the requested user-facing capability still exposes stale or contradictory UI semantics.

---

# 20. Verification Policy

Testing must be proportional to impact.

### Documentation/policy

- consistency review;
- no contradictory authority/source-of-truth rules.

### UI-only

- targeted tests;
- typecheck/lint/analyze for affected client;
- rendered visual verification;
- representative responsive/adaptive sizes;
- accessibility checks for changed flows.

### Client logic

- targeted unit/widget tests;
- routing/state tests where relevant;
- client quality gates.

### Backend/domain

- unit tests;
- integration tests when persistence/authorization matters;
- typecheck/lint.

### DB/auth/finance/offline/security

- targeted tests;
- integration/regression suites;
- migration verification where applicable;
- negative authorization/replay/conflict tests;
- broader validation when warranted.

Before declaring completion:

- relevant tests must pass, or
- remaining failure must be explicitly identified and explained.

Do not repeatedly run the entire repository suite after every small edit, but do not under-test high-risk changes.

---

# 21. Definition of Done

A task is complete only when applicable items are satisfied:

- requested functionality/design is implemented;
- tenant isolation is preserved;
- server-side authorization remains authoritative;
- affected contracts remain consistent;
- migrations are included when required;
- concurrency/idempotency implications were considered;
- offline boundaries remain safe;
- sensitive-data handling remains correct;
- relevant tests pass;
- applicable formatting/lint/typecheck/analyze/build checks pass;
- visual QA is complete for UI work;
- no placeholder implementation remains;
- no knowingly broken path was hidden or bypassed;
- unrelated regressions were not introduced.

---

# 22. Prohibited Actions

Do not:

- weaken authorization to unblock UI;
- trust client-provided ownership/tenancy;
- invent fake production data to make screens appear complete;
- silently fall back to another child/student/tenant/user;
- mark unknown state as success;
- rewrite posted ledger history;
- use floating-point arithmetic for authoritative money;
- remove failing tests merely to obtain green CI;
- disable quality gates without explicit justification;
- create duplicate `AGENTS.md` files;
- create another repository-wide Markdown source of truth;
- treat the Web/App design playbooks as higher authority than this file;
- reactivate deferred modules through redesign work alone;
- implement international expansion unless explicitly requested.

---

# Final Operating Principle

`AGENTS.md` is the constitution.

`SCHOOLOS_PHASE_WISE_IMPLEMENTATION_MASTER_PLAN_WITH_EDGE_CASES.md` is the coordinated phase execution roadmap and edge-case gatekeeper.

`SCHOOLOS_RBAC_AUTHORIZATION_IMPLEMENTATION.md` is the scoped authorization implementation manual.

`SCHOOLOS_WEB_DESIGN_ASTRA.md` and `SCHOOLOS_APP_DESIGN_ASTRA.md` are the platform-specific design execution manuals.

The codebase, schema, tests, and runtime are evidence of implementation.

Astra/Codex must use all five root documents together without ambiguity: **one repository authority, one coordinated implementation roadmap, one authorization implementation contract, two platform-specific design playbooks, and one shared SchoolOS product goal.**
