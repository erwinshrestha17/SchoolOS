import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const webRoot = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, webRoot), 'utf8');

describe('M15 saved-draft review and publication workflow', () => {
  it('shows the draft review action without claiming draft content is published', () => {
    const detail = read('app/dashboard/notices/[noticeId]/page.tsx');

    assert.match(detail, /"Preview & publish"/);
    assert.match(detail, /"Draft notice content"/);
    assert.doesNotMatch(detail, /Published communication content/);
    assert.match(
      detail,
      /Delivery and acknowledgement information will be available after\s+this notice is published\./,
    );
  });

  it('hides delivery, unread-recipient, and acknowledgement analytics until publication', () => {
    const detail = read('app/dashboard/notices/[noticeId]/page.tsx');

    assert.match(detail, /hasPublicationReporting\(noticeQuery\.data\)/);
    assert.match(detail, /showPublicationReporting \? \(/);
    assert.match(detail, /<UnreadRecipientsPanel/);
    assert.match(detail, /<NoticeAcknowledgementPanel/);
  });

  it('uses backend recipient results as the final-action gate', () => {
    const review = read('components/notices/notice-review-workspace.tsx');

    assert.match(review, /communicationsApi\.previewNoticeRecipients/);
    assert.match(review, /previewQuery\.data\.allowedRecipientCount/);
    assert.match(review, /previewQuery\.data\.channels/);
    assert.match(review, /!previewReady/);
    assert.doesNotMatch(review, /students\.length|guardians\.length/);
  });

  it('hides whole-school class and section fields and clears stale audience selections', () => {
    const composer = read('components/notices/notice-composer-workspace.tsx');

    assert.match(composer, /form\.audienceType !== "ALL" \? \(/);
    assert.match(composer, /form\.audienceType === "SECTION" \? \(/);
    assert.match(
      composer,
      /audienceType,\s+classId: "",\s+sectionId: "",/,
    );
    assert.match(composer, /setPreview\(null\)/);
  });

  it('prevents duplicate publication and refetches the backend lifecycle after success', () => {
    const review = read('components/notices/notice-review-workspace.tsx');

    assert.match(review, /actionMutation\.isPending/);
    assert.match(
      review,
      /if \(pendingAction && !actionMutation\.isPending\)/,
    );
    assert.match(review, /queryClient\.refetchQueries\(\{/);
    assert.match(review, /queryKey: \["notice-detail", noticeId\]/);
    assert.match(review, /exact: true/);
  });

  it('removes legacy Recipient Preview navigation and redirects compatibility traffic', () => {
    const workspace = read('components/notices/notices-workspace.tsx');
    const legacy = read('app/dashboard/communications/recipients/page.tsx');

    assert.doesNotMatch(workspace, /Recipient Preview/);
    assert.doesNotMatch(workspace, /label: 'Compose'/);
    assert.match(legacy, /redirect\('\/dashboard\/notices\/new'\)/);
  });

  it('only renders the protected attachment action when an attachment exists', () => {
    const detail = read('app/dashboard/notices/[noticeId]/page.tsx');
    const review = read('components/notices/notice-review-workspace.tsx');

    assert.match(detail, /\{attachmentFileId \? \(/);
    assert.match(review, /attachmentFileId \? \(/);
    assert.match(review, /<ProtectedFileButton/);
    assert.doesNotMatch(review, /window\.open/);
  });
});
