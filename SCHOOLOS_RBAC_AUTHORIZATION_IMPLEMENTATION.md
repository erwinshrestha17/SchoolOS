# SchoolOS RBAC & Authorization Implementation Blueprint

> **Purpose:** This document is the implementation contract for modernizing SchoolOS authorization.
>
> **Primary audience:** Codex / autonomous engineering agents working in the SchoolOS repository.
>
> **Scope:** Multi-tenant authorization, roles, permissions, typed scopes, relationship-aware access, lifecycle policies, separation of duties, delegation, sensitive-data projections, audit, support access, offline authorization, search/export authorization, and access-management UX.
>
> **Authority:** `AGENTS.md` remains the repository-wide source of truth. If this document conflicts with `AGENTS.md`, `AGENTS.md` wins.
>
> **Coordinated playbooks:** `SCHOOLOS_WEB_DESIGN_ASTRA.md` governs Web presentation/interaction and `SCHOOLOS_APP_DESIGN_ASTRA.md` governs Mobile presentation/interaction. This RBAC blueprint governs authorization semantics, server-side policy, scope, sensitive-data projection, separation of duties, delegation, and authorization contracts consumed by those surfaces. It MUST NOT redefine product scope/personas or override platform-specific UX guidance where security semantics are unchanged.

---

# 0. Mission

Evolve the existing SchoolOS role/permission implementation into a production-grade authorization architecture without replacing working backend foundations unnecessarily.

The target model is:

```text
Authentication
    ↓
Security Domain
    ↓
Tenant Boundary
    ↓
Module Entitlement
    ↓
RBAC Permission
    ↓
Typed Scope
    ↓
Relationship / Attribute Policy
    ↓
Resource Lifecycle
    ↓
Separation of Duties
    ↓
Approval / Step-Up
    ↓
Sensitive-Data Projection
    ↓
ALLOW / DENY
    ↓
Audit
```

SchoolOS MUST remain **RBAC-first**, but RBAC alone is insufficient.

The final authorization model is:

```text
RBAC
+
Typed Scope
+
Relationship-aware authorization
+
Context / ABAC checks
+
Resource lifecycle policies
+
Separation of duties
+
Controlled delegation
+
Sensitive-data projection
```

Do not replace the existing system with an external policy engine merely for architectural fashion.

## 0.1 How This Blueprint Works With the Other Root Documents

Codex MUST treat the root files as one coordinated contract:

```text
AGENTS.md
  = product/security/domain constitution

SCHOOLOS_RBAC_AUTHORIZATION_IMPLEMENTATION.md
  = authorization architecture + backend implementation plan

SCHOOLOS_WEB_DESIGN_ASTRA.md
  = Web presentation of authorized capabilities/data

SCHOOLOS_APP_DESIGN_ASTRA.md
  = Mobile presentation of authorized capabilities/data + truthful offline UX
```

Read order for authorization-sensitive work:

```text
AGENTS.md
    ↓
this RBAC blueprint
    ↓
relevant Web/App playbook
    ↓
current code/schema/tests
```

Rules:

- authorization semantics are defined server-side before clients consume them;
- Web/Mobile may hide, disable, explain, or organize actions based on server-provided capabilities, but may not invent access;
- sensitive sections such as Student 360 / Staff 360 must be projected server-side rather than fully returned and hidden client-side;
- global search, dashboards, reports, exports, and inspectors must consume authorization-aware projections;
- mobile offline state may cache safe projections, but server re-authorization at synchronization remains authoritative;
- a UX requirement must not cause weakening of tenant, scope, relationship, lifecycle, or separation-of-duties checks.

## 0.2 Cross-Playbook Dependency Gates

| Product surface / capability | RBAC prerequisite before production exposure |
| --- | --- |
| Student 360 sensitive sections | teacher/guardian policies + server-authorized data projection |
| Staff 360 payroll/bank/documents | HR/payroll separation + sensitive staff projection |
| Teacher attendance / marks | assignment-aware scoped policy |
| Parent linked-child screens | authoritative guardian relationship policy |
| Principal approval UX | explicit approval capability + lifecycle/SoD policy |
| Fee refunds / reversals / accounting approvals | finance SoD + explicit approval permissions |
| Payroll workflow UI | prepare/review/approve/finalize/post separation |
| Global command/search | P1 authorization-aware search projection |
| Reports / exports | explicit export permission + field/scope projection |
| Access Control Center | P0 backend semantics complete enough to manage safely |
| Offline queued mutation | server re-authorization + safe conflict/rejection UX |
| Platform tenant-data support | explicit time/scoped support access |

A design implementation MAY prepare non-authoritative visual structure before a prerequisite is complete, but MUST keep the capability disabled/unreleased until the authorization prerequisite is satisfied.

---

# 1. Non-Negotiable Security Principles

1. Backend authorization is authoritative.
2. Frontend visibility is never authorization.
3. Default deny.
4. Cross-tenant access by ordinary tenant identities must be impossible.
5. Role membership alone must never imply access to every resource in a module.
6. Module entitlement and authorization are separate concepts.
7. Assignment/relationship checks must remain authoritative.
8. Sensitive student, guardian, HR, payroll, finance, audit, and identity data must support restricted projections.
9. Critical financial and security workflows require separation of duties.
10. Platform/control-plane authorization must remain separate from school/tenant authorization.
11. Offline cached authority is never final server authority.
12. Role administration must not allow privilege amplification.
13. New permissions must grant access to no role automatically.
14. Authorization failures must fail closed.
15. Security-relevant authorization changes must be auditable.

---

# 2. Canonical Authorization Vocabulary

Use these terms consistently in code, database schema, tests, docs, and UI.

## 2.1 Authentication

Answers:

> Who is the actor?

Examples:

- `userId`
- `sessionId`
- authentication method
- MFA / step-up assurance state

Authentication is not authorization.

---

## 2.2 Security Domain

Defines whether the request belongs to:

```text
PLATFORM
SCHOOL
```

Platform identities and tenant/school identities are separate security domains.

A Principal or School Admin must never inherit Platform authority.

---

## 2.3 Tenant Boundary

Defines which tenant/school owns the request and resource.

The trusted tenant comes from server-side authenticated context.

Never trust `tenantId` supplied by a browser/mobile request body as authoritative.

---

## 2.4 Entitlement

Defines whether a tenant has access to a product/module.

Examples:

```text
Attendance enabled
Homework enabled
Accounting enabled
Transport disabled
```

Entitlement is not permission.

---

## 2.5 Role

Defines organizational responsibility.

Examples:

```text
Teacher
Principal
School Admin
HR Manager
Cashier
Accountant
Finance Approver
```

A role is a reusable permission template or tenant-defined grouping.

---

## 2.6 Permission

Defines an action capability.

Examples:

```text
attendance:record:mark
fees:payment:collect
accounting:journal:approve
```

Permission alone does not determine final resource access.

---

## 2.7 Scope

Defines where the permission may operate.

Examples:

```text
TENANT
BRANCH
ACADEMIC_YEAR
CLASS
SECTION
SUBJECT
DEPARTMENT
STUDENT
STAFF
FINANCE_ACCOUNT
```

---

## 2.8 Relationship

Defines why an actor is connected to a resource.

Examples:

```text
TeacherAssignment
GuardianRelationship
StaffManagerRelationship
CashierSession
SupportAccessSession
```

---

## 2.9 Policy

Defines contextual conditions.

Examples:

```text
Teacher can enter marks only for active assigned subject/class scope.

Parent can view student data only for an active guardian relationship.

Journal creator cannot approve the same journal.
```

---

## 2.10 Resource Lifecycle

Defines whether the resource state allows the requested action.

Examples:

```text
attendance session OPEN
marks DRAFT
marks LOCKED
result PUBLISHED
journal POSTED
fiscal period CLOSED
notice WITHDRAWN
```

---

# 3. Permission Naming Standard

Adopt:

```text
module:resource:action
```

Examples:

```text
students:profile:read
students:profile:update
students:documents:read
students:documents:manage
students:guardian_contact:read

admissions:application:create
admissions:application:review
admissions:application:approve

attendance:record:read
attendance:record:mark
attendance:record:correct
attendance:correction:approve

academics:marks:read
academics:marks:enter
academics:marks:review
academics:marks:lock
academics:results:publish

homework:assignment:create
homework:assignment:update
homework:submission:review

fees:invoice:create
fees:payment:collect
fees:refund:request
fees:refund:approve
fees:payment:reverse

accounting:journal:create
accounting:journal:review
accounting:journal:approve
accounting:journal:post
accounting:period:close
accounting:period:reopen

hr:staff:read
hr:staff:update
hr:documents:read

payroll:run:prepare
payroll:run:review
payroll:run:approve
payroll:run:finalize

notices:notice:create
notices:notice:approve
notices:notice:publish

reports:report:read
reports:report:export
reports:sensitive_export:execute

security:roles:read
security:roles:manage
security:assignments:manage
security:support_access:approve
```

Avoid:

```text
admin:all
finance:manage
students:everything
academics:full
```

---

# 4. Permission Definition Metadata

Permission catalog entries SHOULD contain:

```ts
type PermissionDefinition = {
  code: string;
  module: string;
  resource: string;
  action: string;

  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  allowedScopeTypes: AuthorizationScopeType[];

  delegable: boolean;

  requiresReason?: boolean;
  requiresMfa?: boolean;
  requiresApproval?: boolean;

  description: string;

  introducedVersion: string;
  deprecatedAt?: Date | null;
};
```

High-risk examples:

```text
accounting:period:reopen
Risk: CRITICAL
Delegable: false
Requires MFA: true
Requires reason: true
```

```text
fees:refund:approve
Risk: HIGH
Requires reason: true
```

---

# 5. Target Data Model

Do not overload `UserRole` with all future authorization concepts.

Target conceptual model:

```text
User
  │
  └── UserRoleAssignment
         │
         ├── TenantRole
         │      └── RolePermissionGrant
         │             └── PermissionDefinition
         │
         └── RoleScopeGrant
```

Additional security entities:

```text
RoleTemplate
DelegationGrant
SupportAccessSession
SensitiveAccessGrant
AuthorizationPolicyVersion
AuthorizationDecisionAudit
AccessChangeAudit
UserAuthorizationVersion
TenantAuthorizationVersion
```

---

# 6. UserRoleAssignment

Recommended fields:

```text
id
tenantId
userId
roleId

effectiveFrom
expiresAt

assignedById
approvedById

reason

revokedAt
revokedById
revokeReason

createdAt
updatedAt
```

A role assignment can exist without tenant-wide authority.

Scope grants define where it applies.

---

# 7. Typed Scope Grants

Replace ambiguous generic `scopeId` behavior over time.

Recommended:

```text
RoleScopeGrant
────────────────────────
id
tenantId
userRoleAssignmentId

scopeType
scopeId

effectiveFrom
expiresAt

createdById
createdAt

revokedAt
revokedById
```

Initial scope types:

```text
TENANT
BRANCH
ACADEMIC_YEAR
CLASS
SECTION
SUBJECT
DEPARTMENT
STUDENT
STAFF
FINANCE_ACCOUNT
```

Do not use arbitrary JSON blobs for core scope semantics unless unavoidable.

---

# 8. Scope Inheritance

Do not assume every scope inherits identically.

Potential hierarchy:

```text
TENANT
  ↓
BRANCH
  ↓
ACADEMIC_YEAR
  ↓
CLASS
  ↓
SECTION
```

But SUBJECT is often orthogonal.

Policy evaluation must explicitly define valid inheritance.

Example:

```text
TENANT scope
→ may include all sections in tenant

SECTION scope
→ includes that section only

SUBJECT scope
→ requires combination with teacher assignment / section context
```

---

# 9. System Role Templates

Create explicit built-in templates.

Recommended:

```text
School Access Owner
School Admin
Principal
Admissions Officer
Teacher
HR Manager
Payroll Preparer
Payroll Reviewer
Payroll Approver
Cashier
Accountant
Finance Approver
Auditor
Parent/Guardian
Student
```

System templates are immutable definitions.

Tenant custom roles are created by cloning a template or creating a bounded custom role.

Never allow tenants to mutate canonical templates directly.

---

# 10. Explicit Allowlists Only

Built-in templates MUST use explicit permission allowlists.

Forbidden:

```text
Admin = allPermissionsExcept(...)
```

Required:

```text
Admin = [
  ...explicitPermissions
]
```

When a new permission is introduced:

```text
default role assignment = NONE
```

Then role templates are deliberately updated.

---

# 11. Teacher Authorization Policy

Teacher access must depend on authoritative assignment.

Example:

```text
Actor:
Teacher

Action:
attendance:record:mark

Resource:
Grade 8A
Mathematics
Period 2
```

Evaluation:

```text
authenticated
tenant match
attendance entitlement
permission present
teacher assignment active
section match
subject/period match when required
attendance lifecycle allows marking
```

Only then:

```text
ALLOW
```

Teacher policies must cover:

```text
students
attendance
homework
academics/marks
activities
timetable
permitted guardian-contact projection
```

Role membership alone must never bypass assignment scope.

---

# 12. Guardian / Parent Authorization

Parent access must depend on an active authoritative guardian relationship.

Conceptual model:

```text
GuardianRelationship
────────────────────
guardianId
studentId
relationshipType

status
effectiveFrom
effectiveTo

capabilities
restrictions
```

Possible capabilities:

```text
PROFILE_VIEW
ATTENDANCE_VIEW
ACADEMICS_VIEW
HOMEWORK_VIEW
FEES_VIEW
REQUESTS_CREATE
```

Every child-facing read or mutation must verify the active relationship.

Knowing a Student ID must not allow access.

---

# 13. Student Authorization

Student accounts are self-scoped.

Typical rule:

```text
actor.studentId === resource.studentId
```

Students may only receive published/authorized information.

Examples:

```text
own profile
own timetable
published results
assigned homework
notices
approved documents
```

Do not grant broad student-list permissions.

---

# 14. Student 360 Field-Level Authorization

Student 360 must consume server-authorized projections.

Do not:

```text
load full record
→ hide tabs in React
```

Target projection model:

```text
identity.basic          ALLOW
identity.documents      DENY
guardian.contact        ALLOW
guardian.restrictions   DENY
attendance              ALLOW
academics               ALLOW
fees                    DENY
medical                 DENY
audit                   DENY
```

Different personas receive different projections.

Teacher example:

```text
basic identity
attendance
academics
homework
permitted guardian contact
```

Accountant example:

```text
basic identity
payer context
fees
invoices
receipts
```

Principal example:

```text
broader oversight projections
```

Admin example:

```text
broad operational projection
without automatic access to every protected field
```

---

# 15. Staff 360 Sensitive Projection

Staff data categories may include:

```text
STAFF_BASIC
STAFF_EMPLOYMENT
STAFF_DOCUMENTS
STAFF_COMPENSATION
STAFF_BANK
STAFF_TAX
STAFF_DISCIPLINARY
```

A generic `hr:staff:read` permission must not automatically expose all categories.

Backend projections remain authoritative.

---

# 16. Finance Separation of Duties

Default finance roles must be separated.

Recommended:

```text
Cashier
  → collect payment
  → issue receipt

Finance Clerk
  → prepare adjustment
  → prepare journal

Accountant
  → accounting operations
  → review
  → reconcile

Finance Approver
  → approve refund
  → approve adjustment
  → approve journal

Accounting Posting Authority
  → post/finalize

Auditor
  → read/export evidence only
```

Avoid one role controlling the full financial lifecycle.

---

# 17. Dynamic Separation of Duties

Role separation alone is insufficient.

Policies must prohibit self-approval.

Examples:

```text
journal.createdById === actor.id
→ DENY journal approval
```

```text
refund.requestedById === actor.id
→ DENY refund approval
```

```text
payroll.preparedById === actor.id
→ DENY payroll approval
```

Where applicable:

```text
reconciliation.preparedBy != finalizer
periodClose.requestedBy != approver
```

---

# 18. Payroll Authorization

Target lifecycle:

```text
Prepare
  ↓
Validate
  ↓
Review
  ↓
Approve
  ↓
Finalize
  ↓
Accounting Post
```

Typical authority separation:

```text
Payroll Preparer
      ↓
Payroll Reviewer
      ↓
Payroll Approver
      ↓
Accountant / Posting Authority
```

HR access does not imply accounting posting rights.

Accounting access does not imply unrestricted HR document access.

---

# 19. Principal Authorization

Principal is not:

```text
Admin + everything
```

Principal primarily receives:

```text
school-wide permitted oversight
attention queues
approvals
academic publication authority
selected financial approval
staff oversight
attendance oversight
reports
audit visibility
```

Principal does not automatically receive:

```text
role/security administration
integration secrets
staff bank data
platform controls
developer controls
```

---

# 20. School Admin Authorization

School Admin is operational.

Do not make it a tenant god-mode identity.

Separate high-risk access/security administration into:

```text
School Access Owner
```

Responsibilities may include:

```text
user administration
role assignments
role templates
delegation
security configuration
```

Even School Access Owner remains subject to delegation limits.

---

# 21. Delegation Boundaries

A user must never grant permissions outside their delegable authority.

Rule:

```text
AssignablePermission ⊆ ActorDelegableAuthority
```

If an administrator does not have delegable authority for:

```text
accounting:period:reopen
```

they cannot create a custom role containing it.

Prevent privilege amplification.

---

# 22. Default Deny

Required:

```text
Unknown → DENY
Missing → DENY
Expired → DENY
Invalid scope → DENY
No relationship → DENY
Unsupported lifecycle → DENY
```

No implicit fallback allow.

---

# 23. Explicit Deny

Use explicit deny sparingly.

Possible use cases:

```text
custody restrictions
suspended staff
disciplinary restrictions
temporary sensitive-data restriction
support-session restrictions
```

Explicit deny overrides allow.

---

# 24. Central Authorization Service

Introduce a single server-side authorization entry point.

Example:

```ts
authorization.authorize({
  actor,
  tenantId,
  capability: 'attendance:record:mark',
  resource: {
    type: 'attendance_session',
    id: sessionId,
  },
  context: {
    sectionId,
    subjectId,
    academicYearId,
  },
});
```

Return:

```ts
{
  allowed: false,
  outcome: 'DENY',
  reasonCodes: [
    'TEACHER_ASSIGNMENT_MISMATCH'
  ],
  decisionId: 'azd_...',
  policyVersion: '2026.09.1'
}
```

Supported outcomes may eventually include:

```text
ALLOW
DENY
REQUIRE_APPROVAL
REQUIRE_STEP_UP
```

This service becomes the internal Policy Decision Point.

---

# 25. Authorization Context

Define one canonical context.

Example:

```ts
type AuthorizationContext = {
  actor: {
    userId: string;
    securityDomain: 'PLATFORM' | 'SCHOOL';
    tenantId?: string;
    sessionId: string;
    authVersion: number;
    assuranceLevel?: string;
  };

  capability: PermissionCode;

  resource?: {
    type: string;
    id?: string;
    tenantId?: string;
    lifecycleState?: string;
  };

  scope?: {
    branchId?: string;
    academicYearId?: string;
    classId?: string;
    sectionId?: string;
    subjectId?: string;
    studentId?: string;
    staffId?: string;
  };

  environment?: {
    requestId?: string;
    ip?: string;
    userAgent?: string;
  };
};
```

Do not allow domain controllers to invent incompatible authorization inputs.

---

# 26. Existing Guards Become Enforcement Points

Keep NestJS guards.

Target:

```text
Controller
   ↓
Authentication Guard
   ↓
Tenant Guard
   ↓
Authorization Guard
   ↓
AuthorizationService
   ↓
Domain Policy
   ↓
Decision
```

Do not embed scattered policy logic inside controllers.

---

# 27. Domain Policy Modules

Keep authorization centralized but domain-aware.

Recommended structure:

```text
apps/api/src/authorization/

authorization.module.ts
authorization.service.ts
authorization-context.ts
authorization-decision.ts

permissions/
  permission-catalog.ts
  permission-metadata.ts

roles/
  role-template.service.ts
  delegation.service.ts

scopes/
  scope.types.ts
  scope-resolver.ts

policies/
  students.policy.ts
  guardians.policy.ts
  attendance.policy.ts
  academics.policy.ts
  homework.policy.ts
  fees.policy.ts
  accounting.policy.ts
  hr.policy.ts
  payroll.policy.ts
  notices.policy.ts
  reports.policy.ts

audit/
  authorization-audit.service.ts

support/
  support-access.policy.ts
```

Do not build one massive authorization file.

---

# 28. Canonical Evaluation Order

Use deterministic order:

```text
1. Authentication
2. Session/user active
3. Security domain
4. Tenant context
5. Resource tenant ownership
6. Module entitlement
7. Hard restriction / explicit deny
8. Permission
9. Typed scope
10. Relationship
11. Resource lifecycle
12. Separation of duties
13. Approval / step-up policy
14. Sensitive-field projection
15. Decision audit where required
```

Reject early where safe.

---

# 29. JWT / Session Strategy

Do not put the entire authorization graph in JWT claims.

JWT/session should contain stable context only:

```text
userId
tenantId
sessionId
securityDomain
authVersion
authentication assurance
```

Avoid embedding authoritative long-lived copies of:

```text
all permissions
all class assignments
all guardian relationships
all scopes
```

These become stale.

---

# 30. Authorization Versioning

Add:

```text
UserAuthorizationVersion
TenantAuthorizationVersion
```

When role assignments, critical permissions, or scope changes occur:

```text
increment version
invalidate effective-access cache
```

Stale sessions can be revalidated.

---

# 31. Authorization Cache

Safe cache candidates:

```text
effective role permissions
active role assignments
entitlements
permission definitions
stable scope memberships
```

Use short-lived cache and explicit invalidation.

Avoid unsafe long-lived cache for:

```text
resource lifecycle
guardian restrictions
financial approval state
attendance session state
```

---

# 32. Platform Security Domain

Platform and School identities remain separate.

Never implement:

```text
PlatformOperator inherits SchoolAdmin
```

or:

```text
Developer can silently browse every tenant
```

Platform authority may cover:

```text
tenant provisioning
subscription
entitlements
provider readiness
platform operations
security operations
```

Tenant data access uses explicit controlled support access.

---

# 33. Support / Break-Glass Access

Use explicit time-limited support sessions.

Model:

```text
SupportAccessSession
────────────────────
operatorId
tenantId

scope
mode

reason
reference/ticket

issuedAt
expiresAt

approvedById
revokedAt
```

Default:

```text
read-only
limited scope
limited duration
reason required
fully audited
```

---

# 34. Just-in-Time Access

For highly sensitive operations, prefer temporary elevated grants over permanent super-roles.

Candidates:

```text
fiscal period reopen
sensitive audit work
emergency support
exceptional financial approval
```

JIT grant should include:

```text
permission/scope
reason
approval
expiry
audit
```

---

# 35. MFA / Step-Up Policy

Sensitive actions may require stronger authentication.

Candidates:

```text
role/security administration
large refunds
financial period reopen
payroll finalization
support elevation
bank detail changes
sensitive export
```

Authorization may return:

```text
REQUIRE_STEP_UP
```

instead of immediate allow/deny.

---

# 36. Access Control Center — Web UX

Target:

```text
Settings
└── Access Control
    ├── Users
    ├── Roles
    ├── Assignments
    ├── Delegations
    ├── Sensitive Access
    ├── Policy Simulator
    └── Audit
```

This is a security administration workspace, not an ordinary generic settings page.

---

# 37. Role Editor UX

Role detail should show business meaning, not a raw alphabetic permission list.

Example:

```text
Teacher
System Template

Users: 42
Risk: Standard

STUDENTS
✓ View assigned students
✓ View permitted guardian contact
✗ View identity documents

ATTENDANCE
✓ Read assigned attendance
✓ Mark assigned attendance
✗ Override locked attendance
✗ Approve correction

ACADEMICS
✓ Enter assigned marks
✓ Create homework
✗ Publish results

FINANCE
No permissions
```

Permission groups follow modules/domains.

---

# 38. Dangerous Permission Indicators

High-risk capabilities require clear warnings.

Example:

```text
CRITICAL
accounting:period:reopen

Reopens a closed fiscal period.
MFA required.
Reason required.
Non-delegable.
```

Risk indicators must not rely only on color.

---

# 39. Role Templates vs Custom Roles

System templates:

```text
immutable
versioned
maintained by SchoolOS
```

Tenant custom role:

```text
cloned from template
or created within delegation limits
```

Maintain template lineage where useful.

---

# 40. User Access Assignment UX

User access page should show:

```text
User
Roles
Scopes
Expiration
Delegated By
Effective Access
Last Changed
```

Example:

```text
Ram Karki

Teacher
  Grade 8A
  Grade 8B
  Mathematics

Activity Coordinator
  Tenant-wide
  expires 2083-12-30
```

---

# 41. Effective Access Preview

The system should answer:

> What can this person actually do?

Example:

```text
Ram Karki

CAN
✓ View 83 assigned students
✓ Take attendance in 8A / 8B
✓ Enter Mathematics marks
✓ Create Mathematics homework

CANNOT
✗ Publish results
✗ View fees
✗ View payroll
✗ Access Grade 9 attendance
```

This preview must be calculated by backend authorization logic.

---

# 42. Policy Simulator

Add an internal administration/debugging tool.

Input:

```text
Actor
Action
Resource
Context
```

Output:

```text
ALLOW

✓ tenant active
✓ permission present
✓ entitlement present
✓ assignment active
✓ lifecycle valid
```

or:

```text
DENY

✗ teacher assignment expired
```

Do not expose secrets/internal stack traces.

---

# 43. Conflict Detection

Role editor should surface risky combinations.

Examples:

```text
accounting:journal:create
+
accounting:journal:approve
```

Show:

> Both permissions are present. SchoolOS still enforces self-approval restrictions.

Other examples:

```text
payroll:run:prepare
+
payroll:run:approve
```

```text
students:sensitive:read
```

---

# 44. Permission Impact Preview

Before role/assignment mutation, show impact.

Example:

```text
This change affects:

17 users
6 teachers
2 branches

New capability:
attendance:correction:approve
```

High-risk changes may require explicit confirmation and reason.

---

# 45. Authorization Audit

Always audit:

```text
role created
role cloned
permission added/removed
scope added/revoked
user-role assignment
delegation created/revoked
support access
sensitive access
critical financial/security override
```

Audit record should contain:

```text
actor
tenant
target
before
after
reason
timestamp
requestId
```

---

# 46. Decision Logging

Do not persist every low-risk read as immutable audit.

Always record or security-log:

```text
financial mutations
payroll actions
security changes
support access
high-risk exports
sensitive access
lifecycle override
cross-tenant denial attempts
privilege escalation attempts
```

---

# 47. Reports & Export Authorization

Read permission does not imply export permission.

Examples:

```text
students:profile:read
≠
reports:student_export:execute
```

Exports must:

```text
run server-side
apply tenant scope
apply field projection
apply relationship/scope rules
be audited where sensitive
record generatedBy/generatedAt
```

---

# 48. Global Search Authorization

Search queries must use authorized server-side projections.

Do not:

```text
search everything
→ filter in browser
```

Teacher search should only return authorized entities.

Accountant search may expose fee/payer context but not protected HR/academic data.

---

# 49. Dashboard Authorization

Persona dashboards must be server-composed.

Frontend receives only authorized dashboard projections.

Do not send all module data and filter by role in the browser.

Apply the same principle to:

```text
Student 360
Staff 360
Principal attention
Finance dashboards
Global search
```

---

# 50. Offline Authorization

Cached permissions are not permanent authority.

Flow:

```text
Server grants safe offline projection
      ↓
App works offline
      ↓
Mutations are queued
      ↓
Network returns
      ↓
Server re-authorizes mutation
      ↓
Commit or reject/conflict
```

If assignment was revoked while offline, sync may be rejected.

Mobile UI must surface that conflict clearly.

---

# 51. Background Jobs

Background jobs must execute under explicit system principals, not stale user JWTs.

Concept:

```text
SystemPrincipal
tenantId
jobType
sourceActorId
sourceRequestId
authorizedOperation
```

Examples:

```text
report generation
notification delivery
report-card generation
accounting posting
exports
```

Original actor remains attached for audit.

---

# 52. PostgreSQL RLS Strategy

Do not make universal RLS part of initial modernization.

Primary defenses:

```text
server authorization
tenant-scoped queries
DB constraints
DB indexes
domain invariants
```

Evaluate targeted RLS later as defense-in-depth for selected high-risk domains.

Do not combine universal RLS rollout with the main RBAC migration unless explicitly justified.

---

# 53. Testing Strategy

Authorization testing is merge-blocking for critical domains.

## 53.1 Unit Policy Tests

Examples:

```text
Teacher + assigned class → ALLOW
Teacher + unassigned class → DENY
Teacher + expired assignment → DENY
Parent + linked child → ALLOW
Parent + unrelated child → DENY
```

---

## 53.2 Endpoint Integration Tests

Call API endpoints directly.

Do not rely on hidden buttons or navigation visibility.

---

## 53.3 Cross-Tenant Tests

For every critical resource:

```text
Tenant A actor
+
Tenant B resource ID
→ DENY / safe not-found
```

---

## 53.4 Privilege Escalation Tests

Examples:

```text
Admin cannot grant non-delegable permission.

Cashier cannot approve own refund.

Teacher cannot alter assignment scope.

Parent cannot enumerate unrelated students.

Support session cannot exceed approved tenant/scope.
```

---

## 53.5 Authorization Matrix Tests

Generate:

```text
Role × Permission × Scope × ResourceState
```

for built-in role templates.

Unexpected grants should fail tests.

---

# 54. Endpoint Authorization Contracts

Every protected endpoint should have an explicit contract.

Example:

```text
POST /attendance/:id/mark

Entitlement:
attendance

Permission:
attendance:record:mark

Scope:
teacher assignment OR attendance admin scope

Lifecycle:
OPEN
```

CI SHOULD detect protected endpoints with missing/ambiguous authorization declarations where feasible.

---

# 55. Migration Strategy

Do not switch all domains at once.

Use:

```text
Legacy Authorization
       +
AuthorizationService

       ↓

Shadow Evaluation

       ↓

Decision Comparison

       ↓

Domain-by-domain enforcement

       ↓

Legacy policy cleanup
```

Shadow mode example:

```text
Legacy = ALLOW
New PDP = DENY
```

Log mismatch for investigation.

Do not immediately break production traffic.

---

# 56. Phase 0 — Baseline Audit

Before semantic changes:

1. Inventory current roles.
2. Inventory permission keys.
3. Inventory permission decorators.
4. Inventory guards.
5. Inventory entitlement checks.
6. Inventory teacher assignment checks.
7. Inventory guardian checks.
8. Inventory support overrides.
9. Inventory `scopeId` semantics.
10. Inventory sensitive data endpoints.
11. Inventory all protected API routes.
12. Produce role-permission matrix.
13. Produce endpoint-authorization matrix.
14. Identify broad role presets.
15. Identify missing negative tests.

## Exit Criteria

- current authorization architecture documented;
- no major endpoint authorization assumption remains unverified;
- baseline tests run;
- migration risks recorded.

---

# 57. P0 — Authorization Integrity Foundation

P0 focuses on preventing incorrect access.

## P0.1 Permission Catalog

Implement canonical permission definitions and metadata.

Tasks:

- normalize naming;
- map legacy permission keys;
- risk-classify permissions;
- mark delegable/non-delegable permissions;
- mark scope compatibility;
- create explicit template allowlists.

### Exit

New permissions grant no role automatically.

---

## P0.2 Central Authorization Kernel

Implement:

```text
AuthorizationService
AuthorizationContext
AuthorizationDecision
PolicyEvaluator
```

Initially call existing scope/relationship services behind this service.

Do not rewrite all domain logic at once.

### Exit

Critical domains can obtain one deterministic decision from one contract.

---

## P0.3 Typed Scope System

Implement typed scope grants and migration compatibility.

### Exit

All newly created scoped assignments use explicit `scopeType`.

---

## P0.4 Tenant/Object Authorization

Standardize trusted resource-tenant validation.

### Exit

Critical domain cross-tenant tests are green.

---

## P0.5 Teacher Policies

Centralize teacher authorization for:

```text
students
attendance
homework
marks
activities
timetable
guardian-contact projection
```

### Exit

Teacher role alone can never bypass authoritative assignment rules.

---

## P0.6 Guardian Policies

Centralize parent/guardian relationship policy.

### Exit

Parent access to a child always depends on active authoritative relationship.

---

## P0.7 Finance Separation of Duties

Split unsafe default financial authority.

Implement at least:

```text
Cashier
Accountant
Finance Approver
Auditor
```

Add self-approval denial.

### Exit

One default finance role no longer owns unsafe full lifecycle authority.

---

## P0.8 HR / Payroll Separation

Separate:

```text
HR
Payroll Preparation
Payroll Review
Payroll Approval
Accounting Posting
```

### Exit

Payroll and accounting authority are independently testable.

---

## P0.9 Security Audit Coverage

Audit:

```text
role changes
permission changes
scope changes
support access
critical finance/security actions
```

### Exit

Security-relevant authorization changes are attributable.

---

## P0 Completion Gate

All must be true:

```text
✓ explicit permission catalog
✓ explicit system role allowlists
✓ default deny
✓ central authorization service
✓ typed scopes
✓ tenant/object validation
✓ teacher scope policies
✓ guardian policies
✓ finance SoD
✓ payroll SoD
✓ platform separation
✓ cross-tenant negative tests
✓ privilege escalation tests
✓ security change audit
```

---

# 58. P1 — Authorization Administration & Operational Maturity

## P1.1 Access Control Center

Build:

```text
Settings → Access Control
```

with:

```text
Users
Roles
Assignments
Delegations
Sensitive Access
Audit
```

---

## P1.2 Modern Role Editor

Add:

```text
permission grouping
risk labels
danger warnings
scope compatibility
role cloning
effective user count
impact preview
```

---

## P1.3 Effective Access Preview

Backend computes effective access.

UI displays human-readable result.

---

## P1.4 Delegation Controls

Implement:

```text
delegable permission boundaries
assignment expiry
reason
temporary assignments
```

Prevent permission amplification.

---

## P1.5 Sensitive Data Projections

Apply backend projections to:

```text
Student 360
Staff 360
Guardian data
Payroll
Finance
```

---

## P1.6 JIT Temporary Access

Implement time-limited grants.

Use where justified.

---

## P1.7 Step-Up Authentication Hooks

Introduce support for:

```text
REQUIRE_STEP_UP
```

for high-risk actions.

---

## P1.8 Policy Simulator

Create internal simulator UI/API.

---

## P1.9 Export Hardening

Separate read and export permissions.

Add sensitive export policies.

---

## P1.10 Global Search Authorization

Apply the centralized authorization layer to search projections.

---

## P1.11 Offline Reauthorization

Standardize safe offline mutation reauthorization.

---

## P1 Completion Gate

```text
✓ Access Control Center
✓ role templates/custom roles
✓ effective access preview
✓ delegation enforcement
✓ sensitive projections
✓ temporary access grants
✓ step-up hooks
✓ search authorization
✓ export authorization
✓ offline reauthorization
✓ policy simulator
```

---

# 59. P2 — Institutional Governance & Scale

## P2.1 Multi-Branch Scope

Support:

```text
TENANT
BRANCH
```

alongside existing academic scopes.

Example:

```text
Principal
scope = Branch A
```

---

## P2.2 Hierarchical Scope Resolution

Implement explicit scope inheritance rules.

---

## P2.3 Role Governance

Optional institutional controls:

```text
role owner
role-change approval
periodic role review
permission certification
```

---

## P2.4 Access Review Campaigns

Support periodic reviews.

Example:

```text
Review all Finance access
```

with:

```text
Keep
Remove
Modify
```

---

## P2.5 Privileged Access Management

For critical operations:

```text
JIT
approval
MFA
reason
expiry
session audit
```

---

## P2.6 Policy Versioning

Track:

```text
policyVersion
permissionCatalogVersion
roleTemplateVersion
```

Authorization decisions can reference these versions.

---

## P2.7 Authorization Observability

Add metrics:

```text
deny count
cross-tenant deny attempts
policy latency
support elevation usage
critical permission usage
stale-scope attempts
```

Alert on suspicious anomalies.

---

## P2.8 Optional Database Defense-in-Depth

Evaluate targeted PostgreSQL RLS only where it demonstrably improves security.

---

## P2.9 External Policy Engine Decision

Only after the internal authorization architecture is stable, evaluate:

```text
OPA
Cedar
OpenFGA / SpiceDB
Casbin
```

Decision criteria:

```text
policy complexity
relationship graph size
cross-service requirements
operational burden
latency
debuggability
team expertise
```

Do not migrate by default.

---

# 60. Frontend Authorization Contract

Frontend consumes authorization results but never becomes authoritative.

This section is the bridge to `SCHOOLOS_WEB_DESIGN_ASTRA.md` and `SCHOOLOS_APP_DESIGN_ASTRA.md`.

The Web/App playbooks decide **how** allowed actions, hidden/restricted sections, approval states, and offline conflicts are presented. This blueprint decides **why** the actor is or is not authorized and which data/actions are safe to expose.

The server may return:

```ts
{
  allowedActions: ['EDIT', 'EXPORT'],
  capabilities: {
    canApprove: false,
    canDelete: false
  }
}
```

Frontend uses this to render UI.

Every API request still re-runs authorization.

---

# 61. Anti-Patterns — Forbidden

Do not introduce:

```text
if role === 'ADMIN' → allow everything

hidden button = secure

client-provided tenantId = trusted

load all data → filter in React

role preset = all permissions except X

one finance role performs request + approval + posting

long-lived JWT stores complete permission/scope graph

offline permission accepted permanently

Platform operator silently browses tenants

Student 360 sends everything and hides restricted tabs

user grants permissions outside own delegation boundary
```

---

# 62. Implementation Order for Codex

Unless the project owner explicitly changes priority, execute in this order:

```text
Phase 0
Audit current state

P0.1
Permission catalog

P0.2
Central authorization kernel

P0.3
Typed scopes

P0.4
Tenant/object isolation hardening

P0.5
Teacher policies

P0.6
Guardian policies

P0.7
Finance SoD

P0.8
Payroll SoD

P0.9
Security audit coverage

P1
Administration / delegation / projections / simulator / search / export / offline

P2
Branch hierarchy / governance / PAM / observability / optional RLS / engine evaluation
```

Do not jump to the Access Control UI before backend semantics are trustworthy.

---

# 63. Pull Request / Change Strategy

Prefer small coherent PRs.

Suggested sequence:

```text
feat/authz-permission-catalog
feat/authz-decision-kernel
feat/authz-typed-scopes
test/authz-cross-tenant-hardening
feat/authz-teacher-policies
feat/authz-guardian-policies
feat/authz-finance-sod
feat/authz-payroll-sod
feat/authz-security-audit

feat/access-control-center
feat/authz-delegation
feat/authz-effective-access
feat/authz-sensitive-projections
feat/authz-temporary-access
feat/authz-step-up
feat/authz-policy-simulator
feat/authz-search-export-offline

feat/authz-multi-branch
feat/authz-access-reviews
feat/authz-privileged-access
feat/authz-observability
```

If explicitly instructed to work directly on `main`, preserve the same implementation order and keep commits independently reviewable.

---

# 64. Verification Requirements

For every authorization change:

```text
unit policy tests
endpoint integration tests
negative authorization tests
cross-tenant tests where relevant
privilege-escalation tests
role-template matrix tests
typecheck
lint
build
migration verification
```

For high-risk domains also verify:

```text
audit trail
idempotency where relevant
transaction boundaries
rollback/reversal behavior
```

Never weaken tests merely to make a migration pass.

---

# 65. Definition of Done

An authorization implementation slice is complete only when:

- backend remains authoritative;
- tenant isolation is preserved;
- policy evaluation is deterministic;
- default deny is preserved;
- new permission keys are documented and risk-classified;
- affected system-role allowlists are explicitly reviewed;
- applicable scope/relationship/lifecycle checks are enforced;
- negative tests exist;
- cross-tenant tests exist where applicable;
- privilege-escalation path is considered;
- security-relevant changes are audited;
- frontend uses effective authorization without becoming authoritative;
- offline behavior remains safe;
- migrations are reversible/safe;
- `AGENTS.md` invariants remain satisfied;
- applicable Web/Mobile playbook requirements are satisfied when a client surface is changed;
- server-provided capability/projection semantics and client presentation remain consistent;
- no unrelated product scope is expanded.

---

# 66. Final Authorization Principle

SchoolOS MUST treat a role as a **capability source**, not as a complete access decision.

The final rule is:

```text
ALLOW =
    authenticated
    AND correctSecurityDomain
    AND activeTenant
    AND resourceTenantMatches
    AND entitled
    AND permissionGranted
    AND scopeMatches
    AND relationshipMatches
    AND lifecycleAllows
    AND separationOfDutiesAllows
    AND approval/step-up requirements satisfied
    AND no explicit deny
```

Anything else is:

```text
DENY
```

This architecture must remain understandable, auditable, testable, and incrementally deployable.

Do not sacrifice correctness for convenience.
