# SchoolOS Module Design References

**Status:** Module-level frontend design reference index.  
**Updated:** 2026-06-19

This folder contains focused module design references derived from SchoolOS visual references and product analysis. These files complement the main web design source of truth:

```text
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

Inventory & Asset Management is scrapped from active design scope.

---

## Available references

| Module | Reference |
|---|---|
| M8 Library | `M8_LIBRARY_FRONTEND_REFERENCE.md` |

---

## Usage rules

- Treat these files as implementation guidance, not backend contract truth.
- Confirm API names, DTOs, permissions, route guards, and protected-file behavior against backend/OpenAPI before coding.
- Do not use fake frontend data to match visual references.
- Keep parent, student, staff self-service, driver, and mobile companion surfaces purpose-limited.
- Use active module numbers in new docs and UI copy.
- Do not create Inventory & Asset Management references unless that module is explicitly re-approved.
