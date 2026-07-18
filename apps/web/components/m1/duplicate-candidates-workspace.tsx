'use client';

import {
  formatBsDate,
  formatBsDateTime,
  type StudentDuplicateCandidate,
  type StudentDuplicateConfidenceFilter,
  type StudentDuplicateQueueStatus,
} from '@schoolos/core';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  GitMerge,
  History,
  RotateCcw,
  Search,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ApiRequestError, api } from '../../lib/api';
import { useUrlFilters } from '../../lib/hooks/use-url-filters';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { EmptyState } from '../ui/empty-state';
import { ErrorState } from '../ui/error-state';
import { FilterBar } from '../ui/filter-bar';
import { LoadingState } from '../ui/loading-state';
import { WorkspaceTabs } from '../ui/module-tabs';
import { SearchInput } from '../ui/search-input';
import { TablePagination } from '../ui/table-pagination';
import { Toast } from '../ui/toast';
import { WorkSurface } from '../ui/work-surface';
import { Badge } from '../ui/primitives/badge';
import { Button } from '../ui/primitives/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/primitives/select';
import { Textarea } from '../ui/primitives/textarea';

const PAGE_SIZE = 20;
const QUEUE_STATUSES: StudentDuplicateQueueStatus[] = [
  'PENDING',
  'NOT_DUPLICATE',
];
const CONFIDENCE_FILTERS: StudentDuplicateConfidenceFilter[] = [
  'ALL',
  'HIGH',
  'MEDIUM',
  'LOW',
];

type SelectedPair = StudentDuplicateCandidate & { key: string };
type ReviewDecision = 'merge' | 'dismiss' | 'reopen';

export function DuplicateCandidatesWorkspace() {
  const queryClient = useQueryClient();
  const reviewPanelRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useUrlFilters({
    page: 1,
    search: '',
    confidence: 'ALL' as StudentDuplicateConfidenceFilter,
    status: 'PENDING' as StudentDuplicateQueueStatus,
  });
  const status = QUEUE_STATUSES.includes(filters.status)
    ? filters.status
    : 'PENDING';
  const confidence = CONFIDENCE_FILTERS.includes(filters.confidence)
    ? filters.confidence
    : 'ALL';
  const page =
    Number.isInteger(filters.page) && filters.page > 0 ? filters.page : 1;
  const [selected, setSelected] = useState<SelectedPair | null>(null);
  const [primaryId, setPrimaryId] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [toast, setToast] = useState<{
    tone: 'success' | 'danger';
    title: string;
    description: string;
  } | null>(null);

  const candidatesQuery = useQuery({
    queryKey: [
      'student-duplicate-candidates',
      status,
      page,
      filters.search,
      confidence,
    ],
    queryFn: () =>
      api.listDuplicateStudentCandidates({
        page,
        limit: PAGE_SIZE,
        search: filters.search || undefined,
        confidence,
        status,
      }),
    placeholderData: keepPreviousData,
  });

  const previewMutation = useMutation({
    mutationFn: ({
      sourceStudentId,
      targetStudentId,
    }: {
      sourceStudentId: string;
      targetStudentId: string;
    }) =>
      api.previewDuplicateStudentMerge({
        sourceStudentId,
        targetStudentId,
      }),
  });
  const resetPreview = previewMutation.reset;

  const mergeMutation = useMutation({
    mutationFn: ({
      sourceStudentId,
      targetStudentId,
      reason,
    }: {
      sourceStudentId: string;
      targetStudentId: string;
      reason: string;
    }) =>
      api.mergeDuplicateStudent({
        sourceStudentId,
        targetStudentId,
        reason,
      }),
    onSuccess: (result) => {
      setToast({
        tone: 'success',
        title: 'Duplicate records merged',
        description: `${result.sourceStudent.studentSystemId} was merged into ${result.targetStudent.studentSystemId}.`,
      });
      finishDecision();
      void refreshDuplicateData();
      void queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (error) => {
      setToast({
        tone: 'danger',
        title: 'Merge could not be completed',
        description: errorMessage(
          error,
          'The records were not changed. Refresh the queue and try again.',
        ),
      });
      setDecision(null);
    },
  });

  const dismissMutation = useMutation({
    mutationFn: ({
      studentOneId,
      studentTwoId,
      reason,
    }: {
      studentOneId: string;
      studentTwoId: string;
      reason: string;
    }) =>
      api.markDuplicateStudentPairNotDuplicate({
        studentOneId,
        studentTwoId,
        reason,
      }),
    onSuccess: () => {
      setToast({
        tone: 'success',
        title: 'Pair removed from the pending queue',
        description:
          'The decision and reviewer note were saved. It can be reopened from Reviewed.',
      });
      finishDecision();
      void refreshDuplicateData();
    },
    onError: (error) => {
      setToast({
        tone: 'danger',
        title: 'Review could not be saved',
        description: errorMessage(
          error,
          'The pair is still pending. Refresh the queue and try again.',
        ),
      });
      setDecision(null);
    },
  });

  const reopenMutation = useMutation({
    mutationFn: ({ reviewId, reason }: { reviewId: string; reason: string }) =>
      api.reopenDuplicateStudentReview(reviewId, { reason }),
    onSuccess: () => {
      setToast({
        tone: 'success',
        title: 'Review reopened',
        description:
          'The pair is back in the pending queue for a fresh decision.',
      });
      finishDecision();
      void refreshDuplicateData();
    },
    onError: (error) => {
      setToast({
        tone: 'danger',
        title: 'Review could not be reopened',
        description: errorMessage(
          error,
          'No review state was changed. Refresh the queue and try again.',
        ),
      });
      setDecision(null);
    },
  });

  const currentQueueData = candidatesQuery.isPlaceholderData
    ? undefined
    : candidatesQuery.data;
  const lastAvailablePage = Math.max(1, currentQueueData?.totalPages ?? 1);
  const pageNeedsCorrection =
    filters.page !== page ||
    Boolean(currentQueueData && page > lastAvailablePage);
  const correctedPage = filters.page !== page ? page : lastAvailablePage;
  const isCriteriaTransition =
    candidatesQuery.isPlaceholderData || pageNeedsCorrection;

  useEffect(() => {
    if (!pageNeedsCorrection) return;
    setFilters({ page: correctedPage }, { history: 'replace' });
  }, [correctedPage, pageNeedsCorrection, setFilters]);

  useEffect(() => {
    setSelected(null);
    setDecision(null);
    setReviewNote('');
    resetPreview();
  }, [confidence, filters.search, page, resetPreview, status]);

  useEffect(() => {
    if (!selected || !currentQueueData) return;
    const selectedStillVisible = currentQueueData.candidates.some(
      (candidate) => pairKey(candidate) === selected.key,
    );
    if (!selectedStillVisible) {
      setSelected(null);
      setReviewNote('');
      resetPreview();
    }
  }, [currentQueueData, resetPreview, selected]);

  const summary = currentQueueData?.summary;
  const selectedNeedsReopen =
    selected?.review?.status === 'NOT_DUPLICATE' &&
    (selected.reviewState === 'NOT_DUPLICATE' ||
      selected.review.identityChanged);
  const noteIsValid = reviewNote.trim().length >= 5;
  const mergeIsSupported =
    previewMutation.data?.isProbableDuplicate === true &&
    !selected?.blockedReason &&
    !selectedNeedsReopen;
  const isSaving =
    mergeMutation.isPending ||
    dismissMutation.isPending ||
    reopenMutation.isPending;
  const queueInteractionDisabled =
    isCriteriaTransition || candidatesQuery.isFetching || isSaving;
  const primaryRecord = selected
    ? primaryId === selected.sourceStudent.id
      ? selected.sourceStudent
      : selected.candidateStudent
    : null;
  const mergedRecord = selected
    ? primaryId === selected.sourceStudent.id
      ? selected.candidateStudent
      : selected.sourceStudent
    : null;
  const confirmation = confirmationCopy(decision, mergedRecord, primaryRecord);

  function refreshDuplicateData() {
    return queryClient.invalidateQueries({
      queryKey: ['student-duplicate-candidates'],
    });
  }

  function finishDecision() {
    setSelected(null);
    setDecision(null);
    setReviewNote('');
    previewMutation.reset();
  }

  function selectPair(candidate: StudentDuplicateCandidate) {
    if (queueInteractionDisabled) return;
    const next = { ...candidate, key: pairKey(candidate) };
    setSelected(next);
    setPrimaryId(candidate.sourceStudent.id);
    setReviewNote('');
    setDecision(null);
    previewMutation.reset();

    if (
      candidate.reviewState === 'PENDING' &&
      !candidate.blockedReason &&
      !(
        candidate.review?.status === 'NOT_DUPLICATE' &&
        candidate.review.identityChanged
      )
    ) {
      previewMutation.mutate({
        sourceStudentId: candidate.candidateStudent.id,
        targetStudentId: candidate.sourceStudent.id,
      });
    }

    window.requestAnimationFrame(() => {
      reviewPanelRef.current?.focus({ preventScroll: true });
      if (window.matchMedia('(max-width: 1279px)').matches) {
        reviewPanelRef.current?.scrollIntoView({ block: 'start' });
      }
    });
  }

  function changePrimary(recordId: string) {
    if (!selected) return;
    setPrimaryId(recordId);
    previewMutation.mutate({
      sourceStudentId:
        recordId === selected.sourceStudent.id
          ? selected.candidateStudent.id
          : selected.sourceStudent.id,
      targetStudentId: recordId,
    });
  }

  function confirmDecision() {
    if (!selected || !decision || !noteIsValid) return;
    const reason = reviewNote.trim();

    if (decision === 'merge') {
      mergeMutation.mutate({
        sourceStudentId:
          primaryId === selected.sourceStudent.id
            ? selected.candidateStudent.id
            : selected.sourceStudent.id,
        targetStudentId: primaryId,
        reason,
      });
      return;
    }

    if (decision === 'dismiss') {
      dismissMutation.mutate({
        studentOneId: selected.sourceStudent.id,
        studentTwoId: selected.candidateStudent.id,
        reason,
      });
      return;
    }

    if (selected.review) {
      reopenMutation.mutate({
        reviewId: selected.review.id,
        reason,
      });
    }
  }

  return (
    <section id="duplicate-review" className="space-y-4">
      {toast ? <Toast {...toast} onDismiss={() => setToast(null)} /> : null}

      <div
        className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm lg:flex-row lg:items-center lg:justify-between"
        role="status"
        aria-label="Duplicate review queue status"
      >
        <div>
          <p className="text-sm font-semibold text-foreground">Review queue</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Backend-owned counts for the current school. Decisions are audited.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            <Search aria-hidden />
            {summary?.pending ?? '—'} pending
          </Badge>
          <Badge variant={summary?.highConfidence ? 'destructive' : 'outline'}>
            <AlertTriangle aria-hidden />
            {summary?.highConfidence ?? '—'} high confidence
          </Badge>
          <Badge variant="outline">
            <CheckCircle2 aria-hidden />
            {summary?.resolvedNotDuplicate ?? '—'} reviewed
          </Badge>
          <Badge variant="outline">
            <GitMerge aria-hidden />
            {summary?.mergedToday ?? '—'} merged today
          </Badge>
        </div>
      </div>

      <WorkspaceTabs
        activeValue={status}
        onValueChange={(value) =>
          setFilters(
            {
              status: value as StudentDuplicateQueueStatus,
              page: 1,
            },
            { history: 'push' },
          )
        }
        label="Duplicate review views"
        items={[
          {
            value: 'PENDING',
            label: 'Pending',
            count: summary?.pending,
          },
          {
            value: 'NOT_DUPLICATE',
            label: 'Reviewed',
            count: summary?.resolvedNotDuplicate,
          },
        ]}
      />

      <FilterBar
        label="Duplicate queue filters"
        searchSlot={
          <SearchInput
            value={filters.search}
            onChange={(search) => setFilters({ search }, { resetPage: true })}
            debounceMs={300}
            label="Search duplicate candidates"
            placeholder="Search student, ID, or admission number"
          />
        }
        filterSlot={
          <Select
            value={confidence}
            onValueChange={(value) =>
              setFilters(
                {
                  confidence: value as StudentDuplicateConfidenceFilter,
                  page: 1,
                },
                { history: 'push' },
              )
            }
          >
            <SelectTrigger
              className="min-w-48 bg-background"
              aria-label="Filter by match confidence"
            >
              <SelectValue placeholder="All confidence levels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All confidence levels</SelectItem>
              <SelectItem value="HIGH">High confidence</SelectItem>
              <SelectItem value="MEDIUM">Medium confidence</SelectItem>
              <SelectItem value="LOW">Low confidence</SelectItem>
            </SelectContent>
          </Select>
        }
        actionSlot={
          filters.search || confidence !== 'ALL' ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setFilters({
                  search: '',
                  confidence: 'ALL',
                  page: 1,
                })
              }
            >
              Clear filters
            </Button>
          ) : undefined
        }
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <WorkSurface
          title={
            status === 'PENDING'
              ? 'Pending duplicate checks'
              : 'Reviewed as separate students'
          }
          description={
            status === 'PENDING'
              ? 'Compare the evidence, then merge the duplicate or record why the students are different.'
              : 'These pairs remain out of the pending queue until a reviewer deliberately reopens them.'
          }
          action={
            <Badge variant="secondary">
              {currentQueueData
                ? currentQueueData.total === 1
                  ? '1 pair'
                  : `${currentQueueData.total} pairs`
                : candidatesQuery.isLoading
                  ? 'Loading pairs'
                  : 'Updating pairs'}
              {currentQueueData &&
              candidatesQuery.isFetching &&
              !candidatesQuery.isLoading
                ? ' · updating'
                : ''}
            </Badge>
          }
          variant="queue"
          flush
          className={selected ? 'order-2 xl:order-1' : 'order-1'}
          data-testid="duplicate-review-workspace"
        >
          {candidatesQuery.isLoading ? (
            <LoadingState
              className="min-h-80"
              label="Loading duplicate candidates…"
            />
          ) : candidatesQuery.isError ? (
            <ErrorState
              title="Duplicate candidates could not load"
              message="No records were changed. Retry to load the current school queue."
              onRetry={() => void candidatesQuery.refetch()}
            />
          ) : isCriteriaTransition ? (
            <LoadingState
              className="min-h-80"
              label={
                pageNeedsCorrection
                  ? 'Moving to the last available queue page…'
                  : 'Updating duplicate candidates…'
              }
            />
          ) : currentQueueData?.candidates.length ? (
            <div className="divide-y divide-border">
              {currentQueueData.candidates.map((candidate) => {
                const key = pairKey(candidate);
                const active = selected?.key === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    disabled={queueInteractionDisabled}
                    onClick={() => selectPair(candidate)}
                    className={`block w-full p-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-wait disabled:opacity-70 ${
                      active
                        ? 'bg-[var(--mod-soft,var(--primary-soft))]'
                        : 'hover:bg-muted/40'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {candidate.sourceStudent.fullNameEn}{' '}
                          <span className="font-normal text-muted-foreground">
                            and
                          </span>{' '}
                          {candidate.candidateStudent.fullNameEn}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {candidate.sourceStudent.studentSystemId} compared
                          with {candidate.candidateStudent.studentSystemId}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            candidate.confidence === 'HIGH'
                              ? 'destructive'
                              : 'outline'
                          }
                        >
                          {confidenceLabel(candidate.confidence)}
                        </Badge>
                        <Badge variant="secondary">
                          {candidate.score}% match
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <p>
                        <span className="font-medium text-foreground">
                          Record A:
                        </span>{' '}
                        DOB {formatBsDate(candidate.sourceStudent.dateOfBirth)}{' '}
                        · {candidate.sourceStudent.className ?? 'Class not set'}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">
                          Record B:
                        </span>{' '}
                        DOB{' '}
                        {formatBsDate(candidate.candidateStudent.dateOfBirth)} ·{' '}
                        {candidate.candidateStudent.className ??
                          'Class not set'}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {candidate.reasons.map((reason) => (
                        <Badge key={reason} variant="outline">
                          {reason}
                        </Badge>
                      ))}
                      {candidate.reviewState === 'NOT_DUPLICATE' ? (
                        <Badge variant="secondary">
                          <CheckCircle2 aria-hidden />
                          Reviewed{' '}
                          {candidate.review
                            ? formatBsDate(candidate.review.reviewedAt)
                            : ''}
                        </Badge>
                      ) : null}
                      {candidate.review?.identityChanged ? (
                        <Badge variant="destructive">
                          <History aria-hidden />
                          Details changed
                        </Badge>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState
              className="min-h-80 rounded-none border-0"
              icon={<UsersRound aria-hidden size={28} />}
              title={
                filters.search || confidence !== 'ALL'
                  ? 'No pairs match these filters'
                  : status === 'PENDING'
                    ? 'No duplicate reviews are pending'
                    : 'No pairs have been reviewed yet'
              }
              description={
                filters.search || confidence !== 'ALL'
                  ? 'Clear the filters or try another student name, ID, or admission number.'
                  : status === 'PENDING'
                    ? 'The current student records have no unresolved duplicate signals.'
                    : 'Pairs marked as separate students will appear here with their reviewer note.'
              }
              action={
                filters.search || confidence !== 'ALL' ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setFilters({
                        search: '',
                        confidence: 'ALL',
                        page: 1,
                      })
                    }
                  >
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          )}

          {currentQueueData &&
          !pageNeedsCorrection &&
          (currentQueueData.total > PAGE_SIZE || page > 1) ? (
            <TablePagination
              page={page}
              pageSize={currentQueueData.limit}
              total={currentQueueData.total}
              onPageChange={(page) => setFilters({ page })}
            />
          ) : null}
        </WorkSurface>

        <div
          ref={reviewPanelRef}
          tabIndex={-1}
          role="region"
          aria-label="Review decision"
          className={`scroll-mt-24 outline-none ${
            selected ? 'order-1' : 'order-2'
          } xl:order-2 xl:sticky xl:top-24`}
        >
          <WorkSurface
            title="Review decision"
            description="Select a pair to compare the records and save one auditable decision."
            action={<ShieldCheck className="size-5 text-primary" aria-hidden />}
            variant="queue"
          >
            {!selected ? (
              <div className="flex min-h-72 flex-col items-center justify-center text-center">
                <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <ShieldCheck aria-hidden />
                </div>
                <p className="mt-4 text-sm font-medium text-foreground">
                  Choose a candidate pair
                </p>
                <p className="mt-1 max-w-64 text-xs leading-5 text-muted-foreground">
                  The comparison, reviewer note, and safe actions will appear
                  here.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <fieldset
                  className="space-y-2"
                  disabled={
                    selectedNeedsReopen ||
                    Boolean(selected.blockedReason) ||
                    queueInteractionDisabled
                  }
                >
                  <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Keep as the primary record
                  </legend>
                  {[selected.sourceStudent, selected.candidateStudent].map(
                    (record) => (
                      <label
                        key={record.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                          primaryId === record.id
                            ? 'border-[var(--mod-border,var(--primary))] bg-[var(--mod-soft,var(--primary-soft))]'
                            : 'border-border'
                        }`}
                      >
                        <input
                          type="radio"
                          name="duplicate-primary-record"
                          className="mt-0.5 size-4"
                          checked={primaryId === record.id}
                          onChange={() => changePrimary(record.id)}
                        />
                        <span className="min-w-0">
                          <strong className="block text-sm font-medium text-foreground">
                            {record.fullNameEn}
                          </strong>
                          <span className="text-xs text-muted-foreground">
                            {record.studentSystemId} ·{' '}
                            {lifecycleLabel(record.lifecycleStatus)}
                          </span>
                        </span>
                      </label>
                    ),
                  )}
                </fieldset>

                {selected.review ? (
                  <div
                    className={`rounded-xl border p-3 text-xs leading-5 ${
                      selected.review.identityChanged
                        ? 'border-warning-200 bg-warning-50 text-warning-900'
                        : 'border-border bg-muted/30 text-muted-foreground'
                    }`}
                  >
                    <p className="font-semibold text-foreground">
                      Previous review
                    </p>
                    <p className="mt-1">{selected.review.reason}</p>
                    <p className="mt-1">
                      Reviewed {formatBsDateTime(selected.review.reviewedAt)}
                    </p>
                    {selected.review.identityChanged ? (
                      <p className="mt-2 font-medium">
                        Student or guardian details changed after this decision.
                        Reopen the review before attempting a merge.
                      </p>
                    ) : null}
                    {selected.review.reopenReason ? (
                      <p className="mt-2">
                        <span className="font-medium text-foreground">
                          Reopened:
                        </span>{' '}
                        {selected.review.reopenReason}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {!selectedNeedsReopen && selected.reviewState === 'PENDING' ? (
                  selected.blockedReason ? (
                    <div
                      className="rounded-xl border border-warning-200 bg-warning-50 p-3 text-xs leading-5 text-warning-900"
                      role="status"
                    >
                      <strong className="block">Merge unavailable</strong>
                      {selected.blockedReason}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
                      {previewMutation.isPending ? (
                        'Checking related records and merge safety…'
                      ) : previewMutation.isError ? (
                        'The merge preview could not load. You can still mark these records as separate students.'
                      ) : previewMutation.data ? (
                        <>
                          <strong className="block text-foreground">
                            Server merge preview
                          </strong>
                          {previewMutation.data.isProbableDuplicate ? (
                            <>
                              {Object.values(
                                previewMutation.data.mergeCounts,
                              ).reduce((sum, count) => sum + count, 0)}{' '}
                              related records will be reconciled in one
                              transaction.
                            </>
                          ) : (
                            'The current evidence is not strong enough for a merge. Review the pair and record a not-duplicate decision if appropriate.'
                          )}
                        </>
                      ) : (
                        'Choose the primary record to load the server merge preview.'
                      )}
                    </div>
                  )
                ) : null}

                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Reviewer note
                  </span>
                  <Textarea
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    maxLength={500}
                    rows={4}
                    placeholder={
                      selectedNeedsReopen ||
                      selected.reviewState === 'NOT_DUPLICATE'
                        ? 'Explain why this pair needs another review'
                        : 'Record the evidence for this decision'
                    }
                  />
                  <span className="block text-xs text-muted-foreground">
                    Required · 5–500 characters · saved in the audit history
                  </span>
                </label>

                {selectedNeedsReopen ||
                selected.reviewState === 'NOT_DUPLICATE' ? (
                  <Button
                    type="button"
                    className="w-full"
                    disabled={!noteIsValid || queueInteractionDisabled}
                    onClick={() => setDecision('reopen')}
                  >
                    <RotateCcw aria-hidden />
                    Review reopen confirmation
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Button
                      type="button"
                      className="w-full"
                      disabled={
                        !noteIsValid ||
                        queueInteractionDisabled ||
                        previewMutation.isPending ||
                        !mergeIsSupported
                      }
                      onClick={() => setDecision('merge')}
                    >
                      <GitMerge aria-hidden />
                      Review merge confirmation
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={!noteIsValid || queueInteractionDisabled}
                      onClick={() => setDecision('dismiss')}
                    >
                      <CheckCircle2 aria-hidden />
                      Mark as separate students
                    </Button>
                  </div>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  disabled={isSaving}
                  onClick={() => {
                    setSelected(null);
                    setReviewNote('');
                    previewMutation.reset();
                  }}
                >
                  Skip for now
                </Button>
              </div>
            )}
          </WorkSurface>
        </div>
      </div>

      <ConfirmDialog
        isOpen={decision !== null}
        title={confirmation.title}
        description={confirmation.description}
        confirmLabel={confirmation.confirmLabel}
        destructive={decision === 'merge'}
        isConfirming={isSaving}
        preventCloseWhileConfirming
        confirmDisabled={!noteIsValid}
        onClose={() => setDecision(null)}
        onConfirm={confirmDecision}
      >
        {decision === 'merge' && mergedRecord && primaryRecord ? (
          <div
            className="grid gap-3 rounded-xl border border-danger-100 bg-danger-50/60 p-3 sm:grid-cols-2"
            aria-label="Student record merge direction"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-danger-700">
                Merge record
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {mergedRecord.fullNameEn}
              </p>
              <p className="text-xs text-muted-foreground">
                {mergedRecord.studentSystemId}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-success-700">
                Keep as primary
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {primaryRecord.fullNameEn}
              </p>
              <p className="text-xs text-muted-foreground">
                {primaryRecord.studentSystemId}
              </p>
            </div>
          </div>
        ) : null}
        {reviewNote.trim() ? (
          <div className="rounded-xl border border-border bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Reviewer note
            </p>
            <p className="mt-1 text-sm leading-6 text-foreground">
              {reviewNote.trim()}
            </p>
          </div>
        ) : null}
      </ConfirmDialog>
    </section>
  );
}

function pairKey(candidate: StudentDuplicateCandidate) {
  return [candidate.sourceStudent.id, candidate.candidateStudent.id]
    .sort()
    .join(':');
}

function confidenceLabel(confidence: StudentDuplicateCandidate['confidence']) {
  return `${confidence.charAt(0)}${confidence.slice(1).toLowerCase()} confidence`;
}

function lifecycleLabel(status: string) {
  return status
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function confirmationCopy(
  decision: ReviewDecision | null,
  mergedRecord: StudentDuplicateCandidate['sourceStudent'] | null,
  primaryRecord: StudentDuplicateCandidate['sourceStudent'] | null,
) {
  if (decision === 'merge') {
    return {
      title: 'Merge these student records?',
      description:
        mergedRecord && primaryRecord
          ? `${mergedRecord.fullNameEn} (${mergedRecord.studentSystemId}) will be merged into ${primaryRecord.fullNameEn} (${primaryRecord.studentSystemId}). Supported relationships will be reconciled in one audited transaction.`
          : 'This audited operation moves the non-primary record to Merged and reconciles its supported relationships in one transaction.',
      confirmLabel: 'Merge records',
    };
  }

  if (decision === 'dismiss') {
    return {
      title: 'Mark these as separate students?',
      description:
        'The pair will leave the pending queue. The saved reviewer note remains available in Reviewed.',
      confirmLabel: 'Save decision',
    };
  }

  return {
    title: 'Reopen this duplicate review?',
    description:
      'The pair will return to Pending so staff can review the latest student and guardian details.',
    confirmLabel: 'Reopen review',
  };
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiRequestError &&
    error.statusCode >= 400 &&
    error.statusCode < 500 &&
    error.message.trim()
    ? error.message
    : fallback;
}
