'use client';

import type { AttendanceAnalytics as AttendanceAnalyticsData } from '@schoolos/core';
import type { ReactNode } from 'react';
import { SectionCard } from '@/components/ui/section-card';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import type { AttendanceAnomalies } from '@/lib/api/attendance';
import { AlertCircle, CalendarX, Clock3, TrendingDown, Users } from 'lucide-react';

interface AttendanceAnalyticsProps {
  analytics?: AttendanceAnalyticsData;
  anomalies?: AttendanceAnomalies;
  isLoadingAnomalies?: boolean;
  anomaliesError?: string;
}

export function AttendanceAnalytics({
  analytics,
  anomalies,
  isLoadingAnomalies = false,
  anomaliesError = '',
}: AttendanceAnalyticsProps) {
  if (!analytics) return null;

  const anomalyCounts = {
    absenceStreaks: anomalies?.absenceStreaks.length ?? 0,
    repeatedLates: anomalies?.repeatedLates.length ?? 0,
    rosterDivergences: anomalies?.anomalies.rosterDivergences.length ?? 0,
    lateSubmissions: anomalies?.anomalies.lateSubmissions.length ?? 0,
    attendanceDrops: anomalies?.anomalies.attendanceDrops.length ?? 0,
    unsubmittedWorkingDays: anomalies?.anomalies.unsubmittedWorkingDays.length ?? 0,
  };
  const totalAnomalies = Object.values(anomalyCounts).reduce(
    (sum, count) => sum + count,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Sessions Reviewed"
          value={analytics.sessionsReviewed}
          icon={<Users size={20} />}
          tone="info"
        />
        <StatCard
          title="Monthly Attendance"
          value={`${analytics.monthlyAttendance.attendancePercent}%`}
          icon={<TrendingDown size={20} />}
          tone="success"
        />
        <StatCard
          title="Students Below 80%"
          value={analytics.below80Warnings?.length ?? 0}
          icon={<AlertCircle size={20} />}
          tone="warning"
        />
        <StatCard
          title="Anomaly Alerts"
          value={isLoadingAnomalies ? '...' : totalAnomalies}
          icon={<CalendarX size={20} />}
          tone={totalAnomalies > 0 ? 'warning' : 'neutral'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Absence Patterns"
          description="Students with high absence frequency"
        >
        <div className="space-y-4">
          {analytics.absenceHotlist?.slice(0, 5).map((item) => (
            <div key={item.studentId} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700">
                  {item.absenceCount}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Student record</p>
                  <p className="text-[0.7rem] text-slate-500 uppercase tracking-wider font-bold">Total Absences</p>
                </div>
              </div>
              <Badge variant="warning">Action Required</Badge>
            </div>
          ))}
          {(!analytics.absenceHotlist || analytics.absenceHotlist.length === 0) && (
            <p className="text-sm text-slate-500 text-center py-4">No significant patterns detected.</p>
          )}
        </div>
        </SectionCard>

        <SectionCard
          title="Attendance Risk Alerts"
          description="Students below 80% attendance threshold"
        >
        <div className="space-y-4">
          {analytics.below80Warnings?.slice(0, 5).map((item) => (
            <div key={item.studentId} className="flex items-center justify-between p-4 bg-red-50/50 border border-red-100 rounded-2xl">
              <div>
                <p className="text-sm font-bold text-slate-900">{item.fullNameEn}</p>
                <p className="text-[0.7rem] text-slate-500 uppercase tracking-wider font-bold">{item.studentSystemId}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-destructive">{item.attendancePercent}%</p>
                <p className="text-[0.6rem] text-slate-400 uppercase tracking-widest font-bold">Current Rate</p>
              </div>
            </div>
          ))}
          {(!analytics.below80Warnings || analytics.below80Warnings.length === 0) && (
            <p className="text-sm text-slate-500 text-center py-4">No students currently at risk.</p>
          )}
        </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Operational Anomaly Dashboard"
        description="Backend-detected absence streaks, repeated late arrivals, roster mismatches, delayed submissions, attendance drops, and unsubmitted working days."
      >
        {isLoadingAnomalies ? (
          <p className="py-4 text-center text-sm text-slate-500">Loading anomaly checks...</p>
        ) : anomaliesError ? (
          <div className="rounded-xl border border-danger-100 bg-danger-50/50 p-4 text-sm font-semibold text-danger-700">
            {anomaliesError}
          </div>
        ) : totalAnomalies === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">No attendance anomalies detected in the current review window.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <AnomalyList
              title="Absence Streaks"
              icon={<AlertCircle size={16} />}
              count={anomalyCounts.absenceStreaks}
              rows={anomalies?.absenceStreaks.slice(0, 5).map((item) => ({
                key: item.studentId,
                title: item.studentName,
                detail: `${classSectionLabel(item.className, item.sectionName)} - ${item.streakCount} consecutive absences`,
                badge: `${item.streakCount} days`,
              })) ?? []}
            />
            <AnomalyList
              title="Repeated Late Arrivals"
              icon={<Clock3 size={16} />}
              count={anomalyCounts.repeatedLates}
              rows={anomalies?.repeatedLates.slice(0, 5).map((item) => ({
                key: item.studentId,
                title: item.studentName,
                detail: `${classSectionLabel(item.className, item.sectionName)} - last 30 days`,
                badge: `${item.lateCount} late`,
              })) ?? []}
            />
            <AnomalyList
              title="Roster Divergence"
              count={anomalyCounts.rosterDivergences}
              rows={anomalies?.anomalies.rosterDivergences.slice(0, 5).map((item) => ({
                key: item.sessionId,
                title: classSectionLabel(item.className, item.sectionName),
                detail: `${formatDate(item.attendanceDate)} - expected ${item.expectedCount}, recorded ${item.actualCount}`,
                badge: `${item.missing.length + item.unexpected.length} records`,
              })) ?? []}
            />
            <AnomalyList
              title="Late Submissions"
              count={anomalyCounts.lateSubmissions}
              rows={anomalies?.anomalies.lateSubmissions.slice(0, 5).map((item) => ({
                key: item.sessionId,
                title: classSectionLabel(item.className, item.sectionName),
                detail: `${formatDate(item.attendanceDate)} - submitted after the expected window`,
                badge: `${item.delayHours}h late`,
              })) ?? []}
            />
            <AnomalyList
              title="Attendance Drops"
              count={anomalyCounts.attendanceDrops}
              rows={anomalies?.anomalies.attendanceDrops.slice(0, 5).map((item) => ({
                key: `${item.classId}-${item.sectionId ?? 'none'}-${item.attendanceDate}`,
                title: classSectionLabel(item.className, item.sectionName),
                detail: `${formatDate(item.attendanceDate)} - ${item.previousAverage}% average to ${item.currentRate}%`,
                badge: `-${item.dropPercentage}%`,
              })) ?? []}
            />
            <AnomalyList
              title="Unsubmitted Working Days"
              count={anomalyCounts.unsubmittedWorkingDays}
              rows={anomalies?.anomalies.unsubmittedWorkingDays.slice(0, 5).map((item) => ({
                key: `${item.classId}-${item.sectionId ?? 'none'}-${item.attendanceDate}`,
                title: classSectionLabel(item.className, item.sectionName),
                detail: formatDate(item.attendanceDate),
                badge: 'Missing',
              })) ?? []}
            />
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function AnomalyList({
  title,
  count,
  rows,
  icon,
}: {
  title: string;
  count: number;
  rows: Array<{ key: string; title: string; detail: string; badge: string }>;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon ? <span className="text-slate-500">{icon}</span> : null}
          <h3 className="text-sm font-black text-slate-900">{title}</h3>
        </div>
        <Badge variant={count > 0 ? 'warning' : 'default'}>{count}</Badge>
      </div>
      <div className="mt-4 space-y-3">
        {rows.length > 0 ? (
          rows.map((row) => (
            <div key={row.key} className="rounded-lg border border-slate-100 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">{row.title}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">{row.detail}</p>
                </div>
                <Badge variant="warning">{row.badge}</Badge>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-lg bg-white px-3 py-4 text-center text-xs font-semibold text-slate-500">
            No current alerts.
          </p>
        )}
      </div>
    </div>
  );
}

function classSectionLabel(className: string, sectionName: string | null) {
  return sectionName ? `${className} / ${sectionName}` : className;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}
