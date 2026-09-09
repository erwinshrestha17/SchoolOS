# P1-02 tenant-scope hardening (2026-09-09, local)

Status: **PASS (local code and database evidence)**

## Remediation

- Prisma tenant scoping now covers `findUniqueOrThrow`, `findFirstOrThrow`, `aggregate`, `groupBy`, `createManyAndReturn`, `updateManyAndReturn`, and `upsert` in addition to the previously covered operations.
- Update and upsert payloads force the active CLS tenant, preventing a mutation from moving a row into another tenant.
- Unknown future model operations fail closed until they receive an explicit scoping strategy.
- `$queryRaw`, `$executeRaw`, and their unsafe variants now refuse execution without a tenant context or an explicit, inventoried `runWithoutTenantScope` region.
- Global API and Platform database probes use stated cross-tenant reasons rather than relying on missing CLS state.
- The backend hardening gate pins the complete production raw-SQL inventory, forbids unsafe raw methods, and requires a tenant anchor outside the two explicit global probes.
- Existing BullMQ processors remain structurally required to use `runTenantScopedJob`; scheduled cross-tenant discovery and per-tenant work remain behind the scoped helpers.

## Verification

| Check | Result |
| --- | --- |
| Prisma tenant-scope unit contracts | PASS — 16 tests |
| Backend hardening source contracts | PASS — 12 tests |
| Real PostgreSQL tenant-isolation integration | PASS — 22 tests |
| API build | PASS |
| API unit suite | PASS — 2,977 tests |
| Local pilot persona smoke | PASS |
| Full active-P0 + Platform smoke | PASS |
| `/ready` with explicit global database probe | HTTP 200, `ready` |

## Evidence boundary

This proves the current code, local PostgreSQL behavior, and local seeded HTTP paths. Repeat the deploy and authenticated gates on the TLS staging build before release approval. PostgreSQL row-level security is not claimed; the application continues to enforce tenant isolation through authenticated CLS scope, explicit raw SQL predicates, and reviewed bypasses.
