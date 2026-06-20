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
    const edit = read('components/students/profile/student-edit-card.tsx');
    assert.match(api, /photo\/content/);
    assert.match(preview, /getStudentPhotoBlob/);
    assert.match(preview, /URL\.createObjectURL/);
    assert.match(edit, /StudentPhotoPreview/);
    assert.doesNotMatch(edit, /src=\{student\.photoUrl\}/);
  });

  it('uses clean accessible disability option controls instead of native radio inputs', () => {
    const edit = read('components/students/profile/student-edit-card.tsx');
    assert.match(edit, /DisabilityOption/);
    assert.match(edit, /role="radiogroup"/);
    assert.match(edit, /No known disability/);
    assert.match(edit, /Disability support recorded/);
    assert.doesNotMatch(edit, /type="radio"/);
  });
});
