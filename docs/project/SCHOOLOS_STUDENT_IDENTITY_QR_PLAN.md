# SchoolOS Student Identity QR Plan

## Purpose

This document records the approved Student Identity direction for SchoolOS.

SchoolOS will use a QR-based student identity foundation before implementing any biometric workflows. Biometrics are intentionally deferred because they involve sensitive child data, hardware cost, guardian consent complexity, and stronger privacy/security obligations.

## Approved Decision

```text
Implement now / near-term:
- Immutable Student ID code generated during student registration/admission.
- Revocable QR credential per student.
- QR code on student ID cards.
- Authenticated QR scan/resolve API.
- Reuse QR identity in Library, Canteen, optional Transport, and parent/mobile views.

Do not implement now:
- Fingerprint registration.
- Face scan registration.
- Biometric attendance.
- Biometric canteen access.
- Biometric library access.
- Storage or processing of biometric templates.
```

## Ownership

Student QR identity is an **M1 Admissions & Student Profiles foundation**, not a Library-only or Canteen-only feature.

```text
M1 Student Identity Foundation owns:
- Immutable student code.
- Student QR credential lifecycle.
- QR generation/rotation/revocation.
- QR scan/resolve security boundary.
- QR block on student ID card.

M8A Library consumes it.
M8C Canteen consumes it.
M8B Transport may consume it where useful.
M10 Notifications reacts to wallet, overdue, boarding/drop, and parent-visible events.
M3/M9 handle money/accounting impact for wallet, fines, and corrections.
```

## Phase Placement

### Phase 2 Stabilization / Cross-Module Foundation

Implement the reusable identity layer before deeper Phase 3 workflows depend on it.

Scope:

```text
1. Confirm immutable Student ID code is generated during registration/admission.
2. Add StudentQrCredential model.
3. Generate QR credential for each admitted/active student.
4. Add QR image generation endpoint for ID cards and student profile.
5. Add QR to student ID card PDF.
6. Add QR rotate/revoke actions for lost or damaged cards.
7. Add authenticated QR scan/resolve API.
8. Add purpose-based scan responses: LIBRARY, CANTEEN, TRANSPORT, ATTENDANCE, GENERAL_STUDENT_LOOKUP.
9. Add audit logs for generate, rotate, revoke, resolve, and scan actions.
10. Add permission and tenant-isolation tests.
```

### Phase 3A — Library Usage

Use student QR to identify borrowers during issue/return workflows.

Scope:

```text
1. Add Scan Student ID action to Library issue/return screens.
2. Resolve student through the shared QR scan API.
3. Show library-safe student data only.
4. Link borrower to issue/return workflow.
5. Keep copy barcode/QR separate from student QR.
6. Notify parents for overdue reminders later through M10.
```

### Phase 3C — Canteen Wallet and QR Purchase Usage

Use student QR for wallet-based snack/meal purchase and meal serving.

Scope:

```text
1. Student canteen wallet.
2. Immutable wallet transaction ledger.
3. Parent/manual top-up.
4. POS item catalog and sales counter.
5. QR scan student lookup at canteen counter.
6. Wallet deduction after confirmed sale.
7. Duplicate meal serving prevention.
8. Parent spending limits and blocked categories/items.
9. Allergy/dietary warning before serving or selling restricted items.
10. Parent notification after purchase or low balance.
```

### Phase 3D — Parent/Mobile Expansion

Expose wallet and consumption visibility to parents.

Scope:

```text
1. Parent can view child wallet balance.
2. Parent can view canteen purchase history.
3. Parent can top up wallet where payment/manual counter flow is enabled.
4. Parent can set spending limits.
5. Parent can block item/category purchases where school policy allows.
6. Parent receives low-balance and purchase notifications.
7. Parent sees library borrowed/overdue books later.
```

## Security Rules

```text
- QR must not contain student name, guardian phone, address, health data, wallet balance, or other PII.
- QR should contain only a random secure token or URL containing a token.
- Store only token hash in the database.
- QR scan must require authentication.
- QR scan must be tenant-scoped by tenantId.
- QR scan response must be purpose-specific and role-limited.
- Parents can only resolve their own child.
- Teachers can only resolve assigned students unless permission allows more.
- Canteen staff can only see canteen-safe data.
- Librarians can only see library-safe data.
- Transport drivers can only see assigned-route students.
- Admin/principal access remains tenant-scoped and audited.
- QR credentials must be revocable and rotatable.
```

## Suggested Data Model

```prisma
model StudentQrCredential {
  id            String          @id @default(cuid())
  tenantId      String
  studentId     String
  tokenHash     String
  status        StudentQrStatus @default(ACTIVE)
  createdAt     DateTime        @default(now())
  rotatedAt     DateTime?
  revokedAt     DateTime?
  lastScannedAt DateTime?

  student       Student         @relation(fields: [studentId], references: [id])

  @@unique([tenantId, studentId])
  @@unique([tokenHash])
  @@index([tenantId, studentId])
  @@index([tenantId, status])
}

enum StudentQrStatus {
  ACTIVE
  REVOKED
}
```

## Suggested APIs

```text
POST /api/v1/students/:studentId/qr
Generate QR credential when missing.

POST /api/v1/students/:studentId/qr/rotate
Rotate QR credential for lost/damaged ID card.

POST /api/v1/students/:studentId/qr/revoke
Revoke QR credential.

GET /api/v1/students/:studentId/qr-image
Return QR PNG/SVG for ID card/profile after permission check.

POST /api/v1/students/qr/resolve
Resolve scanned QR token for a declared purpose.
```

## Purpose-Based Scan Responses

### Canteen

```json
{
  "studentId": "stu_123",
  "studentCode": "SCH-2082-000123",
  "name": "Aarav Sharma",
  "classSection": "Class 3 - A",
  "photoUrl": "signed-url-if-allowed",
  "walletBalance": "500.00",
  "allergyWarnings": ["Peanuts"],
  "canPurchase": true
}
```

### Library

```json
{
  "studentId": "stu_123",
  "studentCode": "SCH-2082-000123",
  "name": "Aarav Sharma",
  "classSection": "Class 3 - A",
  "activeIssues": 2,
  "overdueBooks": 0,
  "canBorrow": true
}
```

## Canteen Wallet Rules

Use immutable wallet movements. Do not silently edit balances.

```text
TOP_UP      +500
PURCHASE     -80
REFUND       +80
CORRECTION   -20
```

Confirmed financial events must later post through M9 Accounting boundaries.

```text
Wallet top-up: Dr Cash/Bank, Cr Student Canteen Wallet Liability.
Wallet purchase: Dr Student Canteen Wallet Liability, Cr Canteen Sales Income.
Cash POS sale: Dr Cash, Cr Canteen Sales Income.
Refund/correction: reversal/correction entry, not silent edit.
```

## Implementation Order

```text
1. Add this plan to project memory and phase structure.
2. Add StudentQrCredential model and indexes.
3. Generate QR credential during student registration/admission or first ID-card generation.
4. Add QR image generation service.
5. Add QR to student ID card PDF.
6. Add QR management actions in student detail page.
7. Add scan/resolve API with purpose-based response.
8. Add scan audit logs.
9. Add Library QR borrower lookup.
10. Add Canteen wallet ledger.
11. Add Canteen QR purchase flow.
12. Add Parent wallet and purchase history.
13. Add parent spending controls and notifications.
```

## Non-Goal

Biometrics are explicitly out of scope for the current roadmap. Revisit only after QR identity is stable, parent trust is established, legal/privacy rules are reviewed, and the product has strong consent, retention, encryption, audit, and deletion workflows.
