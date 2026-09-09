# Controlled-Pilot Rehearsal Smoke (2026-09-09, local)

- Tenant: `pilot-rehearsal-1`
- Result: **PASS**
- Boundary: deterministic local-staging rehearsal; not real-school pilot evidence

## Output

```text
--- Running SchoolOS Smoke Suite: PILOT ---

OK   Postgres connectivity
OK   Redis connectivity
OK   API /health
OK   API /ready
OK   Seeded school admin login
OK   Auth required denial
OK   Seeded principal login
OK   Seeded parent login
OK   Seeded class teacher login
OK   Seeded subject teacher login
OK   Seeded staff login
OK   Seeded accountant login
OK   Admin can list seeded students
OK   Admin can list admission cases
OK   Admin can list admission policies
OK   Admin can read QR credential summary
OK   Admin can list seeded sections
OK   Parent can list linked children
OK   Parent linked child has id
OK   Parent can read linked child profile
OK   Parent can read linked child attendance summary
OK   Parent fees summary denied on Wave 1 pilot
OK   Parent cannot access another child profile
OK   Class teacher can list assigned attendance classes
OK   Class teacher can read attendance today
OK   Class teacher can read assigned roster
OK   Class teacher cannot read unassigned roster
OK   Subject teacher can list assigned homework scopes
OK   Subject teacher can list scoped homework
OK   Subject teacher can read own timetable
OK   Subject teacher can read active assignment context
OK   Subject teacher marks denied on Wave 1 pilot
OK   Subject teacher has no homeroom attendance classes
OK   Principal mobile dashboard denied on Wave 1 pilot
OK   Principal attendance summary denied on Wave 1 pilot
OK   Principal transport alerts denied on Wave 1 pilot
OK   Principal cannot access platform health
OK   Staff HR self-service denied on Wave 1 pilot
OK   Staff leave requests denied on Wave 1 pilot
OK   Staff payslips denied on Wave 1 pilot
OK   Accountant fee invoices denied on Wave 1 pilot
OK   Accountant finance dues denied on Wave 1 pilot
OK   Accountant collection report denied on Wave 1 pilot
OK   Non-parent mobile child list fails closed
OK   Mobile logout revokes its tenant-scoped installation

Smoke suite completed successfully.
```
