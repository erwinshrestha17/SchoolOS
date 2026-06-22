# SchoolOS Education Compliance and IRD Billing Specification

**Product:** SchoolOS  
**Market:** Nepal-focused school and college operating SaaS  
**Document type:** Product + functional companion specification  
**Status:** Approved planning companion for future PRD/FRS/SRS/SDD updates; not implementation proof  
**Owner/audience:** Product management, backend lead, accounting/finance lead, QA lead, compliance advisor, school/college administrator, accountant  
**Scope:** UGC/HEMIS-ready education compliance, iEMIS alignment boundary, QAA readiness support, IRD-compliance-ready billing, immutable tax invoices, credit/debit notes, CBMS-ready adapter design, and SchoolOS module placement.  
**Precedence:** Product intent remains owned by `SCHOOLOS_PRODUCT_REQUIREMENTS.md`; detailed behavior remains owned by `SCHOOLOS_FUNCTIONAL_REQUIREMENTS.md`; software/non-functional requirements remain owned by `../requirements/SCHOOLOS_SRS.md`; architecture remains owned by `../architecture/SCHOOLOS_ARCHITECTURE_AND_SECURITY.md` and `../architecture/SCHOOLOS_MODULE_DESIGN_CATALOG.md`. This document is a canonical companion until the master documents absorb the approved requirements.  
**Inputs/source documents:** Current SchoolOS FRS/module map, M3 Fees and Receipts frontend reference, M11 accounting posting architecture, UGC Nepal public HEMIS/QAA pages, IRD Nepal electronic invoice/electronic billing public procedure pages, Veda public product claims, Tigg public IRD/CBMS billing description.  
**Out-of-scope content:** Legal certification claim, guaranteed IRD approval, direct UGC/HEMIS API claim, CBMS production credential handling, tax advice, final DTO/OpenAPI naming, database migration SQL, UI pixel design, implementation status claims.  
**Last reviewed date:** 2026-06-22

---

## 1. Executive Summary

SchoolOS should treat UGC/HEMIS and IRD billing as compliance-grade systems, not marketing badges.

Recommended product capabilities:

| Capability | SchoolOS name | Scope boundary |
|---|---|---|
| Higher education compliance | M15 Education Compliance | iEMIS readiness, UGC/HEMIS-ready reporting, QAA readiness, validation, exports, submission history. |
| IRD billing | M3B IRD Billing Compliance | Formal billing mode, fiscal-year invoice sequence, immutable tax invoices, credit/debit notes, cancellation, protected PDFs, CBMS-ready adapter. |
| Accounting handoff | M11 Accounting and Finance | Journals, fiscal periods, locks, reconciliation, source posting, finance reports. |

Safe market wording before official approvals:

```text
UGC/HEMIS-ready reporting and export.
IRD-compliance-ready billing engine.
CBMS-ready electronic invoicing adapter.
```

Do not claim the following until official evidence exists:

```text
UGC integrated.
Direct HEMIS API integration.
IRD verified.
CBMS certified.
```

---

## 2. Source Research Notes

### 2.1 UGC / HEMIS

UGC Nepal exposes Higher Education Management Information System services from its public website and maintains Higher Education Management Information System reports for multiple academic years. Public UGC pages also expose QAA institution metadata such as institution name, establishment year, province, nature, university, accreditation date, expiry date, status, and website.

Relevant public references:

```text
https://www.ugcnepal.edu.np/
https://www.ugcnepal.edu.np/category/higher-education-management-information-system-report/
https://www.ugcnepal.edu.np/pages/qaa-receiving-heis-8/
```

Interpretation for SchoolOS:

1. UGC/HEMIS is primarily a higher-education and college/campus reporting concern.
2. SchoolOS should not treat UGC as the primary compliance target for ordinary Grade 1-10 schools.
3. The first product milestone should be HEMIS-ready data preparation and export, not direct API submission.
4. Direct UGC/HEMIS API integration requires official access and should remain a later integration tier.

### 2.2 IRD / Electronic Billing

IRD Nepal has public pages for electronic invoice/electronic billing procedures and notices, including Electronic Invoicing Procedure, 2082 and earlier electronic billing procedure materials.

Relevant public references:

```text
https://ird.gov.np/
https://ird.gov.np/content/13439/notice-regarding-electronic-invoicing/
https://ird.gov.np/content/5490/tax-laws-16910453028/
```

Interpretation for SchoolOS:

1. IRD-ready billing must be implemented through strict invoice controls, not just printable fee receipts.
2. Issued tax invoices must become immutable.
3. Invoice sequence handling must be tenant-specific, fiscal-year-specific, sequential, auditable, and non-reusable.
4. Wrong invoices should use cancellation, credit note, debit note, refund, or reversal workflows rather than silent edits.
5. SchoolOS must verify exact certification and CBMS production requirements with IRD or qualified Nepal tax/compliance advisors before claiming IRD verification.

### 2.3 Competitive References

Veda publicly claims a UGC integrated system and IRD verified billing system. Public pages do not expose implementation detail.

```text
https://veda-app.com/
```

Tigg publicly describes IRD verified billing with CBMS integration for Nepal accounting use cases.

```text
https://tiggapp.com/
```

SchoolOS differentiation should be transparent compliance design: validation dashboards, immutable logs, sequence controls, protected files, submission history, and explicit certification boundaries.

---

## 3. Product Positioning

### 3.1 Positioning Statement

SchoolOS will provide a Nepal-compliance-ready operating platform for schools, +2 institutions, colleges, and campuses by combining iEMIS readiness, UGC/HEMIS-ready reporting, QAA readiness support, and IRD-compliance-ready billing with secure tenant isolation, immutable financial records, protected file access, and auditable submission history.

### 3.2 Segment Fit

| Institution type | Compliance need | SchoolOS support |
|---|---|---|
| Preschool / Montessori | Basic records, guardian data, attendance, fees | Core modules; no UGC requirement. |
| Grade 1-10 school | iEMIS readiness and local school reporting | M1 student/profile data plus M15 iEMIS readiness checks. |
| +2 / higher secondary | School reporting plus program/stream data | M1/M4/M15 stage-aware reporting. |
| College / campus | UGC/HEMIS, staff/program/student statistics, QAA evidence | M15 Education Compliance. |
| VAT/PAN-registered institution | Formal invoice and tax documentation | M3B IRD Billing Compliance plus M11 handoff. |

---

## 4. Module Placement

### 4.1 M15 Education Compliance

M15 owns:

1. Compliance dashboard.
2. Institution compliance profile.
3. iEMIS readiness checks.
4. UGC/HEMIS-ready reporting.
5. QAA readiness tracking.
6. Student, staff, program, and scholarship report snapshots.
7. Validation engine.
8. Export generation.
9. Submission history.
10. Compliance evidence file links through File Registry.

M15 must not own:

1. Core student records.
2. Core staff records.
3. Exam result truth.
4. Accounting truth.
5. File storage authorization.
6. Notification delivery.

M15 consumes canonical data from M1, M4, M7, M11, M12, and File Registry.

### 4.2 M3B IRD Billing Compliance

M3B is an extension of M3 Fees and Receipts.

M3B owns:

1. Billing compliance settings.
2. Formal invoice mode.
3. IRD-compliant mode configuration.
4. Invoice sequence management.
5. Tax invoice preview and issue workflow.
6. Credit note and debit note workflows.
7. Invoice cancellation workflow.
8. Duplicate/copy reprint behavior.
9. CBMS-ready payload/export/adapter logs.
10. Protected invoice PDFs.

M3B must not directly own:

1. Manual accounting journals.
2. Fiscal period locks.
3. Chart of accounts truth.
4. Bank reconciliation.
5. Cross-module ledger writes.

M11 owns official accounting posting, period locks, journals, reconciliation, and accounting reports.

---

## 5. M15 Education Compliance Requirements

### 5.1 Core Actors

| Actor | Responsibilities |
|---|---|
| School admin | Maintain institution profile and basic compliance data. |
| College compliance officer | Generate UGC/HEMIS-ready reports and track submissions. |
| Principal / campus chief | Review readiness dashboard and approve submissions. |
| Accountant | Provides PAN/VAT/fiscal identity and scholarship finance data. |
| HR/admin officer | Maintains staff statistics and qualification data. |
| Platform/support admin | Supports tenant setup only through audited override. |

### 5.2 Institution Compliance Profile

Required fields:

| Field group | Examples |
|---|---|
| Identity | English name, Nepali name, registration number, institution type. |
| Location | Province, district, municipality, ward, address. |
| Ownership/nature | Private, community, public, constituent, trust. |
| Affiliation | University/board, affiliation code, campus code where applicable. |
| Contact | Phone, email, website. |
| Tax identity | PAN, VAT registration status, VAT number. |
| Accreditation | QAA status, accredited date, expiry date, evidence files. |

### 5.3 Higher Education Structure

SchoolOS must model higher education separately from school class-section structure.

```text
University / Board
  → Faculty / Institute
  → Level
  → Program
  → Year / Semester
  → Batch / Section
  → Course / Subject
```

Examples:

| Entity | Example |
|---|---|
| Faculty | Management, Education, Humanities, Science. |
| Level | Bachelor, Master, MPhil, PhD, Diploma. |
| Program | BBS, BBA, B.Ed, BSc CSIT. |
| Year/semester | Year 1, Semester 3. |
| Batch | 2081 Batch, Morning Shift. |

### 5.4 Student Reporting Dimensions

M15 must support aggregated statistics by:

1. Academic year.
2. Program/faculty/level.
3. Year/semester.
4. Gender.
5. District/province of origin where available.
6. Enrollment status.
7. Dropout/transfer/completion status.
8. Scholarship status.
9. Exam/result status where applicable.
10. Inclusion/category fields only when legally required and tenant policy allows collection.

### 5.5 Staff Reporting Dimensions

M15 must support staff statistics by:

1. Teaching / non-teaching.
2. Full-time / part-time / contract.
3. Department/faculty.
4. Designation.
5. Qualification.
6. Gender/category where required.
7. Workload/credit hours where supported.

### 5.6 Scholarship Reporting

Scholarship record fields:

1. Scholarship type.
2. Funding source.
3. Student recipient.
4. Amount.
5. Academic/fiscal year.
6. Status: applied, approved, disbursed, renewed, rejected, closed.
7. Evidence file IDs.
8. Approval and audit history.

### 5.7 QAA Readiness

QAA readiness support should track:

1. Accreditation status.
2. Accredited date.
3. Expiry date.
4. Evidence packages.
5. Committee/quality cell contacts.
6. Report exports.
7. Renewal reminders via M12 where enabled.

### 5.8 Validation Engine

Validation output must distinguish error, warning, and info.

| Validation | Severity |
|---|---|
| Institution province/district missing | ERROR |
| Affiliated university missing for college/campus | ERROR |
| Program level missing | ERROR |
| Student enrollment not linked to active program/class | ERROR |
| Student total does not match demographic subtotals | ERROR |
| Scholarship amount missing | ERROR |
| Staff qualification missing | WARNING |
| Academic year not locked before final report | WARNING |
| QAA expiry missing for QAA-enabled institution | WARNING |
| Duplicate student suspected | WARNING |
| Optional website missing | INFO |

### 5.9 Report States

```text
DRAFT
VALIDATING
VALIDATION_FAILED
READY
EXPORTED
SUBMITTED
REJECTED
ARCHIVED
```

A report must not be marked `READY` if required ERROR validations remain unresolved.

### 5.10 Export Rules

1. Exports must be generated server-side.
2. Exports must be stored through File Registry.
3. Export downloads must be permission-scoped.
4. Report content must include an as-of timestamp.
5. Report run must store validation summary.
6. Re-export must create a new report run or version, not silently overwrite old evidence.

---

## 6. M15 Education Compliance Data Model Draft

```text
compliance_institution_profile
- id
- tenant_id
- institution_name_en
- institution_name_np
- institution_type
- nature
- registration_number
- affiliated_university_id
- province
- district
- municipality
- ward
- pan_number
- vat_number
- qaa_status
- qaa_accredited_at
- qaa_expires_at
- created_at
- updated_at
```

```text
higher_ed_program
- id
- tenant_id
- faculty
- level
- program_code
- program_name
- duration_years
- semester_based
- affiliated_university_id
- active
```

```text
higher_ed_enrollment_snapshot
- id
- tenant_id
- academic_year_id
- program_id
- year_or_semester
- total_students
- male_count
- female_count
- other_count
- scholarship_count
- dropout_count
- completed_count
- generated_from_live_data
- generated_at
```

```text
compliance_report_run
- id
- tenant_id
- report_type: IEMIS | UGC_HEMIS | QAA | SCHOLARSHIP | STAFF | CUSTOM
- academic_year_id
- fiscal_year_id
- status
- generated_by_id
- generated_at
- export_file_id
- validation_error_count
- submitted_at
- submitted_by_id
```

```text
compliance_validation_error
- id
- tenant_id
- report_run_id
- entity_type
- entity_id
- field_name
- severity
- message
- suggested_fix
```

---

## 7. M3B IRD Billing Compliance Requirements

### 7.1 Billing Modes

| Mode | Use case | Rules |
|---|---|---|
| SIMPLE_RECEIPT | Small schools needing fee receipts only | Receipt numbering, payment ledger, protected receipt PDF. |
| FORMAL_INVOICE | Institutions needing official invoice workflow | Invoice sequence, lock after issue, cancellation/credit/debit workflow. |
| IRD_COMPLIANT | Institutions requiring electronic billing compliance | Formal invoice rules plus PAN/VAT settings, CBMS-ready adapter, high-risk audits. |

### 7.2 Institution Tax Settings

Fields:

1. Legal name.
2. PAN number.
3. VAT registration status.
4. VAT number where applicable.
5. Default VAT rate.
6. Fiscal year.
7. Invoice language: English, Nepali, bilingual.
8. Billing mode.
9. CBMS mode: disabled, export-only, sandbox, production.
10. IRD approval reference if verified.

After the first production tax invoice is issued, sensitive tax settings must require reasoned change workflow and audit.

### 7.3 Invoice Sequence Rules

1. Sequence is tenant-scoped.
2. Sequence is fiscal-year-scoped.
3. Sequence is document-type-scoped: tax invoice, credit note, debit note, receipt.
4. Issued numbers are never reused.
5. Cancelled documents continue to consume their number.
6. Sequence reset is blocked after first issued document unless a platform-level audited correction is explicitly approved.
7. Invoice number allocation must be transactional to prevent race conditions.

### 7.4 Tax Invoice Issue Rules

1. A tax invoice starts as preview/draft.
2. The final issue command allocates the sequence number.
3. The issued invoice is locked immediately.
4. No direct edit is allowed after issue.
5. Status changes require reason and audit.
6. PDF generation must use the immutable invoice snapshot.
7. Parent/student copies must never expose internal accounting notes.

### 7.5 Correction Rules

| Problem | Allowed workflow |
|---|---|
| Overcharged fee | Credit note. |
| Undercharged fee | Debit note. |
| Wrong invoice recipient | Cancel + reissue if tenant policy allows. |
| Payment mistake | Payment reversal. |
| Duplicate payment | Refund/reversal. |
| Scholarship applied late | Credit note or waiver workflow. |
| Tax mistake | Credit/debit note with audit and approval. |

### 7.6 CBMS Adapter Rules

1. M3B must not hard-code CBMS provider logic into fee collection services.
2. Use a provider adapter interface.
3. Store request/response hashes instead of exposing secrets or oversized payloads in UI.
4. Every retry must be reasoned and audited.
5. Rejected submissions must remain distinct from failed transport attempts.
6. Manual export mode must remain available until official API access is confirmed.

---

## 8. M3B IRD Billing Data Model Draft

```text
billing_compliance_settings
- id
- tenant_id
- billing_mode
- legal_name
- pan_number
- vat_registered
- vat_number
- default_vat_rate
- invoice_language
- cbms_enabled
- cbms_mode
- approved_by_ird
- ird_approval_reference
- approval_date
- created_at
- updated_at
```

```text
invoice_sequence
- id
- tenant_id
- fiscal_year_id
- sequence_type: TAX_INVOICE | CREDIT_NOTE | DEBIT_NOTE | RECEIPT
- prefix
- current_number
- padding_length
- locked
- created_by_id
- updated_by_id
```

```text
tax_invoice
- id
- tenant_id
- fiscal_year_id
- source_fee_invoice_id
- invoice_number
- issue_date
- issue_date_bs
- buyer_type
- buyer_name
- buyer_pan
- student_id
- guardian_id
- subtotal_amount
- discount_amount
- non_taxable_amount
- taxable_amount
- vat_amount
- total_amount
- status: DRAFT | ISSUED | CANCELLED | CREDITED | PARTIALLY_CREDITED
- issued_by_id
- issued_at
- locked_at
- cancel_reason
- cancelled_by_id
- cancelled_at
- pdf_file_id
- cbms_status
```

```text
tax_invoice_line
- id
- tenant_id
- tax_invoice_id
- line_number
- fee_head_id
- description
- quantity
- unit_price
- discount_amount
- taxable
- tax_rate
- tax_amount
- line_total
- account_mapping_id
```

```text
tax_adjustment_note
- id
- tenant_id
- fiscal_year_id
- note_type: CREDIT_NOTE | DEBIT_NOTE
- note_number
- original_tax_invoice_id
- reason
- subtotal_amount
- tax_amount
- total_amount
- status: DRAFT | ISSUED | CANCELLED
- issued_by_id
- issued_at
- pdf_file_id
- cbms_status
```

```text
cbms_submission_log
- id
- tenant_id
- document_type: TAX_INVOICE | CREDIT_NOTE | DEBIT_NOTE
- document_id
- request_payload_hash
- response_payload_hash
- status: QUEUED | SENT | ACCEPTED | REJECTED | FAILED | RETRYING
- error_code
- error_message
- attempt_count
- last_attempt_at
- accepted_at
- created_at
```

---

## 9. Service Architecture

### 9.1 M15 Services

```text
ComplianceProfileService
EducationStructureMappingService
HemISReportService
IemISReadinessService
QaaReadinessService
ScholarshipReportingService
ComplianceValidationService
ComplianceExportService
ComplianceSubmissionHistoryService
```

### 9.2 M3B Services

```text
BillingComplianceSettingsService
InvoiceSequenceService
TaxInvoiceService
TaxInvoicePdfService
CreditNoteService
DebitNoteService
InvoiceCancellationService
CBMSAdapterService
CBMSRetryService
BillingAuditService
PANValidationService
```

### 9.3 M11 Boundary

M3B must emit approved source events to M11. M11 posts official accounting entries, enforces fiscal period locks, prevents unsafe backdated posting, and owns reconciliation/reporting.

```text
Fee invoice
  -> Tax invoice issue
  -> M11 invoice posting
  -> Payment collection
  -> Receipt issue
  -> M11 payment posting
  -> Credit/debit/reversal when required
  -> Audit + report + protected files
```

---

## 10. API Planning Contract

Endpoint names below are planning names. Confirm final names against OpenAPI/shared contracts before implementation.

### 10.1 Education Compliance APIs

```text
GET    /compliance/dashboard
GET    /compliance/institution-profile
PUT    /compliance/institution-profile

GET    /compliance/education-structure
POST   /compliance/higher-ed/programs
PUT    /compliance/higher-ed/programs/:id

POST   /compliance/reports/iemis/validate
POST   /compliance/reports/iemis/generate

POST   /compliance/reports/hemis/validate
POST   /compliance/reports/hemis/generate

GET    /compliance/reports
GET    /compliance/reports/:id
GET    /compliance/reports/:id/download
POST   /compliance/reports/:id/mark-submitted
```

### 10.2 IRD Billing APIs

```text
GET    /finance/billing-compliance/settings
PUT    /finance/billing-compliance/settings

GET    /finance/invoice-sequences
POST   /finance/invoice-sequences
PUT    /finance/invoice-sequences/:id/lock

POST   /finance/tax-invoices/preview
POST   /finance/tax-invoices/issue
GET    /finance/tax-invoices
GET    /finance/tax-invoices/:id
POST   /finance/tax-invoices/:id/cancel
POST   /finance/tax-invoices/:id/reprint

POST   /finance/tax-invoices/:id/credit-note
POST   /finance/tax-invoices/:id/debit-note

GET    /finance/cbms/logs
POST   /finance/cbms/:documentId/retry
POST   /finance/cbms/export
```

---

## 11. Permissions

### 11.1 Education Compliance

```text
compliance.view
compliance.profile.manage
compliance.mapping.manage
compliance.report.validate
compliance.report.generate
compliance.report.export
compliance.report.mark_submitted
compliance.qaa.manage
```

### 11.2 IRD Billing

```text
billing.compliance.view
billing.compliance.manage_settings
billing.sequence.manage
billing.tax_invoice.preview
billing.tax_invoice.issue
billing.tax_invoice.cancel
billing.tax_invoice.reprint
billing.credit_note.issue
billing.debit_note.issue
billing.cbms.view
billing.cbms.retry
billing.cbms.export
```

High-risk actions must require confirmation, reason, audit, and optionally two-person approval.

High-risk actions include:

1. Invoice cancellation.
2. Sequence change.
3. Credit note issue.
4. Debit note issue.
5. Fiscal year close/reopen.
6. CBMS retry after rejection.
7. Tax settings change after first invoice issue.

---

## 12. Web Surface Allocation

### 12.1 Education Compliance

```text
Compliance
  -> Dashboard
  -> Institution Profile
  -> iEMIS Readiness
  -> UGC / HEMIS Readiness
  -> QAA Readiness
  -> Scholarship Reports
  -> Staff Reports
  -> Validation Errors
  -> Report History
```

### 12.2 IRD Billing

```text
Finance
  -> Billing Compliance Settings
  -> Invoice Sequences
  -> Tax Invoices
  -> Credit Notes
  -> Debit Notes
  -> CBMS Logs
  -> Audit Trail
```

### 12.3 Mobile Boundary

Mobile is purpose-limited.

Allowed on mobile:

1. Parent due amount.
2. Parent receipt/invoice copy where policy allows.
3. Payment status.
4. Principal compliance summary.
5. Accountant alert summary.

Not allowed on mobile by default:

1. Invoice sequence management.
2. CBMS retry.
3. Tax settings edit.
4. HEMIS mapping edit.
5. Credit/debit note issue.
6. Fiscal year close/reopen.

---

## 13. Rollout Plan

### Phase 1: Requirement Confirmation

1. Collect official IRD electronic invoicing procedure documents and sample compliance checklist.
2. Confirm whether target schools/colleges need simple receipts, formal invoices, VAT invoices, or electronic invoice reporting.
3. Confirm education-service tax treatment with Nepal tax advisor before enabling VAT workflows.
4. Confirm CBMS technical access path.
5. Confirm UGC/HEMIS fields with a pilot college/campus.
6. Collect real HEMIS portal screenshots/forms from authorized institution users.

### Phase 2: Shared Compliance Foundation

1. Institution compliance profile.
2. Fiscal year setup.
3. BS/AD date support.
4. Audit logging.
5. File Registry export storage.
6. Validation engine.
7. Report run history.

### Phase 3: IRD-Ready Billing

1. Billing mode setting.
2. Invoice sequence engine.
3. Immutable tax invoice table.
4. Invoice PDF generation.
5. Duplicate reprint marking.
6. Cancellation workflow.
7. Credit note workflow.
8. Debit note workflow.
9. M11 accounting handoff.
10. CBMS-ready payload/export log.

### Phase 4: UGC/HEMIS-Ready Reporting

1. Higher education institution profile.
2. University/faculty/program/level model.
3. Student statistics.
4. Staff statistics.
5. Scholarship records.
6. HEMIS validation.
7. Export generator.
8. Submission history.

### Phase 5: Official Verification / Integration

1. IRD review and approval path.
2. CBMS sandbox/production adapter if official access exists.
3. Pilot college HEMIS export validation.
4. UGC/HEMIS API integration only if UGC provides a supported integration mechanism.

---

## 14. Acceptance Criteria

### 14.1 M15 Education Compliance

1. Tenant admin can complete institution compliance profile.
2. College tenant can configure higher education programs and levels.
3. Compliance dashboard displays missing-data errors and warnings.
4. HEMIS report generation fails when ERROR validations remain unresolved.
5. Exported files are stored through protected File Registry flow.
6. Submission history records generated, exported, submitted, rejected, and archived states.
7. Parent/student users cannot access compliance reports.
8. Platform support override requires reason and audit.

### 14.2 M3B IRD Billing Compliance

1. Tenant can select billing mode by permission.
2. Tax invoice issue allocates a fiscal-year sequence number transactionally.
3. Issued invoice becomes immutable.
4. Direct edit/delete of issued invoice is blocked.
5. Cancel, credit note, and debit note require reason and audit.
6. Reprint shows copy/duplicate status and does not issue a new invoice number.
7. CBMS submission log distinguishes queued, sent, accepted, rejected, failed, and retrying.
8. M11 owns accounting posting and period lock enforcement.
9. Parent copy excludes internal accounting notes.
10. Every money-impacting command is idempotent.

---

## 15. Implementation Guardrails

1. Do not implement live UGC/HEMIS submission without official access.
2. Do not claim IRD verification without approval evidence.
3. Do not allow frontend-calculated money totals to become official.
4. Do not expose raw storage keys, provider URLs, or persistent signed URLs for compliance files.
5. Do not allow cross-tenant sequence, invoice, report, or export access.
6. Do not silently edit issued financial documents.
7. Do not add M15 dashboards with fake metrics before backend summary endpoints exist.
8. Do not collect sensitive demographic/category data unless tenant policy, law, and reporting need justify it.
9. Do not conflate iEMIS and UGC/HEMIS.
10. Do not bypass M11 for official accounting entries.
