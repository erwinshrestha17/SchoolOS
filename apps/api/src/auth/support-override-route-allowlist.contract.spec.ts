import type { SupportOverrideScope } from '@schoolos/core';
import { AcademicYearsController } from '../academic-years/academic-years.controller';
import { AcademicsController } from '../academics/academics.controller';
import { AdmissionCaseQueuesController } from '../admissions/admission-case-queues.controller';
import { AdmissionCasesController } from '../admissions/admission-cases.controller';
import { AttendanceController } from '../attendance/attendance.controller';
import { M2AttendanceHardeningController } from '../attendance/m2-attendance-hardening.controller';
import { ClassesController } from '../classes/classes.controller';
import { CommunicationsOperationsController } from '../communications/communications-operations.controller';
import { DeliveriesController } from '../communications/deliveries.controller';
import { NoticeDetailController } from '../communications/notice-detail.controller';
import { NoticesController } from '../communications/notices.controller';
import { HomeworkController } from '../homework/homework.controller';
import { MeController } from '../plans/me.controller';
import { SchoolSettingsWorkspaceController } from '../settings/school-settings-workspace.controller';
import { SectionsController } from '../sections/sections.controller';
import { StudentSearchController } from '../students/student-search.controller';
import { StudentsController } from '../students/students.controller';
import { TimetableController } from '../timetable/timetable.controller';
import { AuthController } from './auth.controller';
import { SUPPORT_OVERRIDE_READ_SCOPES_KEY } from './decorators/allow-support-override-read.decorator';

const ALL_SCOPES: SupportOverrideScope[] = [
  'SCHOOL_PROFILE',
  'STUDENT_RECORDS',
  'ATTENDANCE',
  'ACADEMICS',
  'HOMEWORK_TIMETABLE',
  'NOTICES_DELIVERY',
];
const ACADEMIC_CONTEXT_SCOPES = ALL_SCOPES.filter(
  (scope) => scope !== 'NOTICES_DELIVERY',
);

const CONTROLLERS = [
  AuthController,
  MeController,
  AcademicYearsController,
  ClassesController,
  SectionsController,
  SchoolSettingsWorkspaceController,
  StudentsController,
  StudentSearchController,
  AcademicsController,
  HomeworkController,
  TimetableController,
  AttendanceController,
  M2AttendanceHardeningController,
  CommunicationsOperationsController,
  NoticesController,
  NoticeDetailController,
  DeliveriesController,
] as const;

const APPROVED: Array<
  [
    controller: (typeof CONTROLLERS)[number],
    handler: string,
    scopes: SupportOverrideScope[],
  ]
> = [
  [AuthController, 'me', ALL_SCOPES],
  [MeController, 'getMyEntitlements', ALL_SCOPES],
  [AcademicYearsController, 'listAcademicYears', ACADEMIC_CONTEXT_SCOPES],
  [ClassesController, 'listClasses', ACADEMIC_CONTEXT_SCOPES],
  [SectionsController, 'listSections', ACADEMIC_CONTEXT_SCOPES],
  [SchoolSettingsWorkspaceController, 'getSchoolProfile', ['SCHOOL_PROFILE']],
  [StudentsController, 'listStudents', ['STUDENT_RECORDS']],
  [StudentsController, 'getSupportStudentModuleSummary', ['STUDENT_RECORDS']],
  [StudentsController, 'getStudentProfile', ['STUDENT_RECORDS']],
  [StudentSearchController, 'searchStudents', ['STUDENT_RECORDS']],
  [AcademicsController, 'listExamTerms', ['ACADEMICS']],
  [AcademicsController, 'listMarks', ['ACADEMICS']],
  [AcademicsController, 'listReportCards', ['ACADEMICS']],
  [HomeworkController, 'listHomework', ['HOMEWORK_TIMETABLE']],
  [HomeworkController, 'getHomework', ['HOMEWORK_TIMETABLE']],
  [
    TimetableController,
    'listSupportPublishedTimetable',
    ['HOMEWORK_TIMETABLE'],
  ],
  [AttendanceController, 'getAnalytics', ['ATTENDANCE']],
  [AttendanceController, 'listConflicts', ['ATTENDANCE']],
  [AttendanceController, 'getCorrectionSummary', ['ATTENDANCE']],
  [M2AttendanceHardeningController, 'getFollowUpQueue', ['ATTENDANCE']],
  [CommunicationsOperationsController, 'getSummary', ['NOTICES_DELIVERY']],
  [
    CommunicationsOperationsController,
    'getProviderDiagnostics',
    ['NOTICES_DELIVERY'],
  ],
  [NoticesController, 'listNotices', ['NOTICES_DELIVERY']],
  [NoticeDetailController, 'getNoticeDetail', ['NOTICES_DELIVERY']],
  [DeliveriesController, 'operations', ['NOTICES_DELIVERY']],
  [DeliveriesController, 'failures', ['NOTICES_DELIVERY']],
];

describe('support override route allowlist contract', () => {
  it('pins the complete method-level allowlist and exact purpose scopes', () => {
    const actual: Array<[string, string, SupportOverrideScope[]]> = [];

    for (const Controller of CONTROLLERS) {
      expect(
        Reflect.getMetadata(SUPPORT_OVERRIDE_READ_SCOPES_KEY, Controller),
      ).toBeUndefined();

      for (const handler of Object.getOwnPropertyNames(Controller.prototype)) {
        if (handler === 'constructor') continue;
        const method =
          Controller.prototype[handler as keyof typeof Controller.prototype];
        if (typeof method !== 'function') continue;
        const scopes = Reflect.getMetadata(
          SUPPORT_OVERRIDE_READ_SCOPES_KEY,
          method,
        ) as SupportOverrideScope[] | undefined;
        if (scopes) actual.push([Controller.name, handler, scopes]);
      }
    }

    expect(actual).toEqual(
      APPROVED.map(([Controller, handler, scopes]) => [
        Controller.name,
        handler,
        scopes,
      ]),
    );
    expect(actual).toHaveLength(26);
  });

  it.each(APPROVED)(
    'allows only the reviewed scopes on %s.%s',
    (Controller, handler, scopes) => {
      expect(
        Reflect.getMetadata(
          SUPPORT_OVERRIDE_READ_SCOPES_KEY,
          Controller.prototype[handler as keyof typeof Controller.prototype],
        ),
      ).toEqual(scopes);
    },
  );

  it.each([
    [StudentsController, 'listStudentOptions'],
    [StudentsController, 'getStudentModuleSummary'],
    [StudentsController, 'getFeeClearance'],
    [AcademicsController, 'getExamTerm'],
    [AcademicsController, 'getReportCardPdf'],
    [HomeworkController, 'listHomeworkTemplates'],
    [HomeworkController, 'getAttachmentDownloadUrl'],
    [TimetableController, 'listTimetable'],
    [TimetableController, 'listPeriods'],
    [AttendanceController, 'getMonthlyRegister'],
    [AttendanceController, 'listCorrectionRequests'],
    [AttendanceController, 'getCorrectionRequest'],
    [DeliveriesController, 'listDeliveries'],
    [NoticesController, 'previewNoticeRecipients'],
    [NoticeDetailController, 'getUnreadRecipients'],
    [AdmissionCaseQueuesController, 'list'],
    [AdmissionCasesController, 'getCase'],
    [AdmissionCasesController, 'listAssessmentCandidates'],
  ] as const)(
    'keeps unreviewed handler %s.%s outside support reachability',
    (Controller, handler) => {
      expect(
        Reflect.getMetadata(
          SUPPORT_OVERRIDE_READ_SCOPES_KEY,
          Controller.prototype[handler as keyof typeof Controller.prototype],
        ),
      ).toBeUndefined();
    },
  );
});
