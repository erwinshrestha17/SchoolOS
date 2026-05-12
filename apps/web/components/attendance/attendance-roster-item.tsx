'use client';

import React from 'react';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Check, X, Clock, AlertCircle } from 'lucide-react';

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

export function AttendanceRosterItem({
  student,
  status,
  remark,
  onStatusChange,
  onRemarkChange,
}: AttendanceRosterItemProps) {
  const isPresent = status === 'PRESENT';
  const isAbsent = status === 'ABSENT';
  const isLate = status === 'LATE';

  const initials = student.fullNameEn
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <div className={cn(
      "group relative flex flex-col p-4 rounded-[2rem] border transition-all duration-300",
      isPresent 
        ? "bg-white border-slate-100 shadow-sm" 
        : isAbsent 
          ? "bg-danger-50/30 border-danger-100 shadow-sm"
          : isLate
            ? "bg-warning-50/30 border-warning-100 shadow-sm"
            : "bg-info-50/30 border-info-100 shadow-sm"
    )}>
      <div className="flex items-center gap-3">
        <Avatar
          alt={student.fullNameEn}
          initials={initials || 'S'}
          className={cn(
            "h-12 w-12 text-sm font-bold shadow-sm transition-all duration-500",
            isPresent ? "bg-emerald-50 text-emerald-600" : "bg-white"
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-slate-900 truncate tracking-tight">{student.fullNameEn}</h4>
            {student.hasMedicalAlert && (
              <AlertCircle size={14} className="text-danger-500" />
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
             <span className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">{student.studentSystemId}</span>
             {student.rollNumber && (
               <>
                 <div className="h-0.5 w-0.5 rounded-full bg-slate-300" />
                 <span className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-widest">Roll {student.rollNumber}</span>
               </>
             )}
          </div>
        </div>
        <StatusBadge status={status} className="h-6" />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
         <ActionButton 
          active={isPresent} 
          onClick={() => onStatusChange('PRESENT')} 
          icon={<Check size={16} />} 
          label="Present"
          color="emerald"
         />
         <ActionButton 
          active={isAbsent} 
          onClick={() => onStatusChange('ABSENT')} 
          icon={<X size={16} />} 
          label="Absent"
          color="danger"
         />
         <ActionButton 
          active={isLate} 
          onClick={() => onStatusChange('LATE')} 
          icon={<Clock size={16} />} 
          label="Late"
          color="warning"
         />
      </div>

      {!isPresent && (
        <div className="mt-4 flex flex-col gap-2 animate-in slide-in-from-top-2 duration-300">
           <input
            type="text"
            value={remark || ''}
            onChange={(e) => onRemarkChange(e.target.value)}
            placeholder="Reason or remark..."
            className="w-full h-10 px-4 text-xs font-medium rounded-xl border-none bg-white/60 focus:bg-white focus:ring-2 focus:ring-primary-500/20 transition-all placeholder:text-slate-400"
           />
           <div className="flex flex-wrap gap-1.5">
             {['SICK_LEAVE', 'EXCUSED_LEAVE', 'UNEXCUSED_LEAVE'].map((s) => (
               <button
                key={s}
                onClick={() => onStatusChange(s as AttendanceStatus)}
                className={cn(
                  "px-2 py-1 text-[0.6rem] font-bold rounded-lg border transition-all uppercase tracking-tighter",
                  status === s 
                    ? "bg-slate-900 border-slate-900 text-white" 
                    : "bg-white/40 border-slate-200 text-slate-500 hover:bg-white"
                )}
               >
                 {s.replace('_', ' ')}
               </button>
             ))}
           </div>
        </div>
      )}
    </div>
  );
}

function ActionButton({ 
  active, 
  onClick, 
  icon, 
  label,
  color
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string;
  color: 'emerald' | 'danger' | 'warning';
}) {
  const colorMap = {
    emerald: active ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" : "bg-white text-slate-400 hover:text-emerald-500 hover:bg-emerald-50",
    danger: active ? "bg-danger-500 text-white shadow-lg shadow-danger-500/30" : "bg-white text-slate-400 hover:text-danger-500 hover:bg-danger-50",
    warning: active ? "bg-warning-500 text-white shadow-lg shadow-warning-500/30" : "bg-white text-slate-400 hover:text-warning-500 hover:bg-warning-50",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-2xl border border-slate-100 transition-all duration-300",
        colorMap[color]
      )}
    >
      {icon}
      <span className="text-[0.6rem] font-bold uppercase tracking-widest">{label}</span>
    </button>
  );
}
