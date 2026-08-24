# SchoolOS Principal Web Persona Design Package

This directory is the governing audit and design package for the SchoolOS **Principal** web persona.

## Documents

| Document | Purpose |
|---|---|
| [`PRINCIPAL_PERSONA_AUDIT.md`](./PRINCIPAL_PERSONA_AUDIT.md) | Audits the current repository implementation, available features, authorization model, shared-page leakage, and required corrections. |
| [`PRINCIPAL_WEB_DESIGN.md`](./PRINCIPAL_WEB_DESIGN.md) | Defines the target Principal information architecture, global design rules, and page-by-page web design. |
| [`PRINCIPAL_WEB_WIREFRAMES.md`](./PRINCIPAL_WEB_WIREFRAMES.md) | Provides low-fidelity desktop wireframes, responsive notes, and shared state patterns for every Principal page. |
| [`PRINCIPAL_WEB_IMPLEMENTATION_SPEC.md`](./PRINCIPAL_WEB_IMPLEMENTATION_SPEC.md) | Maps the design into P0/P1 authorization, routes, backend contracts, components, tests, acceptance criteria, and delivery slices. |

## Governing product rule

```text
The Principal observes, evaluates, approves, escalates, and reviews evidence.
The Principal does not become a substitute Admin, Teacher, HR operator, or Accountant.
```

## Active navigation target

```text
Leadership
  Principal Home
  Attention Centre
  Approval Centre

Students
  Enrollment Overview
  Admissions Overview

School Readiness
  Attendance Oversight
  Academic Readiness
  Staff Overview
  Finance Overview

Communication
  Notices
  Activity Oversight
  Notifications

Evidence
  Reports
  Leadership Audit
```

M8 Library, M9 Transport, M10 Canteen, M13 Learning, and open chat remain outside the active Principal web scope.

## Implementation gate

Do not treat the Principal UI as safe until the canonical `principal` permission preset is converted from broad tenant permission inheritance to an explicit allowlist and direct operational routes are backend-denied.
