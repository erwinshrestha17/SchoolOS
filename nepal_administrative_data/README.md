# Nepal Administrative Hierarchy

Generated: **2026-07-18**

Application-ready Nepal hierarchy:

- **7 provinces**
- **77 districts**
- **753 local levels**
  - 6 Metropolitan Cities
  - 11 Sub-Metropolitan Cities
  - 276 Municipalities
  - 460 Rural Municipalities

## Files

- `nepal_administrative_hierarchy.json` — nested Province → District → Local Level data.
- `nepal_administrative_hierarchy.min.json` — compact JSON for web/mobile bundling.
- `nepal_administrative_hierarchy_flat.csv` — complete joined table, one local level per row.
- `provinces.csv`, `districts.csv`, `local_level_types.csv`, `local_levels.csv` — normalized tables.
- `nepal_administrative_seed_postgresql.sql` — idempotent PostgreSQL schema and seed inserts.
- `province_summary.csv` — counts by province.
- `manifest.json` — validation results and provenance.

## Recommended SchoolOS model

Store `local_level_id` as a foreign key and expose dependent selectors:

`Province → District → Local Level`

Do not persist only a free-text address value. Keep the administrative IDs and render English or Nepali labels from the reference tables.

## Validation

The exported totals match the Government of Nepal structure: 7 provinces, 77 districts, and 753 local levels. Local-level type totals match 6 metropolitan cities, 11 sub-metropolitan cities, 276 municipalities, and 460 rural municipalities.

The dataset was also checked for unique IDs, valid province/district foreign keys, bilingual names, and critical relationship samples such as `Tilottama → Rupandehi → Lumbini Province`.

## Source and caution

Machine-readable hierarchy: `states-nepal` 0.3.1 (MIT), published 2025-07-19. Counts were independently cross-checked with `neplocalgov` and Government of Nepal portals.

The IDs are dataset identifiers, not asserted official government codes. Confirm gazette-sensitive spellings, renamings, or boundary changes against the Nepal Gazette or the relevant government authority before legal/compliance use.
