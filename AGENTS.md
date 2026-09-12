# SchoolOS Agent Operating Contract

This file is the single repository-wide source of truth for durable SchoolOS product boundaries, architecture invariants, security rules, engineering behavior, and autonomous-agent execution policy.

It is written for autonomous software-engineering agents: high-signal instructions, explicit authority, bounded autonomy, proportional verification, and deterministic completion criteria.

# Part I — Agent Constitution

## 1. Authority and instruction precedence

Follow this order:

1. Higher-priority runtime, platform, safety, and tool instructions.
2. The project owner's explicit instruction for the current task.
3. This root `AGENTS.md`.
4. Running code, Prisma schema/migrations, generated contracts, configuration, tests, CI, and Git history as evidence of current implementation.

Important distinctions:

- `AGENTS.md` defines durable repository rules and invariants.
- Code, schema, migrations, configuration, tests, and CI define what is actually implemented now.
- Prose never proves implementation completion.
- A current task may intentionally change a durable rule; when it does, update this file in the same change.
- Do not create another Markdown source of truth.
- If repository evidence conflicts with this file, do not silently choose one. Preserve safety, identify the conflict, and resolve it within the requested scope when possible.

## 2. Rule strength

Interpret requirement words consistently:

- **MUST / MUST NOT** — hard invariant. Do not violate without explicit project-owner instruction or a higher-priority instruction.
- **SHOULD / SHOULD NOT** — default engineering policy. Deviate only when repository evidence provides a stronger technical reason.
- **MAY** — optional implementation choice.

Security, tenant isolation, financial integrity, authoritative history, protected-data access, and fail-closed rules are MUST-level even when surrounding prose uses less formal wording.

## 3. Agent operating mode

Bias toward action and completion.

When asked to implement, fix, audit, refactor, harden, migrate, redesign, investigate, prepare a PR, or make the repository production-ready:

1. Infer routine implementation details from repository evidence and established patterns.
2. Inspect relevant implementation before proposing or editing.
3. Persist until requested scope is complete, verified, or blocked by a legitimate external dependency.
4. Do not stop merely because work is large, multi-layered, unfamiliar, or reveals additional in-scope defects.
5. Ask a question only when missing information can materially change security, data integrity, legal/compliance behavior, irreversible architecture, destructive actions, or the user's intended outcome and cannot be resolved from repository evidence.
6. Prefer the smallest coherent end-to-end change over speculative redesign.
7. Fix directly related defects discovered during the task when they are safely bounded and required for correctness.
8. Do not broaden into unrelated cleanup.
9. Adapt immediately to new instructions or mid-task corrections without discarding already verified work.
10. Use parallel investigation/subagents when available and independent workstreams materially improve speed or confidence.

For long-running work, keep progress reports concise and factual: findings, decisions, blockers, changed files, verification, and remaining risk.

## 4. Decision hierarchy

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
11. UX/accessibility polish.
12. Implementation convenience.

A lower item MUST NOT override a higher item merely because it is easier or faster.

## 5. Scope control

A discovered defect is automatically in scope only when at least one is true:

- it prevents the requested behavior from working correctly;
- it creates a security, tenant-isolation, data-integrity, financial, privacy, or compliance risk in the changed path;
- it causes required verification to fail because of the change;
- leaving it unfixed would make the requested implementation knowingly incomplete;
- it is a direct regression introduced by the current work.

Otherwise:

- do not fix it automatically;
- note it in the PR/final report when material;
- continue the requested task.

Do not convert a bounded task into repository-wide refactoring without explicit need.

## 6. Legitimate stop conditions

Stop implementation only when one of these applies:

- required credentials, account access, environment access, or external authorization are unavailable;
- an external provider/authority prevents further execution;
- a destructive or irreversible action requires project-owner authorization;
- repository evidence presents materially conflicting product requirements that cannot be reconciled safely;
- proceeding would create unacceptable risk of irreversible production data loss or unauthorized access;
- the requested behavior cannot be implemented safely with available authority or tooling.

A failing test, difficult bug, large diff, unfamiliar code, or long execution time is not by itself a blocker.

## 7. Task classification

Before implementation, classify the task into one or more categories:

- **A — Documentation/policy**
- **B — UI-only / presentation**
- **C — Client application logic**
- **D — API/domain logic**
- **E — Database/schema/migration**
- **F — Authorization/security/protected data**
- **G — Financial/accounting/payment**
- **H — Offline/synchronization/concurrency-sensitive client state**
- **I — External provider/integration**
- **J — Production/release/recovery**

The highest-risk applicable classification governs verification and completion requirements.

# Part II — SchoolOS Hard Invariants

## 8. Product mission and roadmap boundary

SchoolOS is a Nepal-first, multi-tenant school operating system for Nepalese schools. The active roadmap is strictly Nepal-scoped unless the project owner explicitly changes that boundary.

Delivery priority:

1. P0 — safety, correctness, auditability, controlled-pilot readiness.
2. P1 — operational maturity and broader Nepal market readiness after P0.
3. P2 — Nepal-wide scale, multi-branch and institutional readiness after P1.

While any P0 release gate remains open, feature breadth MUST NOT outrank tenant isolation, authorization, guardian correctness, attendance correctness, academic integrity, financial integrity, privacy, offline safety, compliance correctness, recovery, or reproducible verification.

During P0, do not expand M8 Library, M9 Transport, M10 Canteen, M13 Learning, international curricula, OneRoster/LTI, foreign compliance, or unrelated breadth unless requested work directly resolves a P0 risk. Existing working code may remain safely isolated or disabled.

Chat/conversations are removed from the active product. M15 owns official notices and announcements. M12 owns notification delivery, retries, provider state, acknowledgements, and delivery diagnostics.

## 9. Repository architecture

Canonical surfaces:

- `apps/api` — NestJS backend and authoritative server-side business rules.
- `apps/web` — Next.js tenant-facing school web application.
- `apps/schoolos_mobile` — Flutter Parent, Teacher, and Principal mobile application.
- `packages/core` — shared contracts, permissions, entitlements, localization/date primitives, and cross-surface types where appropriate.
- PostgreSQL/Prisma — authoritative persistence, constraints, and migrations.
- Redis/queues/providers — operational infrastructure where configured.

Architecture rules:

- Backend services MUST remain authoritative for authorization, financial calculations, state transitions, conflict decisions, and sensitive business rules.
- Clients are presentation and interaction surfaces, not security authorities.
- Client-calculated totals, ownership, tenant context, role claims, permission decisions, or authoritative status MUST NOT be trusted.
- Existing domain boundaries and repository patterns SHOULD be preferred before introducing new abstractions.
- Broad rewrites SHOULD be avoided when a bounded change preserves contracts and security invariants.

## 10. Source-of-truth matrix

Use these authorities when deciding where logic belongs:

| Concern | Authoritative source |
| --- | --- |
| Authenticated identity | server authentication context |
| Tenant identity | trusted server authentication/tenant context |
| Authorization | backend capability + resource-scope checks |
| Database structure | Prisma schema + migrations |
| Persistence invariants | database constraints/indexes + domain logic |
| Money calculations | backend/domain services using precise monetary types |
| Accounting state | M11 authoritative ledger/accounting records |
| Teacher scope | active authoritative assignment data |
| Guardian scope | active verified guardian relationship + capability |
| Feature entitlement | server entitlement resolution |
| API contract | backend/OpenAPI/shared contracts |
| Compliance policy | versioned/effective-dated authoritative configuration/evidence |
| School timezone/day semantics | school configuration; Nepal defaults only when appropriate |
| UI composition | client presentation state only |
| Offline cached authorization | never authoritative; re-check on synchronization |

When fixing a defect, fix the authoritative source rather than layering a client workaround over incorrect server state.

## 11. Platform control plane versus school application

The SchoolOS Platform/control plane and each school's management application are separate security domains even if they share a monorepo or selected infrastructure.

- Platform Operators manage tenants, entitlements, platform operations, provider configuration, releases, compliance-policy distribution, support/security operations, and cross-tenant platform audit.
- School personas operate only within one tenant and their authorized resource scope.
- Principal/Admin privilege inside a school never implies Platform Operator privilege.
- Platform routes/capabilities MUST remain separate from ordinary school roles and dashboards.
- Support access into tenant data MUST be exceptional, reason-bound, scoped, time-limited, auditable, and read-only by default where possible.
- Never implement a permanent unrestricted "developer can see everything" mode.

## 12. Canonical modules and personas

Canonical module taxonomy:

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

These exact product names are canonical markers: M1 Admissions and Student Profiles; M2 Smart Attendance; M3 Fees and Receipts; M4 Academics, Exams, CAS, Report Cards; M5 Activity Feed and Milestones; M6 Homework and Timetable; M7 HR and Payroll; M8 Library; M9 Transport; M10 Canteen; M11 Accounting and Finance; M12 Notifications and Delivery; M15 Notices and Announcements.

Persona/surface boundaries:

- Parent/Guardian — mobile-first, linked-child self-service only.
- Teacher — web and mobile, assignment/capability scoped.
- Admin — web, tenant-scoped school configuration and operations.
- Principal — web and mobile, oversight, attention, controlled approvals, school reporting.
- HR — web, staff administration and payroll scope.
- Accountant — web, fees, reconciliation, accounting, finance reporting, permitted payroll-posting scope.
- Platform Operator — separate control-plane identity and capability domain.

Mobile is not a compressed copy of web. Mobile SHOULD prioritize frequent, time-sensitive, one-handed persona workflows. Web SHOULD own dense configuration, bulk operations, high-risk changes, complex corrections, governance, exports, and administrative workflows unless a safe mobile use case is explicit.

Navigation visibility is never authorization.

## 13. Tenant isolation and authorization

Every tenant-owned read, write, file, export, report, cache, queue job, notification resolution, and synchronization operation MUST derive tenant authority from trusted authenticated context.

- Client-supplied `tenantId` MUST NOT be trusted as authorization context.
- Cross-tenant identifiers MUST fail without disclosing another tenant's data.
- Suspended tenants and unavailable/disabled/missing/failed entitlement resolution MUST fail closed.
- UI module hiding is not a security control.

Authentication and authorization are separate concerns.

- A valid session does not imply permission for a resource or action.
- Authoritative operations MUST use explicit capability checks plus resource scope.
- Generic role checks MUST NOT replace scoped authorization for authoritative actions.
- Server authorization MUST remain effective when clients are stale, offline, modified, or malicious.

### Teacher scope

Teacher reads/writes MUST match active assignment authority across dimensions relevant to the operation, including tenant, academic year, class, section, subject, period, assessment, or assessment component where applicable.

- Homeroom authority does not grant every subject write.
- Subject teaching does not automatically grant homeroom attendance authority.
- Assignment removal MUST remove authority immediately and invalidate affected cached/offline scope.

### Guardian scope

Parent access requires an active, verified guardian relationship for the selected student and tenant, applicable capability, valid effective period, and no blocking restriction.

- Never substitute another linked child when the requested child is unauthorized or unknown.
- Guardian revocation/suspension MUST take effect immediately on the server and invalidate now-inaccessible client data.
- Academic, attendance, fee, document, pickup, emergency, and legal/custody capabilities may differ.

## 14. Sensitive records, files, and mobile authentication

Apply least privilege to medical data, disability/support information, custody/safeguarding records, identity documents, salary/bank data, and other protected records.

- Authorize every protected-file access, not only URL creation.
- Respect consent and media-consent state.
- Audit sensitive access where required.
- Revoke access promptly when identity, role, assignment, guardian scope, tenant state, or session authority changes.
- Do not expose sensitive content in lock-screen notification previews.

Parent, Teacher, and Principal mobile users MAY enable optional device biometrics only after successful credential authentication.

- Prompt after first successful login when supported.
- Users may skip and enable later in Settings.
- Keep secure password/credential fallback.
- Use OS biometric facilities for local unlock only; never store raw biometric templates.
- Logout, revocation, tenant/school switch, assignment removal, guardian revocation, and account disablement MUST purge or render inaccessible any now-unauthorized local data.

## 15. Domain integrity

### M2 attendance

Canonical lifecycle:

`Draft -> Submitted -> Finalized/Locked -> Correction Requested -> Approved/Reopened -> Corrected -> Re-locked`

Required invariants:

- Homeroom and period writes require exact active authority.
- Roster access is assignment scoped.
- Submission and offline replay are idempotent.
- Original and corrected values remain auditable.
- Corrections require reason and controlled reopen authority where configured.
- Locked records cannot be silently edited.
- Parent visibility uses authoritative/finalized state.
- Assignment removal invalidates stale write scope.

### M4 academics, marks, results, report cards

Marks writes require exact active assignment and resource scope.

Canonical state concepts:

`Draft -> Submitted -> Returned -> Resubmitted -> Reviewed -> Locked -> Published -> Withdrawn/Corrected -> Republished`

- Class teachers may see completion status without gaining authority over other teachers' marks.
- Result publication and marks unlock are distinct elevated capabilities.
- Reopen/unlock actions require explicit reason and audit history.
- Parents MUST NOT receive draft/unpublished results.
- Corrected published results preserve prior versions/publication history.
- Report cards and academic documents are protected files.

## 16. Offline and synchronization

SchoolOS MUST remain useful under unreliable or absent connectivity without converting stale client state into authority.

P0 offline-safe scope is intentionally bounded to approved workflows such as attendance drafts, homework/activity drafts, cached timetable, cached assigned roster, and read-only notices/notifications.

High-risk authoritative mutations MUST NOT occur offline during P0, including fee payment/cashier close, accounting posting, payroll finalization, result publication, marks unlocking, guardian changes, role/permission/entitlement changes, compliance configuration, or government export approval/submission.

Offline rules:

- Cache keys/storage MUST remain tenant + identity + resource scoped.
- Sensitive cached data requires secure storage appropriate to the platform.
- Offline writes require durable operation identity/idempotency.
- Synchronization MUST re-check current server authority.
- Conflicts MUST be explicit and resolvable.
- Never use silent last-write-wins for attendance, marks, finance, guardian relationships, or protected student information.
- Never serve one child/tenant/user's cached data as fallback for another.

## 17. Financial integrity: M3, M7, M11

M11 is the authoritative accounting layer. M3 Fees/Receipts and M7 Payroll hand off controlled, idempotent accounting events into M11.

Non-negotiable:

- Authoritative money MUST use precise monetary types; never floating-point arithmetic.
- Durable financial identifiers MUST be generated server-side.
- Payment creation, callbacks, retries, and subledger-to-ledger posting MUST be idempotent when replay is possible.
- Provider callbacks MUST be verified according to integration contract.
- Pending/unconfirmed payment is not paid.
- Receipt/invoice sequence integrity MUST be preserved.
- Issued/posted financial documents and ledger history are immutable in business meaning.
- Corrections occur through reversal, refund, credit/debit note, adjustment, or replacement with explicit lineage.
- Failed/unposted events remain visible and retryable.
- Reconciliation discrepancies remain explicit until resolved.
- Multi-record financial state transitions use database transactions where atomicity is required.
- Persistence constraints/unique indexes SHOULD enforce invariants where safe.

Do not claim statutory, tax, payroll, CBMS, or IRD compliance merely because calculations or document formats exist.

## 18. Nepal compliance and localization

### Nepal IRD / fiscal

Treat mutable fiscal policy as versioned/effective-dated configuration and evidence, not scattered constants.

- Preserve authority/reference, effective period, applicability, rates/exemptions, status, and evidence.
- Historical transactions use policy valid for the relevant transaction/document date.
- Distinguish SchoolOS accounting/billing from official IRD electronic-billing enlistment/approval.
- Distinguish local transaction state from external fiscalization/CBMS confirmation.
- Never fabricate external submission success while the authority/provider is unavailable.
- If online fiscalization is required at issue time, offline operation MUST NOT fabricate compliance.
- Any taxpayer incentive/prize integration requires an authorized interface and authority-issued status/reference; never invent coupon codes.

### Nepal education / IEMIS

Mutable education rules MUST be versioned/effective-dated rather than hard-coded across features.

IEMIS readiness begins with reproducible export, not an unsupported direct-sync claim.

Exports SHOULD preserve schema/version, required-field validation, immutable source snapshot identity/checksum, reviewer/approval state, submission status where applicable, and correction/re-export lineage.

Do not claim direct CEHRD/IEMIS synchronization unless an officially authorized interface exists and is configured.

### Localization

Preserve Nepal-specific correctness:

- Nepali Unicode and English where required.
- `Asia/Kathmandu` school-day/time behavior.
- NPR formatting.
- Nepal phone/address validation.
- province/district/local-level/ward hierarchy.
- BS and AD display where required.
- unambiguous canonical server-side date/time storage.
- Nepal academic/fiscal labels and effective periods.

Authoritative BS dates MUST NOT be stored as ambiguous display strings.

# Part III — Engineering Playbook

## 19. Engineering rules

Prefer:

- explicit domain/service boundaries;
- server-authoritative validation and state transitions;
- transactions for multi-record invariants;
- database constraints for persistence-level invariants;
- idempotent retriable writes;
- bounded pagination and projections;
- indexed production queries;
- background jobs for long-running work with preserved tenant/authorization context;
- structured logs with request/correlation context;
- explicit external-provider timeouts;
- bounded retries only where safe;
- schema migrations for database changes;
- deliberate API/mobile backward compatibility where required.

Avoid:

- business logic duplicated across web/mobile;
- authorization implemented only in UI/route guards;
- N+1 query patterns;
- unbounded list endpoints;
- full-table client-side projection;
- broad exception swallowing;
- retrying non-idempotent authoritative operations without durable idempotency;
- manual production database patching as deployment strategy;
- secrets, credentials, production tokens, or private keys in Git;
- logging sensitive payloads;
- speculative abstractions that do not solve the requested problem.

## 20. Database migrations

Schema changes MUST:

- include a migration;
- preserve existing production data unless explicit destructive migration is authorized;
- prefer additive/expand-contract transitions when practical;
- consider mixed-version deploy compatibility when API/mobile/web may not deploy atomically;
- include safe backfill strategy when making existing data newly required;
- preserve tenant ownership constraints;
- preserve financial, audit, and published academic history;
- define recovery implications for high-risk changes.

Never edit an already-applied production migration merely to make current schema validation pass. Add a new corrective migration.

## 21. Concurrency and idempotency

For authoritative writes, determine whether concurrent execution or replay can violate an invariant.

Use one or more as appropriate:

- database transactions;
- row/version checks;
- unique constraints;
- optimistic concurrency;
- explicit locking where justified;
- durable idempotency keys;
- compare-and-set/state preconditions.

A read-then-write sequence is not safe merely because it passes a single-user test.

Concurrency-sensitive domains include attendance finalization/correction, marks/result state transitions, payment/receipt creation, accounting posting, payroll finalization, guardian/role changes, inventory-like counters, and synchronization replay.

## 22. External providers and retries

External calls SHOULD have explicit timeout, bounded retry policy, structured failure handling, and observable correlation context.

- Retry only idempotent operations or operations protected by durable idempotency.
- Never convert provider timeout/unknown state into authoritative success.
- Persist provider reference/state where needed for reconciliation.
- Verify callbacks/webhooks according to provider contract.
- Separate local acceptance from external confirmation when semantics differ.

## 23. UX and accessibility

SchoolOS UI MUST be role-aware, task-oriented, consistent, and suitable for frequent school use.

- Prefer server-authoritative persona projection; client composition is presentation, not authorization.
- Important workflows SHOULD represent loading, empty, error, denied, disabled-module, expired-session, stale, retry, and conflict states where applicable.
- High-risk or dense configuration belongs on web unless a specific safe mobile workflow is required.
- Mobile primary actions SHOULD support one-handed frequent use.
- Target WCAG 2.2 AA principles for priority web flows and equivalent mobile accessibility: labels, keyboard/focus, screen-reader semantics, touch targets, text scaling, contrast, reduced motion, non-color-only status, and accessible validation/authentication.

Do not treat old screenshots, deleted wireframes, or historical design prose as authority. Inspect current components/tokens and actual product surfaces.

# Part IV — Execution and Delivery

## 24. Task execution protocol

### Before editing

1. Read this file.
2. Classify the task using Section 7.
3. Inspect affected code, schema, shared contracts, permissions, tests, current CI behavior, and relevant Git history when necessary.
4. Determine authoritative source for each relevant value/state transition.
5. Identify tenant/persona/resource authorization implications.
6. Identify concurrency, idempotency, offline, audit, migration, compatibility, and provider implications where applicable.
7. Search for existing patterns before introducing new ones.

### While editing

1. Make the smallest coherent end-to-end change.
2. Keep backend, shared contracts, web, mobile, schema, and tests consistent where change crosses boundaries.
3. Prefer fixing the authoritative source over client workarounds.
4. Add meaningful negative-path coverage for authorization, scope, conflict, replay, concurrency, or failure behavior when risk warrants it.
5. Preserve immutable/auditable history for authoritative domains.
6. Do not disable quality gates, loosen validation, weaken authorization, or delete failing tests merely to obtain green CI.

### Before completion

1. Review complete diff for scope creep, secrets, generated artifacts, stale comments, accidental formatting churn, and unintended behavior.
2. Run verification proportional to actual impact.
3. Inspect failures instead of rerunning blindly.
4. Distinguish failures caused by the change from pre-existing failures.
5. Do not report a failing required gate as passing.
6. State unresolved limitation or external blocker explicitly.

## 25. Verification matrix

Use the narrowest meaningful checks first; broaden when risk, failures, or touched boundaries justify it.

| Task class | Minimum verification expectation |
| --- | --- |
| A — Documentation/policy | relevant contract tests; diff review for policy loss/contradiction |
| B — UI-only | targeted UI tests; lint/typecheck for affected client; visual/browser check when behavior requires it |
| C — Client logic | targeted client tests; typecheck/lint; API/shared-contract compatibility |
| D — API/domain | format/typecheck; targeted unit tests; integration/E2E when persistence/auth/state transitions are involved |
| E — Database/schema | Prisma/schema validation; migration review; affected integration tests; backfill/recovery assessment |
| F — Authorization/security | negative authorization tests; cross-tenant/resource-scope tests; protected-data checks |
| G — Financial/accounting | transaction, idempotency, callback/replay, reversal/refund, reconciliation and persistence tests as applicable |
| H — Offline/sync | replay, conflict, stale-authority, tenant/identity cache separation, reconnect tests |
| I — External integration | timeout, retry, callback verification, unknown-state and idempotency tests |
| J — Production/release | canonical full release gates + exact SHA + migration/recovery/security evidence |

Current repository commands include, as applicable:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm test:integration`
- `pnpm build`
- `pnpm verify:deploy`

For the current web source-of-truth contract, `pnpm --filter @schoolos/web test` exercises `apps/web/test/*.test.mjs`, including `AGENTS.md` markers.

For mobile-impacting changes, CI pins Flutter `3.44.0`. Relevant checks are:

- `dart format lib test` followed by review of resulting diff;
- `flutter analyze`;
- `flutter test --exclude-tags golden`;
- targeted widget/device validation when UX behavior requires it.

Once required checks pass, do not repeatedly rerun or broaden them unless new edits, failures, or unresolved risk justify it.

## 26. Existing failing baseline / red-main policy

If `main` is already failing:

1. Establish the baseline failure before attributing it to the current branch/change.
2. Compare baseline and changed-branch failure fingerprints when practical.
3. Do not silently repair unrelated baseline failures unless requested or they become directly in scope under Section 5.
4. Verify the current change does not introduce new failures.
5. Report clearly:
   - baseline failure;
   - branch/current failure;
   - whether the failure fingerprint changed;
   - what verification for the requested change did pass.
6. Never call the repository or branch "green" while required CI remains red.

A documentation-only change does not automatically own unrelated API/mobile formatting or test failures, but those failures still MUST be reported accurately.

## 27. Definition of Done

A task is complete only when every applicable item is true:

- requested behavior is implemented;
- tenant isolation is preserved;
- authorization is enforced server-side at the resource/action boundary;
- schema/migration changes exist when persistence changed;
- API/shared/client contracts are consistent;
- concurrency/idempotency implications are handled where relevant;
- offline behavior remains bounded and safe where relevant;
- audit/history requirements are preserved;
- external-provider unknown/failure states are explicit where relevant;
- loading/empty/error/denied/stale/conflict states are handled for user-facing flows where relevant;
- meaningful verification passed for the changed scope;
- accessibility was considered for user-facing changes;
- no placeholder, fake success, disabled gate, or knowingly broken path is hidden;
- remaining limitations are explicit.

Do not mark work complete merely because the happy path compiles.

## 28. Destructive operations

Without explicit project-owner instruction, agents MUST NOT:

- reset, drop, truncate, or irreversibly rewrite a non-test database;
- delete production/staging tenant data;
- rewrite applied migration history;
- force-push shared/protected branches;
- destructively rewrite posted financial history;
- destructively rewrite published academic/audit history;
- mass-delete protected/uploaded files;
- invalidate production credentials/secrets;
- bypass backup/recovery safeguards;
- disable tenant/security controls to simplify migration or testing.

Use disposable/local/test environments for destructive verification whenever possible.

## 29. Prohibited actions

Do not:

- weaken tenant isolation, authorization, or validation to unblock UI;
- trust client-provided tenancy, ownership, role, permission, financial totals, or authoritative status;
- silently substitute another student/child/tenant/user/resource when access fails;
- convert unknown, stale, pending, or unavailable state into success;
- fabricate provider, payment, IRD, IEMIS, notification, or synchronization success;
- destructively rewrite posted financial or published academic history;
- use floating-point arithmetic for authoritative money;
- permit unsafe high-risk offline writes during P0;
- add automatic retries to non-idempotent writes;
- remove/skip failing tests solely to make CI green;
- disable a quality gate without explicit task justification;
- introduce international expansion requirements unless explicitly requested;
- resurrect open chat/conversations;
- create duplicate agent instruction files or competing Markdown specifications;
- claim production/pilot readiness from old evidence instead of current verification.

## 30. Pull-request and change contract

Before opening or merging a PR:

- review the complete diff;
- remove accidental formatting churn and unrelated edits;
- verify no secrets or credentials are included;
- verify migrations/contracts/tests are included when required;
- run impact-proportional verification;
- avoid creating duplicate PRs for the same branch/work.

PR/final change summary SHOULD state:

- what changed;
- why it changed;
- affected surfaces/domains;
- authorization/security impact;
- database/migration impact;
- offline/concurrency/idempotency impact when relevant;
- tests/checks executed;
- known failures;
- pre-existing failures distinguished from introduced failures;
- remaining risk or limitations.

When the project owner explicitly requests merge, merge only the intended PR/branch and verify the resulting PR/main state afterward.

## 31. Documentation policy

The repository deliberately permits one tracked Markdown policy/documentation file: `/AGENTS.md`.

Do not add README files, nested `AGENTS.md`, module/design/audit Markdown, Markdown release trackers, Markdown evidence directories, or Markdown runbooks/checklists unless the project owner explicitly changes this policy.

Put:

- durable cross-repository rules in this file;
- implementation truth in code/schema/config/tests/CI;
- task discussion and rationale in PRs/issues;
- transient evidence in CI artifacts, logs, machine-readable outputs, or approved non-Markdown artifacts.

Ignored local Markdown generated by legacy scripts is not authoritative and MUST NOT be committed. When modifying such scripts, prefer machine-readable or log evidence.

Git history is the archive for removed documentation. Do not reintroduce historical prose as competing authority.

## 32. Readiness language

`main` is expected to be green, but a green build alone does not prove every production invariant.

Until a current release-candidate SHA passes all required gates and formal pilot acceptance, describe SchoolOS conservatively as **Internal QA / controlled-pilot preparation**.

Do not inherit historical PASS/READY labels from deleted evidence. Verify the exact current SHA, migration state, tests, recovery evidence, and relevant security/domain gates before making a release-readiness claim.

The objective is a safe, correct, Nepal-ready, recoverable, auditable SchoolOS before expanding breadth.
