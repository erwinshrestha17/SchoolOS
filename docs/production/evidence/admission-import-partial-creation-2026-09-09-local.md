# Admission import partial creation evidence

Date: 2026-09-09. Local unit and type-check evidence only.

Admission creation commits the student and enrollment before processing finance
and document side effects. A later failure previously produced a failed import
row without the committed student identity.

The failure path now looks up the exact tenant and row operation ID and retains
the existing student identity in the result and persisted import row. The web
result links to that student and explains that follow-up processing needs review.
The successful-row counter is labelled Completed to avoid implying failed rows
could not have created a student.

Verification: admissions service 40/40 tests passed, including the new partial
creation regression; API and web TypeScript checks passed; touched web component
lint reported no errors; git diff check passed.

This is a partial recovery improvement. Durable batch resume after process loss,
operator access to persisted row detail, and explicit compensation remain open.
No batch rollback or production-readiness claim is made. Browser verification of
the new result panel remains pending.
