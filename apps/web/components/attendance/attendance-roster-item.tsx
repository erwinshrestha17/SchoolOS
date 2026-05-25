'use client';

import React from 'react';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Check, X, Clock, Calendar } from 'lucide-react';

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
  const isLeave = ['SICK_LEAVE', 'EXCUSED_LEAVE', 'UNEXCUSED_LEAVE'].includes(status);

  const initials = student.fullNameEn
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <div className={cn(
      "group relative flex flex-col p-4 rounded-[2rem] border transition-all duration-300 bg-white shadow-sm hover:shadow-md",
      isPresent && "border-slate-100",
      isAbsent && "border-rose-100 bg-rose-50/10",
      isLate && "border-amber-100 bg-amber-50/10",
      isLeave && "border-blue-100 bg-blue-50/10"
    )}>
      
      {/* Student Details and Avatar */}
      <div className="flex items-center gap-3">
        <Avatar
          alt={student.fullNameEn}
          initials={initials || 'S'}
          className={cn(
            "h-12 w-12 text-sm font-bold shadow-sm transition-all duration-500",
            isPresent ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-600"
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-slate-900 truncate tracking-tight">{student.fullNameEn}</h4>
            {student.hasMedicalAlert && (
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" title="Medical Alert" />
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

      {/* P A L V Single-Tap Toggle Buttons */}
      <div className="mt-4 grid grid-cols-4 gap-1.5 bg-slate-50 p-1.5 rounded-[1.5rem] border border-slate-100">
         <button 
           type="button"
           onClick={() => onStatusChange('PRESENT')} 
           className={cn(
             "flex flex-col items-center justify-center py-2 rounded-xl transition-all font-bold",
             isPresent 
               ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20" 
               : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/50"
           )}
         >
           <span className="text-xs">P</span>
           <span className="text-[0.55rem] uppercase tracking-tighter opacity-70">Present</span>
         </button>
         
         <button 
           type="button"
           onClick={() => onStatusChange('ABSENT')} 
           className={cn(
             "flex flex-col items-center justify-center py-2 rounded-xl transition-all font-bold",
             isAbsent 
               ? "bg-rose-500 text-white shadow-md shadow-rose-500/20" 
               : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/50"
           )}
         >
           <span className="text-xs">A</span>
           <span className="text-[0.55rem] uppercase tracking-tighter opacity-70">Absent</span>
         </button>
         
         <button 
           type="button"
           onClick={() => onStatusChange('LATE')} 
           className={cn(
             "flex flex-col items-center justify-center py-2 rounded-xl transition-all font-bold",
             isLate 
               ? "bg-amber-500 text-white shadow-md shadow-amber-500/20" 
               : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/50"
           )}
         >
           <span className="text-xs">L</span>
           <span className="text-[0.55rem] uppercase tracking-tighter opacity-70">Late</span>
         </button>
         
         <button 
           type="button"
           onClick={() => onStatusChange('SICK_LEAVE')} 
           className={cn(
             "flex flex-col items-center justify-center py-2 rounded-xl transition-all font-bold",
             isLeave 
               ? "bg-blue-500 text-white shadow-md shadow-blue-500/20" 
               : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/50"
           )}
         >
           <span className="text-xs">V</span>
           <span className="text-[0.55rem] uppercase tracking-tighter opacity-70">Leave</span>
         </button>
      </div>

      {/* Exception Remarks and Details Form */}
      {!isPresent && (
        <div className="mt-3.5 space-y-2 border-t border-slate-100 pt-3 animate-in slide-in-from-top-2 duration-300">
           <input
            type="text"
            value={remark || ''}
            onChange={(e) => onRemarkChange(e.target.value)}
            placeholder="Write brief remark..."
            className="w-full h-9 px-3 text-xs font-medium rounded-xl border border-slate-150 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-primary-500/20 transition-all placeholder:text-slate-400 outline-none"
           />
           
           {/* If Leave, show leave sub-kinds */}
           {isLeave && (
             <div className="flex flex-wrap gap-1.5 pt-1">
               {[
                 { key: 'SICK_LEAVE', label: 'Sick' },
                 { key: 'EXCUSED_LEAVE', label: 'Excused' },
                 { key: 'UNEXCUSED_LEAVE', label: 'Unexcused' }
               ].map((leaveType) => (
                 <button
                   key={leaveType.key}
                   type="button"
                   onClick={() => onStatusChange(leaveType.key as AttendanceStatus)}
                   className={cn(
                     "px-2.5 py-1 text-[0.62rem] font-bold rounded-lg border transition-all uppercase tracking-wider",
                     status === leaveType.key 
                       ? "bg-blue-50 border-blue-200 text-blue-700 font-extrabold" 
                       : "bg-white/40 border-slate-200 text-slate-500 hover:bg-white"
                   )}
                 >
                   {leaveType.label}
                 </button>
               ))}
             </div>
           )}
        </div>
      )}
    </div>
  );
}
