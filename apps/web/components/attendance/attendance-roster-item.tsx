'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'SICK_LEAVE' | 'EXCUSED_LEAVE' | 'UNEXCUSED_LEAVE';

interface Student {
  id: string;
  fullNameEn: string;
  studentSystemId: string;
  rollNumber?: string | number | null;
  hasMedicalAlert?: boolean;
}

interface AttendanceRosterItemProps {
  student: Student;
  status: AttendanceStatus;
  remark?: string;
  onStatusChange: (status: AttendanceStatus) => void;
  onRemarkChange: (remark: string) => void;
}

const statusLabels: Record<AttendanceStatus, string> = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  LATE: 'Late',
  SICK_LEAVE: 'Sick leave',
  EXCUSED_LEAVE: 'Excused leave',
  UNEXCUSED_LEAVE: 'Unexcused leave',
};

const statusVariants: Record<AttendanceStatus, 'success' | 'destructive' | 'warning' | 'info'> = {
  PRESENT: 'success',
  ABSENT: 'destructive',
  LATE: 'warning',
  SICK_LEAVE: 'info',
  EXCUSED_LEAVE: 'info',
  UNEXCUSED_LEAVE: 'warning',
};

export function AttendanceRosterItem({
  student,
  status,
  remark,
  onStatusChange,
  onRemarkChange,
}: AttendanceRosterItemProps) {
  const isPresent = status === 'PRESENT';

  return (
    <div className={cn(
      "group relative flex flex-col p-5 rounded-2xl border transition-all duration-200",
      isPresent 
        ? "bg-white border-slate-100 hover:border-slate-200" 
        : "bg-slate-50 border-slate-200 shadow-sm"
    )}>
      <div className="flex items-center gap-4">
        <Avatar name={student.fullNameEn} className="h-10 w-10 text-sm font-bold" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-slate-900 truncate">{student.fullNameEn}</h4>
            {student.hasMedicalAlert && (
              <Badge variant="destructive" className="h-5 px-1.5 text-[0.6rem]">Medical Alert</Badge>
            )}
          </div>
          <p className="text-xs text-slate-500">
            {student.studentSystemId} {student.rollNumber ? `• Roll ${student.rollNumber}` : ''}
          </p>
        </div>
        <Badge variant={statusVariants[status]}>{statusLabels[status]}</Badge>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {Object.keys(statusLabels).map((s) => (
          <button
            key={s}
            onClick={() => onStatusChange(s as AttendanceStatus)}
            className={cn(
              "px-3 py-1.5 text-[0.7rem] font-bold rounded-lg border transition-all",
              status === s
                ? "bg-slate-900 border-slate-900 text-white shadow-sm scale-105"
                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            )}
          >
            {statusLabels[s as AttendanceStatus]}
          </button>
        ))}
      </div>

      {!isPresent && (
        <div className="mt-4">
          <input
            type="text"
            value={remark || ''}
            onChange={(e) => onRemarkChange(e.target.value)}
            placeholder="Add a remark..."
            className="w-full text-xs bg-white border-slate-200 rounded-xl px-4 py-2 focus:ring-1 focus:ring-slate-900"
          />
        </div>
      )}
    </div>
  );
}
