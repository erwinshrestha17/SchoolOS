'use client';

import { useParams } from 'next/navigation';
import { StudentDetailPage } from '../../../../components/students/student-detail-page';

export default function StudentProfileRoute() {
  const params = useParams<{ studentId?: string | string[] }>();
  const studentId = Array.isArray(params.studentId)
    ? params.studentId[0]
    : params.studentId;

  return <StudentDetailPage studentId={studentId ?? ''} />;
}
