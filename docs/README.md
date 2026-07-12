# SchoolOS Documentation

SchoolOS is currently in **Internal QA / controlled-pilot preparation**. Documentation defines product and engineering intent; it does not prove implementation, staging validation, pilot validation, release-candidate status, or GA / Production release readiness.

## Canonical documents

| Document | Single responsibility |
|---|---|
| [Product Requirements](product/SCHOOLOS_PRODUCT_REQUIREMENTS.md) | Product purpose, personas, active scope, module outcomes, user journeys, priorities, and product acceptance boundaries. |
| [Software Requirements Specification](requirements/SCHOOLOS_SRS.md) | Software, API, database, web, mobile, non-functional, performance, reliability, and testable requirements. |
| [Architecture and Security](architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md) | Runtime architecture, security, tenant isolation, authorization, File Registry, storage, queues, provider boundaries, scaling, and performance architecture. |
| [Module Design Catalog](architecture/SCHOOLOS_MODULE_DESIGN_CATALOG.md) | Module taxonomy, ownership, cross-module boundaries, implementation evidence, and known contract, schema, and verification gaps. |
| [Production / GA Release Policy](production/SCHOOLOS_GA_RELEASE_POLICY.md) | Release terminology, stages, evidence requirements, GA blockers, acceptance gates, and prohibited readiness claims. |
| [Production Runbook](production/SCHOOLOS_PRODUCTION_RUNBOOK.md) | Environment configuration, deployment, migrations, health checks, backup, restore, rollback, incidents, pilot operations, and verification commands. |

Current work, blockers, and sequencing belong in GitHub Issues, Milestones, or Projects. Current verification evidence belongs in CI runs, smoke outputs, staging records, and release artifacts.

Do not add a new Markdown file when the content belongs in one of these canonical documents. Keep cross-document context brief and link to the canonical owner instead of duplicating its sections.
