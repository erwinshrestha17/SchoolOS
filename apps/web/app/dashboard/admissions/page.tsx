'use client';

import { AdmissionForm } from '../../../components/forms/admission-form';
import { UserPlus } from 'lucide-react';
import { DashboardPageShell } from '../../../components/dashboard/dashboard-page-shell';
import { ModuleHero } from '../../../components/dashboard/module-hero';

export default function AdmissionsPage() {
  return (
    <DashboardPageShell>
      <ModuleHero
        title="Student Admissions"
        subtitle="Enroll new students, manage bulk imports, and review recent admissions."
        badge="Admissions"
        category="Student Management"
        icon={<UserPlus size={32} className="text-blue-400" />}
        accentColor="blue"
        variant="dark"
      />
      
      <div className="animate-in fade-in duration-300">
        <AdmissionForm />
      </div>
    </DashboardPageShell>
  );
}
