'use client';

import { AcademicsForm } from '../../../components/forms/academics-form';

export default function AcademicsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Academics
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Subjects, exams, CAS, and report cards.
        </p>
      </div>
      <AcademicsForm />
    </div>
  );
}
