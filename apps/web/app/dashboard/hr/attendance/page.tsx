'use client';

import { StaffAttendanceCorrectionQueue } from '../../../../components/hr/staff-attendance-correction-queue';
import { StaffAttendanceSummary } from '../../../../components/hr/staff-attendance-summary';

export default function StaffAttendancePage() {
  return (
    <div className="animate-in fade-in duration-500">
      <StaffAttendanceSummary />
      <StaffAttendanceCorrectionQueue />
    </div>
  );
}
