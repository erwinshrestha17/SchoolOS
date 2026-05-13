'use client';

import { StudentProfileDetail } from '@schoolos/core';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { SectionCard } from '@/components/ui/section-card';
import { CalendarCheck, FolderOpen, QrCode, Wallet, Edit3, FileText, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

type ProfileHeaderProps = {
  profile: StudentProfileDetail;
  onEdit: () => void;
  onOpenIdCard: () => void;
  pdfError?: string;
};

export function ProfileHeader({ profile, onEdit, onOpenIdCard, pdfError }: ProfileHeaderProps) {
  const { student } = profile;
  const studentName = student.fullNameEn || `${student.firstNameEn} ${student.lastNameEn}`;
  
  return (
    <SectionCard className="sticky top-4 z-20 overflow-hidden border-none bg-slate-900 text-white shadow-2xl">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-5">
          <Avatar 
            initials={initials(studentName)} 
            size="xl" 
            className="ring-4 ring-white/10 shadow-xl"
          />
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="phase2" className="bg-white/10 text-white border-white/20">Student Profile</Badge>
              <div className="h-1 w-1 rounded-full bg-white/30" />
              <span className="text-xs font-bold uppercase tracking-wider text-white/50">{student.studentSystemId}</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-4xl">
              {studentName}
            </h1>
            <p className="mt-2 text-slate-300 font-medium">
              {student.className ?? student.class?.name ?? 'No class'} • {student.sectionName ?? student.section ?? 'No section'}
              {student.rollNumber ? ` • Roll ${student.rollNumber}` : ''}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
               <Badge className="bg-success-500/20 text-success-400 border-success-500/30">{student.lifecycleStatus ?? 'ACTIVE'}</Badge>
               <Badge className="bg-primary-500/20 text-primary-400 border-primary-500/30">{student.gender ?? 'N/A'}</Badge>
               {student.disabilityFlag ? (
                 <Badge className="bg-warning-500/20 text-warning-400 border-warning-500/30">{student.disabilityFlag}</Badge>
               ) : (
                 <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">No known disability</Badge>
               )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/students"
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/20"
          >
            <ChevronLeft size={18} />
            Directory
          </Link>
          <Link
            href={`/dashboard/finance?studentId=${encodeURIComponent(student.id)}`}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/20"
          >
            <Wallet size={18} />
            Collect Fees
          </Link>
          <Link
            href={`/dashboard/students/${encodeURIComponent(student.id)}?tab=Attendance`}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/20"
          >
            <CalendarCheck size={18} />
            Attendance
          </Link>
          <Link
            href={`/dashboard/students/${encodeURIComponent(student.id)}?tab=Documents`}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/20"
          >
            <FolderOpen size={18} />
            Documents
          </Link>
          <Link
            href={`/dashboard/students/${encodeURIComponent(student.id)}?tab=Overview`}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/20"
          >
            <QrCode size={18} />
            QR
          </Link>
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-white/20"
          >
            <Edit3 size={18} />
            Edit
          </button>
          <button
            type="button"
            onClick={onOpenIdCard}
            className="flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary-500/30 transition hover:bg-primary-600"
          >
            <FileText size={18} />
            ID Card
          </button>
        </div>
      </div>

      {pdfError && (
        <div className="mt-6 rounded-xl border border-danger-500/30 bg-danger-500/10 p-4 text-sm font-bold text-danger-400 animate-in fade-in slide-in-from-top-2">
          {pdfError}
        </div>
      )}
    </SectionCard>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
