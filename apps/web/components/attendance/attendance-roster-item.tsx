'use client';

import React from 'react';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
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
  disabled?: boolean;
}

function StatusSegmentButton({
  label,
  shortLabel,
  active,
  activeClassName,
  disabled,
  onClick,
}: {
  label: string;
  shortLabel: string;
  active: boolean;
  activeClassName: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-auto flex-col items-center justify-center rounded-xl py-2 font-bold',
        active
          ? activeClassName
          : 'text-slate-500 hover:bg-slate-100/50 hover:text-slate-900',
      )}
      aria-pressed={active}
      aria-label={label}
    >
      <span className="text-xs">{shortLabel}</span>
      <span className="text-[0.55rem] uppercase tracking-tighter opacity-70">
        {label}
      </span>
    </Button>
  );
}

export function AttendanceRosterItem({
  student,
  status,
  remark,
  onStatusChange,
  onRemarkChange,
  disabled = false,
}: AttendanceRosterItemProps) {
  const isPresent = status === 'PRESENT';
  const isAbsent = status === 'ABSENT';
  const isLate = status === 'LATE';
  const isLeave = ['SICK_LEAVE', 'EXCUSED_LEAVE', 'UNEXCUSED_LEAVE'].includes(status);

  const initials = student.fullNameEn
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <div className={cn(
      "group relative flex flex-col rounded-xl border bg-white p-4 shadow-sm transition-all duration-300 hover:shadow-md",
      isPresent && "border-slate-100",
      isAbsent && "border-danger-100 bg-danger-50/10",
      isLate && "border-warning-100 bg-warning-50/10",
      isLeave && "border-info-100 bg-info-50/10",
      disabled && "opacity-60"
    )}>
      
      {/* Student Details and Avatar */}
      <div className="flex items-center gap-3">
        <Avatar
          alt={student.fullNameEn}
          initials={initials || 'S'}
          className={cn(
            "h-12 w-12 text-sm font-bold shadow-sm transition-all duration-500",
            isPresent ? "bg-success-50 text-success-600" : "bg-slate-50 text-slate-600"
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-slate-900 truncate tracking-tight">{student.fullNameEn}</h4>
            {student.hasMedicalAlert && (
              <span
                role="img"
                aria-label="Medical alert"
                title="Medical Alert"
                className="h-2 w-2 rounded-full bg-danger-500 animate-pulse"
              />
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
             <span className="text-[0.62rem] font-bold text-slate-400 uppercase tracking-widest">{student.studentSystemId}</span>
             {student.rollNumber && (
               <>
                 <div className="h-0.5 w-0.5 rounded-full bg-slate-300" />
                 <span className="text-[0.62rem] font-bold text-slate-500 uppercase tracking-widest">Roll {student.rollNumber}</span>
               </>
             )}
          </div>
        </div>
        <StatusBadge status={status} className="h-6" />
      </div>

      <div className="mt-4 grid grid-cols-4 gap-1.5 rounded-xl border border-slate-100 bg-slate-50 p-1.5">
        <StatusSegmentButton
          shortLabel="P"
          label="Present"
          active={isPresent}
          activeClassName="bg-success-500 text-white shadow-md shadow-success-500/20"
          disabled={disabled}
          onClick={() => onStatusChange('PRESENT')}
        />
        <StatusSegmentButton
          shortLabel="A"
          label="Absent"
          active={isAbsent}
          activeClassName="bg-danger-500 text-white shadow-md shadow-danger-500/20"
          disabled={disabled}
          onClick={() => onStatusChange('ABSENT')}
        />
        <StatusSegmentButton
          shortLabel="L"
          label="Late"
          active={isLate}
          activeClassName="bg-warning-500 text-white shadow-md shadow-warning-500/20"
          disabled={disabled}
          onClick={() => onStatusChange('LATE')}
        />
        <StatusSegmentButton
          shortLabel="E"
          label="Leave / Excused"
          active={isLeave}
          activeClassName="bg-info-500 text-white shadow-md shadow-info-500/20"
          disabled={disabled}
          onClick={() => onStatusChange('EXCUSED_LEAVE')}
        />
      </div>

      {!isPresent && (
        <div className="mt-3.5 space-y-2 border-t border-slate-100 pt-3 animate-in slide-in-from-top-2 duration-300">
           <input
            type="text"
            disabled={disabled}
            value={remark || ''}
            onChange={(e) => onRemarkChange(e.target.value)}
            placeholder="Write brief remark..."
            className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-xs font-medium outline-none transition-all placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-[var(--color-mod-attendance-border)] disabled:cursor-not-allowed"
           />
           
        </div>
      )}
    </div>
  );
}
