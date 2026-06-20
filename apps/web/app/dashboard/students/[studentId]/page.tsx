'use client';

import { useParams } from 'next/navigation';
import { AdmissionFollowUpsCard } from '../../../../components/students/profile/admission-follow-ups-card';
import { StudentDetailPage } from '../../../../components/students/student-detail-page';

export default function StudentProfileRoute() {
  const params = useParams<{ studentId?: string | string[] }>();
  const resolvedStudentId = Array.isArray(params.studentId)
    ? params.studentId[0]
    : params.studentId;

  return (
    <main className="space-y-5">
      <AdmissionFollowUpsCard studentId={resolvedStudentId ?? ''} />
      <StudentDetailPage studentId={resolvedStudentId ?? ''} />
    </main>
  );
}
