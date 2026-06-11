'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { StudentProfileDetail } from '@schoolos/core';
import { SectionCard } from '@/components/ui/section-card';
import { StatCard } from '@/components/ui/stat-card';
import { Users, Wallet, CalendarCheck, TrendingUp, User, MapPin, Hash, Phone, ShieldCheck, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';
import { StudentQrCard } from '../student-qr-card';
import { Badge } from '@/components/ui/badge';

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

export function OverviewTab({ profile, onOpenPdf }: { profile: StudentProfileDetail; onOpenPdf: (kind: string, token?: string) => void }) {
  const primaryGuardian = profile.guardians.find((g) => g.isPrimary) ?? profile.guardians[0];
  const outstanding = profile.invoices.reduce((sum, invoice) => sum + invoice.outstandingAmount, 0);
  const presentCount = profile.attendanceRecords.filter((r) => r.status === 'PRESENT').length;
  const className = profile.student.className ?? profile.student.class?.name ?? 'Class not assigned';
  const sectionName = profile.student.sectionName ?? profile.student.section ?? 'Section not assigned';

  const { data: iemisReadiness, isLoading: isIemisLoading } = useQuery({
    queryKey: ['student-iemis-readiness', profile.student.id],
    queryFn: () => api.getIemisReadiness(profile.student.id),
    enabled: Boolean(profile.student.id),
  });

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
            <DetailItem icon={<MapPin size={18} />} label="Class / Section" value={`${className} • ${sectionName}`} />
            <DetailItem icon={<Hash size={18} />} label="Roll Number" value={profile.student.rollNumber ?? 'Not assigned'} />
          </div>
        </SectionCard>

        <div className="space-y-6">
          <StudentQrCard 
            studentId={profile.student.id} 
            studentSystemId={profile.student.studentSystemId}
            // @ts-ignore
            qrCredential={profile.student.qrCredential ?? null}
            onOpenIdCard={(token) => onOpenPdf('id-card', token)}
          />

          <SectionCard title="Government iEMIS Readiness">
            {isIemisLoading ? (
              <p className="text-xs text-slate-400">Loading readiness score...</p>
            ) : iemisReadiness ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {iemisReadiness.eligible ? (
                      <CheckCircle2 size={18} className="text-success-600" />
                    ) : (
                      <AlertTriangle size={18} className="text-warning-600" />
                    )}
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">iEMIS Status</span>
                  </div>
                  <Badge variant={iemisReadiness.eligible ? 'success' : 'warning'} className="text-[10px] font-extrabold uppercase">
                    {iemisReadiness.eligible ? 'Ready' : 'Incomplete'}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="text-2xl font-black text-slate-900">{iemisReadiness.score}%</span>
                    <span className="text-xs font-bold text-slate-400">readiness score</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500 ${
                        iemisReadiness.score === 100 
                          ? 'bg-success-500' 
                          : iemisReadiness.score > 50 
                            ? 'bg-warning-500' 
                            : 'bg-danger-500'
                      }`}
                      style={{ width: `${iemisReadiness.score}%` }}
                    />
                  </div>
                </div>

                {iemisReadiness.issues.length > 0 ? (
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Validation Issues</p>
                    <ul className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                      {iemisReadiness.issues.map((issue, idx) => (
                        <li key={idx} className="text-xs text-slate-600 flex gap-2 font-medium">
                          <span className="text-warning-600 font-bold">•</span>
                          <span>{issue.message}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 font-medium">This profile matches all government iEMIS census reporting fields.</p>
                )}
              </div>
            ) : null}
          </SectionCard>

          <SectionCard title="Primary Guardian">
             {primaryGuardian ? (
               <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-mod-admissions-soft)] text-[var(--color-mod-admissions-text)] font-bold text-lg">
                      {primaryGuardian.fullName[0]}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 leading-tight">{primaryGuardian.fullName}</p>
                      <p className="text-[0.65rem] text-slate-500 uppercase font-bold tracking-wider mt-1">{primaryGuardian.relation}</p>
                    </div>
                  </div>
                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <Phone size={16} className="text-slate-400" />
                      <span className="font-medium">{primaryGuardian.primaryPhone || 'No phone'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <User size={16} className="text-slate-400" />
                      <span className="font-medium">{primaryGuardian.email || 'No email'}</span>
                    </div>
                  </div>
               </div>
             ) : (
               <p className="text-sm text-slate-400">No guardian information recorded.</p>
             )}
          </SectionCard>
        </div>
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
