export type LearningOutcomeDomain =
  | 'GENERAL'
  | 'FOUNDATIONAL_READING'
  | 'FOUNDATIONAL_NUMERACY';

export type LearningMasteryStatus =
  | 'BEGINNING'
  | 'DEVELOPING'
  | 'SECURE'
  | 'EXTENDING';

export type FormativeAssessmentKind =
  | 'OBSERVATION'
  | 'EXIT_TICKET'
  | 'QUIZ'
  | 'ORAL'
  | 'PRACTICAL'
  | 'CHECKLIST'
  | 'REASSESSMENT';

export type StudentInterventionStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'MONITORING'
  | 'RESOLVED'
  | 'CLOSED';

export type StudentInterventionPriority =
  | 'ROUTINE'
  | 'IMPORTANT'
  | 'URGENT';

export type StudentInterventionEntryType =
  | 'NOTE'
  | 'PARENT_CONTACT'
  | 'ACTION'
  | 'FOLLOW_UP'
  | 'PROGRESS'
  | 'ESCALATION'
  | 'RESOLUTION';

export type RemedialGroupStatus =
  | 'PLANNED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED';

export type CurriculumProgressStatus =
  | 'PLANNED'
  | 'COMPLETED'
  | 'MISSED'
  | 'RETEACH_REQUIRED';

export type ParentLearningGuidanceStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'ARCHIVED';

export type LearningImprovementSourceState =
  | 'available'
  | 'empty'
  | 'partial'
  | 'locked'
  | 'unavailable';

export type LearningImprovementPage<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type LearningImprovementStudentRef = {
  id: string;
  studentSystemId: string;
  fullName: string;
  classId: string;
  className: string;
  classLevel: number;
  sectionId: string | null;
  sectionName: string | null;
};

export type LearningImprovementSubjectRef = {
  id: string;
  code: string;
  name: string;
};

export type LearningOutcomeRecord = {
  id: string;
  academicYearId: string;
  classId: string;
  subject: LearningImprovementSubjectRef;
  code: string;
  title: string;
  description: string | null;
  domain: LearningOutcomeDomain;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type FormativeAssessmentEvidenceRecord = {
  id: string;
  outcome: Pick<
    LearningOutcomeRecord,
    'id' | 'code' | 'title' | 'domain'
  >;
  student: LearningImprovementStudentRef;
  academicYearId: string;
  subject: LearningImprovementSubjectRef;
  teacher: { id: string; fullName: string };
  kind: FormativeAssessmentKind;
  masteryStatus: LearningMasteryStatus;
  score: string | null;
  maxScore: string | null;
  assessedOn: string;
  note: string | null;
  observationChecklist: Record<string, boolean> | null;
  parentSummary: string | null;
  reassessmentOfId: string | null;
  createdAt: string;
};

export type LearningOutcomeProgress = {
  outcome: Pick<
    LearningOutcomeRecord,
    'id' | 'code' | 'title' | 'domain'
  >;
  latestMasteryStatus: LearningMasteryStatus;
  latestAssessedOn: string;
  previousMasteryStatus: LearningMasteryStatus | null;
  assessmentCount: number;
  parentSummary: string | null;
};

export type StudentEarlyWarningReasonCode =
  | 'ATTENDANCE_PATTERN'
  | 'FORMATIVE_SUPPORT'
  | 'HOMEWORK_FOLLOW_UP';

export type StudentEarlyWarningItem = {
  signalKey: string;
  student: LearningImprovementStudentRef;
  attentionLevel: 'WATCH' | 'NEEDS_ATTENTION';
  reasons: Array<{
    code: StudentEarlyWarningReasonCode;
    label: string;
    explanation: string;
    observedValue: number;
    threshold: number;
  }>;
  sourceStates: {
    attendance: LearningImprovementSourceState;
    formativeAssessment: LearningImprovementSourceState;
    homework: LearningImprovementSourceState;
  };
  activeInterventionCaseId: string | null;
  generatedAt: string;
};

export type StudentEarlyWarningResponse = LearningImprovementPage<StudentEarlyWarningItem> & {
  generatedAt: string;
  rulesVersion: 'stage3-v1';
  nonPredictive: true;
};

export type StudentInterventionEntryRecord = {
  id: string;
  entryType: StudentInterventionEntryType;
  body: string;
  parentVisible: boolean;
  contactedAt: string | null;
  nextFollowUpOn: string | null;
  createdAt: string;
};

export type StudentInterventionCaseRecord = {
  id: string;
  student: LearningImprovementStudentRef;
  academicYearId: string;
  owner: { id: string; fullName: string } | null;
  sourceSignalKey: string | null;
  priority: StudentInterventionPriority;
  status: StudentInterventionStatus;
  title: string;
  concernSummary: string;
  parentVisibleSummary: string | null;
  nextFollowUpOn: string | null;
  escalatedAt: string | null;
  resolvedAt: string | null;
  resolutionSummary: string | null;
  version: number;
  entries: StudentInterventionEntryRecord[];
  createdAt: string;
  updatedAt: string;
};

export type RemedialGroupRecord = {
  id: string;
  academicYearId: string;
  classId: string;
  sectionId: string | null;
  subject: LearningImprovementSubjectRef;
  outcome: Pick<LearningOutcomeRecord, 'id' | 'code' | 'title'> | null;
  teacher: { id: string; fullName: string };
  name: string;
  purpose: string;
  status: RemedialGroupStatus;
  startsOn: string;
  endsOn: string | null;
  scheduleNote: string | null;
  parentSummary: string | null;
  members: Array<{ student: LearningImprovementStudentRef; joinedAt: string }>;
  createdAt: string;
  updatedAt: string;
};

export type CurriculumProgressItemRecord = {
  id: string;
  academicYearId: string;
  classId: string;
  sectionId: string | null;
  subject: LearningImprovementSubjectRef;
  outcome: Pick<LearningOutcomeRecord, 'id' | 'code' | 'title'> | null;
  teacher: { id: string; fullName: string };
  title: string;
  status: CurriculumProgressStatus;
  plannedOn: string;
  completedOn: string | null;
  missedReason: string | null;
  reteachPlan: string | null;
  resourceUrl: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CurriculumProgressSummary = {
  totalItems: number;
  planned: number;
  completed: number;
  missed: number;
  reteachRequired: number;
  completionPercent: number | null;
  paceState: 'on_track' | 'attention_needed' | 'unavailable';
};

export type ParentLearningGuidanceRecord = {
  id: string;
  studentId: string;
  student: LearningImprovementStudentRef;
  academicYearId: string;
  subject: LearningImprovementSubjectRef;
  outcome: Pick<LearningOutcomeRecord, 'id' | 'code' | 'title' | 'domain'> | null;
  remedialGroup: {
    id: string;
    name: string;
    scheduleNote: string | null;
  } | null;
  teacher: { id: string; fullName: string };
  title: string;
  skillExplanation: string;
  homeActivity: string;
  status: ParentLearningGuidanceStatus;
  visibleFrom: string | null;
  visibleUntil: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ParentLearningSummary = {
  generatedAt: string;
  student: LearningImprovementStudentRef;
  sourceStates: {
    outcomeProgress: LearningImprovementSourceState;
    guidance: LearningImprovementSourceState;
    remedialSupport: LearningImprovementSourceState;
    interventionUpdates: LearningImprovementSourceState;
  };
  outcomeProgress: LearningOutcomeProgress[];
  guidance: ParentLearningGuidanceRecord[];
  remedialSupport: Array<{
    id: string;
    name: string;
    subject: LearningImprovementSubjectRef;
    startsOn: string;
    endsOn: string | null;
    scheduleNote: string | null;
    parentSummary: string | null;
  }>;
  interventionUpdates: Array<{
    caseId: string;
    status: StudentInterventionStatus;
    title: string;
    summary: string;
    nextFollowUpOn: string | null;
    updatedAt: string;
  }>;
};

export type TeacherStudentLearningHub = {
  generatedAt: string;
  student: LearningImprovementStudentRef;
  sourceStates: {
    outcomes: LearningImprovementSourceState;
    outcomeProgress: LearningImprovementSourceState;
    interventions: LearningImprovementSourceState;
    remedialSupport: LearningImprovementSourceState;
    parentGuidance: LearningImprovementSourceState;
  };
  availableOutcomes: LearningOutcomeRecord[];
  outcomeProgress: LearningOutcomeProgress[];
  interventions: StudentInterventionCaseRecord[];
  remedialGroups: RemedialGroupRecord[];
  parentGuidance: ParentLearningGuidanceRecord[];
};
