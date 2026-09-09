# P1-18 School Profile Nepal Address — Local Evidence

Date: 2026-09-09  
Environment: local repository plus Docker PostgreSQL/Redis staging simulation  
Evidence boundary: local authenticated workflow only; this is not certificate-verified staging, a real-school pilot, RC, or GA evidence.

## Change

- School identity now reuses the canonical Province → District → Local Level selector instead of editable free-text hierarchy fields.
- The profile contract carries the selected `localLevelId` plus ward, tole, street, and landmark details.
- The backend validates the local-level identifier, persists one tenant-owned `REGISTERED_OFFICE` address transactionally, and derives municipality, district, and province from reference data.
- The existing printable `schoolAddress` value remains preserved for historical documents and controlled migration.
- Local staging deployment explicitly seeds the versioned Nepal geography reference dataset.

The React best-practices guidance kept the existing query/cache layer and reusable selector, avoiding a duplicate geography fetch system or a second profile endpoint.

## Verification

- Focused settings tests: 4 suites, 39 tests — PASS.
- Full API unit suite: 272 suites, 2,993 tests — PASS.
- API typecheck and build — PASS.
- Touched API files linted with no errors; the changed web component linted with zero warnings — PASS.
- School-profile web contract: 2 checks — PASS.
- Full web unit suite: 95 suites, 658 tests — PASS.
- Web typecheck and production build: 262/262 routes generated — PASS.
- Compiled OpenAPI gate: 1,152 paths, 1,334 operations, 475 schemas — PASS.
- Local geography seed: 7 provinces, 77 districts, 4 local-level types, 753 local levels — PASS.
- Authenticated pilot-rehearsal API: geography lookup, profile PATCH, and profile read-back — PASS; Lalitpur and Bagmati Province were backend-derived and the printable address remained present.
- Authenticated local Playwright browser flow at `/dashboard/settings/school/identity` — PASS; the saved Bagmati Province → Lalitpur → Lalitpur hierarchy hydrated, the Nepali-name toggle rendered `बागमती प्रदेश` and `ललितपुर`, the province picker exposed all seven server-backed provinces, and the page reported zero console errors.
- Local staging deploy — PASS: `staging-deploy-2026-09-09T14-55-46-409Z-local.md`.
- Local staging gate bundle — PASS: `staging-gates-2026-09-09T14-58-53-792Z-local.md`.
- `git diff --check` — PASS.

## Operational finding closed locally

The first runtime lookup found an empty geography dataset. The deployment helper did not run the dedicated geography seed even though the schema and APIs existed. After adding `pnpm db:seed:geography` to deployment and the runbook, an idempotent deployment populated and validated the full committed dataset before the final authenticated workflow proof.

## Remaining boundary

- The same authenticated browser flow still needs exercise on certificate-verified TLS staging; this local Playwright run is not staging or pilot evidence.
- Reference-data provenance/version review remains governed by the committed dataset metadata; this slice does not claim a new official Nepal government source.
- Controlled-pilot staff must confirm the selected hierarchy and printable address for the real school rather than copying local fixture values.
