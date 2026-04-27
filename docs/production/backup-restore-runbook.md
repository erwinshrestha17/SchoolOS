# SchoolOS Backup And Restore Runbook

Production readiness requires restorable data, not just backups that appear to exist. Treat this as the baseline operating policy for Docker VPS deployments.

## What Must Be Backed Up

- Postgres: application data, tenant records, accounting ledger, audit records, sessions, and module data.
- Redis: queue state and transient worker state. Redis is not the source of truth, but persistence reduces operational loss during restarts.
- Storage: uploaded files, generated PDFs, receipts, certificates, activity attachments, and signed document metadata.
- Configuration: production `.env`, proxy config, Docker Compose files, migration version, and deploy commit SHA.

## Backup Frequency

- Postgres: daily full backup and hourly WAL/archive strategy once live schools are onboarded.
- Storage: daily incremental sync and weekly full verification.
- Redis: enable append-only persistence or RDB snapshots if queues are used for scheduled work.
- Configuration: backup on every deployment or secret rotation.

## Minimum Postgres Backup Command

Run from the VPS or a trusted maintenance container:

```bash
pg_dump --format=custom --file=/backups/schoolos-$(date +%Y%m%d%H%M).dump "$DATABASE_URL"
```

Store backups outside the VPS as soon as possible. A VPS-local backup is only a staging copy.

## Restore Drill

1. Provision a clean test database.
2. Restore the latest backup:

```bash
pg_restore --clean --if-exists --dbname="$RESTORE_DATABASE_URL" /backups/latest.dump
```

3. Restore storage files to the test storage root.
4. Start API with restore database/storage values.
5. Run `/api/v1/ready`.
6. Verify login, tenant data, admission documents, receipts, ledger reports, and notification delivery records.
7. Record the restore duration and any missing assets.

Run a restore drill before production launch and at least monthly after onboarding live schools.

## Data Retention And Safety

- Keep immutable audit records and posted journal entries for the required statutory retention window.
- Do not hard-delete students, guardians, invoices, receipts, payroll, journals, or generated certificates from production flows.
- Use module lifecycle states and retention metadata for exit, alumni, void, reverse, archive, and deactivation flows.
- Encrypt sensitive medical, HR, bank, PAN, citizenship, and compliance fields before persistence.

## Incident Checklist

- Capture failing request IDs from API responses/logs.
- Freeze affected tenant/module writes if financial or certificate data may be inconsistent.
- Snapshot current database and storage before attempting repair.
- Prefer corrective/reversing records over mutation of posted or issued records.
- After restore or repair, verify tenant isolation, ledger balance, document availability, and delivery records.
