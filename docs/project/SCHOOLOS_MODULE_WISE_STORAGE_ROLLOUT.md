# SchoolOS Module-Wise Cloud-Agnostic Storage Rollout

**Status:** Active implementation companion for `SCHOOLOS_REMAINING_IMPLEMENTATION_PLAN.md`
**Depends on:** `docs/project/SCHOOLOS_CLOUD_AGNOSTIC_STORAGE_GUIDE.md`
**Goal:** As each remaining SchoolOS module is completed, all images, media, documents, PDFs, exports, and generated files must move through the same provider-agnostic File Registry and StorageService boundary.

---

## 1. Global Rule

Every module that creates, uploads, previews, downloads, exports, or deletes a file must follow this path:

```text
Feature module -> FileRegistryService -> StorageService -> StorageAdapter
```

Never do this inside a feature module:

```text
AWS SDK import
GCP SDK import
R2 manual signing
MinIO direct client
fs.writeFile for production files
hardcoded provider URL
permanent public URL as source of truth
```

---

## 2. Phase Gate 0 Storage Tasks

Before broad remaining implementation continues:

```text
1. Read docs/project/SCHOOLOS_CLOUD_AGNOSTIC_STORAGE_GUIDE.md.
2. Refactor StorageService into adapter pattern.
3. Normalize storage config for local, s3, r2, minio, and optional gcp.
4. Preserve existing R2 env aliases during migration.
5. Ensure object keys are tenant-scoped.
6. Ensure File Registry remains the source of truth.
7. Add tests for local and S3-compatible adapter behavior.
8. Run full verification gate.
```

Exit requirement:

```text
SchoolOS can switch between local, R2, AWS S3, and MinIO through env variables without module code changes.
```

---

## 3. Auth / Security / Tenant Isolation

Storage impact:

```text
- All file access must use authenticated tenantId.
- Cross-tenant file access must fail closed.
- File preview/download routes must return permission-denied states consistently.
- File access should include request/correlation ID logging once request logging is completed.
```

Tests to add while hardening Auth/Security:

```text
- user from tenant A cannot access tenant B file
- platform support override requires reason before tenant file access
- expired session cannot access signed URL generation endpoint
- permission-denied response is safe and human-readable
```

---

## 4. M0 Platform Core

Storage impact:

```text
- Provider readiness should check selected storage provider config.
- Platform settings should show provider type, bucket, endpoint readiness, and safe masked status.
- Queue/provider failure dashboard must never expose storage secrets.
- SaaS tenant onboarding checklist should surface object-storage readiness.
```

Remaining implementation alignment:

```text
- entitlement tests should cover file-producing APIs where plan limits apply
- object-storage readiness verification should run against explicit staging provider
- provider real connection checks must remain safe, configured, and non-paid by default
```

Manual smoke:

```text
- local provider testConnection
- R2 provider testConnection in staging
- MinIO testConnection locally
- failed provider config shows safe error
```

---

## 5. M1 Admissions & Student Profiles

Files owned:

```text
student photos
student documents
admission documents
guardian documents
student ID card PDF/QR assets
school logo/branding assets used in student/profile PDFs
```

Required behavior:

```text
- student profile stores fileId, not provider URL
- document uploads create File Registry records
- photo previews use signed URLs
- ID-card QR PDF reads assets through StorageService/FileRegistry
- document audit trail includes upload/download/delete lifecycle
```

Remaining implementation alignment:

```text
- storage-backed student photo/document staging verification
- ID-card QR PDF behavior verification
- student photo/logo upload UX polish
- QR manual QA in student/library/canteen flows
```

Tests:

```text
- tenant-scoped student photo upload
- cross-tenant student document denial
- revoked/deleted document cannot be previewed
- ID card generation does not use raw public cloud URL
```

---

## 6. M2 Smart Attendance

Files owned:

```text
attendance CSV exports
attendance PDF reports
monthly register exports
future correction request attachments if approved
```

Required behavior:

```text
- exports should be generated through report/File Registry pipeline where retained
- temporary exports may stream, but retained reports must have File Registry records
- parent attendance summary must not expose admin-only files
```

Remaining implementation alignment:

```text
- attendance report/export stabilization
- parent attendance summary later
- offline/slow-network UX must not create duplicate retained exports
```

Tests:

```text
- attendance export is tenant-scoped
- teacher cannot download another tenant/class export
- generated retained export can be downloaded through signed URL
```

---

## 7. M3 Fees & Receipts

Files owned:

```text
receipt PDFs
fee collection reports
cashier close/day-end reports
defaulter aging exports
fee-head/period dues exports
payment reversal/correction evidence attachments if approved
```

Required behavior:

```text
- receipt reprints should read from File Registry or regenerate with auditable history
- cashier close PDFs/CSVs should be tenant-scoped
- finance files must never be public
- dangerous finance exports must be audited
```

Remaining implementation alignment:

```text
- receipt reprint history depth
- cashier-close verification and export/PDF hardening
- finance reports/export polish
- online payment gateway readiness later
```

Tests:

```text
- receipt PDF download requires finance permission
- receipt reprint is audited
- cross-tenant receipt download denied
- reversal/correction export does not expose raw provider URL
```

---

## 8. M4 Academics / Exams / CAS / Report Cards

Files owned:

```text
report card PDFs
academic CSV/PDF reports
result publishing snapshots
CAS exports
promotion readiness exports
school logo assets embedded in PDFs
```

Required behavior:

```text
- generated report files must be saved through File Registry when retained
- object-storage verification must be completed in staging
- report-card correction/regeneration must preserve history
- parent/student report-card access later must be ownership-scoped
```

Remaining implementation alignment:

```text
- staging object-storage verification for generated report files
- final index review after real usage patterns stabilize
- dialog-level correction UX polish
```

Tests:

```text
- generated report-card PDF has File Registry record
- correction/regeneration does not overwrite historical report without record
- parent can only access own child report card later
```

---

## 9. M5 Activity Feed & Milestones

Files owned:

```text
activity photos
activity videos later
milestone attachments
teacher media gallery files
moderation evidence snapshots if needed
```

Required behavior:

```text
- direct upload should be introduced only after normal File Registry flow is stable
- media previews must use signed URLs
- image compression should run through BullMQ
- consent-aware media blocking must happen before signed URL generation
```

Remaining implementation alignment:

```text
- direct-upload API/UX hardening
- image compression queue depth for Nepal low-bandwidth usage
- parent-facing activity view
- teacher media gallery
```

Tests:

```text
- private activity media requires permission
- consent-blocked media does not generate signed URL
- archived/deleted post media access fails closed
- cross-tenant activity media denied
```

---

## 10. M6 Homework & Timetable

Files owned:

```text
homework attachments
student submission attachments
review/correction attachments
homework reports/exports
timetable PDF/CSV exports
substitution reports
```

Required behavior:

```text
- homework attachments must be File Registry backed
- student/parent views later must be ownership-scoped
- timetable exports should be retained only when product rules require history
```

Remaining implementation alignment:

```text
- student/parent homework and timetable views later
```

Tests:

```text
- student can access only assigned homework attachment later
- teacher can access submissions for assigned class only
- cross-tenant homework attachment denied
```

---

## 11. M7 HR & Payroll

Files owned:

```text
staff documents
contract documents
staff profile photos
payslip PDFs
payroll register exports
PF/TDS/component reports
leave report exports
```

Required behavior:

```text
- staff documents are sensitive and private by default
- payslip PDF access must be staff-owner or privileged payroll role only
- sensitive field masking and file access must align
- payroll exports must be audited
```

Remaining implementation alignment:

```text
- HR/payroll browser smoke execution in staging
```

Tests:

```text
- staff self-service can download own payslip only
- payroll admin can download run exports
- teacher cannot access another staff document
- cross-tenant payroll file denied
```

---

## 12. M8A Library Management

Files owned:

```text
book cover images later
library reports
fine reports
borrower history exports
lost/damaged evidence attachments if approved
```

Required behavior:

```text
- report/export UI should use File Registry for retained files
- QR lookup should not expose unrelated student documents
- fine receipt/payment linkage remains owned by M3 rules
```

Remaining implementation alignment:

```text
- receipt/payment linkage polish for library fines after M3 rules finalized
- overdue reminder queue operational depth in staging
- report/export UI polish
- browser smoke execution in seeded staging
```

Tests:

```text
- library report download is permission-scoped
- borrower file/report access is tenant-scoped
- QR lookup does not return private file URLs
```

---

## 13. M8B Transport Management

Files owned:

```text
vehicle documents
driver documents
route reports
trip history reports
transport attendance reports
incident/delay evidence attachments later
```

Required behavior:

```text
- parent tracking UI later must not expose driver private documents
- vehicle/driver document access is admin-only unless explicitly approved
- GPS/live map data is not File Registry data; keep it in transport location pipeline
- retained trip reports should use File Registry
```

Remaining implementation alignment:

```text
- driver app later
- parent child-specific tracking UI later
- route dashboard and trip-history report polish
- live map only after product-approved real-time design
```

Tests:

```text
- parent cannot access vehicle/driver document files
- transport report download requires transport permission
- cross-tenant vehicle document denied
```

---

## 14. M8C Canteen Management

Files owned:

```text
canteen item images
POS receipt PDFs
canteen reports
supplier/vendor documents
purchase bill attachments
wastage evidence attachments
stock adjustment evidence attachments
```

Required behavior:

```text
- POS receipt preview/PDF actions should use protected File Registry flow when retained
- supplier/purchase documents are private to canteen/admin roles
- parent wallet/menu views later should only expose safe item images and own child wallet data
```

Remaining implementation alignment:

```text
- QR/student ID scan speed polish
- purchase-bill, wastage, and manual stock-adjustment UI depth
- parent wallet/menu/spending views later
- report/export polish
- browser smoke execution in seeded staging
```

Tests:

```text
- canteen report file access is role-scoped
- supplier document cross-tenant access denied
- parent cannot access POS receipt for another student
```

---

## 15. M9 Accounting & Finance

Files owned:

```text
accounting report snapshots
trial balance PDFs/CSVs
general ledger PDFs/CSVs
cash book PDFs/CSVs
income statement PDFs/CSVs
balance sheet PDFs/CSVs
VAT/TDS/PF summaries
bank reconciliation exports
audit log exports if approved
```

Required behavior:

```text
- accounting exports are private and audited
- report snapshots must keep historical source metadata
- large exports may move to background workers later
- files must not be generated from frontend calculations
```

Remaining implementation alignment:

```text
- production seed review for default Chart of Accounts and report mappings
- optional background workers for large tenant report exports
```

Tests:

```text
- accounting export download requires accounting permission
- posted-period report snapshot remains immutable
- cross-tenant accounting file denied
```

---

## 16. M10 Notices, Communication, Messaging

Files owned:

```text
notice attachments
chat attachments
consent template documents
communication export reports
delivery failure reports
```

Required behavior:

```text
- notice/chat attachments must use File Registry signed/protected access
- guardian ownership tests must cover every attachment route
- provider callbacks must not expose file secrets
- retention/audit policy must control attachment lifecycle
```

Remaining implementation alignment:

```text
- production SMS/FCM/email adapters and signed callbacks
- retention and audit policy depth
- more guardian ownership tests across chat/message routes
- parent/mobile chat UI later
- moderation/escalation UI depth
- unread recipient list polish
```

Tests:

```text
- guardian can access only own child's notice/chat attachments
- teacher can access only permitted thread attachments
- deleted/escalated/restricted messages fail closed where required
```

---

## 17. M11 Intelligence / AI

Files owned later:

```text
analytics snapshots
review queue evidence exports
explainability reports
approved aggregate reports
```

Rules:

```text
- do not implement M11 until Phase 6 opens
- no AI-generated report should bypass File Registry if retained
- no intelligence export should bypass tenant scoping or audit
```

---

## 18. Mobile Companion App

Storage impact:

```text
- Flutter app must not receive permanent private provider URLs.
- Mobile file previews should use backend-issued short-lived signed URLs.
- Parent app must only access own child files.
- Driver app must only access assigned route/trip safe files.
- Teacher app must only access assigned classes/students/files.
```

Mobile file rules:

```text
- cache signed URLs only for their expiry window
- never store private signed URLs as permanent records
- refresh preview/download URLs through backend
- do not expose admin-shaped File Registry metadata to parents/drivers
```

---

## 19. Done Criteria Per Module

A module is storage-ready only when:

```text
1. File-producing APIs use FileRegistryService/StorageService.
2. No provider SDK imports exist in feature module code.
3. File metadata is tenant-scoped.
4. File access has RBAC/ownership checks.
5. Private files use signed URLs.
6. Cross-tenant denial tests exist.
7. Report/PDF exports are audited where sensitive.
8. Staging provider smoke is run for at least one cloud/S3-compatible provider.
9. Browser/mobile UI never depends on permanent provider URLs for private files.
```

---

## 20. Verification Commands

Run after each storage-related sprint:

```bash
pnpm db:generate
pnpm db:validate
pnpm verify:openapi
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify:production
```

Run module-specific smoke after each module migration:

```text
M1: student photo/document upload-preview-download
M3: receipt/report PDF generation-download
M4: report-card generation-download-history
M5: activity media upload-preview-consent-block
M6: homework attachment upload/download
M7: payslip/staff document download permission check
M8A: library report download
M8B: vehicle/driver document and trip report download
M8C: POS receipt and purchase document download
M9: accounting report snapshot download
M10: notice/chat attachment access by role/guardian ownership
```
