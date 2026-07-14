import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(webRoot, path), 'utf8');

describe('Student profile edit controls', () => {
  it('loads student photos through the protected binary endpoint', () => {
    const api = read('lib/api/students.ts');
    const preview = read('components/students/profile/student-photo-preview.tsx');
    const protectedImageHook = read('lib/hooks/use-protected-image.ts');
    const edit = read('components/students/profile/student-edit-card.tsx');
    assert.match(api, /photo\/content/);
    assert.match(preview, /getStudentPhotoBlob/);
    // The blob -> object URL lifecycle is shared via useProtectedImage rather
    // than duplicated per component.
    assert.match(preview, /useProtectedImage/);
    assert.match(protectedImageHook, /URL\.createObjectURL/);
    assert.match(edit, /StudentPhotoPreview/);
    assert.doesNotMatch(edit, /src=\{student\.photoUrl\}/);
    assert.doesNotMatch(edit, /photoVersion=\{student\.photoUrl\}/);
  });

  it('uses clean accessible disability option controls instead of native radio inputs', () => {
    const edit = read('components/students/profile/student-edit-card.tsx');
    assert.match(edit, /DisabilityOption/);
    assert.match(edit, /role="radiogroup"/);
    assert.match(edit, /No known disability/);
    assert.match(edit, /Disability support recorded/);
    assert.doesNotMatch(edit, /type="radio"/);
  });

  it('keeps guardian unlinking reasoned, primary-safe, and file-access reviewed', () => {
    const detail = read('components/students/student-detail-page.tsx');
    const guardians = read('components/students/profile/tabs/guardians-tab.tsx');

    assert.match(detail, /confirmFileAccessReview: true/);
    assert.match(detail, /confirmFileAccessReview,/);
    assert.match(detail, /newPrimaryGuardianId/);
    assert.match(guardians, /Add guardian/);
    assert.match(guardians, /forcePrimary=\{guardians\.length === 0\}/);
    assert.match(guardians, /Primary Contact Guardian required for first guardian/);
    assert.match(guardians, /New primary guardian/);
    assert.match(guardians, /replacementGuardianId/);
    assert.match(guardians, /confirmedAccessReview/);
    assert.match(guardians, /I reviewed guardian portal and protected-file access/);
    assert.match(guardians, /reason\.trim\(\)\.length < 5/);
    assert.doesNotMatch(guardians, /window\.confirm|confirm\(/);
  });

  it('keeps generated document revocation reasoned and backend-backed', () => {
    const documents = read('components/students/profile/tabs/documents-tab.tsx');
    const api = read('lib/api/students.ts');

    assert.match(api, /revokeGeneratedStudentDocument:/);
    assert.match(documents, /api\.revokeGeneratedStudentDocument\(studentId, documentId, \{ reason \}\)/);
    assert.match(documents, /generatedDocumentRevokeReason\.trim\(\)\.length < 5/);
    assert.match(documents, /Revoke generated document/);
    assert.match(documents, /Version history/);
    assert.match(documents, /revokedAt/);
    assert.match(documents, /queryKey: \['student-profile', studentId\]/);
    assert.match(documents, /keep its audit history/);
    assert.doesNotMatch(documents, /window\.confirm|confirm\(/);
    assert.doesNotMatch(documents, /storageObjectKey|pdfUrl/);
    assert.doesNotMatch(documents, /delete history/);
  });
});
