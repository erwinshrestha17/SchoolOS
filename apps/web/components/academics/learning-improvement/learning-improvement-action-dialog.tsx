'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  formatBsDateForInput,
  parseBsDateInput,
  toGregorianDateFromBs,
  type CurriculumProgressItemRecord,
  type LearningOutcomeRecord,
  type ParentLearningGuidanceRecord,
  type RemedialGroupRecord,
} from '@schoolos/core';
import { toast } from 'sonner';
import { BsDateField } from '@/components/ui/bs-date-field';
import { Button } from '@/components/ui/primitives/button';
import { Checkbox } from '@/components/ui/primitives/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/primitives/dialog';
import { Input } from '@/components/ui/primitives/input';
import { Textarea } from '@/components/ui/primitives/textarea';
import {
  api,
  type UpdateCurriculumProgressPayload,
} from '@/lib/api';
import { schoolFacingErrorMessage } from '@/lib/school-facing-error';

export type LearningImprovementActionTarget =
  | { kind: 'outcome'; record: LearningOutcomeRecord }
  | { kind: 'remedial'; record: RemedialGroupRecord }
  | { kind: 'curriculum'; record: CurriculumProgressItemRecord }
  | { kind: 'guidance'; record: ParentLearningGuidanceRecord };

export function LearningImprovementActionDialog({
  target,
  onClose,
}: {
  target: LearningImprovementActionTarget | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={Boolean(target)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {target ? (
          <ActionForm
            key={`${target.kind}-${target.record.id}`}
            target={target}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ActionForm({
  target,
  onClose,
}: {
  target: LearningImprovementActionTarget;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(currentNextStatus(target));
  const [reason, setReason] = useState('');
  const [completedOnBs, setCompletedOnBs] = useState(
    target.kind === 'curriculum' && target.record.completedOn
      ? formatBsDateForInput(target.record.completedOn)
      : formatBsDateForInput(new Date()),
  );
  const [missedReason, setMissedReason] = useState(
    target.kind === 'curriculum' ? target.record.missedReason ?? '' : '',
  );
  const [reteachPlan, setReteachPlan] = useState(
    target.kind === 'curriculum' ? target.record.reteachPlan ?? '' : '',
  );
  const [resourceUrl, setResourceUrl] = useState(
    target.kind === 'curriculum' ? target.record.resourceUrl ?? '' : '',
  );
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [error, setError] = useState('');

  const studentsQuery = useQuery({
    queryKey:
      target.kind === 'remedial'
        ? [
            'students',
            'remedial-member-picker',
            target.record.academicYearId,
            target.record.classId,
            target.record.sectionId,
          ]
        : ['students', 'remedial-member-picker', 'disabled'],
    queryFn: () => {
      if (target.kind !== 'remedial') {
        throw new Error('Student picker is unavailable');
      }
      return api.listStudents({
        academicYearId: target.record.academicYearId,
        classId: target.record.classId,
        ...(target.record.sectionId
          ? { sectionId: target.record.sectionId }
          : {}),
        status: 'ACTIVE',
        page: 1,
        limit: 100,
      });
    },
    enabled: target.kind === 'remedial',
  });

  const currentMemberIds = useMemo(
    () =>
      target.kind === 'remedial'
        ? new Set(target.record.members.map((member) => member.student.id))
        : new Set<string>(),
    [target],
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (target.kind === 'outcome') {
        return api.setLearningOutcomeState(
          target.record.id,
          !target.record.isActive,
        );
      }
      if (target.kind === 'remedial') {
        const results: unknown[] = [];
        if (selectedStudentIds.length) {
          results.push(
            await api.addRemedialGroupMembers(
              target.record.id,
              selectedStudentIds,
            ),
          );
        }
        if (status && status !== target.record.status) {
          results.push(
            await api.updateRemedialGroupStatus(
              target.record.id,
              status as RemedialGroupRecord['status'],
              reason.trim(),
            ),
          );
        }
        return results;
      }
      if (target.kind === 'curriculum') {
        return api.updateCurriculumProgress(target.record.id, {
          status:
            status as UpdateCurriculumProgressPayload['status'],
          ...(status === 'COMPLETED'
            ? { completedOn: gregorianDateString(completedOnBs) }
            : {}),
          ...(status === 'MISSED' || status === 'RETEACH_REQUIRED'
            ? { missedReason: missedReason.trim() }
            : {}),
          ...(reteachPlan.trim() ? { reteachPlan: reteachPlan.trim() } : {}),
          ...(resourceUrl.trim() ? { resourceUrl: resourceUrl.trim() } : {}),
          reason: reason.trim(),
        } satisfies UpdateCurriculumProgressPayload);
      }
      return api.updateParentLearningGuidanceStatus(
        target.record.id,
        status as ParentLearningGuidanceRecord['status'],
        reason.trim(),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['learning-improvement'],
      });
      toast.success(actionSuccess(target));
      onClose();
    },
    onError: (mutationError) =>
      setError(
        schoolFacingErrorMessage(mutationError, {
          fallback:
            'The learning-support record could not be updated. No other student record was changed.',
          invalid: 'Review the selected lifecycle state and required details.',
          forbidden: 'Your role cannot update this record.',
          conflict:
            'This record changed while you were working. Refresh and review before trying again.',
        }),
      ),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (target.kind === 'outcome') {
      mutation.mutate();
      return;
    }
    if (
      target.kind === 'remedial' &&
      !selectedStudentIds.length &&
      status === target.record.status
    ) {
      setError('Select new members or choose a different group status.');
      return;
    }
    if (
      (target.kind !== 'remedial' || status !== target.record.status) &&
      reason.trim().length < 4
    ) {
      setError('Enter a clear reason for the lifecycle change.');
      return;
    }
    if (
      target.kind === 'curriculum' &&
      (status === 'MISSED' || status === 'RETEACH_REQUIRED') &&
      missedReason.trim().length < 4
    ) {
      setError('Explain why this item was missed or needs reteaching.');
      return;
    }
    try {
      if (target.kind === 'curriculum' && status === 'COMPLETED') {
        parseBsDateInput(completedOnBs);
      }
    } catch {
      setError('Enter a valid Bikram Sambat completion date.');
      return;
    }
    mutation.mutate();
  }

  const eligibleStudents =
    target.kind === 'remedial'
      ? (studentsQuery.data?.items ?? []).filter(
          (student) => !currentMemberIds.has(student.id),
        )
      : [];

  return (
    <form onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>{actionTitle(target)}</DialogTitle>
        <DialogDescription>{actionDescription(target)}</DialogDescription>
      </DialogHeader>

      <div className="mt-5 space-y-4">
        {target.kind !== 'outcome' ? (
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Lifecycle status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-10 w-full rounded-lg border bg-white px-3 text-sm"
            >
              {statusOptions(target).map((option) => (
                <option key={option} value={option}>
                  {option.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {target.kind === 'remedial' ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold">Add students</p>
            {studentsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">
                Loading the active class roster…
              </p>
            ) : eligibleStudents.length ? (
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border p-2">
                {eligibleStudents.map((student) => {
                  const checked = selectedStudentIds.includes(student.id);
                  return (
                    <label
                      key={student.id}
                      className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(next) =>
                          setSelectedStudentIds((current) =>
                            next === true
                              ? [...current, student.id]
                              : current.filter((id) => id !== student.id),
                          )
                        }
                      />
                      <span>
                        {student.fullNameEn ??
                          `${student.firstNameEn ?? ''} ${student.lastNameEn ?? ''}`.trim()}{' '}
                        · {student.studentSystemId}
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No additional active students are available in this scope.
              </p>
            )}
          </div>
        ) : null}

        {target.kind === 'curriculum' && status === 'COMPLETED' ? (
          <BsDateField
            label="Completed on (BS)"
            value={completedOnBs}
            onChange={setCompletedOnBs}
            required
          />
        ) : null}
        {target.kind === 'curriculum' &&
        (status === 'MISSED' || status === 'RETEACH_REQUIRED') ? (
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Reason</span>
            <Textarea
              value={missedReason}
              onChange={(event) => setMissedReason(event.target.value)}
              maxLength={600}
              required
            />
          </label>
        ) : null}
        {target.kind === 'curriculum' ? (
          <>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">
                Reteach plan (optional)
              </span>
              <Textarea
                value={reteachPlan}
                onChange={(event) => setReteachPlan(event.target.value)}
                maxLength={600}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold">
                HTTPS resource link (optional)
              </span>
              <Input
                value={resourceUrl}
                onChange={(event) => setResourceUrl(event.target.value)}
                type="url"
                placeholder="https://…"
              />
            </label>
          </>
        ) : null}

        {target.kind !== 'outcome' &&
        (target.kind !== 'remedial' || status !== target.record.status) ? (
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold">Reason</span>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={600}
              placeholder="Explain this lifecycle change."
              required
            />
          </label>
        ) : null}

        {error ? (
          <p
            className="rounded-lg border border-danger-100 bg-danger-50 p-3 text-sm font-medium text-danger-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </div>

      <DialogFooter className="mt-6">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Confirm update'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function currentNextStatus(target: LearningImprovementActionTarget) {
  if (target.kind === 'outcome') return '';
  return target.record.status;
}

function statusOptions(target: Exclude<LearningImprovementActionTarget, { kind: 'outcome' }>) {
  if (target.kind === 'remedial') {
    return {
      PLANNED: ['PLANNED', 'ACTIVE', 'CANCELLED'],
      ACTIVE: ['ACTIVE', 'COMPLETED', 'CANCELLED'],
      COMPLETED: ['COMPLETED'],
      CANCELLED: ['CANCELLED'],
    }[target.record.status];
  }
  if (target.kind === 'curriculum') {
    return ['PLANNED', 'COMPLETED', 'MISSED', 'RETEACH_REQUIRED'];
  }
  return {
    DRAFT: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
    PUBLISHED: ['PUBLISHED', 'ARCHIVED'],
    ARCHIVED: ['ARCHIVED'],
  }[target.record.status];
}

function actionTitle(target: LearningImprovementActionTarget) {
  if (target.kind === 'outcome') {
    return target.record.isActive
      ? 'Deactivate learning outcome'
      : 'Reactivate learning outcome';
  }
  if (target.kind === 'remedial') return `Manage ${target.record.name}`;
  if (target.kind === 'curriculum') return `Update ${target.record.title}`;
  return `Manage ${target.record.title}`;
}

function actionDescription(target: LearningImprovementActionTarget) {
  if (target.kind === 'outcome') {
    return target.record.isActive
      ? 'New formative checks will no longer be recorded against this outcome. Existing evidence is preserved.'
      : 'This outcome will be available for new formative checks again.';
  }
  if (target.kind === 'remedial') {
    return 'Add active students and update the bounded support-group lifecycle.';
  }
  if (target.kind === 'curriculum') {
    return 'Update the server-owned progress state and retain a reason in the audit trail.';
  }
  return 'Publishing makes this teacher-authored guidance visible to linked parents within its visibility window.';
}

function actionSuccess(target: LearningImprovementActionTarget) {
  if (target.kind === 'outcome') return 'Learning outcome state updated.';
  if (target.kind === 'remedial') return 'Remedial group updated.';
  if (target.kind === 'curriculum') return 'Curriculum progress updated.';
  return 'Parent guidance status updated.';
}

function gregorianDateString(value: string) {
  const gregorian = toGregorianDateFromBs(parseBsDateInput(value));
  return `${gregorian.year}-${String(gregorian.month).padStart(2, '0')}-${String(gregorian.day).padStart(2, '0')}`;
}
