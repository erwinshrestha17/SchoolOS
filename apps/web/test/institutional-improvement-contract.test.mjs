import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const webRoot = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, webRoot), 'utf8');

describe('Stage 4 institutional-improvement web contract', () => {
  it('connects teacher development to reasoned, versioned, protected workflows', () => {
    const route = read(
      'app/dashboard/hr/teacher-development/page.tsx',
    );
    const workspace = read(
      'components/hr/teacher-development-workspace.tsx',
    );
    const api = read('lib/api/institutional-improvement.ts');

    assert.match(route, /TeacherDevelopmentWorkspace/);
    assert.match(workspace, /expectedVersion/);
    assert.match(workspace, /reason/);
    assert.match(workspace, /clientRequestId: crypto\.randomUUID\(\)/);
    assert.match(workspace, /formatBsDate/);
    assert.match(workspace, /ProtectedFileButton/);
    assert.match(workspace, /["']institutional-improvement["']/);
    assert.match(api, /teacher-development\/observations/);
    assert.match(api, /teacher-development\/goals/);
    assert.match(api, /teacher-development\/training/);
    assert.doesNotMatch(workspace, /toLocaleDateString|toLocaleString/);
  });

  it('keeps school improvement plans server-paginated and auditable', () => {
    const route = read(
      'app/dashboard/reports/school-improvement/page.tsx',
    );
    const workspace = read(
      'components/reports/school-improvement-workspace.tsx',
    );
    const api = read('lib/api/institutional-improvement.ts');

    assert.match(route, /SchoolImprovementWorkspace/);
    assert.match(workspace, /page, limit: 20/);
    assert.match(workspace, /expectedVersion/);
    assert.match(workspace, /clientRequestId: crypto\.randomUUID\(\)/);
    assert.match(workspace, /Reason for change/);
    assert.match(workspace, /ProtectedFileButton/);
    assert.match(workspace, /formatBsDate/);
    assert.match(api, /school-improvement\/plans/);
    assert.match(api, /school-improvement\/actions/);
    assert.match(api, /\/reviews/);
    assert.doesNotMatch(workspace, /toLocaleDateString|toLocaleString/);
  });

  it('presents board readiness as explainable operational checks, not predictions', () => {
    const route = read(
      'app/dashboard/academics/board-readiness/page.tsx',
    );
    const workspace = read(
      'components/academics/board-readiness-workspace.tsx',
    );
    const tabs = read('components/academics/academics-tabs.tsx');
    const api = read('lib/api/institutional-improvement.ts');

    assert.match(route, /BoardReadinessWorkspace/);
    assert.match(tabs, /\/dashboard\/academics\/board-readiness/);
    assert.match(workspace, /Grade 8/);
    assert.match(workspace, /SEE/);
    assert.match(workspace, /Grade 12/);
    assert.match(workspace, /not predictions/i);
    assert.match(workspace, /sourceStates/);
    assert.match(workspace, /Count unavailable/);
    assert.match(workspace, /PermissionDenied/);
    assert.match(workspace, /LoadingState/);
    assert.match(workspace, /EmptyState/);
    assert.match(workspace, /ErrorState/);
    assert.match(api, /board-exam-readiness/);
    assert.doesNotMatch(workspace, /predicted score|pass probability|AI risk/i);
  });
});
