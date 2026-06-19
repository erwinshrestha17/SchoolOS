# SchoolOS Module Design References

**Status:** Module-level frontend design reference index.  
**Updated:** 2026-06-19

This folder contains focused module design references derived from SchoolOS visual references and product analysis. These files complement the main web design source of truth:

```text
docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md
```

## Available references

| Module | Reference |
|---|---|
| M8A Library | `M8A_LIBRARY_FRONTEND_REFERENCE.md` |
| M13 Inventory & Asset Management | `M13_INVENTORY_ASSET_FRONTEND_REFERENCE.md` |

## Usage rules

- Treat these files as implementation guidance, not backend contract truth.
- Confirm API names, DTOs, permissions, route guards, and protected-file behavior against backend/OpenAPI before coding.
- Do not use fake frontend data to match visual references.
- Keep parent, student, staff self-service, driver, and mobile companion surfaces purpose-limited.
- For M13, never calculate official stock, valuation, depreciation, or accounting truth in the browser.
- For M13, protected bills, warranty cards, quotations, stocktake sheets, write-off documents, labels, and exports must use File Registry-backed authenticated helpers.
