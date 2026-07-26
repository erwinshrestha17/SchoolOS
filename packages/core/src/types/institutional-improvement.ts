export type TeacherObservationStatus =
  | 'DRAFT'
  | 'COMPLETED'
  | 'ACKNOWLEDGED'
  | 'FOLLOW_UP_DUE'
  | 'CLOSED';

export type TeacherDevelopmentGoalStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED';

export type TeacherTrainingStatus = 'PLANNED' | 'COMPLETED' | 'CANCELLED';

export type SchoolImprovementPlanStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'ARCHIVED';

export type SchoolImprovementActionStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'COMPLETED'
  | 'CANCELLED';

export type InstitutionalImprovementPage<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type StaffReference = {
  id: string;
  employeeId: string;
  fullName: string;
  designation: string | null;
};

export type TeacherObservationRecord = {
  id: string;
  teacher: StaffReference;
  observerUserId: string;
  academicYearId: string;
  classId: string | null;
  sectionId: string | null;
  subjectId: string | null;
  timetableSlotId: string | null;
  observedOn: string;
  strengths: string;
  developmentFocus: string;
  agreedAction: string | null;
  teacherResponse: string | null;
  followUpOn: string | null;
  status: TeacherObservationStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type TeacherDevelopmentGoalRecord = {
  id: string;
  teacher: StaffReference;
  mentor: StaffReference | null;
  academicYearId: string;
  title: string;
  baseline: string;
  target: string;
  actionPlan: string;
  startsOn: string;
  dueOn: string;
  status: TeacherDevelopmentGoalStatus;
  progressNote: string | null;
  completedOn: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type TeacherTrainingRecord = {
  id: string;
  teacher: StaffReference;
  title: string;
  providerName: string | null;
  startsOn: string;
  endsOn: string | null;
  status: TeacherTrainingStatus;
  learningSummary: string | null;
  certificateFileAssetId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TeacherDevelopmentOverview = {
  generatedAt: string;
  academicYearId: string;
  metrics: {
    observationsDue: number;
    activeGoals: number;
    overdueGoals: number;
    completedTraining: number;
  };
  sourceStates: {
    observations: 'available' | 'empty';
    goals: 'available' | 'empty';
    training: 'available' | 'empty';
  };
  observations: TeacherObservationRecord[];
  goals: TeacherDevelopmentGoalRecord[];
  training: TeacherTrainingRecord[];
};

export type SchoolImprovementKpiRecord = {
  id: string;
  ownerUserId: string;
  name: string;
  unit: string;
  baselineValue: string;
  targetValue: string;
  latestValue: string | null;
  dueOn: string;
};

export type SchoolImprovementActionRecord = {
  id: string;
  ownerUserId: string;
  title: string;
  details: string;
  dueOn: string;
  status: SchoolImprovementActionStatus;
  progressNote: string | null;
  evidenceFileAssetId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type SchoolImprovementReviewRecord = {
  id: string;
  reviewedByUserId: string;
  reviewedOn: string;
  summary: string;
  nextActions: string;
  kpiSnapshot: Array<{
    kpiId: string;
    value: number;
    note?: string;
  }>;
  createdAt: string;
};

export type SchoolImprovementPlanRecord = {
  id: string;
  academicYearId: string;
  ownerUserId: string;
  title: string;
  baselineSummary: string;
  targetSummary: string;
  startsOn: string;
  endsOn: string;
  status: SchoolImprovementPlanStatus;
  version: number;
  kpis: SchoolImprovementKpiRecord[];
  actions: SchoolImprovementActionRecord[];
  reviews: SchoolImprovementReviewRecord[];
  createdAt: string;
  updatedAt: string;
};

export type BoardReadinessTrack = 'GRADE_8' | 'SEE' | 'GRADE_12';
export type BoardReadinessState =
  | 'READY'
  | 'NEEDS_ATTENTION'
  | 'BLOCKED'
  | 'UNAVAILABLE';

export type BoardReadinessIndicator = {
  code: string;
  label: string;
  state: BoardReadinessState;
  observed: number | null;
  expected: number | null;
  explanation: string;
  actionRoute: string | null;
};

export type BoardExamReadiness = {
  generatedAt: string;
  academicYearId: string;
  track: BoardReadinessTrack;
  classLevel: 8 | 10 | 12;
  state: BoardReadinessState;
  nonPredictive: true;
  sourceStates: {
    students: 'available' | 'empty' | 'unavailable';
    examTerms: 'available' | 'empty' | 'unavailable';
    marks: 'available' | 'empty' | 'unavailable';
    reportCards: 'available' | 'empty' | 'unavailable';
    iemis: 'available' | 'empty' | 'unavailable';
  };
  indicators: BoardReadinessIndicator[];
};
