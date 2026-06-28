import type { ClassSummary, SectionSummary, SubjectSummary } from './academic.js';
import type {
  StablePaginationMeta,
  TimetableVersionStatus,
  TimetableValidationIssue,
} from './common.js';

export type TimetableSlotSummary = {
  id: string;
  versionId?: string | null;
  academicYearId: string;
  classId: string;
  sectionId: string | null;
  subjectId: string;
  staffId: string;
  periodId?: string | null;
  roomId?: string | null;
  dayOfWeek: number;
  startsAt: string;
  endsAt: string;
  room: string | null;
  class?: ClassSummary;
  section?: SectionSummary | null;
  subject?: SubjectSummary;
  staff?: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
  };
  period?: TimetablePeriodSummary | null;
  roomRef?: RoomSummary | null;
  version?: TimetableVersionSummary | null;
};

export type TimetablePeriodSummary = {
  id: string;
  academicYearId: string;
  name: string;
  dayOfWeek: number | null;
  startsAt: string;
  endsAt: string;
  sortOrder: number;
  isActive: boolean;
};

export type RoomSummary = {
  id: string;
  name: string;
  code: string | null;
  capacity: number | null;
  isActive: boolean;
};

export type TimetableVersionSummary = {
  id: string;
  academicYearId: string;
  classId: string | null;
  sectionId: string | null;
  versionName: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: TimetableVersionStatus;
  publishedAt?: string | null;
  lockedAt?: string | null;
  archivedAt?: string | null;
  class?: ClassSummary | null;
  section?: SectionSummary | null;
  slots?: TimetableSlotSummary[];
};

export type TimetableValidationResult = {
  valid: boolean;
  errors: TimetableValidationIssue[];
  warnings: TimetableValidationIssue[];
};

export type TeacherAvailabilitySummary = {
  availability: Array<{
    id: string;
    academicYearId: string | null;
    staffId: string;
    dayOfWeek: number;
    startsAt: string;
    endsAt: string;
    type: 'AVAILABLE' | 'UNAVAILABLE';
    note: string | null;
  }>;
  limit: {
    id: string;
    maxPeriodsPerDay: number | null;
    maxPeriodsPerWeek: number | null;
  } | null;
};

export type SubjectWeeklyRequirementSummary = {
  id: string;
  academicYearId: string;
  classId: string;
  sectionId: string | null;
  subjectId: string;
  requiredPeriodsPerWeek: number;
  class?: ClassSummary;
  section?: SectionSummary | null;
  subject?: SubjectSummary;
};

export type TimetableSubstitutionSummary = {
  id: string;
  timetableSlotId: string;
  absentTeacherId: string;
  substituteTeacherId: string | null;
  date: string;
  reason: string;
  status: 'DRAFT' | 'ASSIGNED' | 'CANCELLED' | 'COMPLETED';
  timetableSlot?: TimetableSlotSummary;
};

export type TeacherWorkloadSummary = {
  staffId: string;
  employeeId: string;
  staffName: string;
  slotCount: number;
  homeworkCount: number;
  teachingMinutes: number;
  weeklyHours: number;
  slots: TimetableSlotSummary[];
};

export type TimetableSlotPage = {
  items: TimetableSlotSummary[];
  meta: StablePaginationMeta;
};

export type TimetableVersionPage = {
  items: TimetableVersionSummary[];
  meta: StablePaginationMeta;
};

export type TimetableSubstitutionPage = {
  items: TimetableSubstitutionSummary[];
  meta: StablePaginationMeta;
};

export type TeacherWorkloadPage = {
  items: TeacherWorkloadSummary[];
  meta: StablePaginationMeta;
  summary: {
    teacherCount: number;
    totalPeriods: number;
    totalTeachingMinutes: number;
    totalWeeklyHours: number;
  };
};
