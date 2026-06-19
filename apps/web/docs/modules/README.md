# SchoolOS Web Module Implementation Guides

**Status:** Module-level implementation guide index for `apps/web`.  
**Updated:** 2026-06-19

This folder contains focused frontend implementation guides for SchoolOS web modules. These guides complement:

```text
apps/web/AGENTS.md
apps/web/docs/DESIGN_SYSTEM.md
docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md
```

---

## Active module numbering

| Module | Name |
|---|---|
| M8 | Library |
| M9 | Transport |
| M10 | Canteen |
| M12 | Notifications, Notices, Communication, Chat |
| M13 | Learning Layer |

`M8A`, `M8B`, and `M8C` are obsolete labels. Library, Transport, and Canteen are standalone modules.

---

## Available guides

| Module | Guide |
|---|---|
| M8 Library | `M8_LIBRARY_FRONTEND_IMPLEMENTATION_GUIDE.md` |

---

## Usage rules

- Read the matching product/design reference before implementation.
- Use real backend APIs, contracts, and permission checks only.
- Mark unknown route/API/DTO behavior as `needs OpenAPI confirmation` or `needs backend verification`.
- Do not duplicate shared UI primitives if a component already exists in `apps/web`.
- Do not create Inventory & Asset Management web guides unless the project owner explicitly re-approves that module.
