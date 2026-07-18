# SchoolOS

SchoolOS is a Nepal-first, multi-tenant education operating SaaS in Internal QA / controlled-pilot preparation.

Active product scope (Grade 1-12, per Nepal education standards):

```text
SCHOOL
  Grade 1-10

HIGHER_SECONDARY
  Grade 11-12 / +2
```

Preschool (Montessori, Nursery, LKG, UKG, ECD), Bachelor and Master's institution-management features, a broad student mobile application, and M14 Intelligence / AI runtime are not active scope.

The active delivery boundary separates **M12 Notifications and Delivery** from
**M15 Notices and Announcements**. Chat/conversations are removed from the active
product: new writes and navigation are disabled while historical records remain
protected for compatibility and retention.
**M13 Learning Layer is deferred and frozen**: its implementation is preserved,
disabled by default for pilot tenants, excluded from pilot acceptance and release
claims, and limited to critical security or repository-compatibility fixes.

## Current Pilot Focus

SchoolOS is currently **Internal QA / controlled-pilot preparation**, not staging validated, controlled pilot validated, release candidate, or GA / Production release.

The first commercial/pilot hypothesis is a narrow **School (Grade 1-10)** workflow centred on transparent fee records, scholarship/discount treatment where enabled, understandable receipts, attendance, parent notices, and principal attention. SchoolOS may describe these as traceable, auditable operational records; it must not claim legal compliance, regulatory approval, or guaranteed outcomes.

See [`docs/README.md`](docs/README.md) for the canonical documentation set. Current work and blockers live in GitHub Issues, Milestones, or Projects; verification evidence lives in CI runs, smoke outputs, staging records, and release artifacts.
