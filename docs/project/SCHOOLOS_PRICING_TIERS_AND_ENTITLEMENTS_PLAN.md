# SchoolOS Pricing Tiers and Entitlements Plan

**Status:** Roadmap only. No implementation yet.  
**Scope:** Marketing tiers, SaaS packaging, tenant feature access, backend entitlement enforcement, UI gating, usage limits, and future AI plan access.  
**Architecture:** Keep inside the current NestJS modular monolith. Do not introduce microservices for pricing/entitlements at this stage.

This document defines how SchoolOS should be packaged for the market and how plan/tier access should be enforced technically.

---

## 1. Product Marketing Positioning

SchoolOS should not be marketed as only another school management system. The positioning should be:

```text
Nepal-ready School Operating System for modern schools.
```

Core message:

```text
Admissions, attendance, fees, exams, payroll, transport, canteen, communication, accounting, and future AI insights — all in one secure school platform.
```

Important buyer-specific value:

| Buyer/User | Main Value |
|---|---|
| School owner | growth, professionalism, reduced manual operations, retention |
| Principal | student retention, academic quality, parent satisfaction, visibility |
| Accountant | fee collection, receipts, dues, cashier close, reports |
| Admin staff | admissions, student records, documents, exports |
| Teachers | attendance, homework, marks, workload, substitution support |
| Parents | notices, attendance, fees, bus, communication |
| Platform owner | scalable SaaS packaging, plan enforcement, support visibility |

Marketing should focus on outcomes, not only modules:

```text
- Collect fees faster.
- Reduce manual school administration.
- Improve parent trust.
- Track attendance and academics clearly.
- Make school finance audit-ready.
- Add premium operations like transport, canteen, library, and future AI when ready.
```

---

## 2. Recommended Commercial Tiers

Use three main tiers plus add-ons.

```text
Tier 1: SchoolOS Core
Tier 2: SchoolOS Professional
Tier 3: SchoolOS Intelligence
Optional add-ons: Transport GPS, Canteen, Library, SMS bundle, AI credits, Branded Parent App, Advanced Accounting, Custom Reports
```

Reason:

```text
- Three tiers are easier to sell than many packages.
- Add-ons keep pricing flexible for Nepal schools with different needs.
- Feature entitlements allow custom contracts without hardcoding plan names everywhere.
```

---

## 3. Tier 1 — SchoolOS Core

### Target Schools

Small Montessori, preschool, small private schools, and schools moving from paper/Excel.

### Included Modules

```text
M1 Admissions & Student Profiles
M2 Smart Attendance
M3 Fees & Receipts
M5 Activity Feed basic
M10 Notices basic
School Settings basic
Basic reports
Basic PDFs
```

### UI Should Show

```text
Dashboard
Students
Admissions
Attendance
Fees
Receipts
Activity Feed
Notices
Settings
```

### Locked or Hidden

```text
Exams
Homework
Timetable
HR
Payroll
Full Accounting
Library
Transport
Canteen
AI Intelligence
Advanced reports
Advanced parent-teacher chat
```

### Marketing Line

```text
For schools that need digital admissions, attendance, fees, receipts, and parent notices.
```

---

## 4. Tier 2 — SchoolOS Professional

### Target Schools

Growing schools needing academics, HR, payroll, report cards, parent communication, and deeper operations.

### Included Modules

Everything in Tier 1 plus:

```text
M4 Exams, CAS & Report Cards
M6 Homework & Timetable
M7 HR & Payroll
M9 Accounting basic/professional
M10 Parent-Class Teacher Chat
Advanced reports
Exports
Role management
Audit logs
```

### UI Should Show

```text
Dashboard
Students
Attendance
Fees
Exams
Report Cards
Homework
Timetable
HR
Payroll
Accounting
Activity Feed
Notices
Messages
Reports
Settings
```

### Locked or Optional

```text
Library
Transport
Canteen
AI Intelligence
School Health Network
Natural Language Interface
Advanced AI features
```

### Marketing Line

```text
For schools that want full academic, finance, HR, communication, and reporting control.
```

---

## 5. Tier 3 — SchoolOS Intelligence

### Target Schools

Larger schools, school chains, premium private schools, and institutions that want analytics, automation, and AI-assisted decision-making.

### Included Modules

Everything in Tier 1 and Tier 2 plus:

```text
M8A Library Management
M8B Transport Management
M8C Canteen Management
M11 School Intelligence & Analytics
AI Teacher Assistant
Teacher Workload Monitor
Substitute Teacher Intelligence
Guardian Communication Health Score
Academic Momentum Tracker
Exam Difficulty Calibration
Predictive Dropout Engine
Natural Language School Management Interface
Advanced dashboards
Advanced audit and analytics
```

### Optional AI Features

```text
AI report card remarks
AI lesson plan drafts
AI homework feedback drafts
AI notice/message drafts
Dropout risk scoring
Curriculum gap detection
School health network intelligence
Offline AI later
```

### Marketing Line

```text
For schools that want a complete operating system with analytics, automation, and AI-assisted decision-making.
```

---

## 6. Optional Add-ons

Some features should remain add-ons because they create extra operating cost or only apply to some schools.

### Transport GPS Add-on

```text
Live bus tracking
Driver app
Parent bus view
ETA
Route dashboard
```

Reason:

```text
GPS/live tracking increases cost through maps, location storage, mobile app support, WebSocket/SSE, and operational support.
```

### SMS / Notification Bundle

```text
SMS credits
Email provider usage
Push notification quota
Delivery reports
```

Reason:

```text
SMS has direct provider cost and should be metered.
```

### Branded Parent App Add-on

```text
Custom logo
Custom app name later
School-branded parent portal
```

### Advanced Accounting Add-on

```text
Full ledger
Bank reconciliation
Balance sheet
Income statement
VAT/TDS/PF reports
Advanced audit exports
```

### AI Credits Add-on

```text
AI remark generation
AI lesson plans
AI natural language queries
AI risk explanations
```

Reason:

```text
AI inference has ongoing provider or infrastructure cost.
```

---

## 7. Technical Architecture for Tier Access

Plan access must not be implemented only by hiding sidebar items. Frontend visibility is only UX. Backend entitlement enforcement is security.

Correct access decision:

```text
Tenant plan allows feature
+ tenant subscription is active
+ tenant feature override does not disable it
+ user role has permission
+ usage limit is not exceeded
= access allowed
```

Separate concepts:

```text
Marketing tier = business package
Entitlement = technical feature access rule
RBAC = user role permission inside the school
Feature flag = rollout/experimental control
Usage limit = quota control
```

Recommended backend areas:

```text
platform/
plans/
subscriptions/
entitlements/
usage-limits/
feature-flags/
```

Recommended frontend areas:

```text
/platform/plans
/platform/schools/[tenantId]/subscription
/platform/feature-flags
/dashboard/settings/subscription
```

---

## 8. Core Data Model Concepts

These are roadmap-level concepts only. Do not add Prisma models until implementation is approved.

### Plan

```ts
Plan {
  id
  code: 'CORE' | 'PROFESSIONAL' | 'INTELLIGENCE'
  name
  description
  status: 'ACTIVE' | 'ARCHIVED'
  monthlyPrice
  yearlyPrice
  createdAt
  updatedAt
}
```

### PlanFeature

```ts
PlanFeature {
  id
  planId
  featureKey
  enabled
  limitValue nullable
}
```

Example feature keys:

```text
module.students
module.attendance
module.fees
module.exams
module.homework
module.timetable
module.hr
module.payroll
module.accounting
module.library
module.transport
module.canteen
module.intelligence

feature.receipt_pdf
feature.report_card_pdf
feature.parent_teacher_chat
feature.transport_live_tracking
feature.ai_teacher_assistant
feature.ai_dropout_prediction
feature.ai_natural_language_query
```

### TenantSubscription

```ts
TenantSubscription {
  id
  tenantId
  planId
  status: 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED'
  startedAt
  trialEndsAt
  renewsAt
  cancelledAt nullable
}
```

### TenantFeatureOverride

Used for pilot schools, custom contracts, trial access, or temporary access.

```ts
TenantFeatureOverride {
  id
  tenantId
  featureKey
  enabled
  reason
  expiresAt nullable
  createdByUserId
  createdAt
}
```

Examples:

```text
School A is Tier 1 but gets Exams trial for 30 days.
School B is Tier 2 but Transport is disabled.
School C has AI beta access.
```

### UsageLimit

```ts
UsageLimit {
  id
  planId
  metricKey
  limitValue
}
```

Examples:

```text
students.max = 500
staff.max = 50
sms.monthly = 1000
storage.gb = 10
ai.requests.monthly = 500
transport.vehicles.max = 5
```

### UsageCounter

```ts
UsageCounter {
  id
  tenantId
  metricKey
  periodStart
  periodEnd
  usedValue
}
```

---

## 9. Backend Enforcement

Recommended request flow:

```text
JWT Auth Guard
→ Tenant Context Guard
→ Subscription Guard
→ Entitlement Guard
→ RBAC Permission Guard
→ Controller
```

Example decorators for future implementation:

```ts
@RequireFeature('module.exams')
@RequirePermission('exams:read')
@Get('/exams')
listExams() {}
```

```ts
@RequireFeature('module.fees')
@RequirePermission('payments:create')
@Post('/finance/payments')
createPayment() {}
```

```ts
@RequireFeature('feature.ai_teacher_assistant')
@RequireUsage('ai.requests.monthly')
@Post('/intelligence/teacher-assistant/remarks')
generateRemarks() {}
```

Rules:

```text
- Never trust frontend module hiding as security.
- Every paid/premium route must be guarded server-side.
- Every tenant-owned entitlement lookup must be scoped by tenantId.
- Platform support overrides must require reason and audit log.
- Custom plan overrides must have optional expiry.
```

---

## 10. Frontend UI Gating

Frontend should receive tenant entitlements after login or through a context endpoint.

Example endpoint:

```text
GET /api/v1/me/context
```

Example response:

```ts
{
  user: {...},
  tenant: {...},
  subscription: {
    planCode: 'PROFESSIONAL',
    status: 'ACTIVE'
  },
  features: {
    'module.students': true,
    'module.attendance': true,
    'module.fees': true,
    'module.exams': true,
    'module.transport': false,
    'module.intelligence': false
  },
  limits: {
    'students.max': 500,
    'sms.monthly': 1000,
    'ai.requests.monthly': 0
  }
}
```

Sidebar rendering rule:

```ts
if (features['module.exams']) {
  showExamsMenu();
}
```

Locked upsell UI:

```ts
if (!features['module.transport']) {
  showLockedTransportCard('Upgrade to enable Transport');
}
```

Recommended UX:

```text
- Hide locked modules from normal staff.
- Show locked or upgrade modules only to principal/admin users.
- Never expose locked module details to users who do not need upsell visibility.
- Backend still enforces access even if frontend hides the item.
```

---

## 11. Avoid Hardcoding Plan Names

Avoid:

```ts
if (plan === 'INTELLIGENCE') {
  showAI();
}
```

Use:

```ts
if (features['feature.ai_teacher_assistant']) {
  showAI();
}
```

Reason:

```text
Future commercial packaging may include:
- Tier 2 + AI add-on
- Tier 3 without Transport
- Custom enterprise plan
- Pilot plan
- Beta AI access
```

Feature keys keep packaging flexible.

---

## 12. Marketing Website Structure

Recommended public website pages:

```text
/
/features
/features/attendance
/features/fees
/features/exams
/features/parent-communication
/features/transport
/features/ai-school-intelligence
/pricing
/book-demo
/for-montessori
/for-secondary-schools
```

Pricing page should show:

```text
SchoolOS Core
SchoolOS Professional
SchoolOS Intelligence
```

For Nepal, avoid overcommitting exact prices too early if sales will be relationship-based. Use one of:

```text
Starting from NPR X / month
Book demo for custom quote
Per-student pricing
Annual school package
```

---

## 13. Pricing Logic Options

### Option A — Per Student Per Month

Good for SaaS scalability.

```text
Core: NPR X/student/month
Professional: NPR Y/student/month
Intelligence: NPR Z/student/month
```

### Option B — School Size Package

Easier for Nepal sales.

```text
Up to 200 students
201-500 students
501-1000 students
1000+ custom
```

### Option C — Base + Add-ons

Best long-term.

```text
Base platform fee
+ per student fee
+ SMS usage
+ AI usage
+ transport GPS add-on
+ branded app add-on
```

Recommended early go-to-market:

```text
Annual package + setup/training fee
```

Reason:

```text
Nepal schools may prefer predictable billing and onboarding support.
```

---

## 14. Technical Implementation Phases

## Phase E1 — Entitlement Foundation

Scope:

```text
Plan
PlanFeature
TenantSubscription
TenantFeatureOverride
UsageLimit
UsageCounter
Feature registry in packages/core
Backend EntitlementService
Frontend entitlement helper
```

## Phase E2 — Platform Plan Management

Routes:

```text
/platform/plans
/platform/schools/[tenantId]/subscription
/platform/schools/[tenantId]/features
```

Platform admin actions:

```text
assign plan
change plan
enable trial feature
disable feature
set expiry
view usage
```

## Phase E3 — Backend Guards

Add future guards/decorators:

```text
@RequireFeature()
@RequireUsage()
EntitlementGuard
UsageLimitGuard
```

Protect every premium module route.

## Phase E4 — Sidebar and Route Gating

Add:

```text
feature-aware sidebar
locked module cards for admins
403 or upgrade screen
route-level feature checks
```

## Phase E5 — Usage Metering

Track:

```text
student count
staff count
storage
SMS usage
AI requests
transport vehicles
parent users
```

## Phase E6 — Billing and Subscription

Later scope:

```text
school invoice
renewal date
trial period
suspension rules
payment status
manual payment recording
```

Critical boundary:

```text
SchoolOS SaaS billing = SchoolOS company charges schools.
M3/M9 school finance = schools collect money from parents/students.
```

Do not mix these two accounting domains.

---

## 15. Example Feature Matrix

| Feature / Module | Core | Professional | Intelligence |
|---|---:|---:|---:|
| Students & Admissions | Yes | Yes | Yes |
| Attendance | Yes | Yes | Yes |
| Fees & Receipts | Yes | Yes | Yes |
| Notices | Basic | Advanced | Advanced |
| Activity Feed | Basic | Full | Full |
| Exams & Report Cards | No | Yes | Yes |
| Homework | No | Yes | Yes |
| Timetable | No | Yes | Yes |
| HR | No | Yes | Yes |
| Payroll | No | Yes | Yes |
| Accounting | Basic/No | Yes | Advanced |
| Library | Add-on | Add-on | Yes |
| Transport | Add-on | Add-on | Yes |
| Canteen | Add-on | Add-on | Yes |
| Parent-Teacher Chat | No/Basic | Yes | Yes |
| Teacher Workload Monitor | No | Basic | Advanced |
| Substitute Intelligence | No | Basic | Advanced |
| Guardian Communication Score | No | Basic | Advanced |
| Dropout Prediction | No | No | Yes |
| AI Teacher Assistant | No | Add-on | Yes |
| Natural Language Query | No | No | Yes |
| School Health Network | No | No | Enterprise only |

---

## 16. Recommended Strategy

Recommended packaging:

```text
Tier 1: SchoolOS Core
Tier 2: SchoolOS Professional
Tier 3: SchoolOS Intelligence
```

Recommended add-ons:

```text
Transport GPS
Canteen
Library
SMS Pack
AI Credits
Branded Parent App
Advanced Accounting
Custom Reports
```

Reason:

```text
This allows simple marketing while keeping technical access flexible through entitlements.
```

---

## 17. Technical Golden Rule

```text
Plan controls what the school bought.
Feature entitlement controls what the tenant can access.
RBAC controls what the user can do.
Usage limits control how much they can use.
Frontend uses entitlements only for display.
Backend enforces entitlements for security.
```

---

## 18. Future Verification Rule

When implementation eventually starts, every pricing/entitlement task must report:

```text
- Plan/feature keys added.
- Tenant isolation strategy.
- Backend guard strategy.
- Frontend visibility strategy.
- Usage metering impact.
- Platform audit events.
- Tests proving unauthorized tenant/user access is rejected.
- Verification commands run.
```

Standard verification commands:

```bash
pnpm db:generate
pnpm db:validate
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify:production
```
