# SchoolOS Documentation

**Status:** Active documentation map  
**Last updated:** 2026-06-15

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
| 9 | `design/SCHOOLOS_UI_UX_GUIDE.md` | Single UI/UX, design-token, component, accessibility, and web/mobile direction. |
| 10 | `production/SCHOOLOS_PRODUCTION_RUNBOOK.md` | Deployment, environment, backup/restore, pilot onboarding, and go/no-go checks. |

---

## Active Docs

```text
product/SCHOOLOS_PRODUCT_REQUIREMENTS.md
product/SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md
project/SCHOOLOS_PROJECT_STATUS.md
project/SCHOOLOS_IMPLEMENTATION_PLAN.md
project/SCHOOLOS_ADVANCED_OPERATIONS_PLAN.md
project/SCHOOLOS_LEARNING_LAYER_PLAN.md
project/SCHOOLOS_COST_PERFORMANCE_IMPLEMENTATION_PLAN.md
architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md
architecture/SCHOOLOS_PLATFORM_OPERATIONS.md
design/SCHOOLOS_UI_UX_GUIDE.md
production/SCHOOLOS_PRODUCTION_RUNBOOK.md
```

App-specific active docs outside this folder:

```text
apps/schoolos_mobile/MOBILE_MASTER_GUIDE.md
apps/web/e2e/README.md
```

---

## Cleanup Rules

1. Do not add a new `.md` file if the content belongs inside an active source-of-truth doc.
2. Do not recreate planning-only docs that conflict with current implementation status.
3. Keep old duplicated planning content in git history rather than active repo docs.
4. Add a split-out doc only when it has a clear owner, current status, and no overlap with an existing active doc.
