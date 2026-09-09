# P1-16 OpenAPI Contract Gate — Local Evidence

Date: 2026-09-09  
Environment: local repository build  
Evidence boundary: compiled-contract validation only; this is not TLS staging, pilot, RC, or GA evidence.

## Change

- Replaced the source-fragment `verify:openapi` check with generation from the compiled Nest application in preview mode.
- The gate validates the OpenAPI version and identity, JWT bearer scheme, API prefix, minimum non-empty contract size, critical P0/P1 route-method pairs, response metadata, operation IDs, and duplicate operation IDs.
- `verify:openapi` now builds the API before inspection so stale `dist` output cannot produce a false pass.
- Preview mode does not instantiate the application providers or open database/Redis connections.

## Verification

- `pnpm verify:openapi` — PASS.
- API build and Prisma client generation completed before inspection.
- Generated document: 1,152 paths, 1,334 operations, 475 schemas.
- All required critical operation pairs were present; all operations had responses and unique operation IDs.

## Remaining boundary

- This gate proves that the repository can compile and generate a structurally coherent OpenAPI document.
- It does not prove every schema is semantically complete, client compatibility, live TLS deployment, provider integration, or controlled-pilot readiness.
