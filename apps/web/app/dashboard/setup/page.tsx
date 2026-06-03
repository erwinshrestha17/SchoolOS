import { PageHeader } from '@/components/ui/page-header';
import { SetupForm } from '@/components/forms/setup-form';

export default function SchoolSetupPage() {
  return (
    <div className="space-y-6 p-6 md:p-8">
      <PageHeader
        title="School Setup"
        description="Create academic years, class levels, and sections before admissions, attendance, exams, and fee workflows begin."
      />
      <SetupForm />
    </div>
  );
}
