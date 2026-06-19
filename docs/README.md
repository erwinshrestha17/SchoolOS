# SchoolOS Documentation

**Status:** Active documentation map and GA release-governance index  
**Last updated:** 2026-06-19

This folder contains the active detailed SchoolOS documentation. Use this page as the folder-level map only; the root `README.md` remains the repository entry point and source-of-truth summary.

SchoolOS is now governed by a Production / General Availability (GA) release target, not an MVP target. Current work is evidence-led internal QA hardening, seeded school workflow proof, authenticated browser/mobile verification, staging validation, controlled-pilot validation, and release-operational readiness. Do not treat older readiness language, passing local checks, or a demo as proof of production or GA readiness; use the GA release policy and production-readiness audit for the target and current evidence.

---

## Read Order

| Order | Document | Purpose |
|---:|---|---|
| 1 | `../README.md` | Project summary, current release stage, readiness boundaries, and active source-of-truth set. |
| 2 | `../AGENTS.md` | Agent/developer operating rules, GA-oriented delivery target, security rules, architecture rules, and verification commands. |
| 3 | `production/SCHOOLOS_GA_RELEASE_POLICY.md` | Canonical release terminology, stage definitions, GA gates, non-goals, and required reporting format. |
| 4 | `project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md` | Canonical evidence-based readiness audit, scores, command results, blockers, and documentation inventory. |
| 5 | `project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md` | Focused dependency-driven execution plan from internal QA through staging, controlled pilot, release candidate, and production readiness. |
| 6 | `product/SCHOOLOS_PRODUCT_REQUIREMENTS.md` | Product vision, Nepal-first requirements, modules, actors, and product boundaries. |
| 7 | `product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md` | Feature-level behavior, validation rules, edge cases, and acceptance criteria. |
| 8 | `project/SCHOOLOS_PROJECT_STATUS.md` | Current implementation status snapshot; should summarize, not replace, the audit. |
| 9 | `project/SCHOOLOS_IMPLEMENTATION_PLAN.md` | Longer implementation backlog and module detail; execution priority is governed by the next-phase plan and GA policy. |
| 10 | `architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md` | Storage, File Registry, tenant isolation, scaling, performance, and security architecture. |
| 11 | `architecture/SCHOOLOS_PLATFORM_OPERATIONS.md` | Platform control plane, tenant configuration boundaries, SaaS billing, and provider/queue operations. |
| 12 | `design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md` | Active web frontend design, UI/UX, wireframes, components, API usage, and web persona smoke plan. |
| 13 | `design/SCHOOLOS_DASHBOARD_AND_M1_REFERENCE_SCREENS.md` | Approved supporting visual-reference appendix for the supplied principal dashboard and M1 desktop screens. Canonical web-plan rules take precedence. |
| 14 | `design/M8B_TRANSPORT_WEB_REFERENCE_ANALYSIS.md` | Approved supporting visual-reference appendix for the supplied M8B Transport desktop, parent, and driver/mobile screens. Canonical web-plan and backend contracts take precedence. |
| 15 | `implementation/WEB_UI_API_ALIGNMENT_AUDIT.md` | Active implementation alignment audit, including contract-safe M3 Fees & Receipts and M5 Activity Feed & Milestones reference-screen implementation slices. |
| 16 | `design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md` | Active Flutter mobile app UI/UX, persona flows, mobile wireframes, API/offline rules, and mobile smoke plan. |
| 17 | `production/SCHOOLOS_PRODUCTION_RUNBOOK.md` | Deployment, environment, backup/restore, pilot onboarding, rollback, and go/no-go procedures. Procedures are not proof unless executed. |

---

## Active Docs

```text
README.md
product/SCHOOLOS_PRODUCT_REQUIREMENTS.md
product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md
project/SCHOOLOS_PROJECT_STATUS.md
project/SCHOOLOS_IMPLEMENTATION_PLAN.md
project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md
project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md
architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md
architecture/SCHOOLOS_PLATFORM_OPERATIONS.md
design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md
design/SCHOOLOS_DASHBOARD_AND_M1_REFERENCE_SCREENS.md
design/M8B_TRANSPORT_WEB_REFERENCE_ANALYSIS.md
implementation/WEB_UI_API_ALIGNMENT_AUDIT.md
design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md
production/SCHOOLOS_GA_RELEASE_POLICY.md
production/SCHOOLOS_PRODUCTION_RUNBOOK.md
```

App-specific active docs outside this folder:

```text
apps/schoolos_mobile/MOBILE_MASTER_GUIDE.md
apps/web/e2e/README.md
```

## Source-of-Truth Ownership

| Topic | Canonical Document | Audience |
|---|---|---|
| Production / GA target, release stages, and required gates | `production/SCHOOLOS_GA_RELEASE_POLICY.md` | Product, engineering, QA, deployment owner |
| Current readiness evidence and scores | `project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md` | Product, engineering, deployment owner |
| Next development sequence | `project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md` | Engineering team |
| Product scope and boundaries | `product/SCHOOLOS_PRODUCT_REQUIREMENTS.md` | Product, engineering |
| Functional behavior | `product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md` | Engineering, QA |
| Architecture/security rules | `architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md` | Engineering, security |
| Platform operations boundary | `architecture/SCHOOLOS_PLATFORM_OPERATIONS.md` | Platform/admin engineers |
| Web UI and state rules | `design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md` | Web engineers |
| Dashboard and M1 visual-reference detail | `design/SCHOOLOS_DASHBOARD_AND_M1_REFERENCE_SCREENS.md` (supporting appendix; canonical web plan takes precedence) | Product, design, web engineers |
| M8B Transport visual-reference detail | `design/M8B_TRANSPORT_WEB_REFERENCE_ANALYSIS.md` (supporting appendix; canonical web plan and backend/OpenAPI contracts take precedence) | Product, design, web engineers, QA |
| M3 and M5 reference-to-contract implementation guidance | `implementation/WEB_UI_API_ALIGNMENT_AUDIT.md` (implementation audit; canonical web plan and backend/OpenAPI contracts take precedence) | Web engineers, QA |
| Mobile companion app rules | `design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md` | Mobile engineers |
| Deployment and recovery procedure | `production/SCHOOLOS_PRODUCTION_RUNBOOK.md` | Deployment/operator team |
| Historical/superseded docs | `archive/README.md` | Maintainers |

## Deprecated or Merged References

The old combined web/mobile planning reference `docs/design/SCHOOLOS_WEB_MOBILE_PRODUCT_DESIGN_AND_IMPLEMENTATION_PLAN.md` is not an active document. Use the separate web and mobile design plans plus the next-phase delivery plan.

The generated/tool-cache Markdown file `.cache/corepack/v1/pnpm/10.12.1/README.md` is not repository documentation and should not be linked from active docs.

## Design Planning Docs

The active design folder has two source-of-truth documents:

```text
design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md
design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md
```

It also contains owner-approved **supporting visual-reference appendices**:

```text
design/SCHOOLOS_DASHBOARD_AND_M1_REFERENCE_SCREENS.md
design/M8B_TRANSPORT_WEB_REFERENCE_ANALYSIS.md
```

The visual appendices are not competing product, architecture, release, API-contract, or frontend source-of-truth documents. They document supplied reference screens and defer to the canonical web plan for shared UI rules, route boundaries, tenant/RBAC/module entitlement rules, protected files, data truth, and acceptance criteria.

The M3 Fees & Receipts and M5 Activity Feed & Milestones desktop references are recorded as contract-safe implementation slices in `implementation/WEB_UI_API_ALIGNMENT_AUDIT.md`. That audit does not create a competing design or API source: the canonical web plan remains authoritative for shared design rules, and backend/OpenAPI/shared contracts remain authoritative for fields, routes, totals, actions, permissions, file access, consent, audience scope, and provider ownership.

Use the web plan for `apps/web`, school dashboard, platform control plane, settings, module workspaces, reports, protected file actions, and web persona smoke planning.

Use the dashboard/M1 appendix when implementing or reviewing the referenced principal dashboard and M1 Admissions / Student Profiles workspaces.

Use the M8B Transport appendix when implementing or reviewing the referenced Transport admin workspaces, parent assigned-bus status, and driver/conductor assigned-trip flow. Live map, WebSocket, SSE, ETA, route deviation, geofence, and overspeed UI remain deferred unless backend/provider/load/privacy decisions are confirmed.

Use the M3 and M5 sections of the UI/API alignment audit when implementing or reviewing the supplied desktop references against existing real routes and backend contracts. The M5 section explicitly preserves the boundary between M5 classroom activity work, M10 delivery operations, and M0/File Registry or platform storage operations.

Use the mobile plan for `apps/schoolos_mobile`, parent, teacher, principal, driver, staff self-service, and controlled student lab/session app design.

---

## Cleanup Rules

1. Do not add a new `.md` file if the content belongs inside an active source-of-truth doc, unless the owner explicitly approves a supporting visual-reference appendix and its relationship to the canonical doc is recorded here.
2. `production/SCHOOLOS_GA_RELEASE_POLICY.md` is an approved canonical release-governance document; do not duplicate or fork its stage definitions in new docs.
3. Do not recreate planning-only docs that conflict with current implementation status.
4. Keep old duplicated planning content in git history rather than active repo docs.
5. Keep `docs/design` limited to the source-of-truth design plans and owner-approved supporting reference appendices; do not add new design docs without owner approval and an index update here.
6. Web design belongs in `design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`; reference-to-contract implementation notes belong in existing implementation audits and must explicitly defer to the canonical web plan and backend/OpenAPI contracts.
7. Mobile app design belongs in `design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md`.
8. Release evidence and scores belong in `project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md`.
9. Forward execution sequencing belongs in `project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md`.
10. Production / GA terms, stages, and exit gates belong in `production/SCHOOLOS_GA_RELEASE_POLICY.md`.
