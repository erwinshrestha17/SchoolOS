'use client';

import { Megaphone } from 'lucide-react';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { ModuleHero } from '../../../components/dashboard/module-hero';
import { CommunicationsForm } from '../../../components/forms/communications-form';
import { DeliveryRetryPanel } from '../../../components/forms/delivery-retry-panel';
import { NoticeDetailLinksPanel } from '../../../components/forms/notice-detail-links-panel';

export default function NoticesPage() {
  return (
    <DashboardPageShell>
      <ModuleHero
        title="Notices & Communication"
        subtitle="Publish notices, monitor delivery, and manage school communication."
        badge="Notices"
        category="School Operations"
        icon={<Megaphone size={32} className="text-purple-400" />}
        accentColor="purple"
        variant="dark"
      />
      <CommunicationsForm />
      <NoticeDetailLinksPanel />
      <DeliveryRetryPanel />
    </DashboardPageShell>
  );
}
