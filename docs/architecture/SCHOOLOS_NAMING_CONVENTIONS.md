# SchoolOS Naming Conventions

**Status:** Active architecture companion for naming files, folders, database identifiers, API routes, contracts, and frontend/mobile surfaces.  
**Last updated:** 2026-06-20  
**Applies to:** All new SchoolOS code, routes, DTOs, contracts, schema work, tests, and documentation.

---

## 1. Purpose and Scope

SchoolOS uses one consistent naming system so a business concept has the same meaning across the database, backend, OpenAPI, shared contracts, web, mobile, tests, logs, and documentation.

This prevents route mismatches, duplicate concepts, ambiguous identifiers, and status-value drift.

This document applies to new work immediately. Existing stable APIs, routes, tables, and client contracts must not be renamed only for style. Rename legacy names only when a documented compatibility and migration plan protects all affected web, mobile, API, integration, and test consumers.

---

## 2. Canonical Product Vocabulary

Use one approved term for one business concept. Do not introduce aliases unless they describe a genuinely different concept.

| Canonical term | Do not use interchangeably | Notes |
|---|---|---|
| Tenant | schoolId, organizationId | `tenantId` remains the strict SchoolOS tenancy boundary. |
| Student | pupil, learner, entity | Use `student` in code and contracts unless a learning-specific actor is truly required. |
| Guardian | parentRelation, contactPerson | A parent is a guardian persona; use `guardian` for the linked record. |
| Admission Case | fast admission, pipeline record | One progressive, policy-evaluated M1 case backed by `AdmissionApplication`; direct admission and review are paths through the same case. |
| Class | gradeGroup, group | `class` is the academic class entity. |
| Section | subgroup, division | `section` is the class subdivision. |
| Academic year | session, schoolYear | Use `academicYear` / `academicYearId`. |
| Fee invoice | bill, payment request | A payment is not an invoice. |
| Receipt | payment artifact, bill receipt | Receipt is the confirmed collection record/document. |
| Report card | marksheet, result sheet | Use `reportCard` in code; school-facing labels may use an approved localized term. |
| Activity post | feed item, wall post | Use `activityPost` for the M5 record. |
| Notification | message alert | A notification is distinct from a notice or chat message. |
| Notice | announcement | Use `notice` for the school communication record. |
| Learning activity | lesson activity, quiz item | Use `learningActivity` for the teacher-created M13 activity. |
| Learning session | classroom session, lab session | Use `learningSession` for the live/controlled session. |

Do not rename `tenantId` to `schoolId` in Prisma, TypeScript, DTOs, APIs, jobs, cache keys, logs, or frontend/mobile models.

---

## 3. Files, Folders, and Import Paths

### 3.1 TypeScript, JavaScript, and documentation

Use `kebab-case` for new folders and ordinary file names.

```text
apps/api/src/activity-feed/activity-feed.service.ts
apps/api/src/activity-feed/dto/create-activity-post.dto.ts
apps/web/components/activity-feed/activity-feed-workspace.tsx
apps/web/lib/api/activity-feed.ts
docs/architecture/SCHOOLOS_NAMING_CONVENTIONS.md
```

Use the established framework filenames where a framework requires them:

```text
page.tsx
layout.tsx
route.ts
loading.tsx
error.tsx
not-found.tsx
middleware.ts
next.config.ts
```

Use standard NestJS suffixes:

```text
<module>.module.ts
<module>.controller.ts
<module>.service.ts
<name>.guard.ts
<name>.decorator.ts
<name>.interceptor.ts
<name>.policy.ts
<name>.processor.ts
<name>.spec.ts
```

Do not create new camelCase, PascalCase, or snake_case TypeScript file names unless a framework, generated code, or external protocol requires that exact name.

### 3.2 Flutter and Dart

Use Dart-standard `lower_snake_case` for folders, files, imports, and generated-part names.

```text
lib/features/activity_feed/presentation/activity_feed_screen.dart
lib/features/learning/data/learning_session_repository.dart
lib/core/network/api_client.dart
```

Do not use web/TypeScript `kebab-case` inside Dart source paths.

### 3.3 Tests and fixtures

Keep tests beside the relevant feature or in the established test directory. Name tests after the feature and behavior.

```text
activity-feed.service.spec.ts
activity-feed.controller.e2e-spec.ts
learning-session-access.e2e-spec.ts
student-fixtures.ts
```

Use descriptive fixture names. Do not use `data.ts`, `utils.ts`, `helpers.ts`, or `common.ts` for new files unless the scope is genuinely shared and the file name clearly states that scope.

---

## 4. TypeScript, Dart, and Prisma Identifiers

| Item | Convention | Example |
|---|---|---|
| TypeScript/Dart class, interface, type, enum | `PascalCase` | `ActivityFeedService`, `StudentSummary`, `ActivityPostStatus` |
| TypeScript/Dart function, variable, property | `camelCase` | `listActivityPosts`, `academicYearId` |
| TypeScript constant | `UPPER_SNAKE_CASE` | `MAX_UPLOAD_SIZE_BYTES` |
| Prisma model | `PascalCase`, singular | `ActivityPost`, `FeeInvoice` |
| Prisma field | `camelCase` | `tenantId`, `publishedAt`, `softDeletedAt` |
| Prisma enum | `PascalCase` | `ActivityPostStatus` |
| Prisma enum member | `UPPER_SNAKE_CASE` | `PUBLISHED`, `PENDING_APPROVAL` |
| PostgreSQL physical table/column for new mapped schema work | `snake_case` | `activity_posts`, `tenant_id` |

For new Prisma schema work, use `@map` / `@@map` when a snake_case physical PostgreSQL name is needed. Do not create a migration merely to rename existing physical tables or columns for style.

```prisma
model ActivityPost {
  tenantId    String    @map("tenant_id")
  publishedAt DateTime? @map("published_at")

  @@map("activity_posts")
}
```

---

## 5. API Route Rules

### 5.1 General route format

All new public API routes use the current version prefix, lowercase kebab-case path segments, and resource-oriented nouns.

```text
/api/v1/students
/api/v1/activity-feed/posts
/api/v1/attendance/corrections
/api/v1/learning/activities
```

Use plural collection nouns and singular entity identifiers:

```text
GET    /api/v1/students
POST   /api/v1/students
GET    /api/v1/students/:studentId
PATCH  /api/v1/students/:studentId
DELETE /api/v1/students/:studentId
```

Use nested routes only where the ownership relationship is meaningful and authorization remains clear:

```text
/api/v1/students/:studentId/documents
/api/v1/classes/:classId/sections
/api/v1/learning/activities/:activityId/sessions
```

### 5.2 Domain commands

SchoolOS supports explicit action routes when the operation is a real domain command rather than CRUD. Commands must use `POST` unless an existing contract has an approved reason for another method.

```text
POST /api/v1/fees/payments/:paymentId/reverse
POST /api/v1/attendance/corrections/:correctionId/approve
POST /api/v1/learning/sessions/:sessionId/pause
POST /api/v1/learning/sessions/:sessionId/end
POST /api/v1/students/:studentId/qr/rotate
POST /api/v1/reports/export-history/:exportId/retry
```

A command must be module-owned, permission/entitlement-gated, audited when high-risk, idempotent or duplicate-safe when retried, and represented in OpenAPI.

Do not use controller-style or transport-style route names:

```text
/getStudents
/createStudent
/reversePayment
/approveCorrection
/student-list
```

### 5.3 Route parameters and query parameters

New route parameters must name the domain entity explicitly:

```text
:studentId
:guardianId
:classId
:sectionId
:invoiceId
:paymentId
:activityId
:sessionId
```

Avoid new bare `:id`, `:uuid`, `:recordId`, or `:dataId` parameters. Existing stable `:id` routes remain supported until a planned compatibility migration changes them.

Use `camelCase` for API query parameter names:

```text
?academicYearId=...
?classId=...
?createdFrom=...
?sortBy=createdAt
?sortDirection=desc
?page=1
?limit=25
```

Query values must be validated by DTOs. Pagination, filter, enum, date, and money input must never be trusted as raw strings inside services.

### 5.4 Reserved route exceptions

The following established non-resource route families are permitted when they represent authentication, health, the authenticated actor, or platform-level operational endpoints:

```text
/api/v1/auth/login
/api/v1/auth/refresh
/api/v1/auth/me
/api/v1/me/entitlements
/api/v1/health
/api/v1/ready
```

They still use lowercase kebab-case segments and documented OpenAPI contracts.

---

## 6. DTOs, Responses, API Clients, and Frontend Routes

### 6.1 DTOs and contracts

Use responsibility-first DTO names and kebab-case filenames:

```text
create-student.dto.ts
update-student.dto.ts
list-students.query.dto.ts
student-response.dto.ts
reverse-payment.dto.ts
```

Use matching PascalCase exported names:

```ts
CreateStudentDto
UpdateStudentDto
ListStudentsQueryDto
StudentResponseDto
ReversePaymentDto
```

Keep request and response shapes separate when their responsibilities differ. Do not expose Prisma model types as API responses.

### 6.2 Web API clients

New web API-client filenames should use the canonical module/domain name:

```text
apps/web/lib/api/students.ts
apps/web/lib/api/activity-feed.ts
apps/web/lib/api/learning.ts
```

Name functions by the actual domain operation:

```ts
listStudents()
getStudentById()
createStudent()
updateStudent()
listActivityPosts()
publishActivityPost()
launchLearningSession()
```

Do not add vague API methods such as `getData`, `fetchAll`, `handlePost`, or `processThing`.

Existing client filenames are not renamed solely for consistency; new APIs must use the canonical vocabulary and document any adapter mapping.

### 6.3 Web routes

Use business-domain paths, not implementation, component, or dashboard-template names:

```text
/dashboard/students
/dashboard/admissions
/dashboard/attendance
/dashboard/activity-feed
/dashboard/academics/report-cards
/dashboard/settings/roles
/platform/tenants
```

Keep the three route planes separate:

```text
/dashboard/*           daily school operations
/dashboard/settings/*  one tenant's school configuration
/platform/*            SchoolOS operator controls
```

---

## 7. Statuses, Enums, and Lifecycle Values

Every persisted or API-visible lifecycle value must have one canonical chain:

```text
Prisma enum or approved domain value object
-> DTO validation
-> service/domain mapping
-> OpenAPI
-> packages/core shared contract where available
-> web API client and UI
-> Flutter DTO and UI
```

Use enum symbols in backend domain code whenever available:

```ts
ActivityPostStatus.PUBLISHED
```

Do not duplicate raw lifecycle strings across services, controllers, web tabs, or mobile screens:

```ts
status: 'PUBLISHED'
```

Raw strings are allowed only at validated boundaries, serialization mappings, and test fixtures where the enum is intentionally being tested.

Display labels are a separate mapping and must not become stored/API values:

```ts
const ACTIVITY_POST_STATUS_LABELS = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
} as const;
```

No web or mobile surface may invent a status such as `ESCALATED` unless the backend lifecycle, database/schema where relevant, DTO validation, OpenAPI, shared contracts, permission rules, tests, and migration plan all support it.

---

## 8. Files, Storage, and Sensitive Identifiers

Names returned from APIs and used in frontend/mobile code must not leak storage/provider implementation details.

Never expose or adopt as public naming:

```text
raw objectKey
bucket name
provider URL
permanent signed URL
provider credential
Prisma error
stack trace
token hash
```

Use safe domain identifiers such as `fileId`, `assetId`, `receiptId`, `reportCardId`, or a purpose-limited protected-file response.

All file workflows remain:

```text
Feature module -> FileRegistryService -> StorageService -> StorageAdapter
```

---

## 9. Legacy Transition Rules

1. New code follows this document immediately.
2. Existing stable names are not changed for style alone.
3. A rename that affects an API, database, background job, cache key, file path, mobile client, web route, integration, or stored data needs a written compatibility plan.
4. Preserve or version stable external routes until all consumers migrate.
5. Keep enum migrations additive/compatible where data already exists; do not silently reinterpret historical values.
6. Record a route rename in OpenAPI, tests, release notes, and the focused module migration plan.
7. Avoid broad repo-wide cleanup commits. Normalize legacy names when safely touching the same module and only after checking contracts and consumers.

---

## 10. Required Review Checklist

Before merging a new route, file, contract, schema value, or frontend/mobile surface, confirm:

```text
[ ] The name uses approved canonical vocabulary.
[ ] TypeScript/web file and folder names use kebab-case, or a framework exception applies.
[ ] Flutter/Dart paths use lower_snake_case.
[ ] New API route segments are lowercase kebab-case and resource-oriented.
[ ] New route parameters are explicit, such as :studentId or :paymentId.
[ ] DTO, Prisma enum/domain value, OpenAPI, packages/core, web, and mobile values agree.
[ ] No raw status string duplicates an enum or approved value object.
[ ] tenantId remains the tenant boundary.
[ ] No raw storage/provider/secrets/internal identifiers leak through a route or DTO.
[ ] Existing consumers are protected by a compatibility plan when a legacy name changes.
```

## 11. Verification

Naming-only documentation changes need no runtime checks.

When the convention changes code, routes, DTOs, Prisma, OpenAPI, or shared contracts, run the relevant project checks and report only what actually ran:

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
```
