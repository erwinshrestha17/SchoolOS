# M3B IRD Billing Compliance — Frontend Web Design Reference

**Status:** Planned M3 extension frontend design reference.  
**Updated:** 2026-06-22  
**Module:** M3B IRD Billing Compliance, extending M3 Fees and Receipts  
**Master web source:** `docs/design/SCHOOLOS_WEB_FRONTEND_DESIGN_PLAN.md`  
**Product companion:** `docs/product/SCHOOLOS_EDUCATION_COMPLIANCE_IRD_BILLING_SPEC.md`  
**Backend contract rule:** Backend/OpenAPI/shared contracts remain authoritative.

---

## 1. Module Purpose

M3B adds Nepal IRD-compliance-ready billing controls to SchoolOS finance workflows.

It extends M3 Fees and Receipts with billing compliance settings, formal invoice mode, fiscal-year invoice sequences, immutable tax invoices, credit/debit notes, cancellation workflows, duplicate reprint behavior, protected invoice PDFs, and CBMS-ready submission logs.

M3B must not bypass M11 Accounting and Finance. M11 remains the owner of chart of accounts, journals, fiscal periods, period locks, reconciliation, and accounting reports.

---

## 2. Feature List

### Billing Compliance Settings

**Purpose:** Configure institution tax identity and billing mode.

**Users:** Authorized accountant/admin.

**Frontend behavior:** Sectioned settings form for legal name, PAN, VAT status, invoice language, billing mode, CBMS mode, and IRD approval reference if verified.

**Backend alignment:** Backend validates sensitive settings and blocks unsafe changes after production invoices exist.

### Invoice Sequence Management

**Purpose:** Maintain fiscal-year and document-type invoice sequences.

**Users:** Authorized accountant/admin; platform override only with audit.

**Frontend behavior:** Sequence table by fiscal year and document type, locked status, next number preview, warning for production locks.

**Backend alignment:** Backend allocates numbers transactionally. Frontend never calculates official next number.

### Tax Invoice Preview and Issue

**Purpose:** Convert eligible fee invoice data into a formal immutable tax invoice.

**Users:** Cashier/accountant by permission.

**Frontend behavior:** Preview screen shows buyer, student, lines, taxable/non-taxable amounts, VAT, total, and sequence policy before issue.

**Backend alignment:** Backend owns preview calculation, final sequence allocation, invoice lock, PDF generation, and M11 handoff.

### Tax Invoice List and Detail

**Purpose:** Search, review, print/reprint, and inspect issued tax invoices.

**Users:** Finance roles, principal by permission, parent child-scoped copy where policy allows.

**Frontend behavior:** Paginated table with status, invoice number, buyer, student, total, issue date, CBMS state, and right drawer/detail page.

**Backend alignment:** Backend owns filtering, totals, status, and protected PDF links.

### Invoice Cancellation

**Purpose:** Cancel eligible invoices without deleting or reusing invoice numbers.

**Users:** Authorized accountant/approver.

**Frontend behavior:** Confirmation dialog with original invoice context, reason, effect summary, and approval state where required.

**Backend alignment:** Backend validates eligibility, records reason/audit, updates status, and emits M11/CBMS events as needed.

### Credit Note / Debit Note

**Purpose:** Correct issued invoice amounts through formal adjustment documents.

**Users:** Authorized accountant/approver.

**Frontend behavior:** Wizard links to original invoice, captures reason and adjustment lines, previews total/tax impact, then issues note.

**Backend alignment:** Backend allocates note sequence, locks issued note, posts accounting event, and prepares CBMS payload/log.

### CBMS Logs and Retry

**Purpose:** Track electronic invoicing submission/export status.

**Users:** Accountant/admin by permission.

**Frontend behavior:** Log table with queued/sent/accepted/rejected/failed/retrying status, safe error summary, retry/export actions.

**Backend alignment:** Backend owns adapter status, request/response hash, retry logic, provider secrets, and audit.

### Parent Invoice Copy

**Purpose:** Let a guardian view allowed child-scoped receipt/invoice copies.

**Users:** Parent.

**Frontend behavior:** Simple fee/receipt/invoice copy view with protected download and payment status.

**Backend alignment:** Parent API must be child-scoped and must exclude internal accounting notes, CBMS internals, and cashier-only fields.

---

## 3. Personas and Boundaries

| Persona | Can access | Must not access |
|---|---|---|
| Accountant | Settings, sequences, invoices, notes, CBMS logs, audit | Other tenants, raw provider secrets, unauthorized sequence reset |
| Cashier | Issue allowed invoices, view/reprint receipts/invoices | Tax settings, sequence management, CBMS retry unless allowed |
| Principal | Summary and approval queues by permission | Provider secrets, raw accounting journals unless finance permission allows |
| Parent | Linked-child invoice/receipt copy | Sequence, CBMS logs, internal notes, other children |
| Platform support | Audited override only | Silent data repair, cross-tenant browsing without reason |

---

## 4. Route Map

Planning routes; confirm against router and OpenAPI before implementation.

```text
/dashboard/finance/billing-compliance
/dashboard/finance/billing-compliance/settings
/dashboard/finance/billing-compliance/sequences
/dashboard/finance/tax-invoices
/dashboard/finance/tax-invoices/[invoiceId]
/dashboard/finance/tax-invoices/[invoiceId]/credit-note
/dashboard/finance/tax-invoices/[invoiceId]/debit-note
/dashboard/finance/cbms-logs
/parent/children/[studentId]/invoices
```

---

## 5. Screen Specifications

### 5.1 Billing Compliance Settings

**Purpose:** Configure tenant billing mode and legal/tax identity.

**Layout:** Module header, mode selector, legal identity form, PAN/VAT section, invoice language section, CBMS mode section, approval evidence section, audit timeline.

**Header actions:** Save, Validate settings, View audit.

**Confirmations:** Changing billing mode, PAN/VAT fields, CBMS mode, or approval reference after first invoice requires reason and confirmation.

**Backend data needed:** Current settings, first-issued-invoice flag, allowed modes, validation errors, audit history.

**States:** No settings, locked after production use, invalid PAN/VAT format, missing fiscal year, permission denied.

### 5.2 Invoice Sequences

**Purpose:** Manage fiscal-year sequence configuration safely.

**Layout:** Filter by fiscal year and sequence type, table of prefix/current number/padding/locked state, right drawer for sequence detail and audit.

**Header actions:** New sequence, Lock sequence, View usage.

**Confirmations:** Sequence creation/change after invoice issue requires high-risk confirmation or must be blocked.

**Backend data needed:** Paginated sequences, usage count, lock state, audit trail.

**Security:** Frontend displays backend-provided next number only as preview; final allocation is backend-only.

### 5.3 Tax Invoice Preview / Issue

**Purpose:** Review formal tax invoice before issuing immutable document.

**Layout:** Student/buyer context, invoice lines, taxable/non-taxable totals, VAT, total, payment state, sequence policy, final confirmation panel.

**Header actions:** Issue tax invoice, Cancel.

**Confirmations:** Final issue confirmation must show buyer, student, invoice source, total, fiscal year, sequence policy, and irreversible lock warning.

**Backend data needed:** Preview payload, eligibility, exact decimal totals, tax treatment, final issue endpoint.

**Protected files:** No final invoice PDF before issue. After issue, protected PDF is generated from immutable snapshot.

### 5.4 Tax Invoice List

**Purpose:** Search and operate on issued/draft/cancelled/credited tax invoices.

**Layout:** KPI strip, filters, paginated table, detail drawer.

**Filters:** Fiscal year, status, class/section, student, buyer, invoice number, CBMS status, date range.

**KPI cards:** Issued, cancelled, credited, CBMS rejected, pending export.

**Backend data needed:** Backend-owned totals, invoice list, as-of timestamp.

**Actions:** View, Reprint, Cancel where eligible, Credit note, Debit note, Export.

### 5.5 Tax Invoice Detail

**Purpose:** Show immutable invoice snapshot and related actions.

**Layout:** Header status, invoice summary, buyer/student details, line table, tax totals, PDF actions, note/cancellation chain, M11 handoff, CBMS state, audit timeline.

**Actions:** Reprint, Cancel, Issue credit note, Issue debit note, Retry CBMS where allowed.

**Boundary:** No edit button for issued invoice.

### 5.6 Credit/Debit Note Wizard

**Purpose:** Create formal adjustment note linked to original invoice.

**Layout:** Step 1 original invoice context, step 2 reason and lines, step 3 impact preview, step 4 issue confirmation.

**Confirmations:** Must show original invoice number, note type, reason, tax impact, total impact, and irreversible lock warning.

**Backend data needed:** Eligibility, preview totals, sequence preview, issue endpoint.

### 5.7 CBMS Logs

**Purpose:** Track electronic invoicing submission/export lifecycle.

**Layout:** Filter bar, status cards, paginated logs, right drawer for safe error detail.

**Filters:** Status, document type, fiscal year, invoice number, attempt date.

**Actions:** Retry, Export payload, View document.

**Security:** Do not show raw secrets, tokens, full provider credentials, or unsafe raw payloads in UI.

---

## 6. Component Plan

| Component | Use |
|---|---|
| `BillingModeBadge` | Displays simple/formal/IRD-compliant mode. |
| `InvoiceSequenceTable` | Lists sequence state and usage. |
| `TaxInvoicePreviewPanel` | Shows exact backend totals before issue. |
| `ImmutableInvoiceNotice` | Explains issued invoice lock. |
| `AdjustmentNoteWizard` | Credit/debit note workflow. |
| `CBMSStatusBadge` | Shows queued/sent/accepted/rejected/failed/retrying. |
| `ProtectedInvoicePdfButton` | Opens protected PDF copy/reprint. |
| `FinanceAuditTimeline` | Shows settings, issue, cancel, note, retry events. |

---

## 7. State Matrix

| State | UI behavior |
|---|---|
| Billing mode disabled | Show setup CTA if permission allows. |
| Formal/IRD mode locked | Disable unsafe setting changes and show lock reason. |
| Missing sequence | Block issue and link to sequence setup. |
| Preview valid | Enable issue action. |
| Preview invalid | Show backend validation errors. |
| Issue pending | Disable duplicate submit. |
| Issued | Show immutable snapshot and protected PDF. |
| Cancelled | Show cancellation reason and original number preserved. |
| Credited/partially credited | Show adjustment chain. |
| CBMS rejected | Show safe error and retry/export options by permission. |
| File unavailable | Show protected-file unavailable state. |

---

## 8. Security and Financial Controls

1. Every mutation is tenant-scoped.
2. Money values and totals are backend-owned.
3. Final invoice issue is idempotent.
4. Invoice number allocation is transactional.
5. Issued invoice is immutable.
6. No direct delete for issued documents.
7. Reprints are marked copy/duplicate and do not consume new sequence.
8. Credit/debit notes require reason and audit.
9. CBMS retry requires permission, reason, and audit.
10. Parent copies are child-scoped and sanitized.
11. Raw provider secrets and persistent signed URLs must never render in browser.
12. M11 owns official accounting posting.

---

## 9. Nepal-Specific Requirements

1. NPR formatting and exact decimal display.
2. Nepali fiscal year support.
3. BS/AD date display where backend provides both.
4. Institution PAN/VAT fields.
5. Formal invoice/copy/duplicate print labels.
6. English/Nepali/bilingual invoice language option.
7. CBMS-ready status and export mode, but no official certification claim without evidence.
8. Cash-heavy cashier workflow remains supported for schools not ready for full IRD mode.

---

## 10. Done Definition

M3B frontend is ready only when:

1. Every amount comes from backend/OpenAPI.
2. No official invoice number is generated in browser.
3. Issued invoices have no edit route.
4. Credit/debit/cancel workflows require reason and audit.
5. Protected PDFs use File Registry helpers.
6. CBMS status is backend-owned.
7. Parent views are child-scoped.
8. M11 handoff status is visible but not directly writable from M3B UI.
9. All permission, locked, error, queued, stale, partial-failure, and file-unavailable states exist.
10. UI text says IRD-ready or CBMS-ready unless official verification evidence is configured.
