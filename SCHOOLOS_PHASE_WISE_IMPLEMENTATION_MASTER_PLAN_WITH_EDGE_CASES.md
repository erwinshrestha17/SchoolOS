# SchoolOS Coordinated Phase-Wise Implementation Master Plan

> **Purpose**
>
> This document is the execution roadmap for implementing SchoolOS safely and incrementally with Codex/autonomous engineering agents.
>
> It coordinates:
>
> - `AGENTS.md`
> - `SCHOOLOS_RBAC_AUTHORIZATION_IMPLEMENTATION.md`
> - `SCHOOLOS_WEB_DESIGN_ASTRA.md`
> - `SCHOOLOS_APP_DESIGN_ASTRA.md`
>
> It does **not** replace any of those files.
>
> `AGENTS.md` remains the repository-wide constitution and highest project authority.
>
> This roadmap tells Codex **what to implement first, what depends on what, how each slice should be verified, and when a phase is actually complete**.

---

# 0. Operating Model

SchoolOS implementation MUST follow this dependency direction:

```text
Product / security invariants
        ↓
Authorization semantics
        ↓
Database + backend contracts
        ↓
Shared projections / capabilities
        ↓
Web / Mobile presentation
        ↓
Functional tests
        ↓
Negative authorization tests
        ↓
Visual / accessibility / offline QA
        ↓
Production-readiness gate
```

Do not reverse this flow by designing a UI first and inventing backend authority afterward.

---

# 1. Root Documents and Authority

Codex MUST read the applicable root documents before editing.

## 1.1 Always read

`AGENTS.md`

## 1.2 Read for authorization-sensitive work

`SCHOOLOS_RBAC_AUTHORIZATION_IMPLEMENTATION.md`

Mandatory when touching authentication/authorization, roles, permissions, scopes, entitlements, assignment/guardian authority, Student/Staff 360 projections, approval authority, finance/payroll SoD, exports, global search, support access, delegation, offline re-authorization, or protected data.

## 1.3 Read for Web work

`SCHOOLOS_WEB_DESIGN_ASTRA.md`

## 1.4 Read for Mobile work

`SCHOOLOS_APP_DESIGN_ASTRA.md`

---

# 2. Global Implementation Rules

Every phase MUST preserve:

## 2.1 Security
- default deny;
- server-authoritative authorization;
- tenant isolation;
- no client-authoritative role/scope/ownership decisions;
- no hidden-button-as-security;
- no implicit admin-superuser behavior;
- no permanent unrestricted platform support mode.

## 2.2 Data integrity
- authoritative DB constraints;
- transactional multi-record operations;
- idempotency for retriable writes;
- immutable financial lineage;
- versioned/corrective workflows instead of destructive history rewrites.

## 2.3 Nepal-first scope
- Nepal only;
- English + Nepali;
- NPR;
- Nepal timezone;
- BS/AD where applicable;
- Province → District → Local Level → Ward;
- Nepal education/compliance boundaries;
- no international expansion unless explicitly authorized.

### 2.3.1 Versioned Nepal education and HR policy

Mutable Nepal education, employment, payroll, social-security, tax, local-government and fiscal rules MUST be implemented as effective-dated policy/configuration with evidence rather than scattered constants.

Policy resolution must be able to represent:

```text
National baseline
→ province/local-government profile where applicable
→ school type
→ academic or employment/post context
→ record-specific effective-dated terms
```

Historical academic, employment and financial records must remain interpretable under the policy version that applied when the authoritative event occurred.

NEB, IEMIS/CEHRD, TSC and other government systems remain external authorities for their legally assigned functions. SchoolOS may validate, map, export, reconcile and preserve evidence, but must not claim live government integration or statutory approval without authorized current proof.

## 2.4 Deferred modules
Unless explicitly reactivated:
- M8 Library
- M9 Transport
- M10 Canteen
- M13 Learning

remain deferred.

## 2.5 Client boundaries
Web and Mobile consume server-provided capability/projection state such as:
- `allowedActions`
- `capabilities`
- `authorizedSections`
- `lifecycleState`
- `entitlementState`
- `syncState`

They do not decide access.

---

# 3. Codex Execution Pattern for Every Slice

## Step A — Baseline
1. fetch latest repository state;
2. update target branch;
3. ensure working tree is clean;
4. record starting SHA;
5. read applicable root docs;
6. inspect existing implementation;
7. identify affected routes/services/schema/components/tests;
8. record unrelated baseline failures.

## Step B — Gap Analysis
Classify:
- already correct;
- partially implemented;
- missing;
- conflicting;
- unsafe;
- deprecated;
- blocked.

Do not rebuild already-correct functionality.

## Step C — Implementation
Implement the smallest coherent end-to-end slice:

```text
DB
→ domain model
→ service
→ authorization
→ API contract
→ shared types
→ Web/Mobile
→ tests
```

## Step D — Verification
Run tests proportional to impact.

## Step E — Completion Report
Report:
- slice;
- starting SHA;
- ending SHA / commit(s);
- files changed;
- schema/migrations;
- authorization changes;
- API changes;
- Web changes;
- Mobile changes;
- tests run;
- results;
- known limitations;
- remaining prerequisite;
- next slice.

---

# 4. Global Phase Map

```text
Phase 0   Baseline & Architecture Audit
Phase 1   Authorization Foundation
Phase 2   Domain Authorization Policies
Phase 3   Shared Contracts & Web Design System v2
Phase 4   App Shells & Persona Homes
Phase 5   People, Admissions, Student 360 & Teacher Identity Foundation
Phase 6   Attendance, Homework, Academics & Timetable
Phase 7   Fees, HR, Payroll & Accounting
Phase 8   Access Control Administration & Sensitive Data Maturity
Phase 9   Search, Reports, Exports, Activities, Notices & Delivery
Phase 10  Mobile Completion & Offline Hardening
Phase 11  P2 Governance, Multi-Branch Scale & Final Production Hardening
```

---

# 4A. Cross-Phase Edge-Case Operating Rule

Every phase MUST include an explicit edge-case review before implementation is considered complete.

For every edge case, Codex should capture:

```text
Edge case
Trigger
Expected authoritative behavior
User-visible behavior
Security/data-integrity risk
Detection/logging signal
Automated test required
Recovery/rollback path
```

Edge cases are not optional QA notes. If an edge case can cause:

- cross-tenant access;
- privilege escalation;
- stale authority;
- lost financial lineage;
- duplicate financial posting;
- unauthorized student/guardian access;
- incorrect marks/attendance publication;
- offline data leakage;
- approval bypass;
- silent data corruption;

it MUST be treated as a phase-blocking defect.

A phase exit gate is incomplete until its listed edge cases are either:

1. explicitly handled and tested; or
2. proven impossible through schema/domain invariants; or
3. explicitly deferred by the project owner with risk documented.

# PHASE 0 — Repository Baseline & Architecture Audit

## Phase 0 Edge Cases & Early-Resolution Checks

Resolve these during audit rather than discovering them later.

### Documentation / repository drift
- root Markdown says a feature exists but code does not;
- code implements newer behavior than docs;
- old migrations imply one model while current Prisma schema implies another;
- tests encode obsolete policy;
- duplicated permission constants disagree across packages;
- current branch contains uncommitted local behavior not present remotely;
- generated OpenAPI/shared contracts are stale.

### Authentication
- disabled/suspended user still has a valid refresh token;
- password reset does not revoke existing sessions;
- tenant switch leaves prior-tenant cache/session state active;
- multi-role user resolves to an unintended default persona;
- biometric unlock succeeds after server session is revoked;
- stale mobile refresh token restores an invalid session;
- clock skew causes token expiry anomalies.

### Authorization
- endpoint has no explicit permission decorator/guard;
- endpoint has guard but downstream service bypasses tenant scope;
- background job bypasses user/server policy entirely;
- “read” permission is reused for export or sensitive fields;
- role preset contains wildcard/all-except semantics;
- `scopeId` has different meanings in different services;
- teacher/guardian checks are performed in UI only;
- platform operator can reach tenant data without support context.

### Tenant isolation
- nested resource ID belongs to another tenant;
- batch endpoint mixes IDs from multiple tenants;
- attachment/download URL is globally guessable;
- Redis cache key omits tenant/user;
- queue payload omits tenant;
- search index/result cache leaks another tenant;
- export is generated under wrong tenant context;
- notification deep link references another tenant.

### Database
- orphaned role assignments;
- duplicate active guardian relations;
- overlapping active teacher assignments;
- missing composite tenant uniqueness;
- money stored as float;
- soft-deleted rows still counted as authoritative;
- historical rows can be destructively updated;
- missing indexes cause policy queries to become production bottlenecks.

### Baseline testing
- existing red tests are incorrectly attributed to new work;
- flaky test hides auth regressions;
- production build passes while integration tests fail;
- local env differs from CI migration state.

### Required early artifacts
Codex should explicitly list each edge case as:

```text
Handled
Not present
Present and blocking
Present but scheduled for phase X
```

## Goal
Produce a trustworthy map of the current SchoolOS implementation before architectural changes.

## 0.1 Repository State Capture
Record:
- repository;
- branch;
- HEAD SHA;
- working tree state;
- Node/pnpm/Flutter/Dart/Prisma/PostgreSQL/Redis versions;
- canonical install/test/lint/typecheck/build/dev commands.

## 0.2 Documentation Consistency Audit
Compare the four root docs and identify contradictions, stale names, inconsistent lifecycle terms, and auth/design conflicts.

## 0.3 Repository Architecture Audit
Map:
- `apps/api`;
- `apps/web`;
- `apps/schoolos_mobile`;
- `packages/core`;
- Prisma schema/migrations;
- Redis/queues;
- provider integrations;
- tests/CI.

## 0.4 Authentication Audit
Inspect login, refresh/session, reset, tenant context, persona resolution, active/suspended state, biometrics, logout/revocation, session invalidation.

Clearly separate authentication from authorization.

## 0.5 Authorization Audit
Inventory:
- roles;
- permissions;
- role presets;
- role assignment metadata;
- scope fields;
- guards/decorators;
- entitlement checks;
- teacher assignment checks;
- guardian checks;
- support overrides;
- platform permissions;
- finance/payroll approval rules.

Produce:
- Role → Permission Matrix;
- Endpoint → Authorization Matrix;
- Persona → Scope Matrix;
- Protected Data Matrix.

## 0.6 Tenant Isolation Audit
Inspect tenant scoping for reads, writes, files, exports, cache, jobs, notifications, sync.

Identify misuse of client-supplied tenant identifiers.

## 0.7 Prisma / DB Audit
Inspect:
- tenant keys;
- FK/unique constraints;
- indexes;
- lifecycle fields;
- money columns;
- audit/history models;
- assignment models;
- guardian relationships;
- role/scope schema.

## 0.8 Web Architecture Audit
Inventory shell, route groups, design primitives, duplicate cards/buttons/tables/forms, command palette, persona nav, React Query patterns, client-side permission filtering and broad list loads.

## 0.9 Mobile Architecture Audit
Inventory navigation, Riverpod, Dio/auth interceptors, secure storage, biometrics, offline cache/queue, persona state, child context, teacher assignment cache, deep links, notifications.

## 0.10 Test Baseline
Run and record:
- API unit/integration;
- Web tests/typecheck/lint/build;
- Playwright;
- Flutter test/analyze.

## Phase 0 Deliverables
- Current Authorization Matrix
- Endpoint Authorization Matrix
- Current Role Matrix
- Sensitive Data Map
- Design Primitive Inventory
- Known Baseline Failures
- Migration Risk List

## Phase 0 Exit Gate
Do not continue until current auth, scope semantics, assignment/guardian enforcement, tenant isolation risks, broad role presets, Web primitive duplication, mobile offline authority, and baseline tests are understood.

---

# PHASE 1 — Authorization Foundation

## Phase 1 Edge Cases & Early-Resolution Checks

### Permission catalog
- same semantic permission exists under multiple names;
- two permissions differ only by naming but are treated differently;
- new permission accidentally enters Admin through wildcard logic;
- deprecated permission remains accepted indefinitely;
- HIGH/CRITICAL permission is marked delegable by mistake;
- permission allowed scope types do not match actual resource model;
- read permission implicitly enables export/download.

### Role templates
- user receives duplicate grants through multiple roles;
- explicit deny vs allow precedence is undefined;
- template update silently expands existing tenant custom roles;
- custom role created from an old template cannot be upgraded safely;
- Principal/Admin accidentally receives Platform capability;
- Parent/Student role receives tenant-wide scope by default.

### Authorization kernel
- missing resource context accidentally evaluates as ALLOW;
- unknown action defaults to permissive behavior;
- policy throws exception and request falls back to allow;
- policy ordering differs between endpoints;
- entitlement check happens after sensitive data is loaded;
- decision reason exposes internal secrets or PII;
- multiple policy evaluators return conflicting outcomes.

### Typed scopes
- legacy `scopeId` cannot be deterministically typed;
- deleted section/class leaves dangling scope;
- one role assignment has contradictory scopes;
- TENANT scope accidentally overrides explicit restriction;
- subject scope is interpreted as global across classes;
- scope expiry timezone boundary produces incorrect access;
- academic-year rollover leaves stale authority active.

### Tenant/object isolation
- resource tenant derived from request instead of DB;
- parent object belongs to tenant A but nested child belongs to tenant B due corrupted data;
- cross-tenant existence can be inferred from 403 vs 404 behavior;
- batch endpoint partially processes authorized subset and silently ignores unauthorized IDs;
- attachment metadata is tenant-scoped but object storage path is not.

### Required tests
- unknown permission → DENY;
- missing resource tenant → DENY;
- conflicting scope → DENY;
- expired/revoked scope → DENY;
- cross-tenant guessed ID → safe deny/not-found;
- new permission does not alter any existing role snapshot.

## Goal
Create one deterministic server-side authorization architecture while preserving behavior until domains migrate.

### 1A — Canonical Permission Catalog
Create centralized permission definitions using `module:resource:action`.

Metadata:
- risk level;
- allowed scope types;
- delegable;
- reason/MFA/approval requirements;
- description/version.

Map legacy permissions.

### 1A.1 Built-In Role Allowlists
Replace “all except” role logic with explicit allowlists.

New permission → no role by default.

### 1A.2 Role Template Baseline
Define:
- School Access Owner
- School Admin
- Principal
- Admissions Officer
- Teacher
- HR Manager
- Payroll Preparer
- Payroll Reviewer
- Payroll Approver
- Cashier
- Accountant
- Finance Approver
- Auditor
- Parent/Guardian
- Student

### 1B — Central Authorization Kernel
Implement:
- `AuthorizationModule`
- `AuthorizationService`
- `AuthorizationContext`
- `AuthorizationDecision`
- `PolicyEvaluator`

Decision outcomes initially:
- ALLOW
- DENY

Architecture should allow:
- REQUIRE_APPROVAL
- REQUIRE_STEP_UP

### 1B.1 Safe Reason Codes
Examples:
- TEACHER_ASSIGNMENT_MISMATCH
- TENANT_MISMATCH
- PERMISSION_MISSING
- RESOURCE_LOCKED
- GUARDIAN_RELATIONSHIP_INACTIVE
- SELF_APPROVAL_PROHIBITED

### 1B.2 Canonical Evaluation Order
1. authentication
2. active user/session
3. security domain
4. tenant
5. resource tenant
6. entitlement
7. hard restriction/deny
8. permission
9. scope
10. relationship
11. lifecycle
12. SoD
13. approval/step-up
14. sensitive projection
15. audit

### 1B.3 Guard Integration
Existing NestJS guards become enforcement points; policy logic should not live in controllers.

### 1C — Typed Scope System
Introduce/evolve `RoleScopeGrant`.

Initial types:
- TENANT
- BRANCH
- ACADEMIC_YEAR
- CLASS
- SECTION
- SUBJECT
- DEPARTMENT
- STUDENT
- STAFF
- FINANCE_ACCOUNT

### 1C.1 Legacy Scope Migration
Map old `scopeId`; retain compatibility during migration; prohibit ambiguous new writes.

### 1C.2 Scope Resolution
Implement explicit inheritance rather than global assumptions.

### 1D — Tenant/Object Isolation Hardening
Standardize trusted tenant context, resource ownership lookup, tenant-aware repository queries, and safe denial/not-found behavior.

Prioritize:
- Students
- Attendance
- Academics
- Fees
- HR
- Payroll
- Accounting
- Notices

## Phase 1 Verification
- permission catalog tests;
- duplicate permission detection;
- role matrix tests;
- unknown permission deny;
- expired/revoked grant deny;
- scope tests;
- cross-tenant negative tests;
- attachment/export/batch endpoint tenant tests.

## Phase 1 Exit Gate
- canonical catalog;
- explicit role allowlists;
- central authorization kernel;
- typed scopes;
- tenant/object enforcement;
- no automatic permission grants.

---

# PHASE 2 — Domain Authorization Policies

## Phase 2 Edge Cases & Early-Resolution Checks

### Teacher
- teacher has two assignments to same class with different subjects;
- teacher assignment starts/ends mid-day;
- substitute teacher needs temporary authority;
- teacher transferred to another section while offline;
- homeroom teacher tries subject marks entry without subject assignment;
- subject teacher attempts homeroom attendance;
- teacher sees former students through cached directory/search;
- marks/attendance session becomes locked while teacher form remains open.

### Guardian / Parent
- one guardian linked to multiple children in different schools;
- same phone/email belongs to multiple guardians;
- relationship exists but capability is revoked;
- custody restriction overrides generic parent capability;
- guardian relationship changes while app is offline;
- parent switches child while previous child's request is in-flight;
- child removed from account but cached files/photos remain accessible;
- parent knows another child's ID and attempts direct API access.

### Finance
- requester and approver are same person through two different roles;
- refund amount exceeds original collectible amount;
- original payment already reversed/refunded;
- journal is approved, then source transaction changes;
- fiscal period closes while transaction form is open;
- duplicate payment callback produces duplicate journal;
- reconciliation item is matched concurrently by two users;
- same user has Cashier + Finance Approver and attempts self-approval;
- approval threshold changes after request was submitted.

### Payroll
- employee terminates during payroll cycle;
- bank details change after approval but before finalization;
- preparer also becomes reviewer temporarily;
- rerun/reopen creates duplicate accounting posting;
- retroactive salary adjustment affects closed period;
- one employee has missing tax/bank info but payroll batch continues;
- finalized payroll is mutated instead of corrected through adjustment;
- payroll approval session expires mid-action.

### Audit
- audit write fails while business transaction succeeds;
- actor is system/background process rather than user;
- request ID missing;
- before/after payload contains secrets;
- audit record itself can be modified/deleted by ordinary tenant admin.

### Required early rules
High-risk actions should fail closed if audit/approval/SoD prerequisites cannot be established.

## Goal
Centralize high-risk domain authorization and remove scattered special-case behavior.

### 2A — Teacher Authorization
Cover:
- Students
- Attendance
- Homework
- Marks
- Activities
- Timetable
- Guardian contact

Evaluate tenant, academic year, class, section, subject, period, assessment/component, status, effective dates.

Separate homeroom attendance from subject marks authority.

Assignment removal must immediately remove authority and invalidate related cache/offline scope.

### 2B — Guardian / Parent Authorization
Authoritative GuardianRelationship should include:
- guardian/student/tenant;
- relationship type;
- status;
- effective dates;
- capabilities;
- restrictions.

Test unrelated/expired/suspended/wrong-tenant/missing-capability denial.

### 2C — Finance Separation of Duties
Separate:
- Cashier
- Finance Clerk
- Accountant
- Finance Approver
- Posting Authority
- Auditor

Refund lifecycle:
request → review → approve → execute/reverse.

Journal lifecycle:
create → review → approve → post → reverse.

Reconciliation:
prepare → review exceptions → finalize.

Fiscal reopen is critical and reason-bound.

### 2D — HR / Payroll Separation
Lifecycle:
Prepare → Validate → Review → Approve → Finalize → Post.

Differentiate basic HR, documents, salary, bank, tax and disciplinary data.

Self-approval prohibited where policy requires.

### 2E — Authorization Audit
Audit:
- roles;
- permissions;
- scope changes;
- support access;
- sensitive access where needed;
- finance approvals/reversals;
- payroll finalization;
- security overrides.

## Phase 2 Exit Gate
- teacher policies;
- guardian policies;
- finance SoD;
- payroll SoD;
- security audit;
- privilege-escalation tests;
- platform separation preserved.

---

# P0 CROSS-PHASE GATE — Nepal Policy & Teacher Professional Eligibility Foundation

This bounded foundation must be completed before SchoolOS treats teacher assignment, timetable/marks authority, or statutory payroll as production-trustworthy. It does **not** require a complete payroll engine before Phase 6.

## P0-N1 — Nepal Education Policy Foundation

Establish versioned/effective-dated structures for:

- jurisdiction/local-level profile;
- school type/recognition context;
- curriculum version;
- grading/assessment policy version;
- promotion/report-card policy;
- academic calendar policy;
- government-reporting schema/mapping;
- source/evidence, review status, effective dates and supersession.

## P0-N2 — Nepal HR Legal Policy Foundation

Establish versioned/effective-dated structures for:

- employment/post classification;
- contract/service-condition policy;
- working-time/leave policy;
- compensation/minimum-remuneration policy inputs;
- statutory scheme/tax policy inputs;
- teacher qualification/licence requirements where applicable;
- jurisdiction, school type, source/evidence, review status and effective dates.

No school setting may silently override a mandatory minimum represented by the active approved policy.

## P0-N3 — Teacher Identity and Professional Eligibility Foundation

Keep these distinct:

```text
Person
→ Employee
→ Employment
→ Teacher Profile
→ Qualification
→ Teaching Licence
→ Eligibility
→ Academic Assignment
→ Timetable
→ Authorization
```

The minimum pre-Phase-6 contract must support active employment, qualification/licence evidence, verification state, effective dates, applicable policy reference, eligibility outcome/reason, and assignment preflight.

A `Teacher` role/persona is never evidence of professional eligibility.

## P0-N4 — External Authority Boundary

- NEB/IEMIS/TSC records or identifiers must retain their external-authority meaning.
- Initial integrations should support validated export/import/reconciliation and immutable submission snapshots where no supported direct API is established.
- UI states must distinguish `READY`, `EXPORTED`, `SUBMITTED`, `ACKNOWLEDGED`, `REJECTED/CORRECTION_REQUIRED` as applicable instead of implying success.
- Direct government synchronization, licensing verification or statutory certification remains disabled until an authorized interface/evidence exists.

## Cross-Phase Gate Verification

- historical policy-version test;
- future policy change does not rewrite prior academic/employment records;
- teacher role without active employment/required eligibility cannot create an authoritative assignment/write;
- assignment removal or eligibility loss revokes affected current authority;
- government export readiness does not imply submission;
- unsupported government integration cannot be shown as connected.

## Cross-Phase Exit Gate

Before authoritative Phase 6 teacher workflows or Phase 7 statutory payroll can be enabled:

- education-policy versioning exists for the rules those workflows consume;
- minimum employment/teacher-profile/qualification/licence/eligibility contracts exist;
- assignment creation/preflight can consume current eligibility when policy requires it;
- external-authority states are truthful and auditable.

---

# PHASE 3 — Shared Contracts & Web Design System v2

## Phase 3 Edge Cases & Early-Resolution Checks

### Capability contracts
- server omits `capabilities` due partial deployment;
- old Web client receives new capability shape;
- client interprets missing capability as true;
- action visible from stale React Query cache after permission revocation;
- one endpoint returns `canEdit`, another returns `allowedActions` with inconsistent meaning.

### Sensitive projections
- hidden tab data still appears in initial JSON;
- nested relation leaks protected fields;
- general serializer bypasses projection;
- export endpoint uses full entity instead of projected entity;
- inspector and full page use different projection rules;
- cached Student 360 response survives role change.

### Design-system migration
- legacy and v2 primitives coexist with different status meanings;
- one module uses red as brand color while another uses red as error;
- reduced-motion or keyboard behavior regresses during component replacement;
- replacing table primitive breaks sticky headers or pagination state;
- inspector route/back behavior loses filters/scroll;
- duplicate design system is accidentally introduced.

### Low-bandwidth/API behavior
- one secondary panel failure blocks entire page;
- unavailable data rendered as `0`;
- hidden tabs prefetch large protected payloads;
- repeated search requests are not cancelled;
- optimistic UI displays action success before server authorization result.

### Required tests
- capability missing → action unavailable;
- protected section absent from payload;
- stale capability invalidated after auth version change;
- canonical components pass accessibility checks;
- DataWorkspace preserves filters/back-navigation state.

## Goal
Create stable server/client authorization contracts and one canonical Web system.

### 3A — Capability Contract
Standardize:
- allowedActions;
- capabilities;
- authorizedSections;
- lifecycleState;
- entitlementState.

### 3B — Sensitive Projection Contract
Reusable pattern for:
- Student 360;
- Staff 360;
- search;
- dashboards;
- reports;
- inspectors.

### 3C — Web Primitive Consolidation
Migrate legacy overlapping components toward:
- Surface
- Section
- Panel
- Card
- Metric
- DataWorkspace
- Inspector
- Entity360
- QueueWorkspace
- FormSection
- Timeline
- Dialog/Sheet

### 3D — Design Tokens
Converge spacing, radii, control heights, typography, table density, semantic colors, shadows, focus states.

### 3E — DataWorkspace
Support search, filters, chips, sort, pagination, column visibility, density, selection, bulk actions, export hooks, inspector, loading/error/empty, refresh state.

### 3F — Inspector
Support small/medium/large and preserve list state.

### 3G — Form System
Unify labels, help, validation, dirty state, destructive confirmation, section navigation, sticky actions, searchable selectors.

## Phase 3 Exit Gate
- shared capability contract;
- projection pattern;
- canonical Web primitives;
- DataWorkspace;
- Inspector;
- form primitives;
- no third UI system.

---

# PHASE 4 — App Shells & Persona Homes

## Phase 4 Edge Cases & Early-Resolution Checks

### Persona resolution
- user has multiple roles and no obvious primary persona;
- user changes role/assignment while session is active;
- principal also has teacher assignment;
- School Admin is accidentally shown Platform navigation;
- entitlement removed while page is open;
- tenant suspended while user is logged in.

### Navigation
- hidden nav route remains directly accessible;
- command palette reveals unauthorized records;
- recent item points to resource no longer authorized;
- notification link enters a disabled module;
- mobile deep link opens wrong child/class context.

### Teacher Today
- no current/next class;
- timetable changed after cache load;
- substitute assignment active only for one period;
- offline schedule stale;
- multiple overlapping timetable entries;
- action appears for assignment that has just expired.

### Principal Home
- approval count includes items Principal cannot approve;
- critical item disappears because one backend source failed;
- financial summary leaks sensitive staff/payroll data;
- stale attention item links to finalized/deleted resource.

### HR / Accountant Homes
- summary figures aggregate rows actor cannot drill into;
- role has summary permission but not detail permission;
- partial API failure appears as zero;
- fiscal/academic date boundaries produce wrong “today” totals.

### Required tests
- direct route access still re-authorizes;
- persona switch clears incompatible cached data;
- missing entitlement removes entry points;
- partial panel failures are truthful.

## Goal
Move from module-directory thinking to persona-first operations.

### 4A Web App Shell
Provide school, academic year, branch, persona, grouped navigation, command search, quick actions, notifications and security menu.

### 4B Admin Home
Admissions pending, attendance incomplete, fee exceptions, setup blockers, operational work, recent important changes.

### 4C Teacher Today
Current/next class, schedule, attendance due, homework review, missing marks, substitutions, assigned classes. All assignment-scoped server-side.

### 4D Principal Home
Critical attention, approvals, attendance exceptions, academic readiness, finance exceptions, staff absence impact, communication failures.

### 4E HR Home
Attendance today, leave, contracts, missing staff data, payroll readiness.

### 4F Accountant Home
Collections, unreconciled items, posting failures, receivables/payables, period warnings, cash/bank.

### 4G Mobile Foundation
Normalize theme/tokens, primary navigation, semantic statuses, offline indicators, permission/error states, child/class context components.

## Phase 4 Exit Gate
Every major persona has a purpose-built authorized home.

---

# PHASE 5 — People, Admissions, Student 360 & Teacher Identity Foundation

## Phase 5 Edge Cases & Early-Resolution Checks

### Admissions
- duplicate application submitted twice;
- same child has prior withdrawn/rejected application;
- parent/guardian identity conflicts with existing student;
- required document uploaded after decision;
- application approved while capacity became full;
- two reviewers decide simultaneously;
- applicant moves academic year/class during review;
- duplicate detection finds cross-tenant record and must not expose it.

### Student directory
- inactive/withdrawn/graduated student visibility differs by persona;
- pagination/filter count includes unauthorized students;
- search by phone/email reveals protected data;
- bulk action mixes authorized and unauthorized students;
- duplicate Student ID across tenant should be impossible.

### Student 360
- teacher can access student but not fee/medical/custody fields;
- Principal can see summary but not underlying highly sensitive document;
- Accountant can see payer identity but not marks;
- field-level projection differs between list, inspector and full page;
- cached tab remains visible after permission revocation;
- one section fails while others load;
- stale Guardian relationship shows old child data.

### Files/documents
- signed download URL outlives access revocation;
- file path is guessable;
- deleted document remains downloadable;
- consent status changes after media/document cache.

### IEMIS
- missing field vs invalid field distinction;
- BS/AD conversion mismatch;
- duplicate IEMIS identifier;
- readiness falsely implies submission;
- export generated from stale student data.

### Teacher identity / professional evidence
- employee exists without an active employment record;
- duplicate overlapping employment records;
- teacher role exists without Teacher Profile;
- qualification document is present but unverified;
- teaching licence expires or is revoked mid-academic-year;
- licence requirement differs by school/post/policy context;
- eligibility changes after assignment is created;
- historical assignment must retain the policy/evidence context used when created;
- substitute teacher is available but not eligible for the required level/subject;
- staff identity is incorrectly treated as SchoolOS authorization.

### Required tests
- direct Student 360 URL cannot bypass projection;
- protected fields absent from JSON;
- cross-tenant duplicate matching never exposes identity;
- child-switch race cannot mix two children's data;
- teacher role alone does not satisfy professional-eligibility preflight;
- expired/revoked employment or required licence blocks new authoritative assignment/write;
- historical eligibility decision retains its policy-version reference.

### 5A Admissions Home
Stage summary, review queue, missing docs, duplicates, capacity/waitlist where real, new application.

### 5B Applications Workspace
Dense table + inspector + full review.

### 5C Application Review
Identity, checklist, docs, assessment, duplicates, decision history and explicit consequences.

### 5D Duplicate Review
Side-by-side comparison; never silent merge; preserve lineage.

### 5E Student Directory
Dense DataWorkspace, not profile cards.

### 5F Student 360 Backend Projection
Teacher → basic identity, attendance, academics, homework, permitted guardian contact.
Accountant → basic identity, payer/fees/invoices/receipts.
Principal → oversight projection.
Admin → broad operational projection.
Protected sections stay server-filtered.

### 5G Student 360 Web
Render only authorized sections.

### 5H Guardian Mobile Child Context
Secure switching, relationship-aware fetch, cache invalidation, removal of unauthorized stale child data.

### 5I IEMIS Readiness
Completeness, blockers, affected records, validation detail, truthful export/submission state.

### 5J Employee / Employment Foundation
Canonical staff identity plus effective-dated employment/service records. Prevent overlapping authoritative employment where policy/domain rules forbid it.

### 5K Teacher Professional Profile
Teacher-specific profile remains separate from role/persona and organizational position.

### 5L Qualification & Teaching-Licence Evidence
Store qualification/licence evidence, issuer/reference, verification state, effective/expiry dates, protected documents and history. Do not treat uploaded evidence as verified by default.

### 5M Professional Eligibility Projection & Assignment Preflight
Resolve the currently applicable policy, active employment, verified evidence and required level/subject constraints into an auditable eligibility outcome/reason code. Academic-assignment creation consumes this projection where policy requires it.

## Phase 5 Exit Gate
Admissions, Student Directory, Student 360, Guardian scope and IEMIS readiness work safely end-to-end, and the minimum teacher identity/employment/professional-evidence foundation required by Phase 6 exists.

---

# PHASE 6 — Attendance, Homework, Academics & Timetable

## Phase 6 Edge Cases & Early-Resolution Checks

### Teacher eligibility / assignment
- assignment is created for inactive/terminated employment;
- required qualification/licence expires while assignment is active;
- eligibility changes while a teacher has an offline attendance/marks draft;
- policy version changes during the academic year;
- historical marks/attendance must retain the original authoritative event/policy context;
- substitute assignment bypasses level/subject eligibility;
- timetable contains a teacher whose assignment is no longer authoritative;
- teacher role/capability exists but current professional preconditions fail.

### Attendance
- roster changes after draft created;
- student transfers sections mid-day;
- duplicate submission/replay;
- teacher submits offline draft after assignment revoked;
- attendance session locks while offline;
- correction requested against already-corrected record;
- two admins approve/reopen same record concurrently;
- school day/period changes due holiday/emergency;
- timezone/date boundary causes wrong attendance date.

### Homework
- assignment audience changes after publish;
- duplicate publish due retry;
- attachment upload succeeds but assignment create fails;
- due date passes while app offline;
- deleted student still appears in cached submission list;
- teacher loses class assignment after homework created.

### Marks
- max marks changes after entry;
- absent/exempt stored as numeric zero accidentally;
- two teachers edit same mark concurrently;
- lock occurs while user has unsaved changes;
- submit succeeds but client retries and duplicates event;
- report card generated before all marks committed;
- published result corrected without preserving prior version;
- parent sees unpublished result through stale cache/export.

### Timetable
- teacher double-booked;
- room double-booked;
- section double-booked;
- substitution overlaps original assignment;
- academic-year rollover retains old slots;
- timetable edit races with attendance/session generation.

### Required tests
- teacher assignment preflight checks active employment and required eligibility;
- role/permission without current professional preconditions does not bypass assignment policy;
- eligibility/assignment loss invalidates affected offline sync;
- substitute eligibility is enforced where applicable;
- policy-version changes do not rewrite historical authoritative records;
- idempotent attendance submit;
- stale offline attendance rejected safely;
- concurrent correction handling;
- mark lifecycle enforcement;
- unpublished parent visibility denial;
- timetable conflict constraints.

### Phase 6 Teacher Professional Eligibility Gate
Before any authoritative attendance/marks/timetable operation, the server must evaluate the current assignment plus active employment and applicable professional eligibility where required by the active policy. Existing assignments must not become a bypass around expired/revoked preconditions.

### 6A Teacher Attendance Web
Fast register with class/period context, roster, mark-all-present, exceptions, draft/submitted/locked and submit.

### 6B Attendance Offline Draft
Mobile states: local draft, pending sync, syncing, synced, rejected, conflicted.
Sync re-authorizes current assignment.

### 6C Attendance Command Centre
Completion, missing registers, anomalies, corrections, follow-up.

### 6D Corrections Queue
Original/requested/reason/requester/approval/history.

### 6E Academics Readiness
Class × subject readiness matrix.

### 6F Marks Entry
Spreadsheet-style; keyboard navigation; sticky identity; validation; separate Save/Submit; assignment and lock enforcement.

### 6G Marks Lifecycle
Draft → Submitted → Returned → Resubmitted → Reviewed → Locked → Published → Corrected → Republished.

### 6H Report Cards
Generation, validation, preview, publish state, versions/corrections.

### 6I Homework
Home, composer, review queue, submission inspector, feedback.

### 6J Timetable Viewer
Full grid.

### 6K Timetable Builder
Unscheduled items, grid, conflicts, teacher load, room context, version state.

### 6L Substitutions
Today-first queue.

## Phase 6 Exit Gate
Daily teacher work functions safely on Web/Mobile with correct employment/eligibility preconditions where applicable, assignment scope, substitution rules and lifecycle.

---

# PHASE 7 — Fees, HR, Payroll & Accounting

## Phase 7 Edge Cases & Early-Resolution Checks

### Fees / payments
- duplicate gateway callback;
- callback arrives before local redirect/confirmation;
- payment marked pending but UI shows paid;
- overpayment/partial payment;
- payment allocated across multiple invoices;
- payment reversed after receipt issued;
- receipt number collision;
- retry creates duplicate receipt;
- cashier loses network after provider success;
- fee structure changes after invoice issuance;
- student changes class/tenant context after invoice;
- currency rounding and NPR decimal handling.

### Refund / reversal
- partial refund after earlier partial refund;
- amount exceeds refundable balance;
- refund requested in closed fiscal period;
- approval granted then source transaction changes;
- provider refund succeeds but ledger posting fails;
- ledger reversal succeeds but provider refund fails.

### HR / employment / professional eligibility
- employee has duplicate or overlapping authoritative employment/contract records;
- employee has multiple departments/positions with ambiguous primary responsibility;
- employment starts/terminates mid-period;
- qualification or licence evidence is missing/unverified/expired/revoked;
- policy applicability differs by school type, local jurisdiction or employment/post type;
- teacher eligibility changes while academic assignments remain active;
- approved teacher leave creates uncovered timetable periods;
- substitute is available but not eligible for the affected subject/level;
- bank/compensation/statutory membership changes during payroll cycle;
- restricted medical/disciplinary/safeguarding document is exposed in Staff 360;
- staff becomes inactive while approval flow is open;
- historical employment/eligibility record is destructively rewritten after policy changes.

### Leave / academic impact
- leave overlaps employment start/end dates;
- leave balance changes after request but before approval;
- partial-day leave affects only some timetable periods;
- two approved absences compete for the same substitute;
- timetable changes after leave approval;
- substitute assignment expires or is revoked;
- leave is approved but required coverage remains unresolved.

### Payroll
- payroll is attempted before employment/compensation/policy prerequisites are complete;
- employee added/removed mid-cycle;
- retroactive adjustment;
- unpaid leave after payroll preparation;
- rounding differences between employee totals and batch totals;
- duplicate finalize/post retry;
- tax/statutory configuration changes effective mid-period;
- payroll reopened after accounting posting;
- bank export generated before final approval;
- one employee has blocking data while the remainder of the batch is valid;
- payroll calculator and M11 posting disagree on liability totals.

### Accounting
- journal unbalanced by rounding;
- posting retried after timeout;
- posting succeeds but response lost;
- closed-period posting;
- fiscal reopen without reason/MFA;
- journal source deleted/changed;
- reconciliation matched twice;
- bank statement duplicate import;
- account deactivated while journal draft exists;
- financial report total differs from ledger drill-down.

### Audit/recovery
- provider succeeds while DB transaction fails;
- DB commits while queue publish fails;
- queue retry duplicates accounting event;
- immutable record accidentally updated rather than reversed;
- payroll obligation is finalized but M11 posting fails;
- current policy evidence disappears after a later version activates.

### Required tests
- payment idempotency;
- callback replay;
- transaction atomicity;
- refund/reversal lineage;
- employment/contract effective-date constraints;
- qualification/licence verification-state tests;
- teacher eligibility policy-version tests;
- leave-to-timetable impact and substitute authorization tests;
- payroll prerequisite/readiness validation;
- payroll replay safety;
- payroll-to-M11 posting idempotency and reconciliation;
- balanced-journal invariant;
- reconciliation concurrency;
- report-to-ledger reconciliation;
- unauthorized salary/bank/medical/disciplinary/safeguarding projection denial.

## Goal
Complete the highest-risk fee, workforce, payroll and accounting domains after SoD and the Nepal policy/teacher-eligibility foundations are enforced.

### 7A Fees Home
Collections, outstanding, overdue, reconciliation, posting failures, cashier status, exceptions.

### 7B Collect Payment
Find payer → invoices → allocation → method → review → confirm → receipt.
No client-authoritative totals.

### 7C Invoice / Receipt Workspaces
Dense tables + inspectors.

### 7D Student Fee Ledger
Chronological immutable lineage.

### 7E Refund / Reversal / Adjustment
Source transaction, mandatory reason, amount validation, approval, immutable lineage, maker-checker.

### 7F Cashier Close
Expected, actual, difference, unresolved, approval.

### 7G Staff Directory
Dense workspace + inspector. Separate person identity, employment, organizational position and SchoolOS access.

### 7H Staff 360 Sensitive Projection
Server-filtered categories for basic identity, employment, contracts, qualifications, teaching licence, eligibility, attendance, leave, compensation, payroll, bank/tax, documents, disciplinary/safeguarding and history. A generic staff-read permission never implies every category.

### 7I Employment & Contracts
Effective-dated employment/service records, post/designation, department/responsibility, probation/contract dates, status transitions, evidence and history.

### 7J Qualifications & Professional Evidence
Qualifications/training evidence with issuer/reference, verification, expiry where applicable and protected documents.

### 7K Teaching Licence & Verification
Separate teacher-licence record with level/subject context where applicable, issuer/reference, verification state, effective/expiry dates and audit history. SchoolOS must not claim external verification unless it actually occurred.

### 7L Teacher Eligibility Workspace
Policy-driven result showing active employment, required evidence, policy version, eligible/ineligible/review state, reason codes, current assignments and blocking changes. Overrides, if allowed, are elevated, reason-bound and audited.

### 7M Staff Attendance
Authoritative staff attendance with correction history and payroll-impact projection where enabled.

### 7N Leave, Entitlements & Academic Impact
Leave queue + team calendar + entitlement/balance + overlap validation. For teaching staff, show affected timetable periods, coverage status and unresolved academic impact before/after approval.

### 7O Substitution Coordination
Resolve affected classes/periods to eligible, available substitutes. Temporary assignment must be effective-dated, assignment-scoped and independently authorized.

### 7P Compensation & Statutory Membership
Effective-dated salary/allowance/deduction structures plus applicable statutory-scheme/tax membership/configuration references. Restrict sensitive categories through server projections.

### 7Q Payroll Readiness
Validate employment dates, compensation, attendance, leave, statutory/tax configuration, bank/payment data, approvals and policy-version evidence. Missing/blocking state must remain explicit.

### 7R Payroll Run
Prepare → Validate → Review → Approve → Finalize → Accounting Post.

M7 calculates/approves payroll obligations; it does not maintain a second accounting ledger. Final approved liabilities/expenses post idempotently to M11.

### 7S Accounting Home
Period, attention, cash/bank, recent journals.

### 7T Chart of Accounts
Hierarchy/tree.

### 7U Journal Register
Dense table + inspector.

### 7V Journal Entry
Balanced line editor; post only when balanced and authorized.

### 7W Reconciliation
Split-pane matching.

### 7X Receivables / Payables
Aging-first.

### 7Y Fiscal Periods
Close/reopen lifecycle with consequence preview.

### 7Z Financial Reports
Statement → line → account → ledger → journal → source → approval/document.

## Phase 7 Required Security Tests
- cashier self-refund approval deny;
- journal self-approval deny;
- payroll self-approval deny;
- HR access does not imply payroll/accounting access;
- accounting access does not imply unrestricted HR document/salary/bank access;
- teacher eligibility override without elevated permission/reason deny;
- closed period mutation deny;
- cross-tenant finance/HR deny;
- unauthorized salary/bank/medical/disciplinary/safeguarding read deny;
- unauthorized posting deny.

## Phase 7 Exit Gate
HR employment/professional-eligibility records are effective-dated and auditable; leave/substitution integration is operationally safe; payroll prerequisites are versioned and validated; and financial/payroll workflows are correct, M11-posted, auditable, SoD-safe and end-to-end tested.

---

# PHASE 8 — Access Control Administration & Sensitive Data Maturity

## Phase 8 Edge Cases & Early-Resolution Checks

### Role management
- user edits role they currently depend on;
- removing own Access Owner role locks tenant out;
- last security administrator is removed;
- system role mutated directly;
- custom role clones CRITICAL permission unexpectedly;
- permission removed while user session/caches remain active;
- role contains incompatible scope type;
- custom role created from outdated template.

### Delegation
- actor delegates permission they possess but are not allowed to delegate;
- delegation expiry passes during active session;
- delegated role is delegated again recursively;
- temporary grant overlaps permanent grant;
- revocation does not invalidate cache/token.

### Impact preview
- calculated affected-user count differs from committed transaction;
- two admins edit same role simultaneously;
- preview becomes stale before save.

### Policy simulator
- simulator says ALLOW but production endpoint DENIES because context differs;
- simulator leaks protected resource attributes;
- user can use simulator to enumerate hidden resources;
- simulator bypasses tenant isolation.

### Step-up / JIT
- MFA succeeds but action occurs after assurance timeout;
- JIT access outlives requested window;
- approval revoked after JIT grant issued;
- support/JIT session is reused across tenants.

### Safety invariants
- cannot remove last Access Owner without replacement;
- cannot self-elevate to non-delegable authority;
- role mutation increments auth version;
- high-risk changes require reason/audit.

### 8A Access Control Center
Settings → Access Control → Users / Roles / Assignments / Delegations / Sensitive Access / Policy Simulator / Audit.

### 8B Role Editor
Grouped permissions, risk labels, descriptions, scope compatibility, template/custom state, user count, last modified, impact preview.

### 8C Role Templates
System templates immutable; tenant roles derived within delegation constraints.

### 8D User Access Assignment
Roles, scopes, effective dates, expiry, delegated by, effective access.

### 8E Delegation
`AssignablePermission ⊆ ActorDelegableAuthority`.

### 8F Effective Access Preview
Show CAN / CANNOT / WHY / SCOPE / EXPIRY. Backend-computed.

### 8G Permission Impact Preview
Users/scopes affected, new/removed authority, risk.

### 8H Policy Simulator
Actor + Action + Resource + Context → decision, reason chain, scope, policy version.

### 8I Temporary / JIT Access
Permission, scope, reason, approval, expiry, audit.

### 8J Step-Up Authentication Hooks
Support `REQUIRE_STEP_UP` for security admin, financial reopen, large refund, payroll finalize, support elevation, bank changes and sensitive exports.

## Phase 8 Exit Gate
School access can be safely understood, assigned, reviewed, delegated and audited.

---

# PHASE 9 — Search, Reports, Exports, Activities, Notices & Delivery

## Phase 9 Edge Cases & Early-Resolution Checks

### Global search
- unauthorized record title appears in suggestion;
- search index lags permission revocation;
- recent items retain old access;
- partial word search reveals sensitive identity;
- cross-tenant result cache collision;
- search action exists but target capability was revoked.

### Reports
- report summary includes data actor cannot drill into;
- report generated under stale scope;
- long-running report executes after role revocation;
- generated report remains downloadable after access loss;
- report “as of” timestamp missing;
- BS/AD boundaries alter date ranges.

### Exports
- export bypasses field projection;
- CSV formula injection;
- very large export causes memory exhaustion;
- one export contains multiple tenants due bad join;
- download URL shared with unauthorized user;
- sensitive export generated without MFA/reason.

### Activities
- media consent revoked after publish;
- post audience changes after publication;
- activity references student teacher can no longer access;
- deleted media still cached publicly.

### Notices
- audience changes between preview and publish;
- recipient count differs due last-second enrollment/relationship change;
- duplicate publish/retry;
- corrected notice leaves old notification misleading;
- withdrawn notice remains accessible from push deep link;
- scheduled notice publishes after author loses authority.

### Delivery
- provider reports sent but not delivered;
- duplicate provider callback;
- retry sends duplicate notice;
- one channel succeeds while another fails;
- recipient phone/email changes after queueing;
- sensitive content appears on lock screen.

### Required tests
- authorization-aware search;
- report/export revocation behavior;
- safe CSV generation;
- publish idempotency;
- notification/deep-link re-authorization;
- delivery retry idempotency.

### 9A Global Command/Search
RECENT / PEOPLE & RECORDS / ACTIONS / WORKSPACES.
Server-authorized results only.

### 9B Search Performance
Pagination/limits, cancellation, debounce, no full dataset, tenant/scope filtering.

### 9C Reports Catalogue
Persona/domain grouping.

### 9D Report Parameters
Date range, academic year, class/section, account, status.

### 9E Report Preview
Preview where practical.

### 9F Export Authorization
Read ≠ export ≠ sensitive export.
Server scope + field projection.

### 9G Activities/Milestones
Teacher composer, drafts, moderation, gallery, timeline, consent.

### 9H Notices
Composer, audience, attachments, schedule, recipient preview, approval, publish, correct, withdraw.

### 9I Delivery Operations
M12 owns queue/sent/delivered/read/acknowledged/failed/retry/provider state.

### 9J Failure Queue
Recipient, provider, reason, attempts, retry eligibility, source.

## Phase 9 Exit Gate
Discovery/reporting/communication use centralized authorization and correct module responsibility.

---

# PHASE 10 — Mobile Completion & Offline Hardening

## Phase 10 Edge Cases & Early-Resolution Checks

### Authentication / biometrics
- biometric succeeds after server session expired;
- device biometrics changed/reset;
- secure storage cleared partially;
- multiple school accounts on one device;
- logout fails while offline;
- refresh token revoked remotely.

### Child/persona context
- parent switches child during in-flight request;
- teacher changes persona/role while offline;
- Principal also Teacher and cached screens cross persona;
- wrong child data flashes briefly after switch;
- deep link opens stale child/class context.

### Offline cache
- tenant/user key omitted;
- sensitive cached data survives logout;
- app reinstall restores cloud/device backup containing old data;
- schema migration cannot decode old cache;
- stale record looks current due missing timestamp.

### Offline mutation queue
- same operation enqueued twice;
- queue order matters;
- dependent operations sync out of order;
- device clock wrong;
- record deleted on server while offline edit exists;
- server state version changed;
- authority revoked before sync;
- partial sync succeeds then app crashes;
- idempotency key reused incorrectly.

### Connectivity
- flapping network causes repeated retries;
- Wi-Fi connected but internet unavailable;
- request times out after server committed mutation;
- app backgrounded mid-sync;
- OS kills process during queue flush.

### Notifications/deep links
- target deleted/withdrawn;
- actor lost access;
- tenant switched;
- notification received for old account;
- lock-screen preview leaks sensitive data.

### Required tests
- cache isolation by tenant/user/child;
- logout purge;
- role/guardian revocation purge;
- retry/idempotency;
- out-of-order queue handling;
- sync conflict UX;
- deep-link reauthorization;
- background/resume sync.

### 10A Parent Home
Active child, today's attendance, homework, notice attention, next event, fee/payment when appropriate.

### 10B Parent Updates
Unified child/school updates.

### 10C Parent Calendar
Events, homework due, exam schedule, holidays where supported.

### 10D Parent Requests
Only supported self-service/correction flows.

### 10E Teacher Today
Current/next class, attendance, schedule, tasks, substitutions, sync warnings.

### 10F Teacher Classes
Assignment-scoped.

### 10G Teacher Homework
Mobile-appropriate create/review.

### 10H Principal Overview
Exception-first.

### 10I Principal Attention
Critical items with context.

### 10J Principal Approvals
No blind approval; show what/who/impact/evidence/state/consequence.

### 10K Biometrics
Credential login, first-success prompt, skip, enable later, fallback, revoked session, unavailable biometric.

### 10L Offline Storage
Keys scoped by tenant/user/persona/resource/child/class as applicable.

### 10M Offline Mutation Queue
Safe P0 operations only. Store operation id, idempotency key, timestamp, tenant, actor, resource, base version, sync state.

### 10N Sync Re-Authorization
Every queued mutation rechecks server authority.
Possible outcomes: accepted, authority changed, conflict, locked, validation failed.

### 10O Cache Invalidation
Logout, tenant switch, role revocation, teacher assignment removal, guardian revocation, session revocation.

### 10P Notification Deep Links
Re-authorize target when opened.

## Phase 10 Exit Gate
Mobile passes persona UX, authorization, offline/sync, biometrics, notification, accessibility and iOS/Android checks.

---

# PHASE 11 — P2 Governance, Scale & Final Production Hardening

## Phase 11 Edge Cases & Early-Resolution Checks

### Multi-branch
- same person has different roles in different branches;
- shared staff/student crosses branch boundaries;
- branch transfer leaves old scope active;
- tenant-level Principal should or should not inherit branches explicitly;
- reports aggregate branches while actor has only one branch;
- branch-specific numbering/configuration conflicts.

### Hierarchical scopes
- subject scope does not fit strict tree hierarchy;
- resource moves between scopes;
- inherited permission conflicts with explicit restriction;
- deep hierarchy causes policy latency;
- deleted parent scope leaves child grants dangling.

### Access review
- reviewer lacks authority to review target;
- user has not used permission recently but still legitimately needs it;
- removing access mid-session;
- campaign closes with unresolved items;
- audit evidence for reviewer decision missing.

### PAM / JIT
- emergency access requested during outage when approver unavailable;
- JIT grant expires during critical operation;
- break-glass access not revoked automatically;
- privileged session spans multiple tenants.

### Observability
- metrics expose tenant PII;
- auth logging volume becomes excessive;
- alert storm from expected denies;
- decision latency metric missing cache-hit/cache-miss distinction.

### RLS / policy engine evaluation
- Prisma connection pooling conflicts with session RLS variables;
- background workers lack expected DB policy context;
- dual policy engines produce different decisions;
- migration creates inconsistent auth semantics.

### Performance
- authorization check introduces N+1 queries;
- dashboards load one policy check per row;
- large Student/Staff 360 projections overfetch;
- report/export saturates DB;
- Redis cache invalidation storm;
- 500-school scale creates queue backlogs.

### Backup/recovery
- restore produces duplicate queued jobs;
- restored auth version is older than session/token state;
- ledger restored but provider callbacks continue from newer external state;
- audit retention differs from core DB backup;
- object storage restore is inconsistent with DB metadata.

### Deployment
- rolling deployment has old API + new client contract mismatch;
- migration requires downtime unexpectedly;
- old workers process new payload shape;
- mobile app version remains in market against newer API;
- feature flag/entitlement enables incomplete capability.

### Required final tests
- branch isolation;
- hierarchical scope correctness;
- access-review audit;
- JIT expiry/revocation;
- load/stress/soak;
- backup restore drill;
- rolling-deploy compatibility;
- old-mobile/new-API contract compatibility.

### 11A Branch/Campus Scope
TENANT + BRANCH when product requirements are ready.

### 11B Hierarchical Scope Resolution
Explicit tenant/branch/year/class/section rules; subject remains orthogonal where appropriate.

### 11C Access Review Campaigns
Keep / Modify / Remove for Finance, HR, Payroll, Security.

### 11D Role Governance
Role owner, change approval, periodic certification, template version.

### 11E Privileged Access Management
JIT + approval + MFA + reason + expiry + audit.

### 11F Authorization Versioning
Track permissionCatalogVersion, roleTemplateVersion, policyVersion.

### 11G Authorization Observability
Deny count, cross-tenant attempts, policy latency, support elevation, critical permission use, stale-scope and self-approval attempts.

### 11H Optional PostgreSQL RLS Evaluation
Targeted defense-in-depth only when justified.

### 11I External Policy Engine Evaluation
Evaluate OPA/Cedar/OpenFGA/SpiceDB/Casbin only if internal architecture proves insufficient.

### 11J Performance Hardening
Profile dashboards, directories, 360 views, attendance, marks, fees, accounting, search, reports, authorization checks.
Fix N+1, indexes, pagination, cache and queue issues.

### 11K Low-Bandwidth Hardening
Partial failures, stale state, no fake zero, safe retries, deferred media, pagination, search cancellation.

### 11L Accessibility Audit
WCAG 2.2 AA priority flows; mobile screen reader/text/target/order/non-color status.

### 11M Nepal Localization QA
English, Nepali, NPR, Nepal timezone, BS/AD, phones, addresses, IEMIS and fiscal terminology.

### 11N Visual Regression
Canonical baselines:
- App Shell
- Admin Home
- Teacher Today
- Principal Attention
- Student Directory
- Student 360
- Attendance Register
- Marks Grid
- Fee Collection
- Accounting Reconciliation

### 11O Security Regression
Cross-tenant, IDOR, scope bypass, guardian bypass, teacher assignment bypass, self-approval, privilege escalation, support override, export auth, offline stale authority.

### 11P Backup / Restore / Recovery
DB backups, migration recovery, restore runbook, queue recovery, financial consistency, audit preservation.

### 11Q Release Readiness
Migrations, env config, secrets, health, observability, rate limits, timeouts, provider readiness, security headers, builds, mobile signing/config.

## Phase 11 Exit Gate
System is ready for larger Nepal deployments only when authorization governance, multi-branch readiness where needed, performance, accessibility, low-bandwidth, localization, security/visual regression, backup/recovery and observability pass.

---

# 12. Hard Dependencies

```text
Phase 1 before Phase 2
Phase 2 before sensitive Phase 5/6/7 production exposure
Phase 3 before broad Web redesign
Phase 7 before finance governance is considered mature
Phase 8 before broad custom role/delegation usage
Phase 9 search/export depends on server authorization projection
Phase 10 offline mutation depends on server re-authorization
Phase 11 only after P0/P1 maturity
```

---

# 13. Safe Parallel Work

Some work may run in parallel if gates are respected.

Examples:
- Design System v2 can progress while domain authorization policies mature, but protected screens stay disabled/unreleased.
- Mobile theme/navigation primitives can progress before full auth migration, but protected actions are not considered complete.
- Test infrastructure can be improved in parallel when it does not alter product semantics.

---

# 14. Recommended Branch / PR Strategy

Prefer coherent slices:

```text
docs/authz-baseline-audit
feat/authz-permission-catalog
feat/authz-decision-kernel
feat/authz-typed-scopes
test/authz-cross-tenant-hardening
feat/authz-teacher-policy
feat/authz-guardian-policy
feat/authz-finance-sod
feat/authz-payroll-sod

feat/web-design-system-v2
feat/web-app-shell
feat/web-persona-homes

feat/students-directory-v2
feat/student-360

feat/attendance-workspace
feat/academics-readiness
feat/marks-grid
feat/homework-workspace
feat/timetable-workspace

feat/fees-operations
feat/hr-staff-360
feat/payroll-lifecycle
feat/accounting-reconciliation

feat/access-control-center
feat/authz-delegation
feat/authz-policy-simulator

feat/global-search
feat/reports-exports
feat/notices-delivery

feat/mobile-persona-redesign
feat/mobile-offline-hardening

test/production-hardening
```

If explicitly working on `main`, preserve the same commit boundaries.

---

# 15. Phase Status Tracking

Use a lightweight checklist/issue system.

Do not mark a phase complete because code exists.
Mark complete only when exit gate passes.

---

# 16. Risk Classification

- LOW — UI-only/docs
- MEDIUM — client state/non-sensitive backend
- HIGH — auth/tenancy/sensitive data/offline sync
- CRITICAL — finance posting/payroll finalization/role security/support access/fiscal reopen

---

# 17. Verification Matrix by Risk

## LOW
- targeted tests
- lint/typecheck/analyze
- visual verification

## MEDIUM
- unit tests
- integration where needed
- lint/typecheck
- build
- functional/visual QA

## HIGH
- unit
- integration
- negative auth tests
- cross-tenant tests
- migration tests
- build
- observability checks

## CRITICAL
All HIGH checks plus:
- transaction tests
- idempotency/replay tests
- audit verification
- rollback/reversal tests
- privilege-escalation tests

---

# 18. Definition of Done — Slice

A slice is complete only if:
- requirements implemented;
- no known security weakening;
- tenant isolation preserved;
- server authorization authoritative;
- schema migrated safely;
- contracts consistent;
- UI consumes server capability;
- negative tests added;
- relevant tests pass;
- build/analyze passes;
- visual QA completed when UI changed;
- offline impact checked where relevant;
- audit verified for high-risk actions;
- no placeholder path remains.

---

# 19. Definition of Done — Phase

A phase is complete only when:
1. all required slices are complete;
2. phase exit gate passes;
3. regression tests are green;
4. no high/critical defect is silently deferred;
5. root playbooks remain consistent;
6. implementation evidence exists in code/tests/migrations;
7. next phase prerequisites are satisfied.

---

# 20. Codex Prompt Template — Phase

```text
# SchoolOS Implementation Task — Phase X

Repository:
erwinshrestha17/SchoolOS

Target:
<phase name>

Before editing:
1. Fetch latest repository state.
2. Record starting SHA.
3. Ensure working tree is clean.
4. Read AGENTS.md.
5. Read SCHOOLOS_RBAC_AUTHORIZATION_IMPLEMENTATION.md when authorization/data scope is affected.
6. Read SCHOOLOS_WEB_DESIGN_ASTRA.md when Web is affected.
7. Read SCHOOLOS_APP_DESIGN_ASTRA.md when Mobile is affected.
8. Audit current implementation first.

Mission:
Implement Phase X of the SchoolOS coordinated implementation roadmap.

Do NOT repeat work already correctly implemented.
Do NOT begin later phases except for a minimal direct prerequisite.

Complete each slice end-to-end:
DB/schema → backend/domain → authorization → API/shared contract → Web/Mobile where applicable → tests.

Preserve:
- Nepal-only scope;
- tenant isolation;
- backend authority;
- financial integrity;
- offline safety;
- deferred module boundaries;
- existing architecture unless change is justified.

Verification must match impact.

At completion report:
- starting SHA
- commits
- files changed
- migrations
- authorization changes
- API changes
- Web changes
- Mobile changes
- tests/checks run
- results
- blockers
- next recommended slice
```

---

# 21. Codex Prompt Template — Slice

```text
# SchoolOS Implementation Task — Phase X / Slice X.Y

Read:
- AGENTS.md
- applicable scoped root playbooks
- current implementation

Implement ONLY Slice X.Y.

Audit first.

Do not rewrite already-correct functionality.
Do not widen scope.
Do not skip security prerequisites.

Finish the slice end-to-end and satisfy its exit criteria.

Run all required tests for its risk level.

If a later-phase change is necessary only as a direct prerequisite, keep it minimal and document why.

Return:
- current state found
- implementation completed
- files changed
- schema/migration changes
- authorization/security impact
- tests and results
- unresolved issues
- next slice
```

---

# 22. Recommended Codex Session Sequence

```text
Session 01 — Phase 0
Session 02 — Phase 1A
Session 03 — Phase 1B
Session 04 — Phase 1C + 1D

Session 05 — Phase 2A
Session 06 — Phase 2B
Session 07 — Phase 2C
Session 08 — Phase 2D + 2E

Session 09 — Phase 3
Session 10 — Phase 4

Session 11 — Phase 5A–5D
Session 12 — Phase 5E–5I

Session 13 — Phase 6A–6D
Session 14 — Phase 6E–6H
Session 15 — Phase 6I–6L

Session 16 — Phase 7A–7F
Session 17 — Phase 7G–7K
Session 18 — Phase 7L–7S

Session 19 — Phase 8A–8E
Session 20 — Phase 8F–8J

Session 21 — Phase 9A–9F
Session 22 — Phase 9G–9J

Session 23 — Phase 10A–10J
Session 24 — Phase 10K–10P

Session 25 — Phase 11A–11G
Session 26 — Phase 11H–11Q
```

Adjust only when repository reality shows slices are much smaller/larger.

---

# 23. Prohibited During This Roadmap

Do not:
- mark docs complete without implementation;
- implement UI-only permissions;
- trust client tenant/ownership;
- expose full Student 360 and hide tabs;
- create superuser roles for convenience;
- merge Platform and tenant roles;
- expand deferred modules;
- use floating point for money;
- bypass maker-checker;
- overwrite immutable history;
- accept stale offline authority;
- remove failing tests to get green;
- create a second UI system;
- introduce an external auth engine prematurely;
- implement all phases in one huge unreviewable change.

---

# 23A. Edge-Case Completion Checklist

Before any phase is marked complete, Codex MUST answer:

```text
[ ] Cross-tenant IDs tested
[ ] Revoked/expired authority tested
[ ] Concurrent update/race tested where relevant
[ ] Duplicate request/replay tested where relevant
[ ] Partial failure behavior defined
[ ] Network timeout after server commit considered
[ ] Stale cache/session behavior considered
[ ] Background job behavior considered
[ ] Export/file/download path considered
[ ] Audit behavior verified for sensitive changes
[ ] Rollback/reversal/recovery path defined
[ ] Localization/date/time boundary considered
[ ] Pagination/bulk behavior considered
[ ] Unauthorized direct URL/API access tested
[ ] Offline behavior considered
[ ] Mobile deep-link behavior considered where applicable
[ ] No sensitive data leaks through logs/errors/search/cache
```

For HIGH or CRITICAL slices, incomplete answers block phase completion.

# 24. Final Program Goal

At completion, SchoolOS should be:

```text
secure
tenant-isolated
RBAC + scope + relationship aware
auditable
financially correct
offline-safe
mobile-first where appropriate
desktop-efficient where appropriate
accessible
low-bandwidth aware
production observable
recoverable
```

Backend, Web, Mobile and RBAC must behave as one product.

---

# Final Execution Principle

Do not optimize for finishing the most files.

Optimize for closing **one safe dependency layer at a time**.

```text
Understand
→ Secure
→ Standardize
→ Expose
→ Operate
→ Govern
→ Scale
```

Every phase should leave SchoolOS safer, more coherent, and easier for the next phase to build on.
