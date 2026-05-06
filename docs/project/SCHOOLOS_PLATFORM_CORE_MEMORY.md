# SchoolOS Platform Core Memory

This platform core roadmap has been consolidated into the master SchoolOS memory.

Current source of truth:

```text
docs/project/SCHOOLOS_MASTER_PROJECT_MEMORY.md
```

Keep this file only as a compatibility pointer for older prompts that still reference `SCHOOLOS_PLATFORM_CORE_MEMORY.md`.

---

## M0 Platform Core Summary

SchoolOS has three logical planes inside the same modular monolith:

| Plane | Audience | Frontend | Backend |
|---|---|---|---|
| Platform Control Plane | SchoolOS owner/operator | `/platform/*` | `/platform/*` |
| Tenant Configuration Plane | School principal/admin | `/dashboard/settings/*` | `/settings/*` or `/tenant-settings/*` |
| School Operations Plane | School staff/parents/students | `/dashboard/*` | Module APIs such as `/students`, `/attendance`, `/finance`, `/notices` |

---

## Platform Core Priority Order

1. Platform Control Plane depth for school/tenant management and operational health.
2. Tenant Settings foundation.
3. Generic File Registry.
4. Global API Response Envelope with PDF/file/CSV exceptions.
5. Generic Reports Foundation.
6. Safe Activity Logs Module.
7. Usage Limits and Plan Rules.
8. API Key Management.
9. Webhook System.
10. SaaS Subscription and Billing.

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
