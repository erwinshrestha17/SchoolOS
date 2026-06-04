'use client';

import { FileCheck2 } from 'lucide-react';
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';
import { ModuleHero } from '@/components/dashboard/module-hero';
import { ReportCardsWorkspace } from '@/components/academics/report-cards/report-cards-workspace';

export default function AcademicReportCardsPage() {
  return (
    <DashboardPageShell>
      <ModuleHero
        title="Report Cards"
        subtitle="Generate, track, and manage student performance reports using backend-calculated data."
        badge="Exams & Grading"
        category="Academics"
        icon={<FileCheck2 size={32} className="text-indigo-400" />}
        accentColor="indigo"
        variant="dark"
      />
      <ReportCardsWorkspace />
    </DashboardPageShell>
  );
}
