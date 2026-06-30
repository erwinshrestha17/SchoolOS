# SchoolOS Marketing and Compliance Claims Policy

**Status:** Active supporting policy
**Owner/audience:** Product owner, sales, partnerships, support, marketing, demo presenters, and implementation leads
**Scope:** Public copy, proposals, sales conversations, product demos, training, partner materials, pilot agreements, and support language that mention fees, scholarships, discounts, receipts, reversals, reporting, compliance, audit, or regulators.
**Precedence:** This policy governs external claim language only. Product intent remains in `SCHOOLOS_BRD.md`; functional and technical truth remain in the PRD/FRS/SRS/SDD/MDD, OpenAPI, code, tests, and release evidence. Current readiness remains owned by `../project/SCHOOLOS_PRODUCTION_READINESS_AUDIT.md`.
**Last reviewed date:** 2026-07-01

---

## 1. Policy Decision

SchoolOS may be positioned around **clear, traceable, and auditable operational records** for fees, scholarships, discounts, receipts, reversals, parent explanations, and related school workflows.

SchoolOS must not claim that a school is legally compliant, regulator-approved, immune from enforcement, or guaranteed to meet every municipality's fee, scholarship, tax, education-reporting, or other legal requirement.

Core external message:

> SchoolOS helps schools keep clear, traceable records for fees, scholarships, discounts, receipts, and reversals so staff can explain records to parents and prepare evidence faster when management or authorities ask.

This is a product-positioning statement, not legal advice or a legal-compliance certification.

---

## 2. Allowed Language

Use only where the described capability exists for the customer plan, tenant configuration, and release stage:

- traceable records
- auditable workflow history
- audit-ready operational evidence
- clear parent-facing explanations
- configured fee headings and effective-date history
- recorded scholarship and discount application
- reasoned receipt correction, reversal, or refund trail
- permission-controlled access
- tenant-scoped records
- configurable workflows
- helps prepare records faster
- helps reduce manual reconciliation and fee-query handling

Preferred example:

> SchoolOS gives authorized school staff a clear record of configured charges, discounts, scholarships, receipts, and reversals, with parent-facing explanations and auditable history where the workflow is enabled.

---

## 3. Prohibited Language

Do not use these claims in any form unless a qualified legal review has approved the exact statement for a named jurisdiction and product configuration:

- legally compliant
- fully compliant
- guaranteed compliance
- regulator-certified or government-approved
- automatically compliant with every rule
- prevents fines, investigations, refunds, or disputes
- dispute-proof fees
- legally correct fee headings by default
- certified scholarship compliance
- replaces legal, finance, tax, or local-government advice

Do not imply that use of SchoolOS transfers legal, policy, fee-setting, scholarship-allocation, or reporting responsibility from the school to SchoolOS.

---

## 4. Required Qualifier

Where a sales, marketing, proposal, or pilot discussion materially refers to fee, scholarship, reporting, or compliance evidence, include this qualifier in plain language:

> SchoolOS provides operational records and controls. The school remains responsible for its own policies, approvals, legal obligations, and applicable local-government requirements.

For written proposals or pilot agreements, include the qualifier near the relevant claim, not only in general terms at the end.

---

## 5. Evidence Before a Claim

1. Do not claim a workflow is available until its tenant entitlement, backend contract, and user-facing route are confirmed.
2. Do not claim delivery through SMS, email, push, payment, storage, or other providers unless the relevant provider is configured and verified for the intended environment.
3. Do not use screenshots, seeded data, mock delivery logs, or local-only verification as evidence that a workflow is production-ready.
4. Use the exact readiness language from `../production/SCHOOLOS_GA_RELEASE_POLICY.md`; local tests or a demo do not establish pilot, production, or GA readiness.
5. Do not say that a report or export satisfies an authority's required format unless that specific format, configuration, and release evidence have been verified.
6. If an implementation, provider, or local-rule interpretation is unknown, say so and record the next verification action rather than making a reassuring assumption.

---

## 6. Fee, Scholarship, and Parent-Trust Claims

The first commercial wedge for School (Grade 1-10) may emphasize fee transparency and parent trust without creating a separate compliance module.

Allowed proof-oriented themes:

```text
Configured fee headings
+ approval/effective-date record where enabled
+ scholarship and discount record
+ clear receipt breakdown
+ reversal/refund history
+ protected, permission-controlled evidence access
```

Before presenting this as a paid pilot promise, the sold tenant slice must satisfy the risk and live-proof gates in `../project/SCHOOLOS_PILOT_RISK_EVIDENCE_MATRIX.md`.

---

## 7. Review and Escalation

- The product owner reviews new positioning, proposal templates, and landing-page copy against this policy.
- Any statement about law, tax, government approval, municipality-specific rules, or compulsory fee/scholarship treatment requires review by a qualified local adviser before publication.
- Sales, partnerships, and support must correct a prohibited or unsupported claim promptly and record the correction where it affected a customer decision.
- Product feedback may identify a need for a new configurable workflow, but a sales request must not be converted into a legal promise or an unverified implementation claim.

---

## 8. Quick Check Before Publishing or Presenting

```text
[ ] Is the statement describing a real, verified capability for this tenant and release stage?
[ ] Does it avoid words such as compliant, guaranteed, approved, certified, or prevents enforcement?
[ ] Does it distinguish SchoolOS operational evidence from the school's legal responsibility?
[ ] Does it state provider mode honestly where delivery is involved?
[ ] Does it avoid exposing another tenant's, student's, guardian's, or staff member's data?
[ ] Has a qualified local adviser reviewed any jurisdiction-specific legal statement?
```
