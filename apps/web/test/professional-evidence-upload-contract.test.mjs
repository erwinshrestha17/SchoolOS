import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(webRoot, path), 'utf8');

describe('Professional evidence inline upload contract (Phase 5L)', () => {
  const panel = read('components/hr/professional-identity-panel.tsx');

  it('uploads through the protected staff-document path, not a new store', () => {
    assert.match(panel, /<FileUploader[\s\S]{0,80}module="staff_documents"/);
    assert.match(panel, /api\.addStaffDocument\(staffId,/);
    assert.doesNotMatch(panel, /uploadFile\(|fetch\(/);
  });

  it('offers upload only to viewers who may manage staff documents', () => {
    assert.match(
      panel,
      /const canUploadDocuments = hasPermissions\(\['hr:documents:manage'\]\);/,
    );
    assert.match(panel, /\{canUploadDocuments \? \(/);
  });

  it('attaches the registered file as the evidence document, which stays PENDING', () => {
    assert.match(panel, /setDocumentId\(file\.fileId\)/);
    assert.match(panel, /name="documentId"/);
    assert.match(panel, /stays PENDING until a different HR reviewer/);
  });
});
