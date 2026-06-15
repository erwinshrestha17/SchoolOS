# SchoolOS Agent Rules & Development Guidelines

This document serves as the unified operational instruction manual and coding standards guide for developer agents working on the SchoolOS repository.

---

## 1. Operating Protocol for Developer Agents

### Goal
You are working on the SchoolOS repository. Your job is to continue production implementation module-by-module until you are blocked by a decision that genuinely requires human input.

### Primary Objective
Read all available project documentation first, including README, Product Requirements, Functional Requirements, status logs, architecture plans, database schemas, frontend/backend paths, API controllers, and any pending issues.

Then:
1. Build an implementation inventory.
2. Identify incomplete production modules.
3. Rank them by priority using this order:
   - Security, authentication, authorization, tenant isolation
   - Core school operations required for MVP
   - Backend API/database gaps
   - Frontend screens still using mock/fake/placeholder data
   - Audit logging and compliance gaps
   - Error handling, validation, loading states, empty states
   - Tests and verification gaps
   - UI polish only after production functionality is complete

### Strict Rules
- Follow SchoolOS architecture exactly.
- Maintain tenant isolation in every database query, API route, service, and UI data flow.
- Never use fake data, mock data, placeholder data, or in-memory state for production flows.
- Replace mock flows with real backend API/database integration.
- Do not rewrite working modules unnecessarily.
- Do not break existing UI/UX flows.
- Do not remove existing features unless clearly obsolete and documented.
- Do not commit, push, merge, rebase, reset, delete branches, or run destructive git commands.
- Do not expose secrets.
- Do not weaken authentication, authorization, validation, RLS, audit logging, or security checks.
- Do not skip verification.

### Implementation Protocol
For each module:
1. Read relevant docs and existing implementation.
2. Determine what is incomplete.
3. Inspect backend, frontend, database schema, API contracts, types, validation, permissions, audit logs, and tests.
4. Implement only the missing production pieces.
5. Connect frontend to real backend APIs.
6. Ensure all writes persist to the database.
7. Ensure all reads are tenant-scoped.
8. Add or update tests where appropriate.
9. Run verification before moving on.
10. Review the diff for regressions, security issues, fake data, broken flows, tenant leakage, and avoidable compute/storage/provider cost.

### Definition of Done for Each Module
- No fake/mock/placeholder/in-memory production data remains.
- Backend API is implemented.
- Database persistence works.
- Frontend is integrated with real API.
- Tenant isolation is enforced.
- Role/permission checks are enforced.
- Audit logging exists for important create/update/delete/status actions.
- Loading, error, empty, and success states exist.
- Validation exists on frontend and backend.
- Relevant tests pass.
- Existing working behavior is not broken.
- Growing lists are paginated and filtered server-side.
- Heavy work is queued instead of blocking user requests.
- File/media flows use File Registry, StorageService, and optimized variants where applicable.
- The feature does not introduce avoidable SMS, storage, bandwidth, real-time, AI, or database cost.

### Running Progress Log
Maintain this after every major step:
```text
Current module:
Completed items:
Remaining items:
Risks:
Verification run:
Verification result:
Next action:
```

### Stop Conditions
Stop only when:
- A human business decision is required.
- Required credentials/env variables are missing.
- A destructive database migration requires approval.
- There are conflicting docs/specs.
- The priority order is ambiguous and choosing incorrectly could cause major rework.
- A security/tenant/audit rule is unclear.
- Verification cannot be completed because of unavailable external systems.

### Final Output
When stopped or finished, provide:
- Modules completed
- Files changed
- Verification commands run
- Passing/failing results
- Remaining modules
- Blocker requiring human decision, if any

---

## 2. Technical Architecture & Coding Rules

### Core Architecture
- Keep SchoolOS as a **NestJS modular monolith first**.
- Do not introduce microservices unless scale, team ownership, deployment isolation, or compliance isolation clearly justifies the cost and the owner explicitly requests it.
- Keep PostgreSQL with Prisma.
- Keep Redis with BullMQ for queues, background jobs, retries, scheduled operational tasks, heavy exports, PDF/report generation, media/image variant generation, notification batching, and future real-time fanout where appropriate.
- Keep the Next.js dashboard in `apps/web`.
- Keep the Flutter companion app in `apps/schoolos_mobile` as a standalone Flutter app outside pnpm workspaces.
- Do not migrate to Angular yet.
- Do not rename `tenantId` to `schoolId` without a deliberate migration.
- Backend-first for data integrity.
- UI must consume real APIs.
- Mobile must consume existing SchoolOS APIs with bearer auth, secure refresh-token storage, tenant slug login, and readable mobile error mapping.
- Optimize database queries, file sizes, API payloads, and queued work before increasing server size or introducing new infrastructure.

### Product Planes and Route Boundaries
SchoolOS has three logical planes inside the same modular monolith:

| Plane | Frontend | Backend | Purpose |
|---|---|---|---|
| Platform Control Plane | `/platform/*` | `/platform/*` | SchoolOS company/operator administration |
| Tenant Configuration Plane | `/dashboard/settings/*` | `/settings/*` or `/tenant-settings/*` | One school's settings/configuration |
| School Operations Plane | `/dashboard/*` | Module APIs (e.g. `/students`, `/attendance`, etc.) | Daily school workflows |

Rules:
- Platform Control Plane manages SchoolOS SaaS/customer administration.
- Tenant Configuration Plane manages one school's own settings.
- School Operations Plane manages day-to-day school workflows.
- Do not mix SchoolOS SaaS billing with school fee collection.
- School users must not access `/platform/*` routes.
- Platform support/tenant override must require an explicit reason and audit log.

### Working Mode
- Prefer small, focused changes.
- Do not rewrite unrelated files.
- Do not change architecture without explicit instruction.
- Do not start broad new Phase 3, Phase 4, or AI scope unless explicitly requested.
- Treat Library/Transport/Canteen admin workspaces as foundations to polish and harden one vertical at a time.
- Mobile screens must use purpose-limited APIs and must not reuse admin-shaped data directly.
- Keep legacy roadmap/history in git history or consolidated docs; do not recreate duplicate planning files.
- If a task touches docs, update the smallest active source of truth rather than adding another `.md` file.

### Code-File Modularization Rules
Code-file modularization is required as modules grow. This means:
- Split huge services/components/controllers/helpers into focused files.
- Keep the same application/module boundaries.
- Keep the same public routes and API contracts.
- Keep the same database behavior unless the feature itself requires a schema change.
- Keep the same UI/UX unless the task explicitly asks for UX change.

It does **not** mean:
- Creating microservices.
- Splitting deployment units.
- Moving modules into separate apps.
- Rewriting working features from scratch.
- Changing tenantId or product-plane boundaries.

When touching a large file:
- Check whether the current change should extract a focused service, component, hook, helper, or API client file.
- Modularize gradually in the touched area only unless the user explicitly asks for a wider cleanup.
- Split by business/screen responsibility, not arbitrary line count alone.
- Keep behavior, routes, contracts, UI/UX, tenant boundaries, database behavior, and tests stable.
- It is acceptable to keep the old service/controller/component as a thin facade during a safe migration.
- Do not create a massive repo-wide modularization PR unless explicitly requested.

**Backend split preference:**
```text
services/<subfeature>-query.service.ts
services/<subfeature>-command.service.ts
services/<subfeature>-workflow.service.ts
reports/<module>-reports.service.ts
reports/<module>-exports.service.ts
helpers/<module>-formatters.ts
helpers/<module>-validators.ts
jobs/<module>.processor.ts
jobs/<module>.cron.ts
```

**Frontend split preference:**
```text
<module>-workspace.tsx       # thin shell only
tabs/<module>-*-tab.tsx
components/<module>-*.tsx
hooks/use-<module>-queries.ts
hooks/use-<module>-mutations.ts
hooks/use-<module>-forms.ts
utils/<module>-formatters.ts
utils/<module>-constants.ts
```

### Backend Rules
- Controllers should stay thin.
- Business rules belong in services/domain boundaries.
- Validate all external input.
- Use transactions for multi-step business writes.
- Every tenant-owned query must be scoped by authenticated `tenantId`.
- Every business-critical write must be audited.
- Super-admin/platform support tenant override must be explicit, validated, and audited.
- List endpoints for growing data must use pagination and filtering.
- Add/review indexes for high-volume tenant-scoped query patterns.
- Move slow/retryable/provider/report/PDF/media/notification jobs to BullMQ where appropriate.
- Do not bypass service boundaries by writing another module's internal tables directly.
- Do not bypass `AccountingPostingService` for ledger writes.
- File/media writes must go through `StorageService`/`FileRegistryService` boundaries.

### Cost and Performance Rules
- Keep the modular monolith until measured scale pressure proves otherwise.
- Optimize in this order: tenant-scoped database efficiency, pagination/payload control, file/image compression and object storage, BullMQ background jobs, dashboard summaries, selective cache, notification channel control, bounded logs/retention, selective real-time, and deferred async/human-reviewed AI.
- Do not add Kubernetes, microservices, separate search clusters, GPU workers, or new databases for first-version module work without explicit approval.
- Optimize query shape, indexes, pagination, and payload size before increasing CPU/RAM.
- Do not calculate heavy dashboard summaries from raw tables on every page load; use summaries, cached aggregates, or queued recalculation where practical.
- Do not generate PDFs, Excel exports, report cards, large imports, image variants, or notification batches inside the normal request/response cycle.
- Do not serve original uploaded photos in normal frontend/mobile views; use optimized display and thumbnail variants.
- Do not store images, PDFs, documents, or base64 file content in PostgreSQL.
- Do not use SMS for low-priority notifications when in-app, push, or email is enough.
- Do not make normal dashboards real-time unless the workflow requires immediate updates.
- Do not run AI/ML/LLM inference on every page load; scheduled or event-triggered background scoring is the default.
- Keep logs useful but bounded. Do not log large request/response bodies or sensitive school data.
- Review `docs/architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md` before adding any cost-sensitive storage, report, notification, real-time, or AI work.
- Before claiming cost-readiness, confirm growing lists are paginated, indexes support the main query, files use File Registry/object storage with variants, heavy work is queued and idempotent, SMS/real-time/AI are justified, and platform usage/cost can be counted.

### Frontend Rules
- UI must consume real APIs.
- Do not use fake production data for implemented workflows.
- Preserve cookie-first browser auth.
- Do not store raw access/refresh tokens in browser storage.
- Show loading, empty, error, and permission-denied states.
- Parse API errors into readable messages.
- Keep Nepal school staff workflows fast and practical.
- Use server-side filtering/pagination; do not fetch all rows and filter in browser for growing datasets.
- Large dashboard workspaces should become thin shells with tab files, hooks, smaller components, and pure utilities.
- `apps/web/lib/api/client.ts` should remain the base HTTP client; domain-specific APIs belong in separate files.
- Follow `docs/design/SCHOOLOS_UI_UX_GUIDE.md` for visual/UI rules.
- Load only visible dashboard sections first; lazy-load charts, history, reports, and heavy detail panels.

### Security Rules
- Tenant isolation is mandatory.
- Parent/student views must only expose own child/self data.
- Teacher views must only expose assigned data unless role permissions allow more.
- Sensitive data and files must use private access patterns.
- Use signed URLs or protected API URLs for private files/media.
- Avoid permanent public URLs for student media and documents.
- Platform users must not enter tenant data silently; support override requires an explicit reason and audit log.
- UI visibility is not security; backend guards and tenant filters enforce access.

### Money and Accounting Rules
- Use Decimal/numeric money handling.
- Do not use floating point for money calculations.
- Confirmed financial records should not be silently edited.
- Use reversal/correction workflows for payment mistakes.
- Receipt, invoice, journal, and voucher numbers must be tenant/fiscal-year safe.
- M9 Accounting is production-candidate complete but remains inside the monolith.
- Other modules must not directly write ledger rows; use `AccountingPostingService` or a clear accounting boundary.
- Reports must come from backend ledger/report services, not frontend calculations.
- Audit posting, approval, reversal, closing, reopening, bank reconciliation, and exports.

### File and Media Rules
- Use private object storage for documents and media.
- Store object keys and File Registry metadata, not permanent public URLs.
- Serve downloads/previews through signed URLs or protected API access URLs.
- Student documents, photos, activity media, homework attachments, receipts, report cards, payslips, and exports must remain tenant-scoped.
- Modules must use `FileRegistryService` and `StorageService`, not provider SDKs directly.
- Follow consolidated architecture docs for storage details.
- Generate optimized image variants for normal display and thumbnail usage.
- Keep originals only when required for document fidelity, audit, regeneration, or business/legal reasons.

### Scalability Gate for Every Feature
Before implementing a feature, answer:
1. Which module owns this feature: M0 or M1-M11?
2. Which backend folder/API namespace/frontend route owns it?
3. Which tenant owns this data?
4. Which role/permission can access it?
5. Is the list paginated?
6. Which index supports the main query?
7. Does the write need a transaction?
8. Is the operation idempotent?
9. Should this be sync or queued?
10. Does it require audit logging?
11. Does it affect accounting/ledger?
12. What tests prove tenant isolation and permissions?
13. If pricing/tiered access is involved, which feature key, entitlement, and usage limit controls access?
14. If intelligence/AI is involved, is the output explainable and human-reviewed?
15. Is the touched code already too large, and should this task include a small file-level modularization step?
16. What prevents this feature from increasing avoidable compute, storage, bandwidth, SMS, real-time, or AI cost?

A feature is not production-ready until these are answered.

### Verification Commands
Run relevant checks after meaningful changes:
```bash
pnpm db:generate
pnpm db:validate
pnpm verify:openapi
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify:production
pnpm smoke:pilot          # Legacy alias: pnpm smoke:phase1
```

For mobile changes:
```bash
cd apps/schoolos_mobile
flutter pub get
dart format .
flutter analyze
flutter test
```
