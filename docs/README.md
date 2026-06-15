# SchoolOS Documentation

**Status:** Documentation entry point  
**Last updated:** 2026-06-15

This folder contains SchoolOS product, design, frontend, backend-contract, and testing planning documents.

SchoolOS is currently in **planning phase** for the frontend and mobile app work. Frontend/mobile implementation should start only after the planning acceptance checklist in `docs/SCHOOLOS_PLANNING_INDEX.md` is accepted.

---

## Read These First

| Order | Document | Purpose |
|---:|---|---|
| 1 | `docs/SCHOOLOS_PLANNING_INDEX.md` | Master planning index and planning-phase rules. |
| 2 | `docs/design/SCHOOLOS_UI_UX_GUIDE.md` | Main UI/UX source-of-truth. |
| 3 | `docs/design/SCHOOLOS_DESIGN_TOKENS_REFERENCE.md` | Visual tokens for web/mobile design. |
| 4 | `docs/frontend/SCHOOLOS_PERMISSION_CATALOG.md` | Permission naming and scope planning. |
| 5 | `docs/frontend/SCHOOLOS_SCREEN_CONTRACT_MATRIX.md` | Screen-to-role-to-permission-to-API matrix. |
| 6 | `docs/frontend/SCHOOLOS_FRONTEND_BACKEND_CONTRACT_SYNC_PLAN.md` | Rule for implementing backend contract gaps alongside frontend screens. |
| 7 | `docs/frontend/SCHOOLOS_COMPONENT_IMPLEMENTATION_ROADMAP.md` | Component build order for web and mobile. |
| 8 | `docs/testing/SCHOOLOS_PERSONA_SMOKE_TEST_PLAN.md` | Persona-based smoke testing plan. |

---

## Documentation Tiers

### Source of Truth

These docs are the active planning source for frontend/mobile work:

```text
docs/SCHOOLOS_PLANNING_INDEX.md
docs/design/SCHOOLOS_UI_UX_GUIDE.md
docs/design/SCHOOLOS_DESIGN_TOKENS_REFERENCE.md
docs/frontend/SCHOOLOS_PERMISSION_CATALOG.md
docs/frontend/SCHOOLOS_SCREEN_CONTRACT_MATRIX.md
docs/frontend/SCHOOLOS_FRONTEND_BACKEND_CONTRACT_SYNC_PLAN.md
docs/frontend/SCHOOLOS_COMPONENT_IMPLEMENTATION_ROADMAP.md
docs/testing/SCHOOLOS_PERSONA_SMOKE_TEST_PLAN.md
```

### Reference

These docs contain deeper explanations and should be used when the source-of-truth docs need more context:

```text
docs/design/SCHOOLOS_DETAILED_UI_UX_ROLE_COMPONENT_BLUEPRINT.md
docs/design/SCHOOLOS_WEB_MOBILE_MODULE_SCREEN_ROLE_PLAN.md
docs/design/SCHOOLOS_UI_UX_CONSOLIDATION_NOTES.md
docs/frontend/SCHOOLOS_FRONTEND_API_CONSUMPTION_MAP.md
```

### Archive / Superseded

Older drafts, duplicated plans, and one-off planning docs should be moved under:

```text
docs/archive/
```

Do not delete useful old docs immediately. Archive first, then remove later only when the active docs fully replace them.

---

## Rules For Adding New Docs

Before adding a new `.md` file, choose one:

```text
Source of Truth
Reference
Draft
Archive
```

Do not create a new planning file if the content belongs inside an existing source-of-truth doc.

Use this naming style:

```text
SCHOOLOS_<AREA>_<PURPOSE>.md
```

Examples:

```text
SCHOOLOS_SCREEN_CONTRACT_MATRIX.md
SCHOOLOS_PERMISSION_CATALOG.md
SCHOOLOS_PERSONA_SMOKE_TEST_PLAN.md
```

---

## Planning Exit Rule

Frontend/mobile implementation should start only when:

```text
1. Planning index is accepted.
2. UI/UX guide is accepted.
3. Design tokens are accepted.
4. Permission catalog is accepted.
5. Screen contract matrix P0 rows are finalized.
6. Frontend/backend contract sync plan is accepted.
7. Component roadmap is accepted.
8. Persona smoke test plan is accepted.
9. Open planning questions are answered or explicitly deferred.
```

Until then, docs may be refined, consolidated, archived, or reorganized, but implementation should not start.
