# SchoolOS Documentation

**Status:** Active documentation map
**Last updated:** 2026-06-16

This folder contains the active detailed SchoolOS documentation. Use this page as the folder-level map only; the root `README.md` remains the repository entry point and source-of-truth summary.

SchoolOS is not in a planning-only documentation phase. Current work is controlled pilot hardening, staging verification, frontend/mobile polish where real APIs exist, and staged KG-12/M12 Learning expansion.

---

## Read Order

| Order | Document | Purpose |
|---:|---|---|
| 1 | `../README.md` | Project summary, current stage, readiness boundaries, and active source-of-truth set. |
| 2 | `../AGENTS.md` | Agent/developer operating rules, security rules, architecture rules, and verification commands. |
| 3 | `product/SCHOOLOS_PRODUCT_REQUIREMENTS.md` | Product vision, Nepal-first requirements, modules, actors, and product boundaries. |
| 4 | `product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md` | Feature-level behavior, validation rules, edge cases, and acceptance criteria. |
| 5 | `project/SCHOOLOS_PROJECT_STATUS.md` | Current implementation status and remaining work snapshot. |
| 6 | `project/SCHOOLOS_IMPLEMENTATION_PLAN.md` | Active implementation order, module backlogs, and phase gates. |
| 7 | `architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md` | Storage, File Registry, tenant isolation, scaling, performance, and security architecture. |
| 8 | `architecture/SCHOOLOS_PLATFORM_OPERATIONS.md` | Platform control plane, tenant configuration boundaries, SaaS billing, and provider/queue operations. |
| 9 | `design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md` | Active web frontend design, UI/UX, wireframes, components, API usage, and web persona smoke plan. |
| 10 | `design/SCHOOLOS_MOBILE_APP_UI_UX_DESIGN_PLAN.md` | Active Flutter mobile app UI/UX, persona flows, mobile wireframes, API/offline rules, and mobile smoke plan. |
| 11 | `production/SCHOOLOS_PRODUCTION_RUNBOOK.md` | Deployment, environment, backup/restore, pilot onboarding, and go/no-go checks. |

---

## Active Docs

```text
README.md
product/SCHOOLOS_PRODUCT_REQUIREMENTS.md
product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md
project/SCHOOLOS_PROJECT_STATUS.md
project/SCHOOLOS_IMPLEMENTATION_PLAN.md
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
