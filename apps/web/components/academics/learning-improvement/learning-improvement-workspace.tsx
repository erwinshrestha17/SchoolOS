'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  formatBsDate,
  formatBsDateTime,
  type CurriculumProgressItemRecord,
  type FormativeAssessmentEvidenceRecord,
  type LearningOutcomeRecord,
  type ParentLearningGuidanceRecord,
  type RemedialGroupRecord,
  type StudentEarlyWarningItem,
  type StudentInterventionCaseRecord,
} from '@schoolos/core';
import {
  BookOpenCheck,
  ClipboardCheck,
  FolderHeart,
  HeartHandshake,
  ListChecks,
  MessagesSquare,
  Plus,
  Search,
  ShieldAlert,
  UsersRound,
} from 'lucide-react';
import { useSession } from '@/components/session-provider';
import {
  academicsWorkspaceOverflowTabs,
  academicsWorkspaceTabs,
} from '@/components/academics/academics-tabs';
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-shell';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FilterBar } from '@/components/ui/filter-bar';
import { LoadingState } from '@/components/ui/loading-state';
import { ModuleHeader } from '@/components/ui/module-header';
import { ModuleLockedState } from '@/components/ui/module-locked-state';
import { PermissionDenied } from '@/components/ui/permission-denied';
import { WorkspaceTabs } from '@/components/ui/module-tabs';
import { StatusBadge } from '@/components/ui/status-badge';
import { TablePagination } from '@/components/ui/table-pagination';
import { WorkSurface } from '@/components/ui/work-surface';
import { Button } from '@/components/ui/primitives/button';
import { Input } from '@/components/ui/primitives/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/primitives/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/primitives/table';
import { ApiRequestError, api } from '@/lib/api';
import { LearningImprovementCreateDialog } from './learning-improvement-create-dialog';
import { InterventionCaseSheet } from './intervention-case-sheet';
import {
  LearningImprovementActionDialog,
  type LearningImprovementActionTarget,
} from './learning-improvement-action-dialog';

type WorkspaceView =
  | 'attention'
  | 'cases'
  | 'evidence'
  | 'remedial'
  | 'curriculum'
  | 'guidance';

type CreateKind =
  | 'outcome'
  | 'assessment'
  | 'intervention'
  | 'remedial'
  | 'curriculum'
  | 'guidance';

type CreateContext = {
  studentId?: string;
  classId?: string;
  sectionId?: string | null;
  signalKey?: string;
  suggestedTitle?: string;
  suggestedConcern?: string;
};

const PAGE_SIZE = 20;

const workspaceViews = [
  { value: 'attention', label: 'Attention', icon: ShieldAlert },
  { value: 'cases', label: 'Follow-up cases', icon: FolderHeart },
  { value: 'evidence', label: 'Outcomes & checks', icon: ClipboardCheck },
  { value: 'remedial', label: 'Remedial groups', icon: UsersRound },
  { value: 'curriculum', label: 'Curriculum', icon: ListChecks },
  { value: 'guidance', label: 'Parent guidance', icon: MessagesSquare },
];

export function LearningImprovementWorkspace() {
  const { hasPermissions } = useSession();
  const canRead = hasPermissions(['academics:read']);
  const canWrite =
    hasPermissions(['academics:enter_marks']) ||
    hasPermissions(['academics:manage']) ||
    hasPermissions(['marks:manage']);
  const [view, setView] = useState<WorkspaceView>('attention');
  const [academicYearId, setAcademicYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(1);
  const [createKind, setCreateKind] = useState<CreateKind | null>(null);
  const [createContext, setCreateContext] = useState<CreateContext>({});
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [actionTarget, setActionTarget] =
    useState<LearningImprovementActionTarget | null>(null);

  const yearsQuery = useQuery({
    queryKey: ['academic-years'],
    queryFn: api.listAcademicYears,
    enabled: canRead,
  });
  const classesQuery = useQuery({
    queryKey: ['classes'],
    queryFn: api.listClasses,
    enabled: canRead,
  });
  const sectionsQuery = useQuery({
    queryKey: ['sections'],
    queryFn: api.listSections,
    enabled: canRead,
  });
  const subjectsQuery = useQuery({
    queryKey: ['subjects'],
    queryFn: () => api.listSubjects(),
    enabled: canRead,
  });

  const effectiveAcademicYearId =
    academicYearId ||
    yearsQuery.data?.find((year) => year.isCurrent)?.id ||
    yearsQuery.data?.[0]?.id ||
    '';
  const baseFilters = {
    ...(effectiveAcademicYearId
      ? { academicYearId: effectiveAcademicYearId }
      : {}),
    ...(classId ? { classId } : {}),
    ...(sectionId ? { sectionId } : {}),
    ...(subjectId ? { subjectId } : {}),
    page,
    limit: PAGE_SIZE,
  };

  const attentionQuery = useQuery({
    queryKey: [
      'learning-improvement',
      'early-warning',
      baseFilters,
      deferredSearch,
    ],
    queryFn: () =>
      api.getLearningEarlyWarnings({
        ...baseFilters,
        ...(deferredSearch ? { search: deferredSearch } : {}),
      }),
    enabled: canRead && view === 'attention',
  });
  const casesQuery = useQuery({
    queryKey: ['learning-improvement', 'interventions', baseFilters],
    queryFn: () => api.listStudentInterventions(baseFilters),
    enabled: canRead && view === 'cases',
  });
  const outcomesQuery = useQuery({
    queryKey: ['learning-improvement', 'outcomes', baseFilters],
    queryFn: () => api.listLearningOutcomes(baseFilters),
    enabled: canRead && view === 'evidence',
  });
  const assessmentsQuery = useQuery({
    queryKey: ['learning-improvement', 'formative-assessments', baseFilters],
    queryFn: () => api.listFormativeAssessments(baseFilters),
    enabled: canRead && view === 'evidence',
  });
  const remedialQuery = useQuery({
    queryKey: ['learning-improvement', 'remedial-groups', baseFilters],
    queryFn: () => api.listRemedialGroups(baseFilters),
    enabled: canRead && view === 'remedial',
  });
  const curriculumQuery = useQuery({
    queryKey: ['learning-improvement', 'curriculum-progress', baseFilters],
    queryFn: () => api.listCurriculumProgress(baseFilters),
    enabled: canRead && view === 'curriculum',
  });
  const guidanceQuery = useQuery({
    queryKey: ['learning-improvement', 'parent-guidance', baseFilters],
    queryFn: () => api.listParentLearningGuidance(baseFilters),
    enabled: canRead && view === 'guidance',
  });

  const activeQuery = {
    attention: attentionQuery,
    cases: casesQuery,
    evidence: outcomesQuery,
    remedial: remedialQuery,
    curriculum: curriculumQuery,
    guidance: guidanceQuery,
  }[view];

  const moduleLocked =
    activeQuery.error instanceof ApiRequestError &&
    (activeQuery.error.statusCode === 403 ||
      activeQuery.error.statusCode === 423);

  const visibleSections = useMemo(
    () =>
      (sectionsQuery.data ?? []).filter(
        (section) => !classId || section.classId === classId,
      ),
    [classId, sectionsQuery.data],
  );

  function changeView(value: string) {
    setView(value as WorkspaceView);
    setPage(1);
  }

  function openCreate(kind: CreateKind, context: CreateContext = {}) {
    setCreateKind(kind);
    setCreateContext(context);
  }

  function createLabel() {
    if (view === 'attention' || view === 'cases') return 'Start follow-up';
    if (view === 'evidence') return 'Record check';
    if (view === 'remedial') return 'Create group';
    if (view === 'curriculum') return 'Add curriculum item';
    return 'Draft parent guidance';
  }

  function createForView() {
    openCreate(
      view === 'attention' || view === 'cases'
        ? 'intervention'
        : view === 'evidence'
          ? 'assessment'
          : view === 'remedial'
            ? 'remedial'
            : view === 'curriculum'
              ? 'curriculum'
              : 'guidance',
    );
  }

  return (
    <DashboardPageShell>
      <ModuleHeader
        eyebrow="M4 · Academics, Exams, CAS, Report Cards"
        title="Learning support"
        description="Turn explainable classroom evidence into teacher-owned follow-up, progress checks, remedial support, and clear guidance for families. This workspace does not predict student outcomes."
        primaryAction={
          canWrite ? (
            <Button onClick={createForView}>
              <Plus data-icon="inline-start" />
              {createLabel()}
            </Button>
          ) : undefined
        }
        moreActionItems={
          canWrite
            ? [
                {
                  label: 'Define learning outcome',
                  icon: <BookOpenCheck size={16} />,
                  onClick: () => openCreate('outcome'),
                },
                {
                  label: 'Record formative check',
                  icon: <ClipboardCheck size={16} />,
                  onClick: () => openCreate('assessment'),
                },
                {
                  label: 'Create remedial group',
                  icon: <UsersRound size={16} />,
                  onClick: () => openCreate('remedial'),
                },
              ]
            : undefined
        }
      />

      <div className="flex flex-col gap-5">
        <WorkspaceTabs
          items={academicsWorkspaceTabs}
          overflowItems={academicsWorkspaceOverflowTabs}
        />
        <WorkspaceTabs
          items={workspaceViews}
          activeValue={view}
          onValueChange={changeView}
          label="Learning support views"
        />

        {!canRead ? (
          <PermissionDenied
            title="Learning support is not available for your role"
            description="Ask a school administrator if you need access to student learning-support records."
            showNavigation={false}
          />
        ) : (
          <>
            <FilterBar
              description="Filters are applied by the server. Counts and progress summaries remain backend-owned."
              searchSlot={
                view === 'attention' ? (
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(1);
                      }}
                      className="pl-9"
                      placeholder="Search student name or school ID"
                      aria-label="Search students needing attention"
                    />
                  </div>
                ) : undefined
              }
              filterSlot={
                <>
                  <FilterSelect
                    label="Academic year"
                    value={effectiveAcademicYearId}
                    onChange={(value) => {
                      setAcademicYearId(value);
                      setPage(1);
                    }}
                    options={(yearsQuery.data ?? []).map((year) => ({
                      value: year.id,
                      label: year.isCurrent ? `${year.name} · Current` : year.name,
                    }))}
                  />
                  <FilterSelect
                    label="Class"
                    value={classId}
                    onChange={(value) => {
                      setClassId(value);
                      setSectionId('');
                      setSubjectId('');
                      setPage(1);
                    }}
                    includeAll
                    options={(classesQuery.data ?? []).map((item) => ({
                      value: item.id,
                      label: item.name,
                    }))}
                  />
                  <FilterSelect
                    label="Section"
                    value={sectionId}
                    onChange={(value) => {
                      setSectionId(value);
                      setPage(1);
                    }}
                    includeAll
                    options={visibleSections.map((item) => ({
                      value: item.id,
                      label: item.name,
                    }))}
                  />
                  {(view === 'evidence' ||
                    view === 'remedial' ||
                    view === 'curriculum' ||
                    view === 'guidance') && (
                    <FilterSelect
                      label="Subject"
                      value={subjectId}
                      onChange={(value) => {
                        setSubjectId(value);
                        setPage(1);
                      }}
                      includeAll
                      options={(subjectsQuery.data ?? []).map((item) => ({
                        value: item.id,
                        label: item.name,
                      }))}
                    />
                  )}
                </>
              }
            />

            {moduleLocked ? (
              <ModuleLockedState
                moduleName="Learning support"
                description="This school has not enabled the academics workspace for your current role or plan."
              />
            ) : activeQuery.isLoading ? (
              <LoadingState
                variant="page"
                label="Loading learning-support records"
              />
            ) : activeQuery.isError ? (
              <ErrorState
                message="Learning-support records could not be loaded. No student record was changed."
                onRetry={() => void activeQuery.refetch()}
              />
            ) : (
              <>
                {view === 'attention' && (
                  <AttentionView
                    items={attentionQuery.data?.items ?? []}
                    canWrite={canWrite}
                    onCreate={(item) =>
                      openCreate('intervention', {
                        studentId: item.student.id,
                        classId: item.student.classId,
                        sectionId: item.student.sectionId,
                        signalKey: item.signalKey,
                        suggestedTitle: `Learning follow-up for ${item.student.fullName}`,
                        suggestedConcern: item.reasons
                          .map((reason) => reason.explanation)
                          .join(' '),
                      })
                    }
                    onOpenCase={setSelectedCaseId}
                  />
                )}
                {view === 'cases' && (
                  <CasesView
                    items={casesQuery.data?.items ?? []}
                    onOpenCase={setSelectedCaseId}
                  />
                )}
                {view === 'evidence' && (
                  <EvidenceView
                    outcomes={outcomesQuery.data?.items ?? []}
                    assessments={assessmentsQuery.data?.items ?? []}
                    canWrite={canWrite}
                    onCreateOutcome={() => openCreate('outcome')}
                    onCreateAssessment={() => openCreate('assessment')}
                    onManageOutcome={(record) =>
                      setActionTarget({ kind: 'outcome', record })
                    }
                  />
                )}
                {view === 'remedial' && (
                  <RemedialView
                    items={remedialQuery.data?.items ?? []}
                    canWrite={canWrite}
                    onManage={(record) =>
                      setActionTarget({ kind: 'remedial', record })
                    }
                  />
                )}
                {view === 'curriculum' && (
                  <CurriculumView
                    items={curriculumQuery.data?.items ?? []}
                    summary={curriculumQuery.data?.summary}
                    canWrite={canWrite}
                    onManage={(record) =>
                      setActionTarget({ kind: 'curriculum', record })
                    }
                  />
                )}
                {view === 'guidance' && (
                  <GuidanceView
                    items={guidanceQuery.data?.items ?? []}
                    canWrite={canWrite}
                    onManage={(record) =>
                      setActionTarget({ kind: 'guidance', record })
                    }
                  />
                )}
                <TablePagination
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={
                    view === 'attention'
                      ? (attentionQuery.data?.total ?? 0)
                      : view === 'cases'
                        ? (casesQuery.data?.total ?? 0)
                        : view === 'evidence'
                          ? (outcomesQuery.data?.total ?? 0)
                          : view === 'remedial'
                            ? (remedialQuery.data?.total ?? 0)
                            : view === 'curriculum'
                              ? (curriculumQuery.data?.total ?? 0)
                              : (guidanceQuery.data?.total ?? 0)
                  }
                  onPageChange={setPage}
                />
              </>
            )}
          </>
        )}
      </div>

      <LearningImprovementCreateDialog
        kind={createKind}
        context={createContext}
        effectiveAcademicYearId={effectiveAcademicYearId}
        defaultClassId={classId}
        defaultSectionId={sectionId}
        defaultSubjectId={subjectId}
        years={yearsQuery.data ?? []}
        classes={classesQuery.data ?? []}
        sections={sectionsQuery.data ?? []}
        subjects={subjectsQuery.data ?? []}
        onClose={() => {
          setCreateKind(null);
          setCreateContext({});
        }}
      />
      <InterventionCaseSheet
        caseId={selectedCaseId}
        canWrite={canWrite}
        onClose={() => setSelectedCaseId(null)}
      />
      <LearningImprovementActionDialog
        target={actionTarget}
        onClose={() => setActionTarget(null)}
      />
    </DashboardPageShell>
  );
}

function FilterSelect({
  label,
  value,
  options,
  includeAll,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  includeAll?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value || (includeAll ? 'all' : undefined)} onValueChange={(next) => onChange(next === 'all' ? '' : next)}>
      <SelectTrigger className="min-w-40" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {includeAll ? <SelectItem value="all">All {label.toLowerCase()}s</SelectItem> : null}
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AttentionView({
  items,
  canWrite,
  onCreate,
  onOpenCase,
}: {
  items: StudentEarlyWarningItem[];
  canWrite: boolean;
  onCreate: (item: StudentEarlyWarningItem) => void;
  onOpenCase: (caseId: string) => void;
}) {
  if (!items.length) {
    return (
      <EmptyState
        title="No current attention signals"
        description="The server found no students meeting the explainable attendance, formative-check, or homework follow-up rules in this scope."
        icon={<HeartHandshake size={28} />}
      />
    );
  }

  return (
    <WorkSurface
      title="Students needing attention"
      description="Rules-based signals only. Teachers review context before opening a follow-up case."
      flush
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Attention</TableHead>
            <TableHead>Why shown</TableHead>
            <TableHead>Sources</TableHead>
            <TableHead className="text-right">Next step</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.signalKey}>
              <TableCell>
                <p className="font-semibold text-foreground">
                  {item.student.fullName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.student.studentSystemId} · {item.student.className}
                  {item.student.sectionName
                    ? ` · ${item.student.sectionName}`
                    : ''}
                </p>
              </TableCell>
              <TableCell>
                <StatusBadge
                  status={item.attentionLevel}
                  tone={
                    item.attentionLevel === 'NEEDS_ATTENTION'
                      ? 'conflict'
                      : 'pending'
                  }
                />
              </TableCell>
              <TableCell className="max-w-md whitespace-normal">
                <ul className="space-y-1">
                  {item.reasons.map((reason) => (
                    <li key={reason.code} className="text-sm text-foreground">
                      <span className="font-medium">{reason.label}:</span>{' '}
                      <span className="text-muted-foreground">
                        {reason.explanation}
                      </span>
                    </li>
                  ))}
                </ul>
              </TableCell>
              <TableCell className="whitespace-normal">
                <div className="flex flex-wrap gap-1">
                  {Object.entries(item.sourceStates).map(([source, state]) => (
                    <StatusBadge
                      key={source}
                      status={state}
                      label={`${sourceLabel(source)} · ${state}`}
                      tone={state === 'available' ? 'approved' : state === 'empty' ? 'inactive' : 'partial'}
                    />
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-right">
                {item.activeInterventionCaseId ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      onOpenCase(item.activeInterventionCaseId as string)
                    }
                  >
                    Open case
                  </Button>
                ) : canWrite ? (
                  <Button size="sm" onClick={() => onCreate(item)}>
                    Start follow-up
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    View only
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </WorkSurface>
  );
}

function CasesView({
  items,
  onOpenCase,
}: {
  items: StudentInterventionCaseRecord[];
  onOpenCase: (caseId: string) => void;
}) {
  if (!items.length) {
    return (
      <EmptyState
        title="No follow-up cases in this scope"
        description="Open a case from an attention signal or start one for a student after reviewing classroom evidence."
        icon={<FolderHeart size={28} />}
      />
    );
  }
  return (
    <WorkSurface
      title="Learning follow-up cases"
      description="Each case has an owner, next follow-up, versioned lifecycle, and auditable timeline."
      flush
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Case</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Next follow-up</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <p className="font-semibold">{item.student.fullName}</p>
                <p className="text-xs text-muted-foreground">
                  {item.student.studentSystemId}
                </p>
              </TableCell>
              <TableCell className="max-w-sm whitespace-normal">
                <p className="font-medium">{item.title}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {item.concernSummary}
                </p>
              </TableCell>
              <TableCell>{item.owner?.fullName ?? 'Unassigned'}</TableCell>
              <TableCell>
                <div className="flex flex-col items-start gap-1">
                  <StatusBadge status={item.status} />
                  <StatusBadge
                    status={item.priority}
                    tone={
                      item.priority === 'URGENT'
                        ? 'conflict'
                        : item.priority === 'IMPORTANT'
                          ? 'pending'
                          : 'info'
                    }
                  />
                </div>
              </TableCell>
              <TableCell>
                {item.nextFollowUpOn
                  ? formatBsDate(item.nextFollowUpOn)
                  : 'Not scheduled'}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenCase(item.id)}
                >
                  Open case
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </WorkSurface>
  );
}

function EvidenceView({
  outcomes,
  assessments,
  canWrite,
  onCreateOutcome,
  onCreateAssessment,
  onManageOutcome,
}: {
  outcomes: LearningOutcomeRecord[];
  assessments: FormativeAssessmentEvidenceRecord[];
  canWrite: boolean;
  onCreateOutcome: () => void;
  onCreateAssessment: () => void;
  onManageOutcome: (record: LearningOutcomeRecord) => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <WorkSurface
        title="Learning outcomes"
        description="Class- and subject-owned skills used for checks and progress history."
        action={
          canWrite ? (
            <Button size="sm" variant="outline" onClick={onCreateOutcome}>
              <Plus />
              Define outcome
            </Button>
          ) : undefined
        }
        flush
      >
        {outcomes.length ? (
          <div className="divide-y">
            {outcomes.map((outcome) => (
              <div key={outcome.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {outcome.code} · {outcome.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {outcome.subject.name}
                    </p>
                  </div>
                  <StatusBadge
                    status={outcome.isActive ? 'ACTIVE' : 'INACTIVE'}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <StatusBadge status={outcome.domain} tone="info" />
                </div>
                {outcome.description ? (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {outcome.description}
                  </p>
                ) : null}
                {canWrite ? (
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="outline"
                    onClick={() => onManageOutcome(outcome)}
                  >
                    {outcome.isActive ? 'Deactivate' : 'Reactivate'}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            className="m-4 min-h-60"
            title="No learning outcomes yet"
            description="Define a class and subject outcome before recording a formative check."
            icon={<BookOpenCheck size={28} />}
          />
        )}
      </WorkSurface>
      <WorkSurface
        title="Recent formative checks"
        description="Teacher-recorded evidence, including reassessment and optional family-facing summaries."
        action={
          canWrite ? (
            <Button size="sm" onClick={onCreateAssessment}>
              <Plus />
              Record check
            </Button>
          ) : undefined
        }
        flush
      >
        {assessments.length ? (
          <div className="divide-y">
            {assessments.map((item) => (
              <div key={item.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{item.student.fullName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.outcome.code} · {item.outcome.title}
                    </p>
                  </div>
                  <StatusBadge status={item.masteryStatus} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.kind.replace(/_/g, ' ')} ·{' '}
                  {formatBsDate(item.assessedOn)}
                  {item.score && item.maxScore
                    ? ` · ${item.score}/${item.maxScore}`
                    : ''}
                </p>
                {item.note ? (
                  <p className="mt-2 text-sm leading-6">{item.note}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            className="m-4 min-h-60"
            title="No formative checks yet"
            description="Record a short observation, quiz, oral check, practical, checklist, or reassessment."
            icon={<ClipboardCheck size={28} />}
          />
        )}
      </WorkSurface>
    </div>
  );
}

function RemedialView({
  items,
  canWrite,
  onManage,
}: {
  items: RemedialGroupRecord[];
  canWrite: boolean;
  onManage: (record: RemedialGroupRecord) => void;
}) {
  if (!items.length) {
    return (
      <EmptyState
        title="No remedial groups in this scope"
        description="Create a time-bounded support group linked to a class, subject, teacher, and optional learning outcome."
        icon={<UsersRound size={28} />}
      />
    );
  }
  return (
    <WorkSurface
      title="Remedial groups"
      description="Focused support groups with explicit purpose, schedule, membership, and lifecycle."
      flush
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Group</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Teacher</TableHead>
            <TableHead>Schedule</TableHead>
            <TableHead>Members</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="max-w-sm whitespace-normal">
                <p className="font-semibold">{item.name}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {item.purpose}
                </p>
              </TableCell>
              <TableCell>{item.subject.name}</TableCell>
              <TableCell>{item.teacher.fullName}</TableCell>
              <TableCell>
                <p>{formatBsDate(item.startsOn)}</p>
                <p className="text-xs text-muted-foreground">
                  {item.endsOn ? `to ${formatBsDate(item.endsOn)}` : 'No end set'}
                </p>
              </TableCell>
              <TableCell>{item.members.length}</TableCell>
              <TableCell>
                <StatusBadge status={item.status} />
              </TableCell>
              <TableCell className="text-right">
                {canWrite ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onManage(item)}
                  >
                    Manage
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    View only
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </WorkSurface>
  );
}

function CurriculumView({
  items,
  summary,
  canWrite,
  onManage,
}: {
  items: CurriculumProgressItemRecord[];
  summary:
    | {
        totalItems: number;
        planned: number;
        completed: number;
        missed: number;
        reteachRequired: number;
        completionPercent: number | null;
        paceState: string;
      }
    | undefined;
  canWrite: boolean;
  onManage: (record: CurriculumProgressItemRecord) => void;
}) {
  return (
    <div className="space-y-5">
      {summary ? (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border bg-card px-4 py-3 text-sm">
          <span className="font-semibold">
            {summary.totalItems} server-counted items
          </span>
          <span className="text-muted-foreground">
            {summary.completed} completed · {summary.planned} planned ·{' '}
            {summary.missed} missed · {summary.reteachRequired} reteach
          </span>
          <StatusBadge
            status={summary.paceState}
            tone={
              summary.paceState === 'on_track'
                ? 'approved'
                : summary.paceState === 'attention_needed'
                  ? 'pending'
                  : 'inactive'
            }
          />
          <span className="text-muted-foreground">
            Completion:{' '}
            {summary.completionPercent === null
              ? 'Unavailable'
              : `${summary.completionPercent}%`}
          </span>
        </div>
      ) : null}
      {!items.length ? (
        <EmptyState
          title="No curriculum progress records"
          description="Add planned teaching items and update them when completed, missed, or needing reteaching."
          icon={<ListChecks size={28} />}
        />
      ) : (
        <WorkSurface
          title="Curriculum progress"
          description="Pace is derived by the backend from the filtered progress records."
          flush
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Planned</TableHead>
                <TableHead>Teacher</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="max-w-lg whitespace-normal">
                    <p className="font-semibold">{item.title}</p>
                    {item.reteachPlan ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Reteach: {item.reteachPlan}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>{item.subject.name}</TableCell>
                  <TableCell>{formatBsDate(item.plannedOn)}</TableCell>
                  <TableCell>{item.teacher.fullName}</TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    {canWrite ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onManage(item)}
                      >
                        Update
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        View only
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </WorkSurface>
      )}
    </div>
  );
}

function GuidanceView({
  items,
  canWrite,
  onManage,
}: {
  items: ParentLearningGuidanceRecord[];
  canWrite: boolean;
  onManage: (record: ParentLearningGuidanceRecord) => void;
}) {
  if (!items.length) {
    return (
      <EmptyState
        title="No parent guidance in this scope"
        description="Teachers can draft a plain-language skill explanation and a practical home activity, then publish it deliberately."
        icon={<MessagesSquare size={28} />}
      />
    );
  }
  return (
    <WorkSurface
      title="Parent learning guidance"
      description="Only published, in-window guidance is shown to linked parents."
      flush
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Guidance</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Teacher</TableHead>
            <TableHead>Visibility</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">
                <p>{item.student.fullName}</p>
                <p className="text-xs text-muted-foreground">
                  {item.student.studentSystemId}
                </p>
              </TableCell>
              <TableCell className="max-w-lg whitespace-normal">
                <p className="font-semibold">{item.title}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {item.skillExplanation}
                </p>
              </TableCell>
              <TableCell>{item.subject.name}</TableCell>
              <TableCell>{item.teacher.fullName}</TableCell>
              <TableCell>
                {item.visibleFrom
                  ? formatBsDate(item.visibleFrom)
                  : 'When published'}
                {item.visibleUntil
                  ? ` to ${formatBsDate(item.visibleUntil)}`
                  : ''}
              </TableCell>
              <TableCell className="text-right">
                {canWrite && item.status !== 'ARCHIVED' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onManage(item)}
                  >
                    {item.status === 'DRAFT' ? 'Publish or archive' : 'Archive'}
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {item.status === 'ARCHIVED' ? 'Archived' : 'View only'}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge status={item.status} />
                {item.publishedAt ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatBsDateTime(item.publishedAt)}
                  </p>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </WorkSurface>
  );
}

function sourceLabel(value: string) {
  if (value === 'formativeAssessment') return 'Formative checks';
  if (value === 'homework') return 'Homework';
  return 'Attendance';
}
