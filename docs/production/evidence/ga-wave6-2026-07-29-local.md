# GA wave6 verification (2026-07-29, local)

Status: PASS

| Check | Result | Detail |
|---|---|---|
| db:validate | PASS | > schoolos@0.1.0 db:validate /Users/erwin/Projects/SchoolOS > pnpm compile:artifacts && pnpm --filter @schoolos/api exec prisma validate --schema prisma/schema.prisma   > schoolos@0.1.0 compile:artifacts /Users/erwin/Projects/SchoolOS > node scripts/compile-artifacts.mjs  Compiled Prisma schema to: apps/api/prisma/schema.prisma Compiled permission catalog to: packages/core/src/permissions/catalog.ts Compiled permissions to: packages/core/src/permissions.ts Compiled types to: packages/core/src/types.ts Compiled validation to: packages/core/src/validation.ts The schema at prisma/schema.prisma is valid 🚀 |
| verify:openapi | PASS | > schoolos@0.1.0 verify:openapi /Users/erwin/Projects/SchoolOS > node scripts/check-openapi-gate.mjs |
| api typecheck | PASS |  |
| tenant register spec | PASS | > @schoolos/api@0.0.1 test /Users/erwin/Projects/SchoolOS/apps/api > pnpm --filter @schoolos/core build && pnpm run prisma:generate && jest tenants.service.spec   > @schoolos/core@0.1.0 build /Users/erwin/Projects/SchoolOS/packages/core > pnpm run clean && tsc --project tsconfig.json   > @schoolos/core@0.1.0 clean /Users/erwin/Projects/SchoolOS/packages/core > rm -rf dist tsconfig.tsbuildinfo   > @schoolos/api@0.0.1 prisma:generate /Users/erwin/Projects/SchoolOS/apps/api > prisma generate   ✔ Generated Prisma Client (v7.8.0) to ./../../node_modules/.pnpm/@prisma+client@7.8.0_prisma@7.8.0_@types+react-dom@19.2.3_@types+react@19.2.14__@types+_8619248c2409e668e9f86cd42d38c435/node_modules/@prisma/client in 3.35s  Start by importing your Prisma Client (See: https://pris.ly/d/importing-client) |

