'use client';

import {
  formatBsDate,
  teacherEligibilityReasonLabel,
  TEACHER_ELIGIBILITY_STATE_LABELS,
  type TeacherEligibilitySummary,
  type TeacherEligibilityWorkspaceItem,
  type TeacherEvidenceRequirementStatus,
} from '@schoolos/core';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Surface } from '@/components/schoolos';
import { api } from '../../lib/api';
import {
  assignmentSummary,
  blockingChangeSentence,
  buildWorkspaceQuery,
  DEFAULT_HORIZON_DAYS,
  eligibilityStateTone,
  evidenceStatusLabel,
  evidenceStatusTone,
  HORIZON_OPTIONS,
  parseHorizonDays,
  primaryReasonLabel,
  STATE_FILTERS,
  WORKSPACE_PAGE_SIZE,
  WORKSPACE_POPULATION_LIMIT,
  type WorkspaceStateFilter,
} from '../../lib/teacher-eligibility-view';
import {
  PaginatedDataTable,
  type PaginatedDataTableColumn,
} from '../schoolos/data/paginated-data-table';
import { useSession } from '../session-provider';
import { Drawer } from '../ui/drawer';
import { PermissionDenied } from '../ui/permission-denied';
import { SearchInput } from '../ui/search-input';
import { Select } from '../ui/select';
import { StatusBadge } from '../ui/status-badge';

/**
 * Phase 7.10 (7L): school-wide teacher eligibility, read-only.
 *
 * Every state shown here is the server's decision under the applicable
 * approved policy. This page never grants, revokes or overrides anything and
 * has no mutation controls: verifying or revoking evidence stays in the Staff
 * 360 professional panel, which is linked from each teacher. A Teacher role is
 * not evidence.
 */
export function TeacherEligibilityWorkspace() {
  const { hasPermissions } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<WorkspaceStateFilter>('ALL');
  const [atRiskOnly, setAtRiskOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [horizonDays, setHorizonDays] = useState<number>(DEFAULT_HORIZON_DAYS);
  const [page, setPage] = useState(1);
  const selectedStaffId = searchParams.get('staff');

  const canRead = hasPermissions(['hr:read']);
  const query = buildWorkspaceQuery({
    status,
    atRiskOnly,
    search,
    horizonDays,
    page,
  });
  const workspace = useQuery({
    queryKey: ['hr-teacher-eligibility-workspace', query],
    queryFn: () => api.getEligibilityWorkspace(query),
    enabled: canRead,
  });

  if (!canRead) {
    return (
      <PermissionDenied
        title="Teacher eligibility is restricted"
        description="You need HR read access to see teacher eligibility."
        showNavigation={false}
      />
    );
  }

  const resetPage = () => setPage(1);
  const data = workspace.data;
  const totals = data?.totals;
  const closeDrawer = () => {
    router.replace('/dashboard/hr/teacher-eligibility', { scroll: false });
  };
  const openTeacher = (staffId: string) => {
    router.replace(
      `/dashboard/hr/teacher-eligibility?staff=${encodeURIComponent(staffId)}`,
      { scroll: false },
    );
  };

  const columns: PaginatedDataTableColumn<TeacherEligibilityWorkspaceItem>[] = [
    {
      id: 'teacher',
      header: 'Teacher',
      cell: (item) => (
        <div>
          <p className="font-bold text-slate-900">{item.name}</p>
          <p className="text-xs text-slate-500">{item.employeeId}</p>
        </div>
      ),
    },
    {
      id: 'state',
      header: 'State',
      cell: (item) => (
        <div className="flex flex-wrap items-center gap-1">
          <StatusBadge tone={eligibilityStateTone(item.state)}>
            {TEACHER_ELIGIBILITY_STATE_LABELS[item.state]}
          </StatusBadge>
          {item.atRisk && <StatusBadge tone="pending">At risk</StatusBadge>}
        </div>
      ),
    },
    {
      id: 'reason',
      header: 'Why',
      cell: (item) => (
        <span className="text-sm text-slate-700">
          {primaryReasonLabel(item)}
        </span>
      ),
    },
    {
      id: 'employment',
      header: 'Employment',
      hideBelow: 'lg',
      cell: (item) =>
        item.employment ? (
          <span className="text-xs text-slate-600">
            {formatBsDate(item.employment.effectiveFrom)} –{' '}
            {item.employment.effectiveTo
              ? formatBsDate(item.employment.effectiveTo)
              : 'open'}
          </span>
        ) : (
          <span className="text-xs text-slate-500">None current</span>
        ),
    },
    {
      id: 'policy',
      header: 'Policy',
      hideBelow: 'lg',
      cell: (item) =>
        item.policy ? (
          <span className="text-xs text-slate-600">
            {item.policy.policyKey} v{item.policy.version} ·{' '}
            {item.policy.scope.replace('_', ' ').toLowerCase()}
          </span>
        ) : (
          <span className="text-xs text-slate-500">Not resolved</span>
        ),
    },
    {
      id: 'evidence',
      header: 'Evidence',
      hideBelow: 'md',
      cell: (item) => (
        <div className="space-y-1 text-xs">
          <p>
            Qualification:{' '}
            <span className="font-semibold">
              {evidenceStatusLabel(item.evidence.qualification)}
            </span>
          </p>
          <p>
            Licence:{' '}
            <span className="font-semibold">
              {evidenceStatusLabel(item.evidence.licence)}
            </span>
          </p>
        </div>
      ),
    },
    {
      id: 'assignments',
      header: 'Assignments',
      hideBelow: 'md',
      cell: (item) => (
        <span className="text-xs text-slate-600">
          {assignmentSummary(item)}
        </span>
      ),
    },
    {
      id: 'next',
      header: 'Next change',
      hideBelow: 'md',
      cell: (item) =>
        item.nextBlockingChange ? (
          <span className="text-xs text-warning-700">
            {blockingChangeSentence(item.nextBlockingChange)}
          </span>
        ) : (
          <span className="text-xs text-slate-500">None in window</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <Surface
        title="Teacher eligibility"
        description="The policy-driven result for every teacher: current employment, required evidence, applicable policy and what is about to change. This page only reports; it never grants, revokes or overrides anything, and a Teacher role is not evidence."
      >
        <div
          role="group"
          aria-label="Eligibility summary"
          className="grid grid-cols-2 gap-2 md:grid-cols-5"
        >
          <SummaryButton
            label="All teachers"
            count={totals?.total}
            active={status === 'ALL' && !atRiskOnly}
            onClick={() => {
              setStatus('ALL');
              setAtRiskOnly(false);
              resetPage();
            }}
          />
          <SummaryButton
            label="Ineligible"
            count={totals?.ineligible}
            active={status === 'INELIGIBLE'}
            onClick={() => {
              setStatus('INELIGIBLE');
              setAtRiskOnly(false);
              resetPage();
            }}
          />
          <SummaryButton
            label="Needs review"
            count={totals?.needsReview}
            active={status === 'NEEDS_REVIEW'}
            onClick={() => {
              setStatus('NEEDS_REVIEW');
              setAtRiskOnly(false);
              resetPage();
            }}
          />
          <SummaryButton
            label="Eligible"
            count={totals?.eligible}
            active={status === 'ELIGIBLE' && !atRiskOnly}
            onClick={() => {
              setStatus('ELIGIBLE');
              setAtRiskOnly(false);
              resetPage();
            }}
          />
          <SummaryButton
            label={`At risk (${String(parseHorizonDays(horizonDays))} days)`}
            count={totals?.atRisk}
            active={atRiskOnly}
            onClick={() => {
              setStatus('ALL');
              setAtRiskOnly(true);
              resetPage();
            }}
          />
        </div>
        {data?.truncated && (
          <p className="mt-3 text-xs text-warning-700">
            This school has more teachers than one evaluation covers. Totals
            describe the first {WORKSPACE_POPULATION_LIMIT} by name; narrow with
            search.
          </p>
        )}
      </Surface>

      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="md:w-72">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              resetPage();
            }}
            placeholder="Search name or employee ID"
            label="Search teachers"
            debounceMs={300}
          />
        </div>
        <label className="grid gap-1 text-xs font-semibold text-slate-600 md:w-56">
          Look ahead for changes
          <Select
            value={horizonDays}
            onChange={(event) => {
              setHorizonDays(parseHorizonDays(event.target.value));
              resetPage();
            }}
          >
            {HORIZON_OPTIONS.map((days) => (
              <option key={days} value={days}>
                {days} days
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-600 md:w-48">
          State
          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as WorkspaceStateFilter);
              resetPage();
            }}
          >
            {STATE_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <PaginatedDataTable
        columns={columns}
        items={data?.items ?? []}
        getRowId={(item) => item.staffId}
        status={
          workspace.isError
            ? 'error'
            : workspace.isLoading
              ? 'loading'
              : 'ready'
        }
        page={page}
        pageSize={WORKSPACE_PAGE_SIZE}
        totalItems={data?.totalItems ?? 0}
        onPageChange={setPage}
        onRetry={() => void workspace.refetch()}
        onRowClick={(item) => openTeacher(item.staffId)}
        getRowActionLabel={(item) => `Open eligibility for ${item.name}`}
        errorMessage="Teacher eligibility could not be loaded. Check your HR permission and retry."
        emptyTitle="No teachers to evaluate"
        emptyDescription="Teachers appear here once they have a teacher profile or a teaching assignment."
        hasActiveFilters={
          status !== 'ALL' || atRiskOnly || search.trim().length > 0
        }
        noResultsTitle="No teachers match these filters"
        noResultsDescription="Clear the state, at-risk or search filter to see everyone."
      />

      <Drawer
        isOpen={Boolean(selectedStaffId)}
        onClose={closeDrawer}
        title="Teacher eligibility detail"
        description="Server decision under the applicable approved policy"
        width="lg"
      >
        {selectedStaffId && (
          <EligibilityDetail
            staffId={selectedStaffId}
            horizonDays={parseHorizonDays(horizonDays)}
          />
        )}
      </Drawer>
    </div>
  );
}

function SummaryButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number | undefined;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-xl border px-3 py-3 text-left transition-colors ${
        active
          ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
          : 'border-slate-200 bg-white hover:bg-slate-50'
      }`}
    >
      <span className="block text-xs font-semibold text-slate-600">
        {label}
      </span>
      <span className="block text-2xl font-black tabular-nums text-slate-950">
        {count ?? '–'}
      </span>
    </button>
  );
}

function EligibilityDetail({
  staffId,
  horizonDays,
}: {
  staffId: string;
  horizonDays: number;
}) {
  const summary = useQuery({
    queryKey: ['hr-teacher-eligibility-summary', staffId, horizonDays],
    queryFn: () => api.getEligibilitySummary(staffId, horizonDays),
  });
  if (summary.isLoading)
    return <p className="text-sm text-slate-500">Loading eligibility…</p>;
  if (summary.isError || !summary.data)
    return (
      <p role="alert" className="text-sm text-slate-700">
        This teacher&apos;s eligibility could not be loaded. They may not exist
        in this school, or you may not have HR read access.
      </p>
    );
  return <EligibilityDetailBody summary={summary.data} />;
}

function EligibilityDetailBody({
  summary,
}: {
  summary: TeacherEligibilitySummary;
}) {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-bold text-slate-950">{summary.name}</h3>
          <StatusBadge tone={eligibilityStateTone(summary.state)}>
            {TEACHER_ELIGIBILITY_STATE_LABELS[summary.state]}
          </StatusBadge>
          {summary.atRisk && <StatusBadge tone="pending">At risk</StatusBadge>}
        </div>
        <p className="text-xs text-slate-500">{summary.employeeId}</p>
        <p className="text-sm text-slate-700">
          {teacherEligibilityReasonLabel(summary.primaryReasonCode)}
        </p>
        <p className="text-xs text-slate-500">
          Employment:{' '}
          {summary.employment
            ? `${formatBsDate(summary.employment.effectiveFrom)} – ${
                summary.employment.effectiveTo
                  ? formatBsDate(summary.employment.effectiveTo)
                  : 'open'
              }`
            : 'no current verified employment'}
          {' · '}
          Teacher profile:{' '}
          {summary.profile
            ? `${summary.profile.status.toLowerCase()} from ${formatBsDate(
                summary.profile.effectiveFrom,
              )}`
            : 'none'}
        </p>
        <Link
          href={`/dashboard/hr/staff/${encodeURIComponent(summary.staffId)}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-slate-800 underline"
        >
          <ShieldCheck size={14} aria-hidden="true" />
          Open the staff record to verify or revoke evidence
        </Link>
      </header>

      <section aria-label="Upcoming blocking changes" className="space-y-2">
        <h4 className="text-sm font-bold text-slate-900">
          Upcoming changes ({summary.horizonDays} days)
        </h4>
        {summary.blockingChanges.length === 0 ? (
          <p className="text-sm text-slate-600">
            Nothing is scheduled to end or change this teacher&apos;s result
            inside the window.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {summary.blockingChanges.map((change) => (
              <li
                key={`${change.kind}-${change.at}-${change.policyKey ?? ''}`}
                className="rounded-lg border border-warning-100 bg-warning-50 px-3 py-2 text-warning-700"
              >
                {blockingChangeSentence(change)}
                {change.affectedAssignments > 0 &&
                  ` · affects ${String(change.affectedAssignments)} assignment${
                    change.affectedAssignments === 1 ? '' : 's'
                  }`}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Current assignments" className="space-y-2">
        <h4 className="text-sm font-bold text-slate-900">
          Current assignments
        </h4>
        {summary.assignments.length === 0 ? (
          <p className="text-sm text-slate-600">
            No current assignment. The policy is checked when a class or subject
            is assigned.
          </p>
        ) : (
          <ul className="space-y-3">
            {summary.assignments.map((assignment) => (
              <li
                key={assignment.assignmentId}
                className="rounded-xl border border-slate-200 p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">
                    {assignment.className} {assignment.sectionName}
                    {assignment.subjectName
                      ? ` · ${assignment.subjectName}`
                      : ''}
                  </p>
                  <StatusBadge tone={eligibilityStateTone(assignment.state)}>
                    {TEACHER_ELIGIBILITY_STATE_LABELS[assignment.state]}
                  </StatusBadge>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {teacherEligibilityReasonLabel(assignment.reasonCode)}
                </p>
                {assignment.requirements && (
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt className="text-slate-500">Policy</dt>
                    <dd className="font-semibold text-slate-800">
                      {assignment.requirements.policy.policyKey} v
                      {assignment.requirements.policy.version} ·{' '}
                      {assignment.requirements.policy.scope
                        .replace('_', ' ')
                        .toLowerCase()}
                    </dd>
                    <dt className="text-slate-500">Source</dt>
                    <dd className="text-slate-800">
                      {assignment.requirements.policy.sourceTitle}
                    </dd>
                    {assignment.requirements.baselines.length > 0 && (
                      <>
                        <dt className="text-slate-500">Mandatory baselines</dt>
                        <dd className="text-slate-800">
                          {assignment.requirements.baselines
                            .map((item) => `${item.policyKey} v${item.version}`)
                            .join(', ')}
                        </dd>
                      </>
                    )}
                    <dt className="text-slate-500">Qualification</dt>
                    <dd>
                      <RequirementChip
                        required={
                          assignment.requirements.qualification.required
                        }
                        status={assignment.requirements.qualification.status}
                      />
                    </dd>
                    <dt className="text-slate-500">Teaching licence</dt>
                    <dd>
                      <RequirementChip
                        required={assignment.requirements.licence.required}
                        status={assignment.requirements.licence.status}
                      />
                    </dd>
                  </dl>
                )}
                <p className="mt-2 text-[11px] text-slate-500">
                  {assignment.createdUnder
                    ? `Created under a ${assignment.createdUnder.outcome.toLowerCase()} decision on ${formatBsDate(assignment.createdUnder.evaluatedAt)}`
                    : 'Created before eligibility checks existed (legacy)'}
                </p>
              </li>
            ))}
          </ul>
        )}
        {summary.upcomingAssignments.length > 0 && (
          <p className="text-xs text-slate-500">
            {summary.upcomingAssignments.length} upcoming assignment
            {summary.upcomingAssignments.length === 1 ? '' : 's'} start later;
            their eligibility is checked when they take effect.
          </p>
        )}
      </section>

      <section aria-label="Evidence on file" className="space-y-2">
        <h4 className="text-sm font-bold text-slate-900">Evidence on file</h4>
        {summary.evidence.length === 0 ? (
          <p className="text-sm text-slate-600">No evidence submitted.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {summary.evidence.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2"
              >
                <div>
                  <p className="font-semibold text-slate-900">{item.label}</p>
                  <p className="text-xs text-slate-500">
                    Level {item.levelCode ?? 'any'} · subject{' '}
                    {item.subjectCode ?? 'any'} · {formatBsDate(item.validFrom)}{' '}
                    – {item.validUntil ? formatBsDate(item.validUntil) : 'open'}
                  </p>
                </div>
                <StatusBadge
                  tone={
                    item.effectiveState === 'CURRENT'
                      ? 'approved'
                      : item.effectiveState === 'PENDING' ||
                          item.effectiveState === 'NOT_YET_VALID'
                        ? 'pending'
                        : 'rejected'
                  }
                >
                  {item.effectiveState.replaceAll('_', ' ')}
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}
        {summary.evidence.some((item) => item.referencesRedacted) && (
          <p className="text-xs text-slate-500">
            Document and source references are hidden because they need HR
            documents access.
          </p>
        )}
      </section>

      <section aria-label="Recent decisions" className="space-y-2">
        <h4 className="text-sm font-bold text-slate-900">Recent decisions</h4>
        {summary.recentAssessments.length === 0 ? (
          <p className="text-sm text-slate-600">No recorded decisions yet.</p>
        ) : (
          <ul className="space-y-1 text-xs text-slate-600">
            {summary.recentAssessments.map((row) => (
              <li key={row.id}>
                {formatBsDate(row.evaluatedAt)} · {row.outcome.toLowerCase()} ·{' '}
                {teacherEligibilityReasonLabel(row.reasonCode)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function RequirementChip({
  required,
  status,
}: {
  required: boolean;
  status: TeacherEvidenceRequirementStatus | null;
}) {
  if (!required || !status)
    return <span className="text-slate-500">Not required</span>;
  return (
    <StatusBadge tone={evidenceStatusTone(status)}>
      {evidenceStatusLabel(status)}
    </StatusBadge>
  );
}
