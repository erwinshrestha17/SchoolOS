# Controlled Pilot Checklist

Use this checklist when onboarding the first Nepal school (Grades 1–10) on the agreed pilot boundary. Record evidence under `docs/production/evidence/`.

## Preconditions

- [ ] Staging validated with recorded smoke and browser E2E evidence
- [ ] Pilot tenant entitlements reviewed: exams, fees, learning, library, transport, payroll **disabled**
- [ ] Backup/restore drill recorded for the deployment environment holding pilot data
- [ ] Support/on-call contact and escalation path documented
- [ ] Training script trimmed to pilot modules only (no M7/M8/M11 references — see readiness doc C1)

## Day 0 — Platform provisioning

- [ ] Platform operator creates tenant via authenticated `/platform` flow (DEF-01 verified)
- [ ] Initial school admin account issued with forced password change policy
- [ ] Academic year, classes, sections, subjects configured
- [ ] Class teachers assigned per section (DEF-04 path)
- [ ] Subject teachers assigned

## Day 1 — People and records

- [ ] Staff accounts created with audited temporary credentials
- [ ] Students created via admissions wizard or CSV import (dry-run then confirm)
- [ ] Guardians linked with ACTIVE + VERIFIED + APPROVED relationships
- [ ] Parent mobile login verified for at least one linked child

## Day 1 — Daily operations

- [ ] Homeroom teacher marks attendance (DEF-02 homeroom write path)
- [ ] Attendance correction workflow tested (staff/parent path as applicable)
- [ ] Homework assigned and visible on teacher + parent surfaces
- [ ] Notice published (M15→M12 delivery state honest)
- [ ] Timetable visible to teacher and parent where entitled

## Security spot checks

- [ ] Disabled modules fail closed in API and UI (DEF-06)
- [ ] Parent sees linked children only
- [ ] Teacher sees assigned scope only
- [ ] Suspended tenant blocks writes

## Evidence to capture

| Artifact | Path |
| --- | --- |
| Pilot tenant ID/slug | evidence file (no secrets) |
| Workflow screenshots or screen recordings | secure ops store |
| Smoke/pilot output | `docs/production/evidence/` |
| Incident/feedback log | GitHub Issues / support tracker |
| Backup timestamp | manifest path on ops host |

## Exit criteria — Controlled pilot validated

- [ ] Supported workflows complete without engineering intervention for one school week
- [ ] No unresolved P0 incidents open
- [ ] Feedback items triaged with owner and target release
- [ ] Product owner sign-off recorded
