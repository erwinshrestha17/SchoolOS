'use client';

import { AdmissionForm } from '../../../components/forms/admission-form';
import { PageHeader } from '../../../components/ui/page-header';
import { UserPlus } from 'lucide-react';

export default function AdmissionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Admissions"
        description="Enroll new students, manage bulk imports, and review recent admissions."
      />
      
      <div className="animate-fade-in">
        <AdmissionForm />
      </div>
    </div>
  );
}
