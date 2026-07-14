'use client';

import { useParams } from 'next/navigation';
import { StudentIdentityPage } from '../../../../../components/students/student-identity-page';

export default function StudentIdentityRoute() {
  const params = useParams<{ studentId?: string | string[] }>();
  const resolvedStudentId = Array.isArray(params.studentId)
    ? params.studentId[0]
    : params.studentId;

  return <StudentIdentityPage studentId={resolvedStudentId ?? ''} />;
}
