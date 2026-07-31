# Slice 4 / 4.1 — Permission Convergence and Staging Validation Evidence

- **Validation slice:** Slice 4.1 (staging and contract verification)
- **Environment:** Local staging simulation (`schoolos_staging` Postgres `:5434`, API `:4000`, tenant `default-school`)
- **Commit (base):** `e466642080993348ff83901c7871d02a4fb9dd4e` (Slice 4 + 4.1 changes uncommitted on working tree — 37 paths)
- **Deployment identifier:** `pnpm staging:api:local` (rebuilt API dist after Slice 4)
- **Honest boundary:** **Staging validated (local simulation) only.** Not controlled-pilot validated, not remote TLS staging, not GA.

## Slice 4 local baseline (pre–Slice 4.1)

| Gate | Result |
| --- | --- |
| `pnpm --filter @schoolos/core build` | PASS |
| `pnpm --filter @schoolos/web typecheck` | PASS |
| `pnpm --filter @schoolos/api typecheck` | PASS |
| `pnpm --filter @schoolos/web build` | PASS |
| Focused Slice 1–4 contracts | 54/54 PASS |
| Dashboard persona API spec | 7/7 PASS |
| Full web suite | 461 pass / 12 fail (≤14 ceiling) |

## Diff review (Phase 0)

- **Scope:** 27 modified + 3 new files; +625/−144 lines (Slice 4) + Slice 4.1 verifier/DTO (~4 files)
- **No secrets** in diff (only `AuthMethod.PASSWORD` enum references and permission key names)
- **No generated artifacts** committed inadvertently
- **Thin dashboard wrappers:** `HrDashboard`, `AccountantDashboard` delegate to `OperationalDashboardLayout`
- **Slice 4.1 additions:** `verify-slice4-dashboard-persona-local.mjs`, OpenAPI DTO, `hr_manager` route role fix

---

## Required final report

```text
Validation Slice: Slice 4.1
Environment: Local staging simulation (Postgres :5434, API :4000, default-school)
Commit: e466642080993348ff83901c7871d02a4fb9dd4e (+ uncommitted working tree)
Deployment identifier: pnpm staging:api:local (rebuilt 2026-07-31)

OpenAPI:
  Verification command: pnpm verify:openapi
  Result: PASS (Swagger wiring gate)
  compositionPersona enum: admin | principal | hr | accountant (confirmed in /api/v1/docs-json)
  Generated contract changes: OperationalDashboardSummaryResponseDto added; general absent

Persona validation:
  Admin: PASS — HTTP 200, compositionPersona=admin, modules ⊆ admin set
  Principal: PASS — HTTP 200, compositionPersona=principal, no m1_students/m9_accounting
  HR: PASS — HTTP 200, compositionPersona=hr (after hr_manager @Roles fix), no students/academics/fees/accounting
  Accountant: PASS — HTTP 200, compositionPersona=accountant, fees+accounting+hr-payroll; no students/academics
  Teacher: PASS — HTTP 403 on GET /dashboard/summary
  Unsupported personas: PARTIAL — librarian/cashier 403 covered by API unit spec; driver 403 at route guard (not in @Roles); no default-school librarian/cashier seed users for HTTP matrix

Settings:
  Personal settings: PASS (contract) — useSettingsCapabilities; teacher personalOnly frame; no raw permission sets in 5 priority files
  Institutional settings: PASS (contract) — shouldShowSettingsHub(settingsCaps); institutional nav gated on canAccessInstitutionalSettings
  Read/write separation: PASS (contract) — granular settings caps (users:create vs roles:read, etc.)
  Provider settings: Not browser-verified this slice

Homework:
  Assignment enforcement: PASS — pnpm verify:m6-homework (class/subject teacher scopes HTTP 200)
  Class-teacher restriction: PASS (contract) — useHomeworkCapabilities + assignment scope
  Direct-route denial: Backend authority (not re-run as browser E2E this slice)

Payroll:
  Prepare: PASS (contract) — usePayrollCapabilities.canPrepare separate from canReview
  Review: PASS — payroll readiness uses payrollCaps.canReview (alias-aware); verify:m7-hr PASS
  Approve: PASS — HR denied approve without approver role (HTTP 403)
  Finalize: PASS (contract) — canFinalize = payroll:run:post
  Export: PASS (contract) — canExport separate flag
  Accounting posting: Not staging-browser verified
  Sensitive-data exposure: PASS (contract) — readiness query enabled only when granted; fail-closed hooks

Communications:
  Diagnostics: PASS (contract) — useCommunicationsCapabilities.canViewDiagnostics
  Retry: PASS (contract) — separate canRetry flag
  Provider management: Not applicable in touched pages
  Emergency send: PASS (contract) — M15 useNoticeCapabilities unchanged; M12 caps separate
  M12/M15 separation: PASS (contract) — slice4-authorization-contract.test.mjs

Cache validation:
  Persona change: PASS (code contract) — query key ["operational-dashboard-summary", tenantId]; no persona in key; enabled gated on canFetchDashboard
  Tenant change: Not manually browser-verified
  Branch change: N/A (single-branch staging tenant)
  Permission removal: Not manually browser-verified
  Support override: Not exercised (staging)

Commands executed:
  pnpm --filter @schoolos/core build
  pnpm verify:openapi
  pnpm --filter @schoolos/web typecheck
  pnpm --filter @schoolos/api typecheck
  pnpm --filter @schoolos/api build
  pnpm --filter @schoolos/web build
  pnpm verify:slice4-dashboard-persona
  pnpm verify:m6-homework
  pnpm verify:m7-hr
  node --test (54 focused contracts)
  pnpm --filter @schoolos/api test -- operational-summary-dashboard-persona.spec.ts
  node --test apps/web/test/*.test.mjs

Focused tests: 54/54 PASS
Full web tests: 461 pass / 12 fail
Core build: PASS
Web type-check: PASS
API type-check: PASS
Web build: PASS
OpenAPI verification: PASS (gate + manual docs-json)

Evidence captured:
  - docs/production/evidence/slice4-dashboard-persona-http-2026-07-31-local.md
  - docs/production/evidence/m6-homework-core-2026-07-31-local.md
  - docs/production/evidence/m7-hr-core-2026-07-31-local.md
  - This file

New regressions: None (full web failures 12 ≤ 14 baseline; improved from prior 14)
Known baseline failures: 12 pre-existing web contract/unit failures (unchanged suites not modified)
Remaining P0 blockers: Controlled-pilot browser/device matrix (P0-15); remote TLS staging; librarian/cashier HTTP seed on staging tenant

Status: PARTIAL
```

---

## OpenAPI detail

### Shallow gate

`pnpm verify:openapi` validates Swagger bootstrap in `apps/api/src/main.ts` only.

### Manual docs-json inspection (2026-07-31, rebuilt API)

```json
"compositionPersona": {
  "type": "string",
  "enum": ["admin", "principal", "hr", "accountant"],
  "description": "Server-resolved dashboard composition persona. Unsupported personas receive HTTP 403."
}
```

- `general`: **absent**
- Persona query parameter on `GET /dashboard/summary`: **absent**
- Teacher/unsupported: documented via `@ApiForbiddenResponse`, enforced at runtime (403)

---

## Staging test identities (`default-school`)

| Persona | Email | Expected |
| --- | --- | --- |
| Admin | `admin@schoolos.com` | `compositionPersona: admin` |
| Principal | `principal@schoolos.com` | `compositionPersona: principal` |
| HR | `hr@schoolos.com` (role `hr_manager`) | `compositionPersona: hr` |
| Accountant | `accountant@schoolos.com` | `compositionPersona: accountant` |
| Teacher | `classteacher@schoolos.com` | HTTP 403 |
| Driver | `driver@schoolos.com` | HTTP 403 (route `@Roles` guard) |

Password: staging demo env (`SCHOOLOS_DEMO_PASSWORD` / default local demo — not recorded here).

**Note:** `pilot-rehearsal-1` Wave 1 entitlement overrides keep HR/fees/accounting modules OFF; dashboard persona HTTP validation used `default-school` with full module entitlements.

---

## HTTP persona verification

Automated: `pnpm verify:slice4-dashboard-persona` → **33/33 PASS**

Evidence: [`slice4-dashboard-persona-http-2026-07-31-local.md`](./slice4-dashboard-persona-http-2026-07-31-local.md)

---

## Slice 4.1 code additions

| Change | Purpose |
| --- | --- |
| [`scripts/verify-slice4-dashboard-persona-local.mjs`](../../../scripts/verify-slice4-dashboard-persona-local.mjs) | HTTP staging verifier |
| [`operational-dashboard-summary.dto.ts`](../../../apps/api/src/operational-summary/dto/operational-dashboard-summary.dto.ts) | OpenAPI enum documentation |
| `hr_manager` in dashboard `@Roles` | Align route guard with seeded HR role name |

---

## Browser / screenshot gap

Desktop and laptop-width screenshots were **not** captured in this slice. Network-level evidence substitutes for dashboard persona flows. Full browser matrix remains on the controlled-pilot checklist ([`controlled-pilot-pilot-rehearsal-1-2026-07-29.md`](./controlled-pilot-pilot-rehearsal-1-2026-07-29.md)).

---

## Next release action

1. Commit Slice 4 + 4.1 changes after owner review
2. Re-verify on remote TLS staging when available
3. Proceed to **Slice 5 — Attendance reopen/correction/re-lock**
4. Resolve 12 persistent web-test failures before P1 UI standardization
