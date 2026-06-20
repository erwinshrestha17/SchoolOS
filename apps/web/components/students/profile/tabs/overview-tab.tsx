'use client';

import { useQuery } from '@tanstack/react-query';
import type { StudentDocument, StudentProfileDetail } from '@schoolos/core';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { SectionCard } from '@/components/ui/section-card';
import { StudentQrCard } from '../student-qr-card';
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  Users,
  Wallet,
} from 'lucide-react';

type OverviewTabProps = {
  profile: StudentProfileDetail;
  onOpenPdf: (kind: string, token?: string) => void;
  onSelectTab: (tab: 'Profile' | 'Attendance' | 'Fees' | 'Documents' | 'Guardians' | 'Activity') => void;
};

export function OverviewTab({ profile, onOpenPdf, onSelectTab }: OverviewTabProps) {
  const studentId = profile.student.id;
  const primaryGuardian = profile.guardians.find((guardian) => guardian.isPrimary) ?? profile.guardians[0];
  const currentEnrollment =
    profile.enrollments.find((enrollment) => enrollment.status.toUpperCase() === 'ACTIVE') ??
    profile.enrollments[0] ??
    null;
  const documentIssues = getDocumentAttention(profile.documents);

  const attendanceQuery = useQuery({
    queryKey: ['student-attendance-history', studentId],
    queryFn: () => api.getStudentAttendanceHistory(studentId),
    enabled: Boolean(studentId),
  });

  const feeClearanceQuery = useQuery({
    queryKey: ['student-fee-clearance', studentId],
    queryFn: () => api.getStudentFeeClearance(studentId),
    enabled: Boolean(studentId),
  });

  const iemisQuery = useQuery({
    queryKey: ['student-iemis-readiness', studentId],
    queryFn: () => api.getIemisReadiness(studentId),
    enabled: Boolean(studentId),
  });

  const attentionItems = [
    feeClearanceQuery.data && !feeClearanceQuery.data.cleared
      ? {
          key: 'fees',
          tone: 'danger' as const,
          title: 'Outstanding fees need clearance',
          description: `${formatMoney(feeClearanceQuery.data.outstandingAmount)} is outstanding according to the fee-clearance API.`,
          action: 'Review fees',
          onClick: () => onSelectTab('Fees'),
        }
      : null,
    iemisQuery.data && iemisQuery.data.issues.length > 0
      ? {
          key: 'iemis',
          tone: 'warning' as const,
          title: 'iEMIS readiness has issues',
          description: `${iemisQuery.data.issues.length} reporting field${iemisQuery.data.issues.length === 1 ? '' : 's'} need review.`,
          action: 'Open profile',
          onClick: () => onSelectTab('Profile'),
        }
      : null,
    documentIssues.length > 0
      ? {
          key: 'documents',
          tone: 'warning' as const,
          title: 'Document record needs review',
          description: `${documentIssues.length} uploaded document${documentIssues.length === 1 ? '' : 's'} are rejected, expired, or close to expiry.`,
          action: 'Review documents',
          onClick: () => onSelectTab('Documents'),
        }
      : null,
  ].filter((item): item is AttentionItem => item !== null);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.38fr)]">
      <div className="space-y-6">
        <SectionCard title="Attention needed" description="Only real backend or profile-contract signals are shown here.">
          {feeClearanceQuery.isLoading || iemisQuery.isLoading ? (
            <LoadingState label="Checking profile attention items..." />
          ) : feeClearanceQuery.isError || iemisQuery.isError ? (
            <div className="grid gap-3">
              {feeClearanceQuery.isError ? (
                <InlineError
                  title="Fee clearance could not be checked"
                  onRetry={() => void feeClearanceQuery.refetch()}
                />
              ) : null}
              {iemisQuery.isError ? (
                <InlineError title="iEMIS readiness could not be checked" onRetry={() => void iemisQuery.refetch()} />
              ) : null}
            </div>
          ) : attentionItems.length > 0 ? (
            <div className="grid gap-3">
              {attentionItems.map((item) => (
                <AttentionCard key={item.key} item={item} />
              ))}
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-2xl border border-success-100 bg-success-50 p-4 text-success-800">
              <CheckCircle2 size={21} className="mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold">No profile issues need attention right now.</p>
                <p className="mt-1 text-xs font-medium leading-5">
                  Fee clearance, iEMIS readiness, and uploaded document status do not currently show blockers.
                </p>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="At a glance" description="Backend-owned summary values and scoped profile counts.">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <GlanceCard
              icon={<CalendarCheck size={18} />}
              label="Attendance"
              value={
                attendanceQuery.data
                  ? `${attendanceQuery.data.summary.attendancePercentage}%`
                  : attendanceQuery.isLoading
                    ? 'Checking'
                    : 'Unavailable'
              }
              detail={
                attendanceQuery.data
                  ? `${attendanceQuery.data.summary.totalRecords} recorded day${attendanceQuery.data.summary.totalRecords === 1 ? '' : 's'}`
                  : 'From attendance history API'
              }
              onClick={() => onSelectTab('Attendance')}
            />
            <GlanceCard
              icon={<Wallet size={18} />}
              label="Fee clearance"
              value={
                feeClearanceQuery.data
                  ? feeClearanceQuery.data.cleared
                    ? 'Cleared'
                    : formatMoney(feeClearanceQuery.data.outstandingAmount)
                  : feeClearanceQuery.isLoading
                    ? 'Checking'
                    : 'Unavailable'
              }
              detail="From fee-clearance API"
              onClick={() => onSelectTab('Fees')}
            />
            <GlanceCard
              icon={<Users size={18} />}
              label="Guardians"
              value={profile.guardians.length.toString()}
              detail={primaryGuardian ? `Primary: ${primaryGuardian.fullName}` : 'No guardian linked'}
              onClick={() => onSelectTab('Guardians')}
            />
            <GlanceCard
              icon={<FileText size={18} />}
              label="Documents"
              value={profile.documents.length.toString()}
              detail={documentIssues.length > 0 ? `${documentIssues.length} need review` : 'Uploaded documents'}
              onClick={() => onSelectTab('Documents')}
            />
          </div>
        </SectionCard>

        <SectionCard title="Related records" description="Recent activity and current enrollment context from this profile response.">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <div className="mb-3 flex items-center gap-2 text-[0.68rem] font-black uppercase tracking-widest text-slate-400">
                <GraduationCap size={15} aria-hidden="true" />
                Current enrollment
              </div>
              {currentEnrollment ? (
                <div>
                  <p className="text-lg font-black text-slate-950">
                    Class {currentEnrollment.className}
                    {currentEnrollment.sectionName ? ` • Section ${currentEnrollment.sectionName}` : ''}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    {currentEnrollment.academicYear}
                    {currentEnrollment.rollNumber ? ` • Roll ${currentEnrollment.rollNumber}` : ''}
                  </p>
                  <Badge className="mt-3 border-[var(--color-mod-admissions-border)] bg-white text-[var(--color-mod-admissions-text)]">
                    {formatStatus(currentEnrollment.status)}
                  </Badge>
                </div>
              ) : (
                <p className="text-sm font-semibold text-slate-500">No enrollment record is available.</p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <div className="mb-3 flex items-center gap-2 text-[0.68rem] font-black uppercase tracking-widest text-slate-400">
                <Clock size={15} aria-hidden="true" />
                Recent student activity
              </div>
              {profile.activityPosts.length > 0 ? (
                <div className="space-y-3">
                  {profile.activityPosts.slice(0, 3).map((post) => (
                    <div key={post.id} className="rounded-xl bg-white p-3">
                      <p className="line-clamp-1 text-sm font-bold text-slate-900">{post.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-slate-500">
                        {post.body || post.caption || 'Activity details are not recorded.'}
                      </p>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => onSelectTab('Activity')}
                    className="text-xs font-bold text-[var(--color-mod-admissions-text)] hover:underline"
                  >
                    View activity
                  </button>
                </div>
              ) : (
                <p className="text-sm font-semibold text-slate-500">No recent student activity is available in this profile.</p>
              )}
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="space-y-6">
        <SectionCard title="Quick summary">
          <div className="space-y-3">
            <SummaryRow label="Student ID" value={profile.student.studentSystemId} />
            <SummaryRow label="Lifecycle" value={formatStatus(profile.student.lifecycleStatus ?? 'ACTIVE')} />
            <SummaryRow
              label="Class"
              value={
                currentEnrollment
                  ? `${currentEnrollment.className}${currentEnrollment.sectionName ? ` / ${currentEnrollment.sectionName}` : ''}`
                  : profile.student.className ?? profile.student.class?.name ?? 'Not assigned'
              }
            />
            <SummaryRow
              label="Roll"
              value={(currentEnrollment?.rollNumber ?? profile.student.rollNumber)?.toString() ?? 'Not assigned'}
            />
          </div>
        </SectionCard>

        <SectionCard title="iEMIS readiness">
          {iemisQuery.isLoading ? (
            <p className="text-sm font-semibold text-slate-500">Checking iEMIS readiness...</p>
          ) : iemisQuery.isError ? (
            <ErrorState
              title="iEMIS unavailable"
              message="Readiness could not be checked right now."
              onRetry={() => void iemisQuery.refetch()}
              className="min-h-0 p-5"
            />
          ) : iemisQuery.data ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <Badge variant={iemisQuery.data.eligible ? 'success' : 'warning'}>
                  {iemisQuery.data.eligible ? 'Ready' : 'Incomplete'}
                </Badge>
                <span className="text-2xl font-black text-slate-950">{iemisQuery.data.score}%</span>
              </div>
              {iemisQuery.data.issues.length > 0 ? (
                <ul className="space-y-2">
                  {iemisQuery.data.issues.slice(0, 4).map((issue) => (
                    <li key={`${issue.field}-${issue.message}`} className="flex gap-2 text-xs font-medium leading-5 text-slate-600">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning-600" aria-hidden="true" />
                      <span>{issue.message}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs font-semibold leading-5 text-slate-500">
                  No iEMIS issues are currently reported by the readiness API.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm font-semibold text-slate-500">iEMIS readiness is unavailable.</p>
          )}
        </SectionCard>

        <StudentQrCard
          studentId={profile.student.id}
          studentSystemId={profile.student.studentSystemId}
          qrCredential={profile.student.qrCredential ?? null}
          onOpenIdCard={(token) => onOpenPdf('id-card', token)}
        />
      </div>
    </div>
  );
}

type AttentionItem = {
  key: string;
  tone: 'danger' | 'warning';
  title: string;
  description: string;
  action: string;
  onClick: () => void;
};

function AttentionCard({ item }: { item: AttentionItem }) {
  const danger = item.tone === 'danger';
  return (
    <div className={`rounded-2xl border p-4 ${danger ? 'border-danger-100 bg-danger-50' : 'border-warning-100 bg-warning-50'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${danger ? 'text-danger-600' : 'text-warning-600'}`} aria-hidden="true" />
          <div>
            <p className={`text-sm font-bold ${danger ? 'text-danger-800' : 'text-warning-800'}`}>{item.title}</p>
            <p className={`mt-1 text-xs font-medium leading-5 ${danger ? 'text-danger-700' : 'text-warning-700'}`}>{item.description}</p>
          </div>
        </div>
        <button type="button" onClick={item.onClick} className="shrink-0 text-xs font-bold text-slate-800 underline underline-offset-4">
          {item.action}
        </button>
      </div>
    </div>
  );
}

function InlineError({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-danger-100 bg-danger-50 p-4 text-danger-800">
      <p className="text-sm font-bold">{title}</p>
      <button type="button" onClick={onRetry} className="text-xs font-bold underline underline-offset-4">
        Retry
      </button>
    </div>
  );
}

function GlanceCard({
  icon,
  label,
  value,
  detail,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-left transition hover:border-[var(--color-mod-admissions-border)] hover:bg-white"
    >
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[var(--color-mod-admissions-accent)] shadow-sm">
        {icon}
      </div>
      <p className="text-[0.68rem] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-medium leading-5 text-slate-500">{detail}</p>
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <span className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</span>
      <span className="text-right text-sm font-bold text-slate-800">{value}</span>
    </div>
  );
}

function getDocumentAttention(documents: StudentDocument[]) {
  return documents.filter((document) => {
    if (document.status === 'REJECTED' || document.status === 'ARCHIVED') return true;
    const expiry = document.expiryDate ? new Date(document.expiryDate) : null;
    if (!expiry || Number.isNaN(expiry.getTime())) return false;
    const daysUntilExpiry = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30;
  });
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat('en-NP', {
    style: 'currency',
    currency: 'NPR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatStatus(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
