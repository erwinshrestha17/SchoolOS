# SchoolOS Phase 1B — Central Authorization Kernel

Scope: Phase 1B.1 safe reason codes, 1B.2 deterministic evaluation order and 1B.3 guard integration only. This scoped implementation/evidence record is subordinate to `AGENTS.md` and the recognized roadmap/playbooks. It does not authorize or certify Phase 1C, 1D, Phase 2, domain-policy migrations or production rollout.

## Prerequisites and delivery boundary

Starting SHA: `4519f34ca48ddbfdedcd85c3d9723ba17c1da76b`, clean `main`, matching `origin/main` after fetch and fast-forward check. [Phase 0](../phase0-slice0a/BASELINE_CERTIFICATION.md) was certified at `f764c313ee0f0f6e8a61ef0e90a36e118f2a558d` by full run 36284369616. [Phase 1A](../phase1a-canonical-permissions/IMPLEMENTATION_VERIFICATION.md) was certified at the starting SHA by full run 36286847283. Both full workflows executed their `verify` and `mobile` jobs without skipped or failed steps; each browser suite passed all 33 cases.

The existing Phase 1A report was ignored by `**/*.md`, although its evidence was committed. This delivery explicitly includes that missing report and records its already completed exact-SHA CI proof; it does not amend Phase 1A implementation or historical Phase 0 role matrices.

Local commands run against the uncommitted patch are supplemental evidence, labelled as such in the command manifest. The final delivery SHA and its separate full `ci.yml` dispatch are recorded in the delivery response: a commit cannot embed its own hash. A PASS requires that full final-SHA workflow, not path-filtered push success.

## Requirement-to-evidence audit

| Requirement | Implementation and verification |
| --- | --- |
| Central contract | `apps/api/src/authorization/authorization.module.ts`, `authorization.service.ts`, `authorization.types.ts`; globally provided through AuthModule. Real Nest HTTP tests resolve the injected service and prove its DENY prevents handler execution. |
| Authoritative context | Authentication guards record frozen live-check facts in a private request/actor-bound WeakMap. Body fields and a standalone `request.auth` object cannot manufacture that proof. Identity, actor grants, roles, resource, entitlement and registration descriptors are snapshotted before evaluation. |
| Safe decision | Immutable ALLOW/DENY, safe reason code, stage, static policy ID and optional canonical permission. No identity, resource ID, SQL, exception message, stack or arbitrary URL is added to the decision. |
| Fail closed | Unknown required permissions, missing authentication/proof, invalid evaluator registration/result, thrown evaluators and entitlement infrastructure failures deny. DENY immediately stops later evaluation. Unit and HTTP negative tests cover these paths. |
| Deterministic order | Frozen fifteen-stage list, builtin check before extension evaluators, same-stage evaluators ordered by stable ASCII identifier. Duplicate/reserved/invalid IDs are rejected. Tests cover ordering, mutation, exception and deny precedence. |
| Phase 1A integration | Legacy lookup precedes canonical lookup; school administrative aliases remain nontransitive, Platform/support require exact normalized grants. 22 templates × 326 definitions × legacy/canonical requirements = 14,344 parity decisions in unit tests. Core permission/template invariants remain part of the root test gate. |
| Generic guard integration | RolesPermissionsGuard and PlatformGuard delegate their generic decision to AuthorizationService. JwtAuthGuard retains its existing live database/session/support checks. EntitlementGuard is evaluated at stage six where installed. |
| Metadata-less compatibility | Fresh AST inventory of 1,336 route methods / 111 controller declarations; all 91 metadata-less routes reviewed and snapshotted. Only the existing 13 RolesPermissionsGuard handlers receive method-bound compatibility policy markers. |
| Platform/support | All 69 inventoried PlatformGuard routes have explicit permissions and JWT before PlatformGuard. Support remains approved, read-only, reason/expiry-bound by JWT, with explicit exact grants; role-only, metadata-less, write and Platform routes deny. |
| Teacher/guardian/domain preservation | No teacher-scope, guardian-capability, attendance, marks, lifecycle, finance or offline service is rewritten. Existing assignment, relationship, lifecycle, tenant and financial regression suites remain required. |
| Scope boundary | No Core/client contracts, Prisma schema or migration SQL changes; no persisted-grant rewrite, typed scopes, SoD, step-up/approval enforcement, sensitive projections or domain export/offline migration. |

## AuthorizationContext and AuthorizationDecision

`AuthorizationContext` is an internal server input: actor; verified authentication facts; target security domain; trusted tenant; requested permissions; required roles; derived canonical definitions; optional route/action, method and request ID; optional persistence-derived resource ID/tenant; reviewed service-policy marker; and the existing entitlement callback/keys. Guards obtain these inputs from authenticated request state and static decorator metadata, never request-body tenant/role/grant fields.

An optional resource is rejected if its tenant is absent or differs from the trusted tenant. Guards do not invent object ownership or fetch every route resource in this slice; authoritative domain services still do that work. A generic ALLOW means the supplied generic checks passed, not that unregistered resource/domain policies were evaluated.

`AuthorizationDecision` returns only `ALLOW` or `DENY`, `reasonCode`, `stage`, `policyId`, and the canonical permission for a single resolved requirement. `REQUIRE_APPROVAL` / `REQUIRE_STEP_UP` are reserved future type vocabulary only; evaluators returning them currently deny as invalid. Decisions and frozen context arrays cannot be mutated by an earlier evaluator to bypass a later denial.

## Evaluation order and safe codes

1. Authentication
2. Active user/session
3. Security domain
4. Tenant
5. Resource tenant
6. Entitlement
7. Hard restriction
8. Permission
9. Scope
10. Relationship
11. Lifecycle
12. Separation of duties
13. Approval/step-up
14. Sensitive projection
15. Audit

Stages 9–15 are extension points, not implementations of typed scope, relationship, lifecycle, SoD, approvals, projections or persistent decision audit. Existing domain checks and domain audit remain in place. Each builtin/registered DENY stops processing; ALLOW/NOT_APPLICABLE never overrides an earlier denial.

Codes: `ALLOWED`, `AUTHENTICATION_REQUIRED`, `USER_OR_SESSION_INACTIVE`, `SECURITY_DOMAIN_MISMATCH`, `TENANT_MISMATCH`, `TENANT_INACTIVE`, `ENTITLEMENT_MISSING`, `PERMISSION_MISSING`, `ROLE_MISSING`, `UNKNOWN_PERMISSION`, `RESOURCE_TENANT_MISMATCH`, `POLICY_DENIED`, `AUTHORIZATION_EVALUATION_ERROR`. Existing teacher/guardian/lifecycle/domain-specific exception codes remain unchanged.

Kernel denial logs use code, outcome, stage and static policy identifier; only a validated UUID request ID is optionally included. Unexpected exception objects/messages/stacks are discarded. The production exception filter recognizes controlled kernel exceptions, adds `meta.reasonCode` and uses safe denial log fields. Legacy nonkernel exception contracts/logging are not globally rewritten or claimed sanitized by this slice.

## Guard and entitlement integration

RolesPermissionsGuard keeps role ANY and permission ALL semantics. School aliases remain available; canonical required/granted keys normalize to the same reviewed legacy definition. Entitlement enforcement executes before generic permissions when EntitlementGuard is installed, preserving controlled 401/403/404 entitlement errors. Unexpected infrastructure errors become a safe kernel DENY. The outer existing EntitlementGuard still runs on successful requests; existing per-request memoization deduplicates persistence reads, with no new cross-request authority cache.

JwtAuthGuard records proof only after its existing user, tenant, live session family, token/version, support approval and must-change-password checks succeed. API-key validation now carries the actual live tenant security domain; ApiKeyAuthGuard rejects Platform/missing-domain credentials instead of manufacturing a SCHOOL identity. This bounded change is necessary to create trustworthy kernel authentication facts, not a tenant/object migration. Existing active-key, HMAC, expiry and tenant-liveness checks remain.

## Metadata-less route findings

The detailed 91-row [inventory](metadata-less-routes.csv) records route, guards, classification, downstream evidence, calls and boundary. It was generated from current controller ASTs; `reviewed-metadata-less-routes.json` is a review snapshot, and `authorization-route-inventory.spec.ts` regenerates the inventory in CI and requires review for additions/changes.

| Controller group | Count | Preserved authoritative enforcement |
| --- | ---: | --- |
| App | 3 | Public operational health/info/readiness; no protected school records |
| Auth | 17 | Credential/refresh/recovery proof or JWT authenticated self/session operations |
| Demo requests | 1 | Existing public intake DTO/rate/provider-readiness controls |
| Geography | 7 | JWT/TenantActive global Nepal reference data |
| Mobile | 46 | Parent/guardian capabilities, exact active linked child, own recipient and published notice predicates; existing domain service checks |
| Mobile push token | 2 | Authenticated tenant/user/installation and persona entitlement |
| Fees | 1 | Finance dashboard service capability check and tenant predicates |
| Files | 8 | Module upload permission, upload owner or current tenant/resource file access service |
| Payments | 3 | Tenant payment lookup plus finance read/action and reviewer/lifecycle checks |
| Settings | 1 | Key-specific write capability, validation, tenant write and audit |
| Payment webhook | 1 | Provider signature, readiness and server-resolved payment intent/tenant |
| Sync authority | 1 | JWT, TenantActive, module entitlement and trusted tenant scope projection |

Seven known compatibility policy IDs cover the 13 dynamic guarded handlers: FILE_MODULE_UPLOAD, FILE_UPLOAD_OWNER, FILE_RESOURCE_ACCESS, FINANCE_DASHBOARD, PAYMENT_ALLOCATIONS, FINANCE_REQUEST_REVIEW and SETTING_KEY_WRITE. Their method markers merely permit the existing downstream policy to execute; they confer no module, relationship or object authority. A new/unreviewed metadata-less guarded handler denies by default; there is no class-wide marker bypass.

This inventory does not certify all 1,336 downstream service paths as fully hardened. Known Phase 0 projection/file/export/SoD risks remain. SyncAuthorityController's legacy literal `tenantId === 'platform'` exclusion is not a complete domain check for UUID Platform tenants; its trusted tenant fence is preserved, with domain/object migration deferred to Phase 1D. No cross-school access from that source path is claimed.

## Compatibility and intentional differences

Preserved: known school grants/aliases, role ANY and permission ALL, exact Platform/support grants, live revocation, teacher/guardian service authority, downstream tenant/resource/lifecycle/financial rules, controlled entitlement messages and established domain codes.

Intentional fail-closed differences, each covered by negative regression tests:

- Unknown required keys deny even if a raw actor carries that unknown string.
- A raw auth object without completed request-bound authentication proof denies.
- Metadata-less SCHOOL handlers under RolesPermissionsGuard need an explicit reviewed method policy; the 13 existing legitimate handlers retain it.
- Platform and support handlers require explicit permissions; aliases cannot expand their grant set.
- Actual Platform/missing-domain API keys cannot authenticate as school keys.
- Entitlement denial precedes permission denial where the real entitlement guard is installed.

HTTP test harnesses that replace JWT explicitly record synthetic authentication proof. Direct PlatformGuard tests await its async decision and bind a stable synthetic request. The onboarding harness invokes RolesPermissionsGuard only on handlers that actually install it; its Classes fixture receives an active students-only test subscription. These are test-model corrections, not production fallback authority or relaxed assertions.

## Verification and evidence limits

| Gate | Commands / observed result | Status |
| --- | --- | --- |
| Frozen install | `pnpm install --frozen-lockfile` | PASS |
| Prisma / artifacts / contracts | `pnpm db:validate`, `pnpm db:generate`, `pnpm verify:tracked-artifacts`, `pnpm verify:openapi` | PASS |
| Core invariants | `pnpm --filter @schoolos/core test`; 12 tests | PASS |
| Format / lint / typecheck | `pnpm lint`, `pnpm typecheck`, final `pnpm format:check` plus changed-fixture ESLint | PASS |
| Full unit/component | `pnpm test`; Core 12, API 276 suites / 3,195 tests, Web 666, no reported skips | PASS |
| Focused kernel/guard regression | Eight suites / 105 tests, including 14,344 parity decisions | PASS |
| Full API HTTP | `pnpm test:e2e`; 44 suites / 313 tests, including 18 new kernel HTTP cases | PASS |
| Final Platform HTTP harness | Existing Platform hardening suite; 53 tests | PASS |
| PostgreSQL integration / concurrency / isolation | `pnpm test:integration`; 12 suites / 203 tests with both guarded database URLs supplied, no reported skips | PASS |
| Empty supported database migration | Prisma deploy to three empty PostgreSQL databases; all 112 migrations replayed | PASS |
| Migration history / drift | All 112 SQL files byte-identical to starting SHA; `pnpm db:verify:drift` reports no difference | PASS |
| Canonical and browser seeds | Canonical school, separate Platform, account-security, reminders, waitlist and assessment fixtures | PASS |
| Production build / runtime | `pnpm build`; compiled API `GET /api/v1/health` returns 200 | PASS |
| Web browser smoke | `pnpm test:web:e2e` against the compiled API and production Web build; 33/33 cases, no retries/skips | PASS |

The [locked evidence package](evidence/README.md) contains the command manifest, compressed final-attempt logs, tool versions, unchanged migration hashes and implementation file digests. `shasum -a 256 -c SHA256SUMS` verifies the preserved bytes. The preliminary failure manifest is retained. Formatting/empty-function fixture diagnostics, synchronous manual PlatformGuard calls, missing synthetic JWT proof, the over-applied guard on `/auth/me`, absent Classes subscription and TypeScript duplicate object keys were corrected in test setup. No assertions or quality rules were disabled. The command harness overwrote named log files on rerun, so locked raw logs represent the final attempt; the manifest preserves all failed attempts and the diagnostic notes explain their causes. Full final-SHA hosted CI remains required before PASS.

Local persistence uses disposable PostgreSQL 16 and Redis 7 on loopback ports 55434/56380, plus explicitly opted-in auth/admission test databases. Shared development containers/data are untouched. The full hosted manual dispatch will additionally execute Flutter under existing Linux policy; no Core, Web or Mobile source contract changes are made here. Physical devices, live providers, staging and production are not certified.

## Remaining HIGH findings and stop condition

Phase 0 H01 was closed by Phase 1A's explicit immutable allowlists. H06 backup-target safety was repaired in Phase 0. This slice does not claim H02–H05 or H07–H11 fixed: typed grant loss, sensitive student projection, queued export revocation, notice file audience, refund/reversal approval, grant ceilings, teacher professional eligibility, statutory payroll policy and grading-history integrity retain their documented future owners.

No migrations or schema changes are required. Stop after Phase 1B. Exact next slice after final PASS: **Phase 1C — Typed Scope System**. No Phase 1C work is included or authorized by this report.
