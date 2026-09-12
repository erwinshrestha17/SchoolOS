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

## 1.1 Recognized scoped design playbooks

Exactly two root-level design playbooks are recognized:

- `SCHOOLOS_WEB_DESIGN_ASTRA.md` — scoped to `apps/web` and SchoolOS web UX/frontend design.
- `SCHOOLOS_APP_DESIGN_ASTRA.md` — scoped to `apps/schoolos_mobile` and SchoolOS Flutter mobile UX/frontend design.

These files are **specialized execution playbooks, not independent sources of truth**.

They MAY refine:

- visual hierarchy;
- interaction patterns;
- navigation structure;
- page/screen composition;
- responsive/adaptive behavior;
- design-system implementation;
- accessibility details;
- surface-specific visual QA.

They MUST NOT override this file on:

- Nepal-only roadmap scope;
- module status or product scope;
- personas and access boundaries;
- tenant isolation;
- authentication/authorization;
- financial/accounting integrity;
- privacy/protected data;
- compliance behavior;
- offline safety boundaries;
- backend authority;
- source-of-truth decisions;
- release/verification requirements.

If a design playbook conflicts with this file, **this file wins**.

If Web and App playbooks differ, that is allowed when the difference is platform-appropriate. Neither design playbook has authority over the other surface.

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
2. If the task touches `apps/web`, also read `SCHOOLOS_WEB_DESIGN_ASTRA.md`.
3. If the task touches `apps/schoolos_mobile`, also read `SCHOOLOS_APP_DESIGN_ASTRA.md`.
4. Inspect relevant implementation before editing.
5. Trace affected backend, database, contracts, web, mobile, and tests as required by impact.
6. Infer routine implementation details from repository evidence and existing patterns.
7. Prefer the smallest coherent end-to-end change over speculative redesign.
8. Continue until requested scope is complete, verified, or blocked by a legitimate external dependency.
9. Fix directly related defects when required for correctness.
10. Do not broaden into unrelated cleanup.
11. Never weaken authorization, validation, tests, or quality gates merely to make work pass.

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

- Homeroom authority does not grant every subject write.
- Subject teaching does not grant homeroom attendance automatically.
- Assignment removal MUST remove authority immediately and invalidate affected cached/offline scope.

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
- conflicts are explicit and resolvable;
- no silent last-write-wins for authoritative sensitive records;
- never serve one user/child/tenant's cached data as fallback for another.

The App design playbook controls how offline/sync state is communicated, but it may not relax these boundaries.

---

# 15. Financial Integrity

M11 is the authoritative accounting layer. M3 Fees/Receipts and M7 Payroll hand off controlled, idempotent accounting events into M11.

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

# 16. Nepal Compliance and Localization

Treat mutable Nepal education/fiscal policy as versioned/effective-dated configuration and evidence, not scattered constants.

Support correctly where applicable:

- Nepali Unicode;
- English;
- Nepal timezone;
- NPR;
- Nepal phone formats;
- province/district/local level/ward;
- BS and AD date presentation with unambiguous canonical storage.

Do not claim government/API integration without authorized evidence.

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

# 19. Verification Policy

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

# 20. Definition of Done

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

# 21. Prohibited Actions

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

`SCHOOLOS_WEB_DESIGN_ASTRA.md` and `SCHOOLOS_APP_DESIGN_ASTRA.md` are scoped design execution manuals.

The codebase, schema, tests, and runtime are evidence of implementation.

Astra/Codex should use all three together without ambiguity: **one repository authority, two platform-specific design playbooks, and no conflict in product/security ownership.**
