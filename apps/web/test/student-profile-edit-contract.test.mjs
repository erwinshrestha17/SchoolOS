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

  it('only submits authoritative enrollment placement when the operator changes it', () => {
    const edit = read('components/students/profile/student-edit-card.tsx');

    assert.match(edit, /const placementChanged =/);
    assert.match(edit, /classId !== activeEnrollment\.classId/);
    assert.match(
      edit,
      /\(sectionId \|\| null\) !== \(activeEnrollment\.sectionId \?\? null\)/,
    );
    assert.match(
      edit,
      /parsedRollNumber !== \(activeEnrollment\.rollNumber \?\? null\)/,
    );
    assert.match(edit, /\.\.\.\(placementChanged/);
    assert.doesNotMatch(edit, /\.\.\.\(activeEnrollment\s*\?\s*\{\s*classId/);
  });

  it('provides purpose-limited guardian authority, recovery, and revocation administration', () => {
    const detail = read('components/students/student-detail-page.tsx');
    const guardians = read('components/students/profile/tabs/guardians-tab.tsx');
    const api = read('lib/api/students.ts');

    assert.match(detail, /studentId=\{studentId\}/);
    assert.doesNotMatch(detail, /guardianRemoveMutation/);
    assert.match(guardians, /Link guardian/);
    assert.match(guardians, /forcePrimary=\{guardians\.length === 0\}/);
    assert.doesNotMatch(guardians, /Maximum 2 guardians|one or two active/);
    assert.match(guardians, /Parent-app capabilities/);
    assert.match(guardians, /Pilot-disabled actions/);
    assert.match(guardians, /Start date \(BS\)/);
    assert.match(guardians, /toGregorianDateFromBs/);
    assert.match(guardians, /Access & recovery/);
    assert.match(guardians, /Provision parent account/);
    assert.match(guardians, /Recent sessions and devices/);
    assert.match(guardians, /Recovery and relationship actions/);
    assert.match(guardians, /Decision reason/);
    assert.match(guardians, /Evidence reference/);
    assert.match(guardians, /SCHOOL_IDENTITY_REVIEW/);
    assert.match(guardians, /SUSPEND_COMPROMISED_ACCOUNT/);
    assert.match(guardians, /REVOKE_RELATIONSHIP/);
    assert.match(guardians, /MARK_DECEASED/);
    assert.match(guardians, /formatBsDate/);
    assert.doesNotMatch(guardians, /userAgent|ipAddress|tokenHash/);
    assert.doesNotMatch(guardians, /window\.confirm|confirm\(/);

    assert.match(api, /getGuardianAccessAdministration/);
    assert.match(api, /performGuardianRecoveryAction/);
    assert.match(api, /provisionGuardianAccount/);
    assert.match(api, /revokeGuardianSession/);
    assert.match(api, /createGuardianIdentityVerification/);
    assert.match(api, /reviewGuardianIdentityVerification/);
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
