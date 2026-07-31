import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(join(webRoot, relativePath), 'utf8');
}

describe('Service requests Action Centre contracts', () => {
  it('uses real service-request APIs and no fake queue data', () => {
    const apiClient = read('lib/api/service-requests.ts');
    const workspace = read('components/service-requests/service-requests-workspace.tsx');

    assert.match(apiClient, /\/service-requests/);
    assert.match(apiClient, /listServiceRequests/);
    assert.match(apiClient, /getServiceRequest/);
    assert.match(apiClient, /triageServiceRequest/);
    assert.match(apiClient, /resolveServiceRequest/);
    assert.match(apiClient, /escalateServiceRequest/);
    assert.match(workspace, /serviceRequestsApi\.listServiceRequests/);
    assert.match(workspace, /serviceRequestsApi\.getServiceRequest/);
    assert.doesNotMatch(workspace, /mockRequests|fakeRequests|placeholderData/);
    assert.match(
      workspace,
      /Independent review required: the requester or current assignee cannot close this case/,
    );
  });

  it('registers Action Centre routes, navigation, and permission gates', () => {
    const layout = read('app/dashboard/layout.tsx');
    const sidebar = read('components/layout/sidebar.tsx');
    const listPage = read('app/dashboard/service-requests/page.tsx');
    const detailPage = read('app/dashboard/service-requests/[requestId]/page.tsx');

    assert.match(layout, /\/dashboard\/service-requests/);
    assert.match(layout, /service_requests:read/);
    assert.match(sidebar, /\/dashboard\/service-requests/);
    assert.match(sidebar, /Action Centre/);
    assert.match(listPage, /ServiceRequestsQueueWorkspace/);
    assert.match(detailPage, /ServiceRequestDetailWorkspace/);
  });
});
