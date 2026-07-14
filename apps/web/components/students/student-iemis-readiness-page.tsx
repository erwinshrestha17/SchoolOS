'use client';

import type {
  PermissionKey,
  StudentIemisIssueCategory,
  StudentIemisReadiness,
  StudentIemisReadinessIssue,
  StudentIemisReadinessStatus,
} from '@schoolos/core';
import { formatBsDate, formatBsDateTime } from '@schoolos/core';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Info,
  MinusCircle,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';
import { api, ApiRequestError } from '@/lib/api';
import { useBreadcrumbLabel } from '@/components/schoolos/navigation/breadcrumb-label-context';
import { useSession } from '@/components/session-provider';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { ModuleLockedState } from '@/components/ui/module-locked-state';
import { PageState } from '@/components/ui/page-state';
import { SectionCard } from '@/components/ui/section-card';

const CATEGORY_LABELS: Record<StudentIemisIssueCategory, string> = {
  IDENTITY: 'Identity',
  ENROLLMENT_PLACEMENT: 'Enrollment and placement',
  GUARDIAN_INFORMATION: 'Guardian information',
  TRANSFER_INFORMATION: 'Transfer information',
  DOCUMENTS: 'Documents',
  ATTENDANCE: 'Attendance',
  ACADEMIC_STATUS_RESULTS: 'Academic status and results',
};

const CATEGORY_ORDER = Object.keys(
  CATEGORY_LABELS,
) as StudentIemisIssueCategory[];

export function StudentIemisReadinessPage({
  studentId,
}: {
  studentId: string;
}) {
  const { hasPermissions } = useSession();
  const readinessQuery = useQuery({
    queryKey: ['student-iemis-readiness', studentId],
    queryFn: () => api.getIemisReadiness(studentId),
    enabled: Boolean(studentId),
  });

  useBreadcrumbLabel(
    readinessQuery.data
      ? `${readinessQuery.data.fullNameEn} reporting readiness`
      : null,
  );

  if (readinessQuery.isLoading) {
    return (
      <LoadingState
        variant="page"
        label="Checking government-reporting readiness…"
      />
    );
  }

  if (readinessQuery.isError) {
    return (
      <ReadinessFailure
        error={readinessQuery.error}
        onRetry={() => void readinessQuery.refetch()}
      />
    );
  }

  const readiness = readinessQuery.data;

  if (!readiness) {
    return (
      <EmptyState
        title="Readiness has not been checked"
        description="Check this student’s government-reporting details before preparing an export."
      />
    );
  }

  if (!hasCompleteReadinessResponse(readiness)) {
    return (
      <ErrorState
        title="Readiness details are incomplete"
        message="Some reporting details could not be loaded. Try the SchoolOS check again before making an export decision."
        onRetry={() => void readinessQuery.refetch()}
      />
    );
  }

  const status = getStatusPresentation(readiness.status);
  const issueGroups = CATEGORY_ORDER.map((category) => ({
    category,
    issues: readiness.issues.filter((issue) => issue.category === category),
  })).filter((group) => group.issues.length > 0);

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      <Link
        href={`/dashboard/students/${encodeURIComponent(studentId)}`}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-bold text-slate-600 transition hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mod-admissions-accent)] focus-visible:ring-offset-2"
      >
        <ArrowLeft size={17} aria-hidden="true" />
        Back to student profile
      </Link>

      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-[var(--color-mod-admissions-text)]">
            M1 · Student reporting
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            Government reporting readiness
          </h1>
          <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-600">
            Complete the required student information before including this
            record in the next iEMIS export.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void readinessQuery.refetch()}
          disabled={readinessQuery.isFetching}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mod-admissions-accent)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            size={16}
            className={readinessQuery.isFetching ? 'animate-spin' : ''}
            aria-hidden="true"
          />
          {readinessQuery.isFetching ? 'Checking readiness…' : 'Check again'}
        </button>
      </header>

      <SectionCard title="Student context">
        <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ContextItem label="Student" value={readiness.fullNameEn} />
          <ContextItem label="Student ID" value={readiness.studentSystemId} />
          <ContextItem
            label="iEMIS identifier"
            value={readiness.nationalStudentId ?? 'Not recorded'}
          />
          <ContextItem
            label="Academic year"
            value={readiness.academicYear ?? 'No active enrollment'}
          />
          <ContextItem
            label="Class"
            value={readiness.className ?? 'Not assigned'}
          />
          <ContextItem
            label="Section"
            value={readiness.sectionName ?? 'Not assigned'}
          />
          <ContextItem
            label="Roll number"
            value={readiness.rollNumber?.toString() ?? 'Not assigned'}
          />
          <ContextItem
            label="Enrollment status"
            value={
              readiness.enrollmentStatus
                ? formatStatus(readiness.enrollmentStatus)
                : 'No active enrollment'
            }
          />
          <ContextItem
            label="Admission date"
            value={
              readiness.admissionDate
                ? formatBsDate(readiness.admissionDate)
                : 'Not recorded'
            }
          />
        </dl>
      </SectionCard>

      <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <SectionCard title="Readiness summary">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <status.Icon
                  size={20}
                  className={status.iconClassName}
                  aria-hidden="true"
                />
                <Badge variant={status.badgeVariant}>{status.label}</Badge>
              </div>
              <p className="mt-4 text-lg font-black text-slate-950">
                {readiness.status === 'NOT_EVALUATED'
                  ? 'Required checks have not been run.'
                  : `${readiness.passedRequiredChecks} of ${readiness.totalRequiredChecks} required checks passed`}
              </p>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600">
                {getReadinessExplanation(readiness)}
              </p>
            </div>
            <div className="grid min-w-56 grid-cols-2 gap-3">
              <CountItem
                label="Blocked"
                value={readiness.blockingIssueCount}
                tone="danger"
              />
              <CountItem
                label="Warnings"
                value={readiness.warningCount}
                tone="warning"
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Validation details">
          <div className="space-y-4">
            <ContextRow
              label="Export eligibility"
              value={readiness.exportEligible ? 'Eligible' : 'Not eligible'}
            />
            <ContextRow
              label="Last checked"
              value={formatBsDateTime(readiness.evaluatedAt)}
            />
            <ContextRow
              label="Rule version"
              value={readiness.requirementVersion}
            />
          </div>
        </SectionCard>
      </section>

      {issueGroups.length > 0 ? (
        <div className="space-y-5">
          {issueGroups.map((group) => (
            <SectionCard
              key={group.category}
              title={CATEGORY_LABELS[group.category]}
            >
              <div className="grid gap-4">
                {group.issues.map((issue) => (
                  <ReadinessIssueCard
                    key={issue.code}
                    issue={issue}
                    studentId={studentId}
                    canFix={
                      issue.requiredPermission
                        ? hasPermissions([
                            issue.requiredPermission as PermissionKey,
                          ])
                        : false
                    }
                  />
                ))}
              </div>
            </SectionCard>
          ))}
        </div>
      ) : (
        <PageState
          tone="success"
          title="No reporting issues need action"
          description="All required student checks currently pass. Review any warnings before preparing the export."
        />
      )}
    </div>
  );
}

function ReadinessIssueCard({
  issue,
  studentId,
  canFix,
}: {
  issue: StudentIemisReadinessIssue;
  studentId: string;
  canFix: boolean;
}) {
  const severity = getSeverityPresentation(issue.severity);
  const actionHref = canFix ? getIssueActionHref(issue, studentId) : null;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <severity.Icon
              size={17}
              className={severity.iconClassName}
              aria-hidden="true"
            />
            <h3 className="font-black text-slate-950">{issue.title}</h3>
            <Badge variant={severity.badgeVariant}>{severity.label}</Badge>
          </div>
          <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
            {issue.message}
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <ContextItem
              label="Current value"
              value={issue.currentValueSafe ?? 'Not recorded'}
              compact
            />
            <ContextItem
              label="Required action"
              value={issue.requiredAction}
              compact
            />
          </dl>
          {!actionHref ? (
            <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-600">
              {getReadOnlyGuidance(issue)}
            </p>
          ) : null}
        </div>
        {actionHref ? (
          <Link
            href={actionHref}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-mod-admissions-accent)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--color-mod-admissions-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mod-admissions-accent)] focus-visible:ring-offset-2"
          >
            {getIssueActionLabel(issue)}
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function ContextItem({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact ? '' : 'rounded-2xl border border-slate-100 bg-slate-50/70 p-4'
      }
    >
      <dt className="text-[0.68rem] font-black uppercase tracking-widest text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-bold leading-5 text-slate-900">
        {value}
      </dd>
    </div>
  );
}

function CountItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'danger' | 'warning';
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        tone === 'danger'
          ? 'border-danger-100 bg-danger-50 text-danger-800'
          : 'border-warning-100 bg-warning-50 text-warning-800'
      }`}
    >
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs font-bold">{label}</p>
    </div>
  );
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

function getStatusPresentation(status: StudentIemisReadinessStatus) {
  switch (status) {
    case 'READY':
      return {
        label: 'Ready',
        Icon: CheckCircle2,
        iconClassName: 'text-success-600',
        badgeVariant: 'success' as const,
      };
    case 'READY_WITH_WARNINGS':
      return {
        label: 'Ready with warnings',
        Icon: AlertTriangle,
        iconClassName: 'text-warning-600',
        badgeVariant: 'warning' as const,
      };
    case 'BLOCKED':
      return {
        label: 'Needs attention',
        Icon: ShieldAlert,
        iconClassName: 'text-danger-600',
        badgeVariant: 'destructive' as const,
      };
    case 'NOT_EVALUATED':
      return {
        label: 'Not checked yet',
        Icon: Clock3,
        iconClassName: 'text-slate-500',
        badgeVariant: 'neutral' as const,
      };
    case 'OUTDATED_VALIDATION':
      return {
        label: 'Check outdated',
        Icon: Clock3,
        iconClassName: 'text-warning-600',
        badgeVariant: 'warning' as const,
      };
  }
}

function getSeverityPresentation(
  severity: StudentIemisReadinessIssue['severity'],
) {
  switch (severity) {
    case 'BLOCKING':
      return {
        label: 'Required · Blocks export',
        Icon: ShieldAlert,
        iconClassName: 'text-danger-600',
        badgeVariant: 'destructive' as const,
      };
    case 'WARNING':
      return {
        label: 'Warning',
        Icon: AlertTriangle,
        iconClassName: 'text-warning-600',
        badgeVariant: 'warning' as const,
      };
    case 'INFORMATION':
      return {
        label: 'Information',
        Icon: Info,
        iconClassName: 'text-info-600',
        badgeVariant: 'info' as const,
      };
    case 'NOT_REQUIRED':
      return {
        label: 'Not required',
        Icon: MinusCircle,
        iconClassName: 'text-slate-500',
        badgeVariant: 'neutral' as const,
      };
  }
}

function getReadinessExplanation(readiness: StudentIemisReadiness) {
  if (readiness.status === 'NOT_EVALUATED') {
    return 'No export decision should be made until the SchoolOS readiness check has run.';
  }
  if (readiness.status === 'OUTDATED_VALIDATION') {
    return 'The last check is outdated. Run the readiness check again before preparing an export.';
  }
  if (readiness.blockingIssueCount > 0) {
    return `${readiness.blockingIssueCount} required detail${readiness.blockingIssueCount === 1 ? ' must' : 's must'} be completed before this student can be included in the export.`;
  }
  if (readiness.warningCount > 0) {
    return `The student remains export-eligible, but ${readiness.warningCount} warning${readiness.warningCount === 1 ? '' : 's'} should be reviewed.`;
  }
  return 'This student currently passes all required checks for the SchoolOS export preparation workflow.';
}

function getIssueActionHref(
  issue: StudentIemisReadinessIssue,
  studentId: string,
) {
  const base = `/dashboard/students/${encodeURIComponent(studentId)}`;
  switch (issue.fixTarget) {
    case 'STUDENT_PROFILE':
      return `${base}?edit=true&focus=${encodeURIComponent(issue.field)}`;
    case 'ENROLLMENT':
      return `${base}?edit=true&focus=placement`;
    case 'GUARDIANS':
      return `${base}?tab=Guardians`;
    case 'DOCUMENTS':
      return `${base}?tab=Documents`;
    case 'ATTENDANCE':
      return `${base}?tab=Attendance`;
    case 'ACADEMICS':
      return `${base}?tab=Academic`;
    case 'NONE':
      return null;
  }
}

function getIssueActionLabel(issue: StudentIemisReadinessIssue) {
  switch (issue.code) {
    case 'NEPALI_NAME_REQUIRED':
      return 'Add Nepali name';
    case 'ENGLISH_NAME_REQUIRED':
      return 'Complete English name';
    case 'DATE_OF_BIRTH_REQUIRED':
      return 'Correct date of birth';
    case 'GENDER_REQUIRED':
      return 'Review gender';
    case 'NATIONALITY_REQUIRED':
      return 'Add nationality';
    case 'NATIONAL_STUDENT_ID_MISSING':
      return 'Add iEMIS identifier';
    case 'CLASS_PLACEMENT_REQUIRED':
      return 'Assign class';
    case 'SECTION_PLACEMENT_REQUIRED':
      return 'Assign section';
    case 'ADMISSION_DATE_REQUIRED':
      return 'Review enrollment';
    case 'GUARDIAN_CONTACT_REQUIRED':
      return 'Review guardian details';
    default:
      return 'Review details';
  }
}

function getReadOnlyGuidance(issue: StudentIemisReadinessIssue) {
  if (issue.fixTarget === 'NONE') {
    return issue.requiredAction;
  }
  switch (issue.requiredPermission) {
    case 'guardians:update':
      return `${issue.title}. Contact authorized admissions or guardian-record staff.`;
    case 'enrollments:create':
      return `${issue.title}. Contact an authorized admissions administrator.`;
    case 'students:manage_lifecycle':
      return `${issue.title}. Contact a school administrator who can manage student lifecycle records.`;
    default:
      return `${issue.title}. Contact authorized student records staff.`;
  }
}

function formatStatus(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function hasCompleteReadinessResponse(
  readiness: StudentIemisReadiness,
): boolean {
  if (!Array.isArray(readiness.issues)) return false;

  const blockingIssues = readiness.issues.filter(
    (issue) => issue.blocking || issue.severity === 'BLOCKING',
  ).length;
  const warnings = readiness.issues.filter(
    (issue) => issue.severity === 'WARNING',
  ).length;

  return (
    typeof readiness.passedRequiredChecks === 'number' &&
    typeof readiness.totalRequiredChecks === 'number' &&
    typeof readiness.blockingIssueCount === 'number' &&
    typeof readiness.warningCount === 'number' &&
    typeof readiness.exportEligible === 'boolean' &&
    typeof readiness.evaluatedAt === 'string' &&
    typeof readiness.requirementVersion === 'string' &&
    readiness.passedRequiredChecks <= readiness.totalRequiredChecks &&
    blockingIssues === readiness.blockingIssueCount &&
    warnings === readiness.warningCount
  );
}

function ReadinessFailure({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  if (isModuleLockedError(error)) {
    return (
      <ModuleLockedState
        moduleName="Student reporting"
        description="Student reporting is not enabled for this school. No readiness or export decision is shown."
      />
    );
  }

  if (error instanceof ApiRequestError && error.statusCode === 403) {
    return (
      <PageState
        tone="permission"
        title="You do not have permission to view this student’s reporting readiness."
        description="Ask a school administrator for student record access. No reporting data has been changed."
      />
    );
  }

  if (error instanceof ApiRequestError && error.statusCode === 404) {
    return (
      <EmptyState
        title="Student not found"
        description="The student record does not exist in this school or is no longer available to you."
      />
    );
  }

  return (
    <ErrorState
      title="Government-reporting readiness could not be checked"
      message="No export decision should be made from an unavailable result. Try again."
      onRetry={onRetry}
    />
  );
}

function isModuleLockedError(error: unknown) {
  if (!(error instanceof ApiRequestError) || error.statusCode !== 403) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes('subscription plan') ||
    message.includes('not enabled') ||
    message.includes('module.students')
  );
}
