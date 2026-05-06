'use client';

import { StudentProfileDetail } from '@schoolos/core';
import { SectionCard } from '@/components/ui/section-card';
import { StatCard } from '@/components/ui/stat-card';
import { Users, Wallet, CalendarCheck, TrendingUp, User, MapPin, Hash, Phone } from 'lucide-react';

const formatMoney = (amount: number) => {
  return new Intl.NumberFormat('en-NP', {
    style: 'currency',
    currency: 'NPR',
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (date: string | Date) => {
  return new Intl.DateTimeFormat('en-NP', {
    dateStyle: 'medium',
  }).format(new Date(date));
};

export function OverviewTab({ profile }: { profile: StudentProfileDetail }) {
  const primaryGuardian = profile.guardians.find((g) => g.isPrimary) ?? profile.guardians[0];
  const outstanding = profile.invoices.reduce((sum, invoice) => sum + invoice.outstandingAmount, 0);
  const presentCount = profile.attendanceRecords.filter((r) => r.status === 'PRESENT').length;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Outstanding Fees" value={formatMoney(outstanding)} icon={<Wallet size={20} />} />
        <StatCard title="Attendance Rate" value={`${Math.round((presentCount / Math.max(1, profile.attendanceRecords.length)) * 100)}%`} icon={<CalendarCheck size={20} />} />
        <StatCard title="Guardians" value={profile.guardians.length} icon={<Users size={20} />} />
        <StatCard title="Invoices" value={profile.invoices.length} icon={<TrendingUp size={20} />} />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <SectionCard title="Core Identity" className="lg:col-span-2">
          <div className="grid gap-6 sm:grid-cols-2">
            <DetailItem icon={<User size={18} />} label="Full Name" value={profile.student.fullNameEn || `${profile.student.firstNameEn} ${profile.student.lastNameEn}`} />
            <DetailItem icon={<Hash size={18} />} label="Student ID" value={profile.student.studentSystemId} />
            <DetailItem icon={<CalendarCheck size={18} />} label="Date of Birth" value={profile.student.dateOfBirth ? formatDate(profile.student.dateOfBirth) : 'Not recorded'} />
            <DetailItem icon={<TrendingUp size={18} />} label="Lifecycle Status" value={profile.student.lifecycleStatus ?? 'ACTIVE'} />
            <DetailItem icon={<MapPin size={18} />} label="Class / Section" value={`${profile.student.className ?? profile.student.class?.name ?? 'N/A'} • ${profile.student.sectionName ?? profile.student.section ?? 'N/A'}`} />
            <DetailItem icon={<Hash size={18} />} label="Roll Number" value={profile.student.rollNumber ?? 'Not assigned'} />
          </div>
        </SectionCard>

        <SectionCard title="Primary Guardian">
           {primaryGuardian ? (
             <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 font-bold">
                    {primaryGuardian.fullName[0]}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{primaryGuardian.fullName}</p>
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">{primaryGuardian.relation}</p>
                  </div>
                </div>
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <Phone size={16} className="text-slate-400" />
                    <span>{primaryGuardian.primaryPhone || 'No phone'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <User size={16} className="text-slate-400" />
                    <span>{primaryGuardian.email || 'No email'}</span>
                  </div>
                </div>
             </div>
           ) : (
             <p className="text-sm text-slate-400">No guardian information recorded.</p>
           )}
        </SectionCard>
      </div>
    </div>
  );
}

function DetailItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-slate-400">
        {icon}
      </div>
      <div>
        <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-0.5 font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}
