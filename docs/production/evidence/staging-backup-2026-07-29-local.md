# Staging Backup Evidence (Local Simulation)

- Date: 2026-07-29
- Source database: schoolos_staging@localhost:5434
- Result: **PASS**

## Metrics (manifest)

| Metric | Count |
| --- | ---: |
| Tenant | 1 |
| Student | 689 |
| User | 797 |
| AuditLog | 11 |
| storageFileCount | 3146 |

## Command

```bash
DATABASE_URL=postgresql://schoolos:password123@localhost:5434/schoolos_staging?schema=public pnpm backup:local
```

## Follow-up

Repeat on TLS staging/production host with off-site artifact storage before GA.
