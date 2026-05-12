'use client';

import { StaffDetailWorkspace } from '@/components/hr/staff-detail-workspace';
import { useParams } from 'next/navigation';

export default function StaffDetailPage() {
  const params = useParams();
  const staffId = params.id as string;

  return (
    <div className="animate-in fade-in duration-500">
      <StaffDetailWorkspace staffId={staffId} />
    </div>
  );
}
