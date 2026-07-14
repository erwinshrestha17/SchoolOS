'use client';

import { useParams } from 'next/navigation';
import { StudentIemisReadinessPage } from '@/components/students/student-iemis-readiness-page';

export default function StudentIemisReadinessRoute() {
  const params = useParams<{ studentId?: string | string[] }>();
  const resolvedStudentId = Array.isArray(params.studentId)
    ? params.studentId[0]
    : params.studentId;

  return <StudentIemisReadinessPage studentId={resolvedStudentId ?? ''} />;
}
