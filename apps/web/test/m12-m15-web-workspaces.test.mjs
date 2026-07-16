import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(webRoot, path), 'utf8');

describe('M12 and M15 rendered web workspaces', () => {
  it('provides real routes for notices, queues, delivery operations, notifications, and preferences', () => {
    for (const path of [
      'app/dashboard/notices/page.tsx',
      'app/dashboard/notices/new/page.tsx',
      'app/dashboard/notices/[noticeId]/page.tsx',
      'app/dashboard/notices/[noticeId]/edit/page.tsx',
      'app/dashboard/notices/[noticeId]/review/page.tsx',
      'app/dashboard/notices/scheduled/page.tsx',
      'app/dashboard/notices/approvals/page.tsx',
      'app/dashboard/notices/deliveries/page.tsx',
      'app/dashboard/notices/failures/page.tsx',
      'app/dashboard/notifications/page.tsx',
      'app/dashboard/notifications/preferences/page.tsx',
    ]) {
      assert.equal(
        existsSync(join(webRoot, path)),
        true,
        `Missing route: ${path}`,
      );
    }
  });

  it('serializes server pagination and filters without deriving official totals from page length', () => {
    const list = read('components/notices/notice-list-workspace.tsx');
    const center = read(
      'components/notifications/notification-center-workspace.tsx',
    );
    const delivery = read(
      'components/notifications/delivery-operations-workspace.tsx',
    );

    assert.match(list, /listNoticePage\(\{/);
    assert.match(list, /totalItems=\{noticesQuery\.data\?\.total/);
    assert.match(list, /URLSearchParams/);
    assert.doesNotMatch(list, /items\.length[^\n]*totalItems/);
    assert.match(center, /readStatus/);
    assert.match(center, /category/);
    assert.match(delivery, /listNotificationDeliveryOperationPage/);
    assert.match(delivery, /listNotificationDeliveryFailurePage/);
  });

  it('keeps draft input recoverable and uses the protected file helper path', () => {
    const composer = read('components/notices/notice-composer-workspace.tsx');
    const detail = read('app/dashboard/notices/[noticeId]/page.tsx');

    assert.match(composer, /createNoticeDraft/);
    assert.match(composer, /updateNoticeDraft/);
    assert.match(composer, /beforeunload/);
    assert.match(composer, /Your valid form entries have been preserved/);
    assert.match(composer, /<FileUploader/);
    assert.match(detail, /<ProtectedFileButton/);
  });

  it('permission-gates lifecycle and retry actions and requires reasons', () => {
    const detail = read('app/dashboard/notices/[noticeId]/page.tsx');
    const acknowledgement = read(
      'components/notices/notice-acknowledgement-panel.tsx',
    );
    const delivery = read(
      'components/notifications/delivery-operations-workspace.tsx',
    );

    for (const permission of [
      'notices:publish',
      'notices:schedule',
      'notices:cancel',
      'notices:archive',
    ]) {
      assert.ok(detail.includes(permission));
    }
    assert.match(detail, /lifecycleMutation\.isPending/);
    assert.match(detail, /actionReason\.trim\(\)/);
    assert.match(acknowledgement, /reason\.trim\(\)/);
    assert.match(delivery, /notifications:retry_deliveries/);
    assert.match(delivery, /retryReason\.trim\(\)/);
  });

  it('distinguishes read from acknowledgement and routes follow-up through M12', () => {
    const acknowledgement = read(
      'components/notices/notice-acknowledgement-panel.tsx',
    );
    const center = read(
      'components/notifications/notification-center-workspace.tsx',
    );

    assert.match(acknowledgement, /Read means the message was opened/);
    assert.match(acknowledgement, /requestNoticeAcknowledgementFollowUp/);
    assert.match(acknowledgement, /idempotencyKey/);
    assert.match(center, /acknowledgement is a separate explicit action/);
  });

  it('renders bounded provider and failure states without private delivery payloads', () => {
    const delivery = read(
      'components/notifications/delivery-operations-workspace.tsx',
    );

    assert.match(delivery, /Provider mode/);
    assert.match(delivery, /Mocked or disabled providers/);
    assert.match(delivery, /lastFailureReason/);
    assert.doesNotMatch(
      delivery,
      /item\.body|item\.destination|deviceToken|webhookBody|stackTrace/,
    );
  });

  it('keeps deep links bounded and reauthorization in the dashboard route gate', () => {
    const center = read(
      'components/notifications/notification-center-workspace.tsx',
    );
    const layout = read('app/dashboard/layout.tsx');

    assert.match(center, /safeDashboardHref/);
    assert.match(layout, /prefix: ["']\/dashboard\/notifications["']/);
    assert.match(layout, /return ["']notifications["']/);
    assert.match(layout, /notifications:view_own/);
  });
});
