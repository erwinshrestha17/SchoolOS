# P0-07 Wrong-Child Prevention (2026-07-31, local)

Status: **PARTIAL (local development complete for mobile confirmation payloads + existing server assert; not staging / controlled-pilot validated)**

## Implementation completed

- Parent mobile payment, sandbox payment/top-up, service-request create, and consent decision payloads now send `confirmStudentId`.
- Consent UI shows the selected child name in the confirmation dialog and blocks submission without a selected child.
- Server-side `assertConfirmStudentId` contract tests cover match / missing / mismatch.

## Honest posture

Server confirmation was already required on several high-impact routes; this slice closes the mobile omission gap. Authenticated browser/device multi-child proof remains P0-15.
