import {
  AuthMethod,
  LearningAccessType,
  LearningActivityStatus,
  LearningActivityType,
  LearningDifficulty,
  LearningLanguageMode,
  LearningMode,
  LearningQuestionType,
  LearningSessionStatus,
  StaffStatus,
  StudentLifecycleStatus,
} from '@prisma/client';
import { LearningActivityPermissionsService } from '../src/learning/activities/learning-activity-permissions.service';
import { LearningActivitiesService } from '../src/learning/activities/learning-activities.service';
import { LearningAnswerEvaluatorService } from '../src/learning/attempts/learning-answer-evaluator.service';
import { LearningAttemptsService } from '../src/learning/attempts/learning-attempts.service';
import { ParentLearningSummaryService } from '../src/learning/parent-summary/parent-learning-summary.service';
import { LearningProgressService } from '../src/learning/progress/learning-progress.service';
import { LearningResourcesService } from '../src/learning/resources/learning-resources.service';
import { LearningSessionAccessService } from '../src/learning/sessions/learning-session-access.service';
import { LearningSessionsService } from '../src/learning/sessions/learning-sessions.service';
import {
  PrismaMock,
  createAuthContextMock,
  createPrismaMock,
} from './test-helpers';

export function createLearningHarness() {
  const prisma = createPrismaMock();
  const auditService = { record: jest.fn(() => Promise.resolve()) };
  const permissions = new LearningActivityPermissionsService(prisma as any);
  const access = new LearningSessionAccessService(prisma as any);
  const progress = new LearningProgressService(prisma as any, permissions);
  const evaluator = new LearningAnswerEvaluatorService();

  return {
    prisma,
    auditService,
    permissions,
    access,
    activities: new LearningActivitiesService(
      prisma as any,
      permissions,
      auditService as any,
    ),
    sessions: new LearningSessionsService(
      prisma as any,
      permissions,
      access,
      auditService as any,
    ),
    resources: new LearningResourcesService(
      prisma as any,
      permissions,
      auditService as any,
    ),
    attempts: new LearningAttemptsService(
      prisma as any,
      access,
      evaluator,
      progress,
      auditService as any,
    ),
    progress,
    parentSummary: new ParentLearningSummaryService(
      prisma as any,
      auditService as any,
    ),
  };
}

export function seedLearningBase(prisma: PrismaMock) {
  const now = new Date();
  prisma.__state.students = prisma.__state.students.filter(
    (student) => !['student-a', 'student-b'].includes(String(student.id)),
  );
  prisma.__state.tenants = prisma.__state.tenants.filter(
    (tenant) => !['tenant-a', 'tenant-b'].includes(String(tenant.id)),
  );
  prisma.__state.tenants.push({
    id: 'tenant-a',
    slug: 'tenant-a',
    name: 'Tenant A',
    isActive: true,
  });
  prisma.__state.tenants.push({
    id: 'tenant-b',
    slug: 'tenant-b',
    name: 'Tenant B',
    isActive: true,
  });
  prisma.__state.classes.push(
    { id: 'class-a', tenantId: 'tenant-a', name: 'Grade 4', level: 4 },
    { id: 'class-b', tenantId: 'tenant-a', name: 'Grade 5', level: 5 },
  );
  prisma.__state.sections.push(
    { id: 'section-a', tenantId: 'tenant-a', classId: 'class-a', name: 'A' },
    { id: 'section-b', tenantId: 'tenant-a', classId: 'class-b', name: 'B' },
  );
  prisma.__state.subjects.push(
    {
      id: 'subject-a',
      tenantId: 'tenant-a',
      classId: 'class-a',
      name: 'Math',
      code: 'MATH4',
    },
    {
      id: 'subject-other',
      tenantId: 'tenant-a',
      classId: 'class-a',
      name: 'Science',
      code: 'SCI4',
    },
    {
      id: 'subject-b',
      tenantId: 'tenant-a',
      classId: 'class-b',
      name: 'Math',
      code: 'MATH5',
    },
  );
  prisma.__state.staff.push({
    id: 'teacher-a',
    tenantId: 'tenant-a',
    userId: 'teacher-user',
    firstName: 'Teacher',
    lastName: 'A',
    status: StaffStatus.ACTIVE,
  });
  prisma.__state.subjectTeacherAssignments.push({
    id: 'assignment-a',
    tenantId: 'tenant-a',
    academicYearId: 'year-a',
    staffId: 'teacher-a',
    classId: 'class-a',
    sectionId: 'section-a',
    subjectId: 'subject-a',
  });
  prisma.__state.students.push(
    {
      id: 'student-a',
      tenantId: 'tenant-a',
      userId: 'student-user',
      studentSystemId: 'ST-A',
      firstNameEn: 'Student',
      lastNameEn: 'A',
      classId: 'class-a',
      sectionId: 'section-a',
      lifecycleStatus: StudentLifecycleStatus.ACTIVE,
      dateOfBirth: now,
      admissionDate: now,
    },
    {
      id: 'student-b',
      tenantId: 'tenant-a',
      userId: 'student-b-user',
      studentSystemId: 'ST-B',
      firstNameEn: 'Student',
      lastNameEn: 'B',
      classId: 'class-b',
      sectionId: 'section-b',
      lifecycleStatus: StudentLifecycleStatus.ACTIVE,
      dateOfBirth: now,
      admissionDate: now,
    },
  );
  prisma.__state.guardians.push({
    id: 'guardian-a',
    tenantId: 'tenant-a',
    userId: 'parent-user',
    fullName: 'Parent A',
    relation: 'Parent',
    primaryPhone: '9800000000',
  });
  prisma.__state.studentGuardians.push({
    id: 'link-a',
    tenantId: 'tenant-a',
    studentId: 'student-a',
    guardianId: 'guardian-a',
    relation: 'Parent',
  });
}

export function seedLearningActivity(prisma: PrismaMock) {
  prisma.__state.learningActivities.push({
    id: 'activity-a',
    tenantId: 'tenant-a',
    title: 'Fractions',
    description: 'Fractions quiz',
    classId: 'class-a',
    sectionId: 'section-a',
    subjectId: 'subject-a',
    teacherId: 'teacher-a',
    activityType: LearningActivityType.QUIZ,
    difficulty: LearningDifficulty.EASY,
    mode: LearningMode.COMPUTER_LAB,
    accessType: LearningAccessType.SCHOOL_ONLY,
    languageMode: LearningLanguageMode.ENGLISH,
    status: LearningActivityStatus.READY,
    createdBy: 'teacher-user',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  prisma.__state.learningQuestions.push({
    id: 'question-a',
    tenantId: 'tenant-a',
    activityId: 'activity-a',
    type: LearningQuestionType.MULTIPLE_CHOICE,
    prompt: '1/2 equals?',
    options: ['A', 'B'],
    correctAnswer: { value: 'A' },
    points: 1,
    sortOrder: 0,
  });
}

export function seedLearningSession(
  prisma: PrismaMock,
  overrides: Record<string, unknown> = {},
) {
  prisma.__state.learningSessions.push({
    id: 'session-a',
    tenantId: 'tenant-a',
    activityId: 'activity-a',
    classId: 'class-a',
    sectionId: 'section-a',
    subjectId: 'subject-a',
    teacherId: 'teacher-a',
    mode: LearningMode.COMPUTER_LAB,
    sessionCode: 'ABC123',
    status: LearningSessionStatus.LIVE,
    schoolOnly: true,
    startedAt: new Date(),
    expiresAt: new Date(Date.now() + 60 * 60_000),
    ...overrides,
  });
}

export const teacherActor = () =>
  createAuthContextMock({
    userId: 'teacher-user',
    tenantId: 'tenant-a',
    tenantSlug: 'tenant-a',
    authMethod: AuthMethod.PASSWORD,
    roles: ['teacher'],
    permissions: [
      'learning:read',
      'learning:create',
      'learning:update',
      'learning:launch',
      'learning:progress',
    ],
  });

export const studentActor = () =>
  createAuthContextMock({
    userId: 'student-user',
    tenantId: 'tenant-a',
    tenantSlug: 'tenant-a',
    authMethod: AuthMethod.PASSWORD,
    roles: ['student'],
    permissions: ['learning:read', 'learning:attempt', 'learning:progress'],
  });

export const parentActor = () =>
  createAuthContextMock({
    userId: 'parent-user',
    tenantId: 'tenant-a',
    tenantSlug: 'tenant-a',
    authMethod: AuthMethod.PASSWORD,
    roles: ['parent'],
    permissions: ['learning:read', 'learning:progress'],
  });
