import type { StudentProfile } from "./student.js";
import type { PromotionResult } from "./common.js";

export type AcademicYearSummary = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  isCurrent: boolean;
};

export type ClassSummary = {
  id: string;
  name: string;
  code?: string | null;
  level?: number;
  studentCount?: number;
  sectionCount?: number;
  subjectCount?: number;
};

export type SectionSummary = {
  id: string;
  name: string;
  classId?: string;
  class?: {
    id: string;
    name: string;
  };
  capacity: number | null;
  studentCount?: number;
  isAssignedClassTeacher?: boolean;
  isAssignedSubjectTeacher?: boolean;
};

export type SubjectSummary = {
  id: string;
  classId: string;
  code: string;
  name: string;
  type: string;
  hasPractical: boolean;
  theoryMarks: number | null;
  practicalMarks: number | null;
  passMarks: number | null;
  class?: ClassSummary;
  teacherAssignments?: TeacherAssignmentSummary[];
};

export type TeacherAssignmentSummary = {
  id: string;
  academicYearId: string;
  subjectId: string;
  staffId: string;
  classId: string;
  sectionId: string | null;
  subject?: SubjectSummary;
  staff?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
  };
};

export type ExamTermSummary = {
  id: string;
  academicYearId: string;
  name: string;
  startsOn: string;
  endsOn: string;
  weightPercent: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  isLocked: boolean;
  academicYear?: {
    id: string;
    name: string;
  };
  components?: AssessmentComponentSummary[];
};

export type ExamTimetableSlotSummary = {
  id: string;
  academicYearId: string;
  examTermId: string;
  subjectId: string;
  classId: string;
  sectionId: string | null;
  startsAt: string;
  endsAt: string;
  room: string | null;
  publishedAt: string | null;
};

export type MobileExamSchedule = {
  academicYear: {
    id: string;
    name: string;
  } | null;
  items: MobileExamScheduleItem[];
};

export type MobileExamScheduleItem = {
  id: string;
  examTerm: {
    id: string;
    name: string;
  };
  subject: {
    id: string;
    name: string;
    code: string;
  };
  startsAt: string;
  endsAt: string;
  room: string | null;
  publishedAt: string;
};

export type AssessmentRetakeType = "RETEST" | "MAKE_UP";

export type AssessmentRetakeStatus =
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "SCHEDULED"
  | "COMPLETED"
  | "APPLIED"
  | "CANCELLED";

export type AssessmentRetakeResultDecision =
  | "PENDING"
  | "KEEP_ORIGINAL"
  | "USE_RETAKE";

export type AssessmentRetakeSummary = {
  id: string;
  markEntryId: string;
  examTermId: string;
  assessmentComponentId: string;
  subjectId: string;
  studentId: string;
  classId: string;
  sectionId: string | null;
  type: AssessmentRetakeType;
  status: AssessmentRetakeStatus;
  reason: string;
  originalMarks: number;
  originalStatus: MarkEntrySummary["status"];
  scheduledStartsAt: string | null;
  scheduledEndsAt: string | null;
  room: string | null;
  attemptMarks: number | null;
  attemptRemarks: string | null;
  resultDecision: AssessmentRetakeResultDecision;
  resultDecisionReason: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  completedAt: string | null;
  appliedAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  student?: {
    id: string;
    studentSystemId: string;
    firstNameEn: string;
    lastNameEn: string;
  };
  class?: { id: string; name: string };
  section?: { id: string; name: string } | null;
  subject?: { id: string; name: string; code: string };
  examTerm?: {
    id: string;
    name: string;
    academicYearId: string;
    isLocked: boolean;
  };
  assessmentComponent?: {
    id: string;
    name: string;
    maxMarks: number;
  };
};

export type AssessmentRetakePage = {
  items: AssessmentRetakeSummary[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type MarkLockRequestSummary = {
  id: string;
  examTermId: string;
  status: string;
  reason: string;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type AssessmentComponentSummary = {
  id: string;
  examTermId: string;
  subjectId: string;
  name: string;
  type: string;
  maxMarks: number;
  weightPercent: number;
  passMarks: number | null;
  subject?: SubjectSummary;
  examTerm?: { id: string; name: string; isLocked: boolean };
};

export type MarkEntrySummary = {
  id: string;
  examTermId: string;
  assessmentComponentId: string;
  subjectId: string;
  studentId: string;
  marksObtained: number;
  status:
    | "DRAFT"
    | "PRESENT"
    | "ABSENT"
    | "EXCUSED"
    | "MISSING"
    | "WITHHELD"
    | "SUBMITTED"
    | "RETEST";
  remarks: string | null;
  isLocked: boolean;
  student?: StudentProfile;
  subject?: SubjectSummary;
  assessmentComponent?: AssessmentComponentSummary;
};

export type CasRecordSummary = {
  id: string;
  academicYearId: string;
  subjectId: string;
  studentId: string;
  classId: string;
  sectionId: string | null;
  category: string;
  score: number;
  maxScore: number;
  observedOn: string;
  note: string | null;
  student?: {
    firstNameEn: string;
    lastNameEn: string;
    studentSystemId: string;
  };
  subject?: { code: string; name: string };
  class?: { name: string };
  section?: { name: string | null };
};

export type ReportCardSummary = {
  id: string;
  academicYearId: string;
  examTermId: string;
  studentId: string;
  classId: string;
  sectionId: string | null;
  totalMarks: number;
  maxMarks: number;
  percentage: number;
  grade: string;
  gpa: number;
  status: string;
  lockedAt: string | null;
  student?: StudentProfile;
};

export type PromotionReadiness = {
  studentId: string;
  studentName: string;
  studentSystemId: string;
  classId: string;
  className: string;
  sectionId: string | null;
  sectionName: string | null;
  reportCardId: string | null;
  percentage: number;
  grade: string;
  gpa: number;
  status: "READY" | "REVIEW" | "BLOCKED";
  reasons: string[];
  recommendedAction: "PROMOTE" | "REVIEW" | "HOLD";
  lifecycleStatus: string;
  outstandingBalance: number;
};

export type BatchPromotionResult = {
  summary: {
    total: number;
    promoted: number;
    skipped: number;
    failed: number;
  };
  results: PromotionResult[];
};

export type ResultPublishingReadiness = {
  reportCardId: string;
  studentId: string;
  studentName: string;
  studentSystemId: string;
  classId: string;
  className: string;
  sectionId: string | null;
  sectionName: string | null;
  academicYearId: string;
  academicYearName: string;
  examTermId: string;
  examTermName: string;
  percentage: number;
  grade: string;
  gpa: number;
  reportStatus: string;
  publishStatus: string;
  publishedAt: string | null;
  publishedBy: string | null;
  blockedReasons: string[];
  notificationEligibility: boolean;
};
