'use client';

import { PageHeader } from '../../../components/ui/page-header';
import { CommunicationsForm } from '../../../components/forms/communications-form';
import { DeliveryRetryPanel } from '../../../components/forms/delivery-retry-panel';
import { NoticeDetailLinksPanel } from '../../../components/forms/notice-detail-links-panel';

export default function NoticesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Notices & Communication"
        description="Publish notices, monitor delivery, and manage school communication."
      />
      <CommunicationsForm />
      <NoticeDetailLinksPanel />
      <DeliveryRetryPanel />
    </div>
  );
}
