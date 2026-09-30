import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(webRoot, path), 'utf8');

describe('Admissions workspaces follow ASTRA M1-A / M1-B (Phase 5)', () => {
  const pipeline = read('components/admissions/admissions-pipeline.tsx');
  const queues = read('components/m1/admission-case-queues.tsx');
  const age = read('lib/queue-age.ts');
  const summary = read('components/ui/summary-card.tsx');

  it('applications table has the spec columns', () => {
    const headers = [
      ...pipeline.matchAll(/<th className="px-4 py-3">([^<]+)<\/th>/g),
    ].map((match) => match[1]);
    assert.deepEqual(headers, [
      'Applicant',
      'Application ID',
      'Applying for',
      'Stage',
      'Documents',
      'Assessment',
      'Submitted',
      'Owner',
    ]);
  });

  it('applications filters are server-side: year, class, stage, documents, reviewer', () => {
    for (const label of [
      'Filter by academic year',
      'Filter by applying class',
      'Filter by application stage',
      'Filter by document state',
      'Filter by assigned reviewer',
    ]) {
      assert.match(pipeline, new RegExp(`aria-label="${label}"`));
    }
    for (const param of [
      'academicYearId:',
      'documentState:',
      'reviewer:',
      'classId:',
      'status:',
    ]) {
      assert.ok(
        pipeline.includes(`api.listAdmissionApplications({`) &&
          pipeline.includes(param),
        `${param} must be sent to the server`,
      );
    }
    // Rows never fall back to client-side filtering of loaded items.
    assert.doesNotMatch(pipeline, /applications\.filter\(/);
  });

  it('queue table shows age since submission, flagged only for open work', () => {
    assert.match(queues, /<TableHead className="px-4">Age<\/TableHead>/);
    assert.match(queues, /submittedAt=\{item\.createdAt\}/);
    assert.match(
      queues,
      /CLOSED_QUEUES = new Set<AdmissionCaseQueue>\(\[\s*'COMPLETED',\s*'NOT_ADMITTED',?\s*\]\)/,
    );
    assert.match(
      age,
      /days >= 14 \? 'overdue' : days >= 7 \? 'pending' : 'none'/,
    );
  });

  it('the strip is a variant of the canonical SummaryGrid, default grid unchanged', () => {
    assert.match(summary, /variant = 'grid'/);
    assert.match(summary, /grid gap-4 sm:grid-cols-2 xl:grid-cols-4/);
    assert.match(summary, /SummaryVariantContext/);
  });
});
