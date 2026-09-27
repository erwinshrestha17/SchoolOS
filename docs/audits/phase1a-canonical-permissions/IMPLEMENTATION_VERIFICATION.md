# SchoolOS Phase 1A — Canonical Permission Catalog

Scope: Phase 1A, including 1A.1 explicit built-in role allowlists and 1A.2 role template baseline. This is a scoped implementation/evidence record, subordinate to `AGENTS.md` and the recognized execution documents. No Phase 1B kernel or typed-scope migration is included.

## Prerequisite and delivery boundary

Starting SHA: `f764c313ee0f0f6e8a61ef0e90a36e118f2a558d`, clean `main`, matching `origin/main`. Phase 0 passed at that SHA through [full manual CI run 36284369616](https://github.com/erwinshrestha17/SchoolOS/actions/runs/36284369616): both jobs executed without skipped steps. Its [certification](../phase0-slice0a/BASELINE_CERTIFICATION.md) remains historical baseline evidence.

Phase 1A delivery SHA: `4519f34ca48ddbfdedcd85c3d9723ba17c1da76b`. Its [full manual CI run 36286847283](https://github.com/erwinshrestha17/SchoolOS/actions/runs/36286847283) passed: both `verify` and `mobile` executed with no skipped or failed steps, and all 33 Web browser cases passed on their first attempt. This delivery result was rechecked before Phase 1B. The report had remained locally present but untracked under the repository's Markdown ignore rule; Phase 1B includes it explicitly to make the prerequisite record retrievable with the committed evidence.

Compressed command logs, source-file digests and the PostgreSQL seed query are locked in [evidence/](evidence/local-verification.json). Verify preserved bytes with `shasum -a 256 -c SHA256SUMS` from that folder. The full local unit/E2E/integration runs precede the final definition-freeze and canonical-name review; the later Core, typecheck and 171 affected API checks cover the freeze. Final delivery-SHA hosted CI verifies the complete final source together.

## Requirement-to-evidence audit

| Requirement | Current implementation and proof |
| --- | --- |
| Canonical `module:resource:action` definitions | `packages/core/src/canonical-permissions.ts` explicitly maps all 326 existing keys to 326 unique canonical identities; Core tests compare catalog coverage, naming and unique identities. |
| Metadata | Each definition has risk, allowed scope types, delegation, reason/MFA/approval requirements, description, introduced version and nullable deprecation. Runtime validation rejects incomplete/duplicate/domain-inconsistent definitions. |
| Legacy mapping without premature migration | Persisted permissions and existing guards retain legacy keys. Canonical lookups return a definition or `null`; unknown keys are not assigned a fallback definition. |
| HIGH/CRITICAL nondelegable | Core tests check every HIGH/CRITICAL definition. Metadata is declarative; it does not yet enforce MFA, approval or resource policy. |
| Explicit built-in allowlists | `permissions/roles.ts` no longer reads the permission catalog to construct grants. Admin's 222 and Principal's 65 direct grants are explicit; Principal's 21 accounting visibility grants are reviewed constants. Platform's 28-key list is also explicit. |
| New permission defaults to no role | Every direct role grant is explicitly enumerated. Catalog changes cannot add grants via all-except filters. Exact direct and effective-alias snapshots fail when authority changes without updating the reviewed baseline. |
| All named role templates | `systemRoleTemplates` defines all 15 roadmap labels plus seven preserved existing roles, with stable persisted keys, domain, version 1 and direct grants. |
| Immutable/versioned templates | Template records, grant arrays, role definitions, school/Platform definition lists and grant maps are frozen. Tenant permission administration rejects canonical system roles and reserved built-in names. |
| Custom roles remain independent | Custom grants remain editable through the existing audited transaction. Provisioning and seed reject normalized custom-name collisions; upserts never promote custom roles to system roles. No automatic user assignment is added for new roles. |
| Platform separation | Core tests inspect direct and effective grants for every school template; API boundary tests inspect actual runtime school and Platform definitions. |
| API/persistence compatibility | Unit, HTTP E2E and PostgreSQL integration verify mutation rejection, custom-role audit rollback, system reconciliation, provisioning failure, and direct HR bulk-attendance authority. |
| Generated contracts | Only generated `permissions.ts` changes; `compile:artifacts` and tracked-artifact checks validate it. Prisma schema and all migration SQL remain unchanged. |

The catalog has 7 LOW, 88 MEDIUM, 176 HIGH and 55 CRITICAL definitions. Broad fee setup maps to `fees:configuration:manage`, discount/waiver management to `fees:discount:manage`, and notification template, preference and delivery operations to their actual resources rather than the inbox. The legacy catalog descriptions and current controller paths were inspected before establishing these canonical names.

## Role template baseline

All 16 pre-existing direct permission sets exactly match the Phase 0 `role-permissions.csv` rows with `direct=true`. This slice replaces implicit construction without silently removing their direct grants. Existing finance/HR role combinations remain future SoD work.

| Persisted key | Display name | Direct grants | Change |
| --- | --- | ---: | --- |
| school_config_owner | School Access Owner | 32 | Existing grants preserved |
| admin | School Admin | 222 | Explicit allowlist replaces all-except |
| principal | Principal | 65 | Explicit accounting subset |
| admissions_officer | Admissions Officer | 10 | New, unassigned |
| teacher | Teacher | 42 | Existing assignment enforcement preserved |
| hr_manager | HR Manager | 36 | Existing grants preserved |
| payroll_preparer | Payroll Preparer | 7 | New, no review/approve/post/pay |
| payroll_reviewer | Payroll Reviewer | 7 | New, no create/approve/post/pay |
| payroll_approver | Payroll Approver | 4 | New, no create/review/post/pay |
| cashier | Cashier | 3 | New, collect/read; no refund/reverse/close |
| accountant | Accountant | 65 | Existing grants preserved |
| finance_approver | Finance Approver | 3 | New, finance-specific approval read/decide |
| financial_auditor | Auditor | 25 | Existing grants preserved |
| parent | Parent/Guardian | 14 | Existing child capability checks preserved |
| student | Student | 10 | Existing self-service grants preserved |
| subject_teacher | Subject Teacher | 39 | Existing subject scope preserved |
| support_staff | Support Staff | 6 | Compatibility retained |
| librarian | Librarian | 6 | Deferred module remains deferred |
| driver | Driver | 5 | Existing driver scope preserved |
| platform_super_admin | Platform Super Admin | 28 | Explicit Platform allowlist |
| platform_support | Platform Support | 10 | Separate Platform domain |
| platform_billing_admin | Platform Billing Admin | 9 | Separate Platform domain |

Machine-readable reviewed baselines: `packages/core/test/role-template-baseline.json` and `role-effective-alias-baseline.json`. Core tests bind both to the running compiled definitions.

## Effective authority changes and safety boundaries

Generic `settings:read` no longer confers `advanced:approvals:read`; generic `settings:manage` no longer confers approval manage/decide. Generic `reports:export` no longer confers payroll exports, analytics refresh or document management. Explicit grants and the existing domain-specific administrative aliases remain.

| Existing role | Removed indirect grants |
| --- | --- |
| accountant / financial_auditor | advanced:analytics:refresh, advanced:approvals:read, advanced:documents:manage, payroll:exports:create |
| admin | payroll:exports:create |
| hr_manager / teacher | advanced:approvals:read |
| school_config_owner | advanced:approvals:read, advanced:approvals:manage, advanced:approvals:decide |

No effective grants were added to an existing role. Aliases are not transitively expanded.

New templates were checked against actual downstream services. Finance Approver does not receive generic advanced approvals because those workflows can concern nonfinance domains. Admissions Officer omits broad student/guardian read until a safe workflow projection exists (Phase 0 H03); this catalog slice does not claim a complete admissions UI workflow. Payroll templates separate grants, while actor-level SoD remains Phase 2 work.

Legacy attendance aliases remain for caller-scoped staff self-attendance. Bulk staff attendance now requires a direct `hr:attendance:write` or `hr:manage` grant before loading data, so student attendance authority cannot become HR bulk-write authority. Unit and HTTP negative tests prove rejection; the existing self-attendance service remains caller-scoped.

The canonical lookup does not yet act as an endpoint authorization kernel. Teacher assignments, guardian relationships, session checks, entitlements, lifecycle checks and current tenant enforcement remain authoritative in their existing services. Canonical scope metadata does not create or widen persisted role assignments.

## Local verification

Toolchain: Node 22.23.2, pnpm 10.12.1, Prisma 7.8.0. Persistence used disposable PostgreSQL 16 and Redis 7 on loopback ports 55434/56380, with separate explicitly opted-in auth/admission test databases. No shared development database was changed.

| Gate | Command / evidence | Result |
| --- | --- | --- |
| Canonical generation / tracked artifacts | `pnpm compile:artifacts`; `pnpm verify:tracked-artifacts` | PASS |
| Schema / client / contracts | `pnpm db:validate`; Prisma generation during API gates; `pnpm verify:openapi` | PASS |
| Core contract baseline | `pnpm --filter @schoolos/core test` | PASS: 12 tests |
| Format / lint / typecheck | `pnpm lint`; `pnpm typecheck` | PASS; API 0 errors, 3,628 warnings; Web zero-warning policy retained |
| Unit/component | `pnpm test` | PASS: Core 12; API 273 suites / 3,134 tests; Web 666, no skips |
| HTTP E2E | `pnpm test:e2e` | PASS: 43 suites / 295 tests |
| Persistence / regression | `pnpm test:integration`, both guarded database URLs supplied | PASS: 12 suites / 203 tests |
| Final immutable definitions / affected fixtures | Core baseline tests plus targeted RolesService, TenantsService, canonical seed and AttendanceService tests | PASS: 12 Core and 171 API tests |
| Empty database replay / seed | Prisma deploy to three empty PostgreSQL databases; `pnpm db:migrate`; `pnpm db:seed` | PASS: 112 migrations; six new templates have 10/3/3/4/7/7 grants and zero assigned users |
| Migration drift | `pnpm db:verify:drift` | PASS: no difference |
| Production builds | `NODE_ENV=production pnpm build` | PASS: API/Core/Web |

The final delivery additionally requires a full manual `ci.yml` run on its exact SHA, including browser and Mobile gates; this cannot be replaced with path-skipped success. Mobile source is unchanged. Hosted Flutter excludes macOS-only goldens under the existing documented policy; the Phase 0 same-host golden evidence remains separate. This slice does not certify physical devices, live providers, staging or production rollout.

## Remaining work and stop boundary

Phase 0 H01's implicit built-in inheritance is closed by explicit allowlists and versioned baselines. H02–H05 and H07–H11 are not claimed fixed. Custom-role grant ceilings, actor-level finance/payroll SoD, typed scopes, sensitive projections, queued reauthorization, teacher professional eligibility, statutory-policy history and grading-history integrity retain their future owners.

Existing persisted tenant roles are not automatically reconciled by application startup. The canonical school development seed resynchronizes true system presets; collisions fail closed and require deliberate remediation. Existing tenant custom roles are not upgraded. A managed production reconciliation/version-lineage rollout remains separate.

Stop after Phase 1A. Exact recommended next slice: **Phase 1B — Central Authorization Kernel**, preserving current domain checks and introducing deterministic fail-closed decision contracts. No Phase 1B implementation is included here.
