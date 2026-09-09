# P1-17 Nepal Timezone Validation — Local Evidence

Date: 2026-09-09  
Environment: local repository and unit doubles  
Evidence boundary: local backend validation only; this is not TLS staging, controlled-pilot, device, RC, or GA evidence.

## Change

- The legacy single-setting mutation and atomic settings-domain mutation both accept only `Asia/Kathmandu` for the tenant timezone.
- Values such as `UTC`, aliases, empty strings, and non-strings fail before persistence.
- The constraint follows SchoolOS's Nepal-only product boundary and protects attendance, payroll, fiscal-day, and notification scheduling semantics from tenant-supplied timezone drift.

## Verification

- Focused settings suites: 3 suites, 31 tests — PASS.
- API TypeScript check — PASS.

## Remaining boundary

- The school-profile address remains free text and is not claimed as remediated here.
- The settings workflow must still be repeated on certificate-verified TLS staging before any pilot or release claim.
