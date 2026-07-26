'use client';

import {
  useMemo,
  useState,
  type ComponentProps,
  type FormEvent,
} from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  formatBsDateForInput,
  parseBsDateInput,
  toGregorianDateFromBs,
  type AcademicYearSummary,
  type ClassSummary,
  type SectionSummary,
  type SubjectSummary,
} from '@schoolos/core';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/primitives/dialog';
import { Button } from '@/components/ui/primitives/button';
import { Input } from '@/components/ui/primitives/input';
import { Textarea } from '@/components/ui/primitives/textarea';
import { BsDateField } from '@/components/ui/bs-date-field';
import {
  api,
  type CreateCurriculumProgressPayload,
  type CreateFormativeAssessmentPayload,
  type CreateLearningOutcomePayload,
  type CreateParentGuidancePayload,
  type CreateRemedialGroupPayload,
  type CreateStudentInterventionPayload,
} from '@/lib/api';
import { schoolFacingErrorMessage } from '@/lib/school-facing-error';

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

type Props = {
  kind: CreateKind | null;
  context: CreateContext;
  effectiveAcademicYearId: string;
  defaultClassId: string;
  defaultSectionId: string;
  defaultSubjectId: string;
  years: AcademicYearSummary[];
  classes: ClassSummary[];
  sections: SectionSummary[];
  subjects: SubjectSummary[];
  onClose: () => void;
};

export function LearningImprovementCreateDialog(props: Props) {
  return (
    <Dialog
      open={props.kind !== null}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        {props.kind ? (
          <CreateForm
            key={`${props.kind}-${props.context.studentId ?? 'blank'}-${props.context.signalKey ?? ''}`}
            {...props}
            kind={props.kind}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CreateForm({
  kind,
  context,
  effectiveAcademicYearId,
  defaultClassId,
  defaultSectionId,
  defaultSubjectId,
  years,
  classes,
  sections,
  subjects,
  onClose,
}: Props & { kind: CreateKind }) {
  const queryClient = useQueryClient();
  const todayBs = formatBsDateForInput(new Date());
  const [academicYearId, setAcademicYearId] = useState(
    effectiveAcademicYearId,
  );
  const [classId, setClassId] = useState(context.classId ?? defaultClassId);
  const [sectionId, setSectionId] = useState(
    context.sectionId ?? defaultSectionId,
  );
  const [subjectId, setSubjectId] = useState(defaultSubjectId);
  const [studentId, setStudentId] = useState(context.studentId ?? '');
  const [outcomeId, setOutcomeId] = useState('');
  const [remedialGroupId, setRemedialGroupId] = useState('');
  const [title, setTitle] = useState(context.suggestedTitle ?? '');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [domain, setDomain] = useState<
    'GENERAL' | 'FOUNDATIONAL_READING' | 'FOUNDATIONAL_NUMERACY'
  >('GENERAL');
  const [kindValue, setKindValue] = useState('OBSERVATION');
  const [masteryStatus, setMasteryStatus] = useState('DEVELOPING');
  const [score, setScore] = useState('');
  const [maxScore, setMaxScore] = useState('');
  const [assessedOnBs, setAssessedOnBs] = useState(todayBs);
  const [note, setNote] = useState('');
  const [parentSummary, setParentSummary] = useState('');
  const [priority, setPriority] = useState('ROUTINE');
  const [concernSummary, setConcernSummary] = useState(
    context.suggestedConcern ?? '',
  );
  const [nextFollowUpOnBs, setNextFollowUpOnBs] = useState('');
  const [purpose, setPurpose] = useState('');
  const [startsOnBs, setStartsOnBs] = useState(todayBs);
  const [endsOnBs, setEndsOnBs] = useState('');
  const [scheduleNote, setScheduleNote] = useState('');
  const [progressStatus, setProgressStatus] = useState('PLANNED');
  const [plannedOnBs, setPlannedOnBs] = useState(todayBs);
  const [completedOnBs, setCompletedOnBs] = useState('');
  const [missedReason, setMissedReason] = useState('');
  const [reteachPlan, setReteachPlan] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [skillExplanation, setSkillExplanation] = useState('');
  const [homeActivity, setHomeActivity] = useState('');
  const [visibleFromBs, setVisibleFromBs] = useState('');
  const [visibleUntilBs, setVisibleUntilBs] = useState('');
  const [error, setError] = useState('');

  const availableSections = useMemo(
    () =>
      sections.filter(
        (section) => !classId || section.classId === classId,
      ),
    [classId, sections],
  );
  const availableSubjects = useMemo(
    () => subjects.filter((subject) => !classId || subject.classId === classId),
    [classId, subjects],
  );

  const studentsQuery = useQuery({
    queryKey: [
      'students',
      'learning-improvement-picker',
      academicYearId,
      classId,
      sectionId,
    ],
    queryFn: () =>
      api.listStudents({
        academicYearId,
        classId,
        ...(sectionId ? { sectionId } : {}),
        status: 'ACTIVE',
        page: 1,
        limit: 100,
      }),
    enabled:
      Boolean(classId && academicYearId) &&
      (kind === 'assessment' ||
        kind === 'intervention' ||
        kind === 'guidance'),
  });
  const outcomesQuery = useQuery({
    queryKey: [
      'learning-improvement',
      'outcomes',
      'picker',
      academicYearId,
      classId,
      subjectId,
    ],
    queryFn: () =>
      api.listLearningOutcomes({
        academicYearId,
        classId,
        ...(subjectId ? { subjectId } : {}),
        isActive: true,
        page: 1,
        limit: 100,
      }),
    enabled:
      Boolean(academicYearId && classId) &&
      (kind === 'assessment' ||
        kind === 'remedial' ||
        kind === 'curriculum' ||
        kind === 'guidance'),
  });
  const remedialQuery = useQuery({
    queryKey: [
      'learning-improvement',
      'remedial-groups',
      'picker',
      academicYearId,
      classId,
      subjectId,
      studentId,
    ],
    queryFn: () =>
      api.listRemedialGroups({
        academicYearId,
        classId,
        ...(subjectId ? { subjectId } : {}),
        ...(studentId ? { studentId } : {}),
        status: 'ACTIVE',
        page: 1,
        limit: 100,
      }),
    enabled:
      kind === 'guidance' &&
      Boolean(academicYearId && classId && studentId),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      setError('');
      const clientRequestId = crypto.randomUUID();
      if (kind === 'outcome') {
        return api.createLearningOutcome({
          academicYearId,
          classId,
          subjectId,
          code: code.trim(),
          title: title.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          domain,
        } satisfies CreateLearningOutcomePayload);
      }
      if (kind === 'assessment') {
        return api.createFormativeAssessment({
          outcomeId,
          studentId,
          academicYearId,
          classId,
          ...(sectionId ? { sectionId } : {}),
          subjectId,
          kind: kindValue as CreateFormativeAssessmentPayload['kind'],
          masteryStatus:
            masteryStatus as CreateFormativeAssessmentPayload['masteryStatus'],
          ...(score ? { score: Number(score) } : {}),
          ...(maxScore ? { maxScore: Number(maxScore) } : {}),
          assessedOn: gregorianDateString(assessedOnBs),
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(parentSummary.trim()
            ? { parentSummary: parentSummary.trim() }
            : {}),
          clientSubmissionId: clientRequestId,
        } satisfies CreateFormativeAssessmentPayload);
      }
      if (kind === 'intervention') {
        return api.createStudentIntervention({
          studentId,
          academicYearId,
          ...(context.signalKey ? { sourceSignalKey: context.signalKey } : {}),
          priority:
            priority as CreateStudentInterventionPayload['priority'],
          title: title.trim(),
          concernSummary: concernSummary.trim(),
          ...(parentSummary.trim()
            ? { parentVisibleSummary: parentSummary.trim() }
            : {}),
          ...(nextFollowUpOnBs
            ? { nextFollowUpOn: gregorianDateString(nextFollowUpOnBs) }
            : {}),
          clientRequestId,
        } satisfies CreateStudentInterventionPayload);
      }
      if (kind === 'remedial') {
        return api.createRemedialGroup({
          academicYearId,
          classId,
          ...(sectionId ? { sectionId } : {}),
          subjectId,
          ...(outcomeId ? { outcomeId } : {}),
          name: title.trim(),
          purpose: purpose.trim(),
          startsOn: gregorianDateString(startsOnBs),
          ...(endsOnBs ? { endsOn: gregorianDateString(endsOnBs) } : {}),
          ...(scheduleNote.trim()
            ? { scheduleNote: scheduleNote.trim() }
            : {}),
          ...(parentSummary.trim()
            ? { parentSummary: parentSummary.trim() }
            : {}),
          clientRequestId,
        } satisfies CreateRemedialGroupPayload);
      }
      if (kind === 'curriculum') {
        return api.createCurriculumProgress({
          academicYearId,
          classId,
          ...(sectionId ? { sectionId } : {}),
          subjectId,
          ...(outcomeId ? { outcomeId } : {}),
          title: title.trim(),
          status:
            progressStatus as CreateCurriculumProgressPayload['status'],
          plannedOn: gregorianDateString(plannedOnBs),
          ...(completedOnBs
            ? { completedOn: gregorianDateString(completedOnBs) }
            : {}),
          ...(missedReason.trim()
            ? { missedReason: missedReason.trim() }
            : {}),
          ...(reteachPlan.trim() ? { reteachPlan: reteachPlan.trim() } : {}),
          ...(resourceUrl.trim() ? { resourceUrl: resourceUrl.trim() } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
          clientRequestId,
        } satisfies CreateCurriculumProgressPayload);
      }
      return api.createParentLearningGuidance({
        studentId,
        academicYearId,
        subjectId,
        ...(outcomeId ? { outcomeId } : {}),
        ...(remedialGroupId ? { remedialGroupId } : {}),
        title: title.trim(),
        skillExplanation: skillExplanation.trim(),
        homeActivity: homeActivity.trim(),
        ...(visibleFromBs
          ? { visibleFrom: gregorianDateString(visibleFromBs) }
          : {}),
        ...(visibleUntilBs
          ? { visibleUntil: gregorianDateString(visibleUntilBs) }
          : {}),
        clientRequestId,
      } satisfies CreateParentGuidancePayload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['learning-improvement'],
      });
      toast.success(successMessage(kind));
      onClose();
    },
    onError: (mutationError) => {
      setError(
        schoolFacingErrorMessage(mutationError, {
          fallback:
            'This learning-support record could not be saved. No other student record was changed.',
          invalid:
            'Review the selected class, student, dates, and required details before trying again.',
          forbidden:
            'Your role cannot create this learning-support record in the selected scope.',
          conflict:
            'A matching request was already recorded or the school record changed. Refresh and review before trying again.',
        }),
      );
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }
    mutation.mutate();
  }

  function validate() {
    if (!academicYearId) return 'Select an academic year.';
    if (kind !== 'intervention' && kind !== 'guidance' && !classId) {
      return 'Select a class.';
    }
    if (
      (kind === 'assessment' ||
        kind === 'intervention' ||
        kind === 'guidance') &&
      !studentId
    ) {
      return 'Select a student.';
    }
    if (
      (kind === 'outcome' ||
        kind === 'assessment' ||
        kind === 'remedial' ||
        kind === 'curriculum' ||
        kind === 'guidance') &&
      !subjectId
    ) {
      return 'Select a subject.';
    }
    if (
      (kind === 'assessment' || kind === 'intervention') &&
      !classId
    ) {
      return 'Select a class before selecting a student.';
    }
    if (kind === 'outcome' && (!code.trim() || title.trim().length < 3)) {
      return 'Enter an outcome code and a title of at least 3 characters.';
    }
    if (kind === 'assessment' && !outcomeId) {
      return 'Select a learning outcome.';
    }
    if (
      kind === 'assessment' &&
      Boolean(score) !== Boolean(maxScore)
    ) {
      return 'Enter both score and maximum score, or leave both blank.';
    }
    if (
      kind === 'assessment' &&
      score &&
      maxScore &&
      Number(score) > Number(maxScore)
    ) {
      return 'Score cannot be greater than the maximum score.';
    }
    if (
      kind === 'intervention' &&
      (title.trim().length < 3 || concernSummary.trim().length < 8)
    ) {
      return 'Enter a clear case title and concern summary.';
    }
    if (
      kind === 'remedial' &&
      (title.trim().length < 3 || purpose.trim().length < 8)
    ) {
      return 'Enter a group name and a clear support purpose.';
    }
    if (kind === 'curriculum' && title.trim().length < 3) {
      return 'Enter a curriculum item title.';
    }
    if (
      kind === 'curriculum' &&
      progressStatus === 'COMPLETED' &&
      !completedOnBs
    ) {
      return 'Enter the completed date for a completed item.';
    }
    if (
      kind === 'curriculum' &&
      (progressStatus === 'MISSED' ||
        progressStatus === 'RETEACH_REQUIRED') &&
      missedReason.trim().length < 4
    ) {
      return 'Explain why this item was missed or needs reteaching.';
    }
    if (
      kind === 'guidance' &&
      (title.trim().length < 3 ||
        skillExplanation.trim().length < 8 ||
        homeActivity.trim().length < 8)
    ) {
      return 'Enter a title, clear skill explanation, and practical home activity.';
    }
    try {
      [
        assessedOnBs,
        nextFollowUpOnBs,
        startsOnBs,
        endsOnBs,
        plannedOnBs,
        completedOnBs,
        visibleFromBs,
        visibleUntilBs,
      ]
        .filter(Boolean)
        .forEach((date) => parseBsDateInput(date));
    } catch {
      return 'Enter valid Bikram Sambat dates in YYYY-MM-DD format.';
    }
    return '';
  }

  const students = studentsQuery.data?.items ?? [];
  const outcomes = outcomesQuery.data?.items ?? [];

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{dialogTitle(kind)}</DialogTitle>
        <DialogDescription>{dialogDescription(kind)}</DialogDescription>
      </DialogHeader>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Academic year"
          value={academicYearId}
          onChange={setAcademicYearId}
          options={years.map((year) => ({
            value: year.id,
            label: year.isCurrent ? `${year.name} · Current` : year.name,
          }))}
          required
        />
        <SelectField
          label="Class"
          value={classId}
          onChange={(value) => {
            setClassId(value);
            setSectionId('');
            setSubjectId('');
            setStudentId('');
            setOutcomeId('');
          }}
          options={classes.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
          required={
            kind !== 'intervention' || !Boolean(context.studentId)
          }
        />
        {(kind === 'assessment' ||
          kind === 'remedial' ||
          kind === 'curriculum') && (
          <SelectField
            label="Section (optional)"
            value={sectionId}
            onChange={setSectionId}
            options={availableSections.map((item) => ({
              value: item.id,
              label: item.name,
            }))}
            allowBlank
          />
        )}
        {(kind === 'outcome' ||
          kind === 'assessment' ||
          kind === 'remedial' ||
          kind === 'curriculum' ||
          kind === 'guidance') && (
          <SelectField
            label="Subject"
            value={subjectId}
            onChange={(value) => {
              setSubjectId(value);
              setOutcomeId('');
            }}
            options={availableSubjects.map((item) => ({
              value: item.id,
              label: `${item.code} · ${item.name}`,
            }))}
            required
          />
        )}
        {(kind === 'assessment' ||
          kind === 'intervention' ||
          kind === 'guidance') && (
          <SelectField
            label="Student"
            value={studentId}
            onChange={setStudentId}
            options={students.map((student) => ({
              value: student.id,
              label: `${student.fullNameEn ?? `${student.firstNameEn ?? ''} ${student.lastNameEn ?? ''}`.trim()} · ${student.studentSystemId}`,
            }))}
            required
            disabled={Boolean(context.studentId)}
            loading={studentsQuery.isLoading}
          />
        )}
        {kind === 'outcome' && (
          <>
            <TextField
              label="Outcome code"
              value={code}
              onChange={setCode}
              maxLength={40}
              placeholder="e.g. NUM-03"
              required
            />
            <SelectField
              label="Outcome domain"
              value={domain}
              onChange={(value) => setDomain(value as typeof domain)}
              options={[
                { value: 'GENERAL', label: 'General' },
                {
                  value: 'FOUNDATIONAL_READING',
                  label: 'Foundational reading',
                },
                {
                  value: 'FOUNDATIONAL_NUMERACY',
                  label: 'Foundational numeracy',
                },
              ]}
              required
            />
          </>
        )}
        {(kind === 'assessment' ||
          kind === 'remedial' ||
          kind === 'curriculum' ||
          kind === 'guidance') && (
          <SelectField
            label={
              kind === 'assessment'
                ? 'Learning outcome'
                : 'Learning outcome (optional)'
            }
            value={outcomeId}
            onChange={setOutcomeId}
            options={outcomes.map((outcome) => ({
              value: outcome.id,
              label: `${outcome.code} · ${outcome.title}`,
            }))}
            allowBlank={kind !== 'assessment'}
            required={kind === 'assessment'}
            loading={outcomesQuery.isLoading}
          />
        )}
        {kind === 'assessment' && (
          <>
            <SelectField
              label="Check type"
              value={kindValue}
              onChange={setKindValue}
              options={enumOptions([
                'OBSERVATION',
                'EXIT_TICKET',
                'QUIZ',
                'ORAL',
                'PRACTICAL',
                'CHECKLIST',
                'REASSESSMENT',
              ])}
              required
            />
            <SelectField
              label="Current progress"
              value={masteryStatus}
              onChange={setMasteryStatus}
              options={enumOptions([
                'BEGINNING',
                'DEVELOPING',
                'SECURE',
                'EXTENDING',
              ])}
              required
            />
            <BsDateField
              label="Assessed on (BS)"
              value={assessedOnBs}
              onChange={setAssessedOnBs}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Score (optional)"
                type="number"
                min="0"
                step="0.01"
                value={score}
                onChange={setScore}
              />
              <TextField
                label="Maximum (optional)"
                type="number"
                min="0.01"
                step="0.01"
                value={maxScore}
                onChange={setMaxScore}
              />
            </div>
          </>
        )}
        {kind === 'intervention' && (
          <>
            <SelectField
              label="Priority"
              value={priority}
              onChange={setPriority}
              options={enumOptions(['ROUTINE', 'IMPORTANT', 'URGENT'])}
              required
            />
            <BsDateField
              label="Next follow-up (BS, optional)"
              value={nextFollowUpOnBs}
              onChange={setNextFollowUpOnBs}
            />
          </>
        )}
        {kind === 'remedial' && (
          <>
            <BsDateField
              label="Starts on (BS)"
              value={startsOnBs}
              onChange={setStartsOnBs}
              required
            />
            <BsDateField
              label="Ends on (BS, optional)"
              value={endsOnBs}
              onChange={setEndsOnBs}
            />
          </>
        )}
        {kind === 'curriculum' && (
          <>
            <SelectField
              label="Progress status"
              value={progressStatus}
              onChange={setProgressStatus}
              options={enumOptions([
                'PLANNED',
                'COMPLETED',
                'MISSED',
                'RETEACH_REQUIRED',
              ])}
              required
            />
            <BsDateField
              label="Planned on (BS)"
              value={plannedOnBs}
              onChange={setPlannedOnBs}
              required
            />
            {progressStatus === 'COMPLETED' ? (
              <BsDateField
                label="Completed on (BS)"
                value={completedOnBs}
                onChange={setCompletedOnBs}
                required
              />
            ) : null}
          </>
        )}
        {kind === 'guidance' && (
          <>
            <SelectField
              label="Remedial group (optional)"
              value={remedialGroupId}
              onChange={setRemedialGroupId}
              options={(remedialQuery.data?.items ?? []).map((group) => ({
                value: group.id,
                label: group.name,
              }))}
              allowBlank
              loading={remedialQuery.isLoading}
            />
            <BsDateField
              label="Visible from (BS, optional)"
              value={visibleFromBs}
              onChange={setVisibleFromBs}
            />
            <BsDateField
              label="Visible until (BS, optional)"
              value={visibleUntilBs}
              onChange={setVisibleUntilBs}
            />
          </>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {(kind === 'outcome' ||
          kind === 'intervention' ||
          kind === 'remedial' ||
          kind === 'curriculum' ||
          kind === 'guidance') && (
          <TextField
            label={
              kind === 'remedial'
                ? 'Group name'
                : kind === 'curriculum'
                  ? 'Curriculum item'
                  : 'Title'
            }
            value={title}
            onChange={setTitle}
            maxLength={kind === 'curriculum' ? 180 : 160}
            required
          />
        )}
        {kind === 'outcome' && (
          <TextAreaField
            label="Description (optional)"
            value={description}
            onChange={setDescription}
            maxLength={1000}
          />
        )}
        {kind === 'assessment' && (
          <>
            <TextAreaField
              label="Teacher note (optional)"
              value={note}
              onChange={setNote}
              maxLength={1000}
            />
            <TextAreaField
              label="Plain-language parent summary (optional)"
              value={parentSummary}
              onChange={setParentSummary}
              maxLength={600}
            />
          </>
        )}
        {kind === 'intervention' && (
          <>
            <TextAreaField
              label="Concern summary"
              value={concernSummary}
              onChange={setConcernSummary}
              maxLength={1200}
              required
            />
            <TextAreaField
              label="Parent-visible summary (optional)"
              value={parentSummary}
              onChange={setParentSummary}
              maxLength={600}
            />
          </>
        )}
        {kind === 'remedial' && (
          <>
            <TextAreaField
              label="Support purpose"
              value={purpose}
              onChange={setPurpose}
              maxLength={1000}
              required
            />
            <TextAreaField
              label="Schedule note (optional)"
              value={scheduleNote}
              onChange={setScheduleNote}
              maxLength={600}
            />
            <TextAreaField
              label="Parent summary (optional)"
              value={parentSummary}
              onChange={setParentSummary}
              maxLength={600}
            />
          </>
        )}
        {kind === 'curriculum' && (
          <>
            {(progressStatus === 'MISSED' ||
              progressStatus === 'RETEACH_REQUIRED') && (
              <TextAreaField
                label="Reason"
                value={missedReason}
                onChange={setMissedReason}
                maxLength={600}
                required
              />
            )}
            <TextAreaField
              label="Reteach plan (optional)"
              value={reteachPlan}
              onChange={setReteachPlan}
              maxLength={600}
            />
            <TextField
              label="HTTPS resource link (optional)"
              value={resourceUrl}
              onChange={setResourceUrl}
              type="url"
              placeholder="https://…"
            />
            <TextAreaField
              label="Teacher note (optional)"
              value={note}
              onChange={setNote}
              maxLength={1000}
            />
          </>
        )}
        {kind === 'guidance' && (
          <>
            <TextAreaField
              label="Explain the skill in plain language"
              value={skillExplanation}
              onChange={setSkillExplanation}
              maxLength={1000}
              required
            />
            <TextAreaField
              label="Practical home activity"
              value={homeActivity}
              onChange={setHomeActivity}
              maxLength={1000}
              required
            />
          </>
        )}
      </div>

      {error ? (
        <p
          className="mt-4 rounded-lg border border-danger-100 bg-danger-50 px-3 py-2 text-sm font-medium text-danger-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <DialogFooter className="mt-6">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : submitLabel(kind)}
        </Button>
      </DialogFooter>
    </form>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  allowBlank,
  required,
  disabled,
  loading,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  allowBlank?: boolean;
  required?: boolean;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        disabled={disabled || loading}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5 disabled:bg-slate-100"
      >
        <option value="">
          {loading ? 'Loading…' : allowBlank ? 'None' : `Select ${label.toLowerCase()}`}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  ...props
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<ComponentProps<typeof Input>, 'value' | 'onChange'>) {
  return (
    <label className="space-y-1.5">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...props}
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  ...props
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<ComponentProps<typeof Textarea>, 'value' | 'onChange'>) {
  return (
    <label className="space-y-1.5">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...props}
      />
    </label>
  );
}

function enumOptions(values: string[]) {
  return values.map((value) => ({
    value,
    label: value.replace(/_/g, ' ').toLowerCase().replace(/^./, (letter) => letter.toUpperCase()),
  }));
}

function gregorianDateString(value: string) {
  const gregorian = toGregorianDateFromBs(parseBsDateInput(value));
  return `${gregorian.year}-${String(gregorian.month).padStart(2, '0')}-${String(gregorian.day).padStart(2, '0')}`;
}

function dialogTitle(kind: CreateKind) {
  return {
    outcome: 'Define learning outcome',
    assessment: 'Record formative check',
    intervention: 'Start learning follow-up',
    remedial: 'Create remedial group',
    curriculum: 'Add curriculum progress item',
    guidance: 'Draft parent learning guidance',
  }[kind];
}

function dialogDescription(kind: CreateKind) {
  return {
    outcome:
      'Create a reusable class and subject skill. Foundational domains are limited to Grades 1–3 by the server.',
    assessment:
      'Capture a short teacher-owned progress check. This is evidence, not a predictive score.',
    intervention:
      'Assign a structured case with a follow-up date and optional family-visible summary.',
    remedial:
      'Create a bounded support group. Add members and activate it after creation.',
    curriculum:
      'Record planned, completed, missed, or reteach-required progress against the teaching plan.',
    guidance:
      'Draft plain-language guidance. A separate publish action controls parent visibility.',
  }[kind];
}

function submitLabel(kind: CreateKind) {
  return {
    outcome: 'Create outcome',
    assessment: 'Save check',
    intervention: 'Start follow-up',
    remedial: 'Create group',
    curriculum: 'Add item',
    guidance: 'Save draft',
  }[kind];
}

function successMessage(kind: CreateKind) {
  return {
    outcome: 'Learning outcome created.',
    assessment: 'Formative check recorded.',
    intervention: 'Learning follow-up started.',
    remedial: 'Remedial group created.',
    curriculum: 'Curriculum progress item added.',
    guidance: 'Parent guidance saved as a draft.',
  }[kind];
}
