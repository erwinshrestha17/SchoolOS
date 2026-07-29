# GA wave5 verification (2026-07-29, local)

Status: PASS

| Check | Result | Detail |
|---|---|---|
| db:validate | PASS | > schoolos@0.1.0 db:validate /Users/erwin/Projects/SchoolOS > pnpm compile:artifacts && pnpm --filter @schoolos/api exec prisma validate --schema prisma/schema.prisma   > schoolos@0.1.0 compile:artifacts /Users/erwin/Projects/SchoolOS > node scripts/compile-artifacts.mjs  Compiled Prisma schema to: apps/api/prisma/schema.prisma Compiled permission catalog to: packages/core/src/permissions/catalog.ts Compiled permissions to: packages/core/src/permissions.ts Compiled types to: packages/core/src/types.ts Compiled validation to: packages/core/src/validation.ts The schema at prisma/schema.prisma is valid 🚀 |
| verify:openapi | PASS | > schoolos@0.1.0 verify:openapi /Users/erwin/Projects/SchoolOS > node scripts/check-openapi-gate.mjs |
| api typecheck | PASS |  |
| smoke:learning | PASS | > schoolos@0.1.0 smoke:learning /Users/erwin/Projects/SchoolOS > node scripts/smoke-runner-local.mjs learning  --- Running SchoolOS Smoke Suite: LEARNING ---  OK   Postgres connectivity OK   Redis connectivity OK   API /health OK   API /ready OK   Seeded school admin login OK   Learning Activities (/learning/activities)  Smoke suite completed successfully. |

