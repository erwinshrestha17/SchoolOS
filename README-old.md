# 🏰 Nestjs-Auth-RBAC

A plug-and-play NestJS monorepo template that gives any new system (HotelOS, SchoolOS, EcomOS, etc.) complete auth, JWT tokens, RBAC, audit logging, and multi-tenancy in a single import. 

**Zero auth code needed in consuming apps.** ## ⚡ Core Features

* **Universal AuthModule:** A dynamic module (`AuthModule.forRoot()`) that registers all submodules, guards, interceptors, and seeds in a single call.
* **Bulletproof Token Strategy:** Short-lived access tokens (15 min) in memory, and long-lived opaque refresh tokens (7 days) stored securely via `httpOnly` cookies. Includes stolen token detection with automatic revocation.
* **Granular RBAC:** Complete guard system utilizing `@Roles()` and `@Permissions()` decorators. 
* **Multi-Tenancy Ready:** Single schema design with `tenantId` isolation across all tables. Seamlessly transition from single to multi-tenant by flipping the `multiTenant: true` flag.
* **Audit Logging:** Global `AuditInterceptor` tracks all mutating requests automatically.

## 🛠 Tech Stack

| Layer | Choice | Reason |
| :--- | :--- | :--- |
| **Runtime** | Node.js 20 LTS | Stable, massive ecosystem, best PostgreSQL support |
| **Framework** | NestJS 10 | Enforced structure, native monorepo CLI, DI container, decorators |
| **Build Orch.**| Turborepo | Caches builds, runs tasks in parallel, monorepo-native |
| **ORM** | Prisma | Type-safe queries, auto-generated types from schema, best PG support |
| **Cache/Queue**| Redis + BullMQ | Refresh token store, rate limiting, OTP delivery jobs |
| **Security** | bcrypt (cost 12) | Industry standard cost balances security vs login latency |

## 🚀 Quick Start

Initialize the monorepo and bootstrap the core infrastructure:

```bash
# 1. Scaffold the monorepo 
npx create-turbo@latest corp --example with-nestjs 

# 2. Generate the auth library 
nest g library auth --prefix corp 

# 3. Generate the first app 
nest g app auth-service 

# 4. Run Prisma migration 
turbo run db:migrate 

# 5. Seed roles + superadmin 
turbo run db:seed 

# 6. Start all apps in dev mode 
turbo run start:dev
