# SchoolOS Platform Core Memory

This platform core roadmap has been consolidated into the master SchoolOS memory.

Current source of truth:

```text
docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
```

Current repo/backend audit:

```text
docs/project/SCHOOLOS_CURRENT_REPO_ANALYSIS.md
```

Keep this file only as a compatibility pointer for older prompts that still reference `SCHOOLOS_PLATFORM_CORE_MEMORY.md`.

---

## Current M0 Status

```text
M0 Platform Core Foundation Depth: Completed
Current work: stabilize existing platform/domain foundations, then deepen one vertical at a time.
```

Implemented/foundation areas now include:

```text
Platform Control Plane foundation
Tenant/settings boundary documentation
Generic File Registry foundation
Global API response/reporting direction
Usage/plan-service foundations
Platform audit direction
```

Remaining platform work:

```text
SaaS subscription and billing automation
API key management
Webhook system
Plan/feature entitlement enforcement depth
Platform health/queue/audit UI depth
Support access workflow polish
```

---

## M0 Platform Core Summary

SchoolOS has three logical planes inside the same modular monolith:

| Plane | Audience | Frontend | Backend |
|---|---|---|---|
| Platform Control Plane | SchoolOS owner/operator | `/platform/*` | `/platform/*` |
| Tenant Configuration Plane | School principal/admin | `/dashboard/settings/*` | `/settings/*` or `/tenant-settings/*` |
| School Operations Plane | School staff/parents/students | `/dashboard/*` | Module APIs such as `/students`, `/attendance`, `/finance`, `/notices`, `/academics`, `/accounting`, `/library`, `/transport`, `/canteen` |

---

## Platform Core Priority Order

Near-term priority after repo stabilization:

```text
1. Platform audit/usage visibility polish.
2. Plan/feature entitlement enforcement depth.
3. Tenant settings depth where it unblocks production workflows.
4. File Registry adoption for generated reports/files.
5. Usage limits and plan rules.
6. API Key Management only when integrations require it.
7. Webhook System only when external integrations require it.
8. SaaS Subscription and Billing before broad paid rollout.
```

Do not let platform work delay the immediate repo stabilization and Phase 2A admin UI/browser smoke work.

---

## Critical Boundary

```text
SchoolOS Finance/M3/M9 = school collects money from students/parents.
SaaS Billing = SchoolOS company charges schools for using SchoolOS.
```

Do not mix school fee collection with platform SaaS billing.

---

## Rules

- Keep M0 Platform Core inside the NestJS modular monolith.
- Keep platform routes under `/platform/*`.
- Keep school settings under `/dashboard/settings/*`.
- Every platform action affecting tenants, plans, billing, support access, providers, or limits must be audited.
- School users must not access platform settings.
- Platform support must not enter tenant data silently; support override requires an explicit reason and audit log.
- Frontend gating is display only; backend entitlement and permission checks must enforce access.
- Do not introduce microservices for platform separation yet.
