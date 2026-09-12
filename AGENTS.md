# SchoolOS Agent Operating Contract

This file is the single repository-wide source of truth for durable SchoolOS product boundaries, architecture invariants, security rules, engineering behavior, and agent execution policy.

It is optimized for autonomous coding agents, including GPT-6 Astra: high-signal rules, explicit precedence, bias toward completing the requested work, proportional verification, and minimal competing prose.

## 1. Authority and instruction precedence

Follow this order when working in the repository:

1. Higher-priority runtime, platform, safety, and tool instructions.
2. The project owner's explicit instruction for the current task.
3. This root `AGENTS.md`.
4. Running code, Prisma schema/migrations, generated contracts, configuration, tests, CI, and Git history as evidence of current implementation.

Important distinctions:

- `AGENTS.md` defines durable rules and invariants.
- Code, schema, migrations, configuration, tests, and CI define what is actually implemented now.
- Prose never proves implementation completion.
- A current task may intentionally change a rule in this file; when it does, update this file in the same change.
- Do not create another Markdown source of truth.
- If repository evidence conflicts with this file, do not silently choose one. Preserve safety, identify the conflict, and resolve it within the requested scope when possible.

## 2. Agent operating mode

Bias toward action and completion.

When the user asks to implement, fix, audit, refactor, harden, migrate, redesign, or prepare a PR:

1. Infer routine implementation details from the repository and prior context.
2. Inspect the relevant implementation before proposing or editing.
3. Persist until the requested scope is complete, verified, or blocked by an actual external dependency.
4. Do not stop merely because the task is large, touches multiple layers, or reveals additional in-scope defects.
5. Ask a question only when missing information can materially change security, data integrity, legal/compliance behavior, irreversible architecture, or the user's intended outcome and cannot be resolved from repository evidence.
6. Prefer the smallest coherent end-to-end change over speculative redesign.
7. Fix directly related defects discovered during the task when safe and reasonably bounded.
8. Do not broaden into unrelated cleanup.
9. Adapt immediately to new instructions or mid-task corrections without discarding already verified work.
10. Use parallel investigation/subagents when available and when independent workstreams can materially improve speed or confidence.

For long-running work, keep progress reports concise and factual. Report findings, decisions, blockers, changed files, verification, and remaining risk. Do not produce ceremonial status prose.

## 3. Product mission and scope

SchoolOS is a Nepal-first, multi-tenant school operating system for Nepalese schools. The active roadmap is strictly Nepal-scoped unless the project owner explicitly changes that boundary.

Delivery priority:

1. P0 — safety, correctness, auditability, controlled-pilot readiness.
2. P1 — operational maturity and broader Nepal market readiness after P0.
3. P2 — Nepal-wide scale, multi-branch and institutional readiness after P1.

While a P0 release gate remains open, feature breadth must not outrank tenant isolation, authorization, guardian correctness, attendance correctness, academic integrity, financial integrity, privacy, offline safety, compliance correctness, recovery, or reproducible verification.

During P0, do not expand M8 Library, M9 Transport, M10 Canteen, M13 Learning, international curricula, OneRoster/LTI, foreign compliance, or unrelated feature breadth unless the requested work directly resolves a P0 risk. Existing working code may remain safely isolated or disabled.

Chat/conversations are removed from the active product. M15 owns official notices and announcements. M12 owns notification delivery, retries, provider state, acknowledgements, and delivery diagnostics.

## 4. Repository architecture and authority boundaries

Canonical surfaces:

- `apps/api` — NestJS backend and authoritative server-side business rules.
- `apps/web` — Next.js school web application.
- `apps/schoolos_mobile` — Flutter mobile application.
- `packages/core` — shared contracts, permissions, entitlements, localization/date primitives, and cross-surface types where appropriate.
- PostgreSQL/Prisma — authoritative persistence, constraints, and migrations.
- Redis/queues/providers — operational infrastructure where configured.

Architecture rules:

- Backend services are authoritative for authorization, financial calculations, state transitions, conflict decisions, and sensitive business rules.
- Clients are presentation and interaction surfaces, not security authorities.
- Do not trust client-calculated totals, ownership, tenant context, role claims, or permission decisions.
- Prefer existing domain boundaries and repository patterns before creating new abstractions.
- Avoid broad rewrites when a bounded change can preserve contracts and security invariants.

### Platform control plane versus school application

The SchoolOS Platform/control plane and each school's management application are separate security domains even if they share a monorepo or selected infrastructure.

- Platform Operators manage tenants, entitlements, platform operations, provider configuration, releases, compliance-policy distribution, support/security operations, and cross-tenant platform audit.
- School personas operate only within one tenant and their authorized resource scope.
- Principal/Admin privilege inside a school never implies Platform Operator privilege.
- Keep platform routes/capabilities separate from ordinary school roles and dashboards.
- Support access into tenant data must be exceptional, reason-bound, scoped, time-limited, auditable, and read-only by default where possible.
- Never implement a permanent unrestricted "developer can see everything" mode.

## 5. Canonical modules and personas

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

Mobile is not a compressed copy of web. Mobile should prioritize frequent, time-sensitive, one-handed persona workflows. Web should own dense configuration, bulk operations, high-risk changes, complex corrections, governance, exports, and administrative workflows unless a safe mobile use case is explicit.

Navigation visibility is never authorization.

## 6. Non-negotiable security and data invariants

### Tenant isolation

Every tenant-owned read, write, file, export, report, cache, queue job, notification resolution, and synchronization operation must derive tenant authority from trusted authenticated context.

- Never trust client-supplied `tenantId` as authorization context.
- Cross-tenant identifiers must fail without disclosing another tenant's data.
- Suspended tenants and unavailable/disabled/missing/failed entitlement resolution fail closed.
- UI module hiding is not a security control.

### Authentication versus authorization

Authentication and authorization are separate concerns.

- A valid session does not imply permission for a resource or action.
- Authoritative operations require explicit capability checks plus resource scope.
- Do not replace scoped permission checks with generic role conditions.
- Server authorization must remain effective even when clients are stale, offline, modified, or malicious.

### Teacher scope

Teacher reads/writes must match current assignment authority across the dimensions relevant to the operation, such as tenant, academic year, class, section, subject, period, assessment, or assessment component.

- Homeroom authority does not grant every subject write.
- Subject teaching does not automatically grant homeroom attendance authority.
- Assignment removal must remove authority immediately and invalidate affected cached/offline scope.

### Guardian scope

Parent access requires an active, verified guardian relationship for the selected student and tenant, applicable capability, valid effective period, and no blocking restriction.

- Never substitute another linked child when the requested child is unauthorized or unknown.
- Guardian revocation/suspension must take effect immediately on the server and invalidate now-inaccessible client data.
- Academic, attendance, fee, document, pickup, emergency, and legal/custody capabilities may differ.

### Sensitive records and files

Apply least privilege to medical data, disability/support information, custody/safeguarding records, identity documents, salary/bank data, and other protected records.

- Authorize every protected-file access, not only URL creation.
- Respect consent and media-consent state.
- Audit sensitive access where required.
- Revoke access promptly when identity, role, assignment, guardian scope, tenant state, or session authority changes.
- Do not expose sensitive content in lock-screen notification previews.

### Mobile authentication

Parent, Teacher, and Principal mobile users may enable optional device biometrics only after successful credential authentication.

- Prompt after first successful login when supported.
- Users may skip and enable later in Settings.
- Keep secure password/credential fallback.
- Use OS biometric facilities for local unlock only; never store raw biometric templates.
- Logout, revocation, tenant/school switch, assignment removal, guardian revocation, and account disablement must purge or render inaccessible any now-unauthorized local data.

## 7. Domain integrity rules

### M2 attendance

Canonical lifecycle:

`Draft -> Submitted -> Finalized/Locked -> Correction Requested -> Approved/Reopened -> Corrected -> Re-locked`

Preserve these invariants:

- Homeroom and period writes require their exact active authority.
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
- Parents must never receive draft/unpublished results.
- Corrected published results preserve prior versions/publication history.
- Report cards and academic documents are protected files.

### Offline and synchronization

SchoolOS must remain useful under unreliable or absent connectivity without converting stale client state into authority.

P0 offline-safe scope is intentionally bounded to approved workflows such as attendance drafts, homework/activity drafts, cached timetable, cached assigned roster, and read-only notices/notifications.

Do not perform high-risk authoritative mutations offline during P0, including fee payment/cashier close, accounting posting, payroll finalization, result publication, marks unlocking, guardian changes, role/permission/entitlement changes, compliance configuration, or government export approval/submission.

Offline rules:

- Cache keys/storage must remain tenant + identity + resource scoped.
- Sensitive cached data requires secure storage appropriate to the platform.
- Offline writes need durable operation identity/idempotency.
- Synchronization must re-check current authority.
- Conflicts must be explicit and resolvable.
- Never use silent last-write-wins for attendance, marks, finance, guardian relationships, or protected student information.
- Never serve one child/tenant/user's cached data as fallback for another.

### Financial integrity: M3, M7, M11

M11 is the authoritative accounting layer. M3 Fees/Receipts and M7 Payroll hand off controlled, idempotent accounting events into M11.

Non-negotiable:

- Use precise monetary types; never floating-point arithmetic for authoritative money.
- Generate durable financial identifiers server-side.
- Require idempotency for payment creation, callbacks, retries, and subledger-to-ledger posting.
- Verify provider callbacks according to the integration contract.
- Pending/unconfirmed payment is not paid.
- Preserve receipt/invoice sequence integrity.
- Issued/posted documents and ledger history are immutable in business meaning.
- Correct through reversal, refund, credit/debit note, adjustment, or replacement with explicit lineage.
- Failed/unposted events remain visible and retryable.
- Reconciliation discrepancies remain explicit until resolved.
- Multi-record financial state transitions use database transactions where atomicity is required.
- Add persistence constraints/unique indexes for enforceable invariants.

Do not claim statutory, tax, payroll, CBMS, or IRD compliance merely because calculations or document formats exist.

## 8. Nepal compliance and localization

### Nepal IRD / fiscal

Treat mutable fiscal policy as versioned/effective-dated configuration and evidence, not scattered constants.

- Preserve authority/reference, effective period, applicability, rates/exemptions, status, and evidence.
- Historical transactions use the policy valid for the relevant transaction/document date.
- Distinguish SchoolOS accounting/billing from official IRD electronic-billing enlistment/approval.
- Distinguish local transaction state from external fiscalization/CBMS confirmation.
- Never fabricate external submission success while the authority/provider is unavailable.
- If online fiscalization is required at issue time, offline operation must not fabricate compliance.
- Any taxpayer incentive/prize integration requires an authorized interface and authority-issued status/reference; never invent coupon codes.

### Nepal education / IEMIS

Mutable education rules must be versioned/effective-dated rather than hard-coded across features.

IEMIS readiness begins with reproducible export, not an unsupported direct-sync claim.

Exports should preserve schema/version, required-field validation, immutable source snapshot identity/checksum, reviewer/approval state, submission status where applicable, and correction/re-export lineage.

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

Do not store authoritative BS dates as ambiguous display strings.

## 9. Engineering rules

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
- schema migrations for database change;
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

## 10. Task execution protocol

Before editing:

1. Read this file.
2. Inspect the affected code, schema, shared contracts, permissions, tests, and current CI behavior.
3. Determine the authoritative source of each relevant value and state transition.
4. Identify tenant/persona/resource authorization implications.
5. Identify concurrency, idempotency, offline, audit, and migration implications where applicable.
6. Search for existing patterns before introducing new ones.

While editing:

1. Make the smallest coherent end-to-end change.
2. Keep backend, shared contracts, web, mobile, schema, and tests consistent where the change crosses those boundaries.
3. Prefer fixing the source of truth over adding client workarounds.
4. Add meaningful negative-path coverage for authorization, scope, conflict, replay, or failure behavior when risk warrants it.
5. Preserve immutable/auditable history for authoritative domains.
6. Do not disable quality gates, loosen validation, weaken authorization, or delete failing tests merely to obtain green CI.

Before completion:

1. Review the diff for scope creep, secrets, generated artifacts, stale comments, and accidental formatting churn.
2. Run verification proportional to the actual change.
3. Inspect failures rather than rerunning blindly.
4. Distinguish failures caused by the change from pre-existing failures, but do not falsely report a failing gate as passing.
5. State any unresolved limitation or external blocker explicitly.

## 11. Verification strategy

Testing is proportional to impact. Astra and other coding agents must not run the entire repository repeatedly after every small edit.

Use the narrowest meaningful checks first; broaden when risk, failures, or touched boundaries justify it.

### Documentation / agent-policy only

At minimum:

- verify tests/contracts that directly read `AGENTS.md`;
- inspect the diff for accidental policy loss or contradictory instructions.

For the current web source-of-truth contract, `pnpm --filter @schoolos/web test` exercises `apps/web/test/*.test.mjs`, including the `AGENTS.md` markers.

### Isolated web change

Typically:

- `pnpm --filter @schoolos/web lint`
- `pnpm --filter @schoolos/web typecheck`
- targeted web tests
- relevant Playwright smoke only when the changed flow requires browser verification

### Isolated API/domain change

Typically:

- API format/lint/typecheck
- targeted unit tests
- relevant E2E/integration tests when persistence, authorization, transactions, queues, or provider behavior is involved

### Shared/core or cross-surface change

Include affected API/web checks and build/contract checks. Run broader repository gates when the change can affect multiple workspaces.

### Database, authorization, finance, offline sync, protected data

Require stronger verification, including relevant negative cases, persistence/integration tests, replay/concurrency/idempotency tests, migration validation, and cross-tenant/resource-scope checks.

### Mobile-impacting change

CI pins Flutter `3.44.0`. Relevant checks are:

- `dart format lib test` followed by review of resulting diff;
- `flutter analyze`;
- `flutter test --exclude-tags golden`;
- targeted device/widget/browser-equivalent validation where the UX change requires it.

Do not broaden mobile verification merely because a non-code documentation file was deleted under the mobile directory; use judgment about whether runtime behavior changed, while respecting required CI behavior.

### Full deploy/release verification

Use the repository's canonical scripts when the change or release decision warrants them:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm test:integration`
- `pnpm build`
- `pnpm verify:deploy`

A release claim must identify the exact Git SHA and current gate results. Historical evidence does not override current failure.

Once required checks pass, do not repeat or broaden them unless new edits, failures, or unresolved risk justify it.

## 12. Definition of Done

A task is complete only when every applicable item is true:

- requested behavior is implemented;
- tenant isolation is preserved;
- authorization is enforced server-side at the resource/action boundary;
- schema/migration changes exist when persistence changed;
- API/shared/client contracts are consistent;
- concurrency/idempotency implications were handled where relevant;
- offline behavior remains bounded and safe where relevant;
- audit/history requirements are preserved;
- loading/empty/error/denied/stale/conflict states are handled for user-facing flows where relevant;
- meaningful verification passed for the changed scope;
- accessibility was considered for user-facing changes;
- no placeholder, fake success, or knowingly broken path is hidden;
- remaining limitations are explicit.

Do not mark work complete merely because the happy path compiles.

## 13. Prohibited actions

Do not:

- weaken tenant isolation, authorization, or validation to unblock a UI;
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

## 14. UX and accessibility

SchoolOS UI must be role-aware, task-oriented, consistent, and suitable for frequent school use.

- Prefer server-authoritative persona projection; client composition is presentation, not authorization.
- Important workflows must represent loading, empty, error, denied, disabled-module, expired-session, stale, retry, and conflict states where applicable.
- High-risk or dense configuration belongs on web unless a specific safe mobile workflow is required.
- Mobile primary actions should support one-handed frequent use.
- Target WCAG 2.2 AA principles for priority web flows and equivalent mobile accessibility: labels, keyboard/focus, screen-reader semantics, touch targets, text scaling, contrast, reduced motion, non-color-only status, and accessible validation/authentication.

Do not treat old screenshots, deleted wireframes, or historical design prose as authority. Inspect current components/tokens and the actual product surface.

## 15. Documentation policy

The repository deliberately permits one tracked Markdown policy/documentation file: `/AGENTS.md`.

Do not add README files, nested `AGENTS.md`, module/design/audit Markdown, Markdown release trackers, Markdown evidence directories, or Markdown runbooks/checklists unless the project owner explicitly changes this policy.

Put:

- durable cross-repository rules in this file;
- implementation truth in code/schema/config/tests/CI;
- task discussion and rationale in PRs/issues;
- transient evidence in CI artifacts, logs, machine-readable outputs, or approved non-Markdown artifacts.

Ignored local Markdown generated by legacy scripts is not authoritative and must not be committed. When modifying such scripts, prefer machine-readable or log evidence.

Git history is the archive for removed documentation. Do not reintroduce historical prose as competing authority.

## 16. Readiness language

`main` is expected to be green, but a green build alone does not prove every production invariant.

Until a current release-candidate SHA passes all required gates and formal pilot acceptance, describe SchoolOS conservatively as **Internal QA / controlled-pilot preparation**.

Do not inherit historical PASS/READY labels from deleted evidence. Verify the exact current SHA, migration state, tests, recovery evidence, and relevant security/domain gates before making a release-readiness claim.

The objective is a safe, correct, Nepal-ready, recoverable, auditable SchoolOS before expanding breadth.
