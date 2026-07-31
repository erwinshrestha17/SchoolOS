# P1 Prerequisite Gate Assessment — 2026-07-31 (local)

Status: **BLOCKED — P1 implementation must not begin**

Assessed against the P1 programme brief's own rule: *"Do not begin P1 implementation until all P0
workstreams have a verified `PASS` status."*

## 1. Gate result

| Brief's P0 gate | Repo roadmap ID | Evidence in repo | Verdict |
|---|---|---|---|
| P0-01 Authorization, tenant isolation, scope | P0-01 | `p0-01-authorization-2026-07-31-local.md` | **PARTIAL** |
| P0-02 Attendance correctness | P0-08 (+P0-11) | `p0-08-*-2026-07-31-local.md` (x2) | **PARTIAL** |
| P0-03 Marks and result integrity | P1-09 / P1-15 | none | **DEFERRED** |
| P0-04 Nepal Compliance Profile | (no roadmap ID) | none — no implementation found | **NOT STARTED** |
| P0-05 IEMIS readiness | P2-06 | partial code only, no evidence file | **DEFERRED** |
| P0-06 Fee and receipt integrity | P0-12 | none | **DEFERRED** |
| P0-07 Privacy, safeguarding, protected files | P0-10 / P1-16 / P1-20 | none | **PARTIAL** |
| Offline / backup / localization / pilot gates | P0-15 | none | **DEFERRED** |

**No P0 evidence file in this repository asserts `PASS`.** All eleven `p0-*` evidence files dated
2026-07-31 self-declare `PARTIAL`, each with the qualifier *"not staging / controlled-pilot
validated"*.

## 2. Primary sources

- `docs/production/evidence/wave2-deferred-later-waves-2026-07-31.md` — explicitly defers marks/result
  integrity, Nepal compliance profile, IEMIS export, fee/receipt integrity, safeguarding depth, and
  the seeded browser/multi-user/device matrix. Closes with: *"Do not claim staging, controlled-pilot,
  or GA readiness from Wave 2 local evidence alone."*
- `docs/production/SCHOOLOS_GA_PROGRAM_TRACKER.md` — honest release stage recorded as *"Local staging
  validated … **not** controlled-pilot validated; **not** GA"*, with five open GA blockers.
- Per-file status lines of all `docs/production/evidence/p0-*.md`.

## 3. Independent code verification (not doc-only)

Checked directly against the source rather than relying on the status documents:

| Check | Command / target | Result |
|---|---|---|
| Nepal Compliance Profile | `grep -ril "complianceProfile\|NepalCompliance" apps/api/src apps/web packages schema.prisma` | **0 matches** — capability absent entirely |
| IEMIS readiness | same grep for `iemis` | present (`student-iemis.service`, readiness DTO, settings keys) — partial, not evidenced |
| Guardian capability model (P0-05) | `schema.prisma` | present (`enum GuardianCapability`, `capabilities[]`) |
| Marks/result locking (P0-03) | `schema.prisma` | `lockedAt` / `unlockedAt` present; no result-version model |
| Repo build health | `pnpm typecheck` | **PASS** (exit 0, api + web) |

Build health is green; the gate failure is one of *unverified P0 scope*, not a broken tree.

## 4. Additional finding — programme ID collision

The P1 brief's workstream numbering does **not** match this repository's existing roadmap.

| ID | Brief | `docs/SchoolOS_Controlled_Pilot_Implementation_Priority_Roadmap.md` |
|---|---|---|
| P1-01 | Unified Household and Re-enrollment | Parent Dashboard Reordering |
| P1-03 | Multi-curriculum Report Cards | (repo P1-03 = principal attention queue, evidence file exists) |

`docs/production/evidence/p1-03-principal-attention-2026-07-31-local.md` already exists and refers to
the *repo's* P1-03, not the brief's. Adopting the brief's numbering without reconciliation will
produce colliding, ambiguous evidence filenames. A namespace decision is required before any P1
evidence is written.

## 5. Greenfield scope check

Three of the brief's first four workstreams have no foundation in the schema at all:

| Brief workstream | Required models | Present in `schema.prisma` (8,486 lines) |
|---|---|---|
| P1-01 Household / re-enrollment | `Person`, `Household`, re-enrollment lifecycle | **none** |
| P1-02 Workflow engine | `Workflow*` (14 named entities) | **none** |
| P1-03 Multi-curriculum | curriculum framework/version chain | not verified — pending |

These are new subsystems spanning schema, migrations, API, web, mobile, and tests across a codebase
of 963 API files, 720 web files, 192 Dart files and 94 existing migrations — not incremental slices.

## 6. Required action before P1 begins

1. Close and evidence the P0 workstreams named in the brief, in particular the three with no
   implementation or evidence at all: Nepal Compliance Profile, fee/receipt integrity, marks/result
   integrity.
2. Execute the P0-15 seeded browser / multi-user / real-device matrix, which converts the standing
   `PARTIAL` local claims into `PASS`.
3. Resolve the P1 numbering collision against the existing roadmap.

## 7. Reviewer

Assessment produced by automated gate check. **Requires owner review before any P1 slice is
authorized.** No P1 code was written; per the brief's own prerequisite rule, implementation did not
begin.
