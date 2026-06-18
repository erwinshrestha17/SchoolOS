# SchoolOS Documentation

**Status:** Active documentation map
**Last updated:** 2026-06-18

This folder contains the active detailed SchoolOS documentation. Use this page as the folder-level map only; the root `README.md` remains the repository entry point and source-of-truth summary.

SchoolOS is not in a planning-only documentation phase. Current work is evidence-led internal QA hardening, realistic seeded demo/pilot flows, authenticated browser/mobile verification, and staging readiness. Do not treat older readiness language as proof; use the production-readiness audit for current evidence.

---

## Read Order

| Order | Document | Purpose |
|---:|---|---|
| 1 | `../README.md` | Project summary, current stage, readiness boundaries, and active source-of-truth set. |
| 2 | `../AGENTS.md` | Agent/developer operating rules, security rules, architecture rules, and verification commands. |
| 3 | `product/SCHOOLOS_PRODUCT_REQUIREMENTS.md` | Product vision, Nepal-first requirements, modules, actors, and product boundaries. |
| 4 | `product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md` | Feature-level behavior, validation rules, edge cases, and acceptance criteria. |
| 5 | `project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md` | Canonical evidence-based readiness audit, scores, command results, blockers, and documentation inventory. |
| 6 | `project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md` | Focused dependency-driven execution plan from local QA to controlled pilot and production readiness. |
| 7 | `project/SCHOOLOS_PROJECT_STATUS.md` | Current implementation status snapshot; should summarize, not replace, the audit. |
| 8 | `project/SCHOOLOS_IMPLEMENTATION_PLAN.md` | Longer implementation backlog and module detail; execution priority is governed by the next-phase plan. |
| 9 | `architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md` | Storage, File Registry, tenant isolation, scaling, performance, and security architecture. |
| 10 | `architecture/SCHOOLOS_PLATFORM_OPERATIONS.md` | Platform control plane, tenant configuration boundaries, SaaS billing, and provider/queue operations. |
| 11 | `design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md` | Active web frontend design, UI/UX, wireframes, components, API usage, and web persona smoke plan. |
| 12 | `design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md` | Active Flutter mobile app UI/UX, persona flows, mobile wireframes, API/offline rules, and mobile smoke plan. |
| 13 | `production/SCHOOLOS_PRODUCTION_RUNBOOK.md` | Deployment, environment, backup/restore, pilot onboarding, and go/no-go procedures. Procedures are not proof unless executed. |

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
design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md
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
| Current readiness evidence and scores | `project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md` | Product, engineering, deployment owner |
| Next development sequence | `project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md` | Engineering team |
| Product scope and boundaries | `product/SCHOOLOS_PRODUCT_REQUIREMENTS.md` | Product, engineering |
| Functional behavior | `product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md` | Engineering, QA |
| Architecture/security rules | `architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md` | Engineering, security |
| Platform operations boundary | `architecture/SCHOOLOS_PLATFORM_OPERATIONS.md` | Platform/admin engineers |
| Web UI and state rules | `design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md` | Web engineers |
| Mobile companion app rules | `design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md` | Mobile engineers |
| Deployment and recovery procedure | `production/SCHOOLOS_PRODUCTION_RUNBOOK.md` | Deployment/operator team |
| Historical/superseded docs | `archive/README.md` | Maintainers |

## Deprecated or Merged References

The old combined web/mobile planning reference `docs/design/SCHOOLOS_WEB_MOBILE_PRODUCT_DESIGN_AND_IMPLEMENTATION_PLAN.md` is not an active document. Use the separate web and mobile design plans plus the next-phase delivery plan.

The generated/tool-cache Markdown file `.cache/corepack/v1/pnpm/10.12.1/README.md` is not repository documentation and should not be linked from active docs.

## Design Planning Docs

The active design folder intentionally contains only two source-of-truth documents:

```text
design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md
design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md
```

Use the web plan for `apps/web`, school dashboard, platform control plane, settings, module workspaces, reports, protected file actions, and web persona smoke planning.

Use the mobile plan for `apps/schoolos_mobile`, parent, teacher, principal, driver, staff self-service, and controlled student lab/session app design.

---

## Cleanup Rules

1. Do not add a new `.md` file if the content belongs inside an active source-of-truth doc.
2. Do not recreate planning-only docs that conflict with current implementation status.
3. Keep old duplicated planning content in git history rather than active repo docs.
4. Keep `docs/design` limited to the two active design plans unless the owner explicitly approves another source-of-truth split.
5. Web design belongs in `design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`.
6. Mobile app design belongs in `design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md`.
7. Readiness claims belong in `project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md`.
8. Forward execution sequencing belongs in `project/SCHOOLOS_NEXT_PHASE_DELIVERY_PLAN.md`.
