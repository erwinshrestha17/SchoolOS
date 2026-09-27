# SchoolOS Phase 1C / 1D and Phase 1 Exit Gate

This scoped implementation and verification record is subordinate to `AGENTS.md`, the recognized master roadmap and RBAC playbook. It covers the authorization foundation, typed scope migration and priority tenant/object isolation. It does not certify Phase 2 domain policies, sensitive projections, production rollout or the remaining P0 release gates.

Starting SHA: `7c828a39c4548e273a7e3a46c1392768eead1094`; clean `main`, matching `origin/main` after fetch. Implementation branch: `codex/phase1-scopes-isolation`. The exact delivery SHA and its full hosted CI run are recorded in the PR and delivery response; a commit cannot embed its own hash. Hosted certification requires both jobs and their substantive steps to pass at that exact SHA, including browser and Flutter checks.

## Prerequisites and exit gate

The starting SHA's full manual CI run [36291684573](https://github.com/erwinshrestha17/SchoolOS/actions/runs/36291684573) was checked live: `verify` and `mobile` passed, including browser, analyze and test steps. Phase 1A and 1B implementation evidence is retained in their existing scoped audit directories.

| Phase 1 exit requirement | Implementation / proof |
| --- | --- |
| Canonical catalog | Existing immutable canonical definitions, legacy mapping, scope metadata, unknown-permission rejection and duplicate detection; Core contract tests remain mandatory. |
| Explicit role allowlists | Existing reviewed templates remain byte-identical. No catalog or role-permission rewrite is introduced. Legacy replay asserts permission and role-permission counts do not increase. |
| Central kernel | Existing deterministic kernel and live authentication proof; typed scope stage and server-owned resource lookup now integrated. Unit and actual HTTP negative checks exercise guard denial. |
| Typed scopes | `RoleScopeGrant`, all ten vocabulary types, effective/expiry/revocation/supersession history, same-type union and different-dimension intersection. Actual persistence tests cover expiry, revocation, deleted targets, conflicting restrictions and scope replacement. |
| Tenant/object enforcement | Composite assignment ownership; priority relational DB triggers and corruption preflight; immutable persisted tenant ownership; safe file absence/object paths; complete batch validation; explicit notice audience references; queued-export live authorization. |
| No automatic permission grants | Scope initialization supplies context for an explicitly assigned role; it creates no permission membership. Canonical templates and Core generated permission artifacts are unchanged. |

## Typed scope contract

Supported persisted vocabulary: TENANT, BRANCH, ACADEMIC_YEAR, CLASS, SECTION, SUBJECT, DEPARTMENT, STUDENT, STAFF, FINANCE_ACCOUNT. BRANCH and DEPARTMENT are reserved vocabulary and deny writes/resolution because this P0 schema has no authoritative entities for those dimensions. Their operational implementation belongs to the already sequenced later roadmap; no synthetic branch/department authority is introduced.

A role assignment is authoritative only when its own tenant, role, identity, start, expiry and revocation are valid. Its current scope set must also match the permission's catalog scope metadata and the server-derived resource. Same-type targets form a union; distinct types intersect. An expired or revoked restrictive dimension remains in the current set and cannot disappear to widen another dimension. Reason-bound transactional replacement supersedes the complete previous set, retaining its history. TENANT cannot coexist with another current dimension, including a revoked restriction.

Scope dates use inclusive start and exclusive expiry, with explicit timezone validation on writes. A missing target, foreign parent, inactive staff/account, unsupported dimension, missing resource context or invalid scope interval fails closed. Subject IDs identify exact persisted subjects; class presence does not imply subject authority. Current student academic-year inheritance requires one coherent current active effective enrollment; old-year scope does not inherit into a rollover year.

`scopesByRole` is optional in the existing role-assignment request. Omission preserves existing restrictions. Explicit input must target the requested same-tenant roles and known same-tenant entities, use coherent academic dimensions, avoid duplicate targets and stay within the bounded scope count. Duplicate legacy assignments require review before scope replacement. Configuration ownership cannot be scheduled into an inactive scoped state; removal remains a controlled protected-role revocation. Existing governance transactions lock/re-authorize the actor and retain audit and invalidation behavior. Both protected role removal and account suspension count only current effective unrestricted configuration owners; an expired/revoked scope or a future assignment cannot substitute for the last effective owner.

The login/self projection returns flat permissions only for current unrestricted grants. JWT authorization retains typed grants internally for kernel evaluation. Unconverted broad list/write/export paths therefore deny restricted assignments rather than flatten them to tenant-wide access. Existing teacher assignment and guardian relationship services remain authoritative and are not replaced by generic role scopes. Parent/Student templates have no administrative student-directory permission; their TENANT context supplies only the existing explicit persona capabilities, with linked-child/self/resource policies still required. A tenant context never establishes guardian or student ownership.

The student detail route uses minimal server-owned dimensions. The profile service checks the dimensions of the row actually returned again, preventing a class/section change between guard lookup and profile read from returning an out-of-scope row. Existing teacher checks remain in place. This does not certify the broader Student 360 sensitive projection work assigned to later phases.

## Migrations and recovery

Three append-only migrations:

1. `20260927100000_typed_role_scopes`: typed grants, tenant-composite User/Role/UserRole keys, interval and active-target constraints, deterministic legacy backfill, unresolved review audit, explicit transactional scope initialization and immutable legacy scope writes.
2. `20260927101000_priority_tenant_object_integrity`: preflight and tenant-reference triggers for priority Students, Attendance, Academics, Fees, HR, Payroll, Accounting, Notices and supporting file/export tables; immutable tenant ownership on tenant-owned rows. Existing corruption aborts migration instead of rewriting authoritative history.
3. `20260927102000_role_scope_supersession`: separates deliberate history replacement from revocation, preserving restrictive dimensions until the complete scope set is deliberately replaced.

All 112 prior migration SQL files are byte-identical to the starting SHA. Empty database replay and final schema drift checks are required. The repeatable legacy replay starts from all 112 baseline migrations on an empty guarded local database, creates nine deterministic old grants and three ambiguous/unknown/foreign grants, applies the new migrations, and verifies retained history, review audit and no permission grants. A deliberately corrupt Section/Class relationship blocks the second migration transaction with no partial trigger installation or history rewrite; after explicit fixture repair, the migration completes and rejects the foreign link. CI executes this replay on its own disposable database.

Recovery: inspect and repair unresolved grants through authorized typed role assignment with an audit reason; do not guess their legacy meaning. Repair corrupt tenant links only under reviewed recovery before deploying the integrity migration. Invalid stored file paths remain unavailable until reviewed storage/metadata recovery; do not rewrite issued financial or academic history. Restore a verified backup or apply a reviewed forward migration if deployment recovery is needed; old application code must not flatten restricted school grants.

## Priority object and batch enforcement

The DB boundary rejects foreign parents in nested writes and raw SQL, including attendance records, marks/exams, payments/invoices, staff/payroll, accounting lines, notices/recipient deliveries and supporting file/export ownership. UserRole user/role relations are composite tenant foreign keys. Tenant reassignment is forbidden, preventing a previously valid child from becoming cross-tenant by moving its parent.

The production promotion controller delegates to `PromotionReadinessService`. Its complete preflight validates source/target classes, target sections and every requested student before any transition, including later mappings in a batch. Duplicate IDs deny. Actual-controller HTTP tests verify a mixed single mapping, a foreign later mapping, trusted tenant derivation and the legitimate path. Existing business-readiness and financial checks are preserved.

Notice creation/draft/update/preview validates complete explicit student, guardian, staff and recipient-user sets under the actor's tenant. File metadata uses an explicit tenant predicate and a uniform not-found response for missing/foreign/deleted assets. Signing/read requires the canonical exact tenant storage prefix and rejects traversal, encoding ambiguity and foreign paths.

Queued report payloads are audit snapshots, not permission authority. Execution first verifies the persisted tenant/actor/report/format record, live school identity and session family, active unrestricted role grants, export permission and report-specific permission. It repeats current authorization and teacher scope before registering the artifact. Current download authorization remains required. Worker cancellation/idempotency and persistent field projections remain later Phase 9 work; no claim of complete queued-export lifecycle remediation is made.

## Edge-case review

| Trigger | Authoritative / user-visible behavior | Risk and detection | Automated evidence | Recovery |
| --- | --- | --- | --- | --- |
| New/unknown/duplicate permission or stale template | No implicit grant; unknown requirement denies | Escalation; canonical tests and safe UNKNOWN_PERMISSION | Core, kernel, template regression | Reviewed catalog/template version change |
| Missing resource context / evaluator failure or conflict | Restricted scope denies; first DENY wins, exception fails closed | Disclosure; safe kernel reason/stage | Kernel unit and HTTP | Restore correct context/policy; no fallback |
| Ambiguous, unknown or foreign legacy scope ID | Assignment retained without authority and review audit | Scope widening; LEGACY_SCOPE_UNRESOLVED | Real legacy replay, nine mapped / three unresolved | Authorized typed replacement |
| Deleted target / inactive staff/account | Whole assignment loses effective authority | Dangling authority; live target resolver | Live persistence and write validation tests | Reviewed reassignment; never silently drop dimension |
| TENANT plus restriction / subject reused across classes | Contradictory set rejected; exact subject required | Scope expansion; constraint/kernel denial | SQL and scope tests | Replace the complete scope set |
| Scope expiry/revocation / timezone or year rollover | Immediate denial; revoked restriction retained; current year derived | Stale authority; live resolution / SCOPE_MISMATCH | Exact UTC/NPT boundaries, rollover and real DB tests | Audited replacement or renewal |
| Duplicate roles or repeated requested batch IDs | Permission set deduplicated; ambiguous scope update / duplicate batch denied | Undefined authority or repeated writes | Role/kernel and batch regressions | Review legacy duplicates before changing scope |
| Last effective owner is suspended or loses its role while an alternate has stale scope or a future assignment | Reject both changes; preserve an effective owner | Configuration orphaning; protected-owner denial | Real database alternate-owner matrix and concurrent suspension/removal tests | Assign a current authorized replacement first |
| Parent/Student with tenant context | Explicit persona capabilities only; self/guardian services remain mandatory | Unrelated-child enumeration; relationship failure | Unchanged templates and existing guardian DB/HTTP matrix | Restore verified relationship; no child substitution |
| Foreign nested ID or tenant reassignment | DB rejects; pre-existing corruption blocks rollout | Cross-tenant data; safe constraint / preflight signal | Ten priority model read/mutation cases, seven nested domains, raw SQL | Reviewed data recovery before rollout |
| Foreign/missing guessed object or storage path | Same safe absence; no URL signing for invalid path | Existence oracle / storage disclosure | File unit, HTTP and DB regression | Reviewed canonical storage recovery |
| Mixed batch, including a later foreign mapping | Entire request rejected before any transition | Partial authoritative writes | Production-controller HTTP and DB transaction tests | Correct and resubmit full batch |
| Student class/section changes after guard | Returned row must still match scope; deny before activity reads | Stale resource lookup disclosure | Student service regression | Refresh resource and authorized scope |
| Role/session/permission revoked during queued export | Deny before data execution or artifact registration as applicable | Stale queued authority; worker failure remains visible | Export revocation/session/execution-change tests | Request a new authorized export; no cached grant retry |

## Verification and evidence limits

The command manifest and preserved logs in [evidence](evidence/README.md) identify the actual local commands, successes and preliminary failures. Root lint/typecheck/unit/component gates, full API HTTP, all opted-in PostgreSQL integration suites, legacy replay, migration drift, OpenAPI and production build/runtime are required. No assertion, quality gate or authorization control was disabled to obtain green results.

Preliminary fixture failures reflected explicit typed-grant fields, supersession query shape, canonical file prefixes and uniform absence/constraint responses. The migration replay also caught seeded baseline permissions and duplicate legacy-write fixture IDs; assertions were corrected to compare baseline counts and exercise a distinct new write. One concurrent local build removed Core dist while a test/typecheck was reading it; those checks were rerun after the build serially. These are recorded failed attempts, not passing evidence.

The preliminary hosted run at `a8ed78ae` passed the substantive backend gates and build, then exposed the account-security E2E seed's prohibited legacy `global` school scope. The fixture now uses the existing null legacy field with atomic typed TENANT initialization, preserving repeated-seed idempotency without relaxing enforcement. All six hosted seed commands were replayed locally; two runs of the security fixture retain exactly one assignment and an explicit same-tenant scope per fixture user. Direct fixture lint also caught its pre-existing untyped error callback, which was corrected. A preliminary persistence-check query used the wrong relation column name; the preserved final SQL uses the schema's actual `userRoleAssignmentId`. Final hosted certification remains required at the corrected delivery SHA.

Disposable PostgreSQL 16 / Redis 7 use loopback ports 55434/56380 and guarded auth/admission/replay databases. Shared development data are untouched. Full hosted CI additionally runs Web browser smoke and Flutter under the existing Linux test policy. Physical devices, live providers, staging, pilot readiness and production deployment are not certified by this phase.

Phase 0 H02 (lost school role scope) is addressed by this foundation. H04 queued authorization receives the bounded live checks described above; it is not a claim that all Phase 9 export lifecycle risks are closed. Sensitive student projection, notice-file audience policy, finance approval/SoD, grant ceilings, teacher employment/professional eligibility, statutory payroll evidence and grading history retain their recognized later owners. No deferred product module is reactivated. After the final Phase 1 gate passes, the next slice is **Phase 2 — Domain Authorization Policies**.
