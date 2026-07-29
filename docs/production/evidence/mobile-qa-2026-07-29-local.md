# Mobile QA Evidence (Local — Automated Suite)

- Date: 2026-07-29
- Environment: local workstation (not physical device)
- Result: **PARTIAL** (automated tests pass; emulator/device QA pending)

## Commands run

```bash
cd apps/schoolos_mobile
flutter pub get
flutter analyze
flutter test
```

## Results

| Check | Result |
| --- | --- |
| flutter analyze | PASS (no issues) |
| flutter test | PASS (539 tests) |
| Android emulator pilot paths | NOT RUN — requires device QA wave |
| iOS simulator pilot paths | NOT RUN — requires device QA wave |
| Physical device deep-link/permission denial | NOT RUN |

## Pilot personas to cover in device wave

- Parent/Guardian: child list, notices inbox, attendance view
- Teacher: attendance drafts/sync, homework, schedule
- Principal: mobile dashboard read surfaces

## Follow-up

Complete emulator + physical device checklist before controlled pilot validated claim.
