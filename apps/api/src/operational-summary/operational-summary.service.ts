import { Injectable } from '@nestjs/common';
import { getNepalSchoolDay } from '@schoolos/core';
import type { AuthContext } from '../auth/auth.types';
import { getParentStudentIds } from '../common/security/parent-scope';
import { EntitlementsService } from '../plans/entitlements.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  OPERATIONAL_SUMMARY_MODULES,
  type OperationalAttentionItem,
  type OperationalModuleSummary,
  type OperationalRecentItem,
  type OperationalSummaryModule,
  type OperationalSummaryStatus,
} from './operational-summary.types';

type Day = ReturnType<typeof getNepalSchoolDay>;
type SummaryModule = Exclude<OperationalSummaryModule, 'm11_intelligence'>;
interface DelegateRow {
  id: string;
  createdAt: Date;
}
interface ModelDelegate {
  count(args?: unknown): Promise<number>;
  findMany?(args?: unknown): Promise<DelegateRow[]>;
  aggregate?(args?: unknown): Promise<unknown>;
}
interface MetricDefinition {
  key: string;
  model: string;
  where: Record<string, unknown>;
  attention?: {
    label: string;
    action: string;
    severity?: OperationalAttentionItem['severity'];
  };
}
interface Metric {
  key: string;
  value: number | string | null;
  failed: boolean;
  attention?: OperationalAttentionItem;
}
interface TeacherScope {
  staffId: string;
  subjectIds: string[];
  classSectionScopes: Array<{ classId: string; sectionId: string | null }>;
}

const MODULE_CONFIG: Record<
  SummaryModule,
  { entitlement: string; permissions: string[]; route: string; label: string }
> = {
  m1_students: {
    entitlement: 'students',
    permissions: ['students:read', 'admissions:read'],
    route: '/dashboard/students',
    label: 'Students',
  },
  m2_attendance: {
    entitlement: 'attendance',
    permissions: ['attendance:read'],
    route: '/dashboard/attendance',
    label: 'Attendance',
  },
  m3_fees: {
    entitlement: 'fees',
    permissions: ['fees:read', 'fees:manage', 'payments:close'],
    route: '/dashboard/fees',
    label: 'Fees',
  },
  m4_academics: {
    entitlement: 'exams',
    permissions: ['academics:read', 'marks:read'],
    route: '/dashboard/academics',
    label: 'Academics',
  },
  m5_activity: {
    entitlement: 'activity',
    permissions: ['activity_feed:read', 'activity_feed:moderate'],
    route: '/dashboard/activity',
    label: 'Activity',
  },
  m6_homework_timetable: {
    entitlement: 'homework',
    permissions: ['homework:read', 'timetable:read'],
    route: '/dashboard/homework',
    label: 'Homework & Timetable',
  },
  m7_hr_payroll: {
    entitlement: 'hr',
    permissions: ['staff:read', 'payroll:read', 'hr:read'],
    route: '/dashboard/hr',
    label: 'HR & Payroll',
  },
  m8a_library: {
    entitlement: 'library',
    permissions: ['library:read'],
    route: '/dashboard/library',
    label: 'Library',
  },
  m8b_transport: {
    entitlement: 'transport',
    permissions: ['transport:trips:read', 'transport:reports:read'],
    route: '/dashboard/transport',
    label: 'Transport',
  },
  m8c_canteen: {
    entitlement: 'canteen',
    permissions: ['canteen:read', 'canteen:manage'],
    route: '/dashboard/canteen',
    label: 'Canteen',
  },
  m9_accounting: {
    entitlement: 'accounting',
    permissions: ['accounting:read'],
    route: '/dashboard/accounting',
    label: 'Accounting',
  },
  m10_communications: {
    entitlement: 'notices',
    permissions: ['notices:read', 'communications:read'],
    route: '/dashboard/notices',
    label: 'Notices & Communication',
  },
  m12_learning: {
    entitlement: 'learning',
    permissions: ['learning:read', 'learning:manage'],
    route: '/dashboard/learning',
    label: 'Learning',
  },
};

const TEACHING_ROLES = new Set(['teacher', 'subject_teacher']);
const TEACHER_MODULES = new Set<SummaryModule>([
  'm2_attendance',
  'm4_academics',
  'm5_activity',
  'm6_homework_timetable',
  'm12_learning',
]);

@Injectable()
export class OperationalSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  async getDashboardSummary(actor: AuthContext) {
    const day = getNepalSchoolDay();
    const entitlements = await this.entitlementsService.getEntitlements(
      actor.tenantId,
    );
    const all = await Promise.all(
      OPERATIONAL_SUMMARY_MODULES.filter(
        (module): module is SummaryModule => module !== 'm11_intelligence',
      ).map((module) =>
        this.getModuleSummaryInternal(module, actor, day, entitlements.modules),
      ),
    );
    const modules = all.filter((module) => module.permissions.canView);
    const attentionItems = modules
      .flatMap((module) =>
        module.attentionItems.map((item) => ({
          ...item,
          module: module.module,
        })),
      )
      .sort(
        (left, right) =>
          severityOrder(left.severity) - severityOrder(right.severity),
      )
      .slice(0, 10);
    const recentItems = modules
      .flatMap((module) =>
        module.recentItems.map((item) => ({ ...item, module: module.module })),
      )
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .slice(0, 10);

    return {
      generatedAt: new Date().toISOString(),
      schoolDay: day.gregorianDate,
      module: 'dashboard',
      status: dashboardStatus(modules),
      summary: {
        visibleModuleCount: modules.length,
        readyModuleCount: modules.filter((module) => module.status === 'ready')
          .length,
        attentionItemCount: attentionItems.length,
      },
      attentionItems,
      recentItems,
      nextActions: modules.flatMap((module) => module.nextActions).slice(0, 8),
      modules,
    };
  }

  async getModuleSummary(module: OperationalSummaryModule, actor: AuthContext) {
    const day = getNepalSchoolDay();
    const entitlements = await this.entitlementsService.getEntitlements(
      actor.tenantId,
    );
    if (module === 'm11_intelligence') {
      return this.emptySummary(module, day, 'locked', false, {
        roadmapOnly: 'M11 Intelligence is roadmap-only.',
      });
    }
    return this.getModuleSummaryInternal(
      module,
      actor,
      day,
      entitlements.modules,
    );
  }

  async getMobileSummary(
    persona: 'parent' | 'teacher' | 'principal' | 'driver' | 'staff',
    actor: AuthContext,
  ) {
    const day = getNepalSchoolDay();
    const modules = new Set(
      (await this.entitlementsService.getEntitlements(actor.tenantId)).modules,
    );

    switch (persona) {
      case 'parent':
        return this.parentMobileSummary(actor, day, modules);
      case 'teacher':
        return this.teacherMobileSummary(actor, day, modules);
      case 'principal':
        return this.principalMobileSummary(actor, day);
      case 'driver':
        return this.driverMobileSummary(actor, day, modules);
      case 'staff':
        return this.staffMobileSummary(actor, day, modules);
    }
  }

  private async getModuleSummaryInternal(
    module: SummaryModule,
    actor: AuthContext,
    day: Day,
    enabledModules: string[],
  ): Promise<OperationalModuleSummary> {
    const config = MODULE_CONFIG[module];
    if (!this.canView(module, actor, config.permissions)) {
      return this.emptySummary(module, day, 'permissionDenied', false);
    }
    if (!enabledModules.includes(config.entitlement)) {
      return this.emptySummary(module, day, 'locked', true);
    }

    const teacherScope = this.isTeachingOnly(actor)
      ? await this.getTeacherScope(actor)
      : null;
    if (this.isTeachingOnly(actor) && !TEACHER_MODULES.has(module)) {
      return this.emptySummary(module, day, 'permissionDenied', false);
    }
    if (this.isTeachingOnly(actor) && !teacherScope) {
      return this.emptySummary(module, day, 'empty', true);
    }

    const metrics = await this.moduleMetrics(module, actor, day, teacherScope);
    const recent = await this.recentItems(
      this.recentModel(module),
      this.recentWhere(module, actor, teacherScope),
      config.label,
    );
    const status =
      metrics.some((metric) => metric.failed) || recent.failed
        ? 'partial'
        : metrics.length > 0 && metrics.every((metric) => metric.value === 0)
          ? 'empty'
          : 'ready';

    const attentionItems = metrics
      .flatMap((metric) => (metric.attention ? [metric.attention] : []))
      .slice(0, 10);

    return {
      generatedAt: new Date().toISOString(),
      schoolDay: day.gregorianDate,
      module,
      status,
      permissions: { canView: true },
      summary: Object.fromEntries(
        metrics.map((metric) => [metric.key, metric.value]),
      ),
      attentionItems,
      recentItems: recent.items,
      // Only surface a dashboard shortcut for this module when it genuinely
      // has something to review. Otherwise every enabled module always
      // contributed a generic "Open <module>" action, which made the
      // dashboard's cross-module next-actions list just re-list every
      // sidebar destination instead of the work that actually needs
      // attention today.
      nextActions:
        attentionItems.length > 0
          ? [
              {
                key: `open_${module}`,
                label: `Open ${config.label}`,
                route: config.route,
              },
            ]
          : [],
      nextCursor: null,
    };
  }

  private async moduleMetrics(
    module: SummaryModule,
    actor: AuthContext,
    day: Day,
    teacherScope: TeacherScope | null,
  ): Promise<Metric[]> {
    const tenantId = actor.tenantId;
    const now = new Date();
    const thirtyDays = new Date(
      day.endExclusiveUtc.getTime() + 30 * 86_400_000,
    );
    const staleGpsAt = new Date(now.getTime() - 15 * 60_000);
    const teacherOnly = this.isTeachingOnly(actor);

    const definitions: Record<SummaryModule, MetricDefinition[]> = {
      m1_students: [
        this.def(
          'applicationsNeedingReview',
          'admissionApplication',
          {
            tenantId,
            status: {
              in: [
                'INQUIRY',
                'APPLICATION',
                'DOCUMENT_PENDING',
                'INTERVIEW',
                'ACCEPTED',
              ],
            },
          },
          'Review pending admissions',
          '/dashboard/admissions',
        ),
        this.def(
          'unverifiedDocuments',
          'studentDocument',
          { tenantId, verifiedAt: null, status: 'ACTIVE' },
          'Review student documents',
          '/dashboard/students/documents',
        ),
        this.def(
          'duplicateCandidates',
          'admissionImportRow',
          { tenantId, status: 'DUPLICATE' },
          'Review duplicate candidates',
          '/dashboard/students/duplicates',
        ),
        this.def('admissionsToday', 'enrollment', {
          tenantId,
          admissionDate: { gte: day.startUtc, lt: day.endExclusiveUtc },
        }),
        this.def(
          'qrCredentialIssues',
          'studentQrCredential',
          {
            tenantId,
            OR: [{ expiresAt: { lte: now } }, { revokedAt: { not: null } }],
          },
          'Review student QR credentials',
          '/dashboard/students/qr',
        ),
        this.def(
          'iemisReadinessBlockers',
          'enrollment',
          { tenantId, admissionNumber: null, status: 'ACTIVE' },
          'Review iEMIS readiness',
          '/dashboard/students/iemis',
        ),
      ],
      m2_attendance: teacherOnly
        ? this.teacherAttendanceDefinitions(actor, day, teacherScope!)
        : [
            this.def('expectedStudents', 'student', {
              tenantId,
              lifecycleStatus: 'ACTIVE',
            }),
            this.def('attendanceSessionsToday', 'attendanceSession', {
              tenantId,
              attendanceDate: { gte: day.startUtc, lt: day.endExclusiveUtc },
            }),
            this.def('presentToday', 'attendanceRecord', {
              tenantId,
              status: 'PRESENT',
              attendanceSession: {
                attendanceDate: { gte: day.startUtc, lt: day.endExclusiveUtc },
              },
            }),
            this.def(
              'absentToday',
              'attendanceRecord',
              {
                tenantId,
                status: 'ABSENT',
                attendanceSession: {
                  attendanceDate: {
                    gte: day.startUtc,
                    lt: day.endExclusiveUtc,
                  },
                },
              },
              'Review absent students',
              '/dashboard/attendance/daily',
            ),
            this.def(
              'lateToday',
              'attendanceRecord',
              {
                tenantId,
                status: 'LATE',
                attendanceSession: {
                  attendanceDate: {
                    gte: day.startUtc,
                    lt: day.endExclusiveUtc,
                  },
                },
              },
              'Review late arrivals',
              '/dashboard/attendance/daily',
            ),
            this.def(
              'pendingCorrections',
              'attendanceCorrectionRequest',
              { tenantId, status: 'PENDING' },
              'Review attendance corrections',
              '/dashboard/attendance/corrections',
            ),
            this.def(
              'unsubmittedRegisters',
              'attendanceSession',
              {
                tenantId,
                attendanceDate: { gte: day.startUtc, lt: day.endExclusiveUtc },
                submittedAt: null,
              },
              'Complete pending attendance registers',
              '/dashboard/attendance/daily',
            ),
          ],
      m3_fees: [
        this.def('paymentCountToday', 'payment', {
          tenantId,
          status: 'SUCCESS',
          paidAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
        }),
        this.def(
          'overdueInvoices',
          'invoice',
          {
            tenantId,
            status: { in: ['ISSUED', 'PARTIAL'] },
            dueDate: { lt: day.startUtc },
          },
          'Review overdue fee follow-up',
          '/dashboard/fees/dues',
        ),
        this.def('invoicesDueToday', 'invoice', {
          tenantId,
          status: { in: ['ISSUED', 'PARTIAL'] },
          dueDate: { gte: day.startUtc, lt: day.endExclusiveUtc },
        }),
        this.def(
          'refundsToday',
          'paymentRefund',
          {
            tenantId,
            refundDate: { gte: day.startUtc, lt: day.endExclusiveUtc },
          },
          'Review refunds',
          '/dashboard/fees/reversals',
        ),
        this.def('billingRunsToday', 'feeBillingRun', {
          tenantId,
          generatedAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
        }),
        this.def(
          'cashierVarianceRisks',
          'cashierClose',
          {
            tenantId,
            closedAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
            varianceAmount: { not: 0 },
          },
          'Review cashier-close variances',
          '/dashboard/fees/cashier-close',
        ),
      ],
      m4_academics: teacherOnly
        ? [
            this.def(
              'assignedMarksOpen',
              'markEntry',
              {
                tenantId,
                subjectId: { in: teacherScope?.subjectIds ?? [] },
                isLocked: false,
              },
              'Complete marks for assigned subjects',
              '/dashboard/academics/marks',
            ),
            this.def('assignedExamSlotsToday', 'examTimetableSlot', {
              tenantId,
              subjectId: { in: teacherScope?.subjectIds ?? [] },
              startsAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
            }),
          ]
        : [
            this.def('currentAcademicYears', 'academicYear', {
              tenantId,
              isCurrent: true,
            }),
            this.def('examSlotsToday', 'examTimetableSlot', {
              tenantId,
              startsAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
            }),
            this.def(
              'marksOpen',
              'markEntry',
              { tenantId, isLocked: false },
              'Review marks entry progress',
              '/dashboard/academics/marks',
            ),
            this.def(
              'pendingMarkLocks',
              'markLockRequest',
              { tenantId, status: 'PENDING' },
              'Review mark lock requests',
              '/dashboard/academics/marks',
            ),
            this.def(
              'reportCardPublishBlockers',
              'reportCard',
              { tenantId, publishedAt: null, isCurrent: true },
              'Review report-card readiness',
              '/dashboard/academics/report-cards',
            ),
            this.def(
              'promotionReady',
              'promotionRecord',
              { tenantId, status: 'READY' },
              'Review promotion readiness',
              '/dashboard/academics',
            ),
          ],
      m5_activity: teacherOnly
        ? [
            this.def(
              'myPostsAwaitingModeration',
              'activityPost',
              {
                tenantId,
                createdById: actor.userId,
                status: 'PENDING_APPROVAL',
              },
              'Review your pending activity posts',
              '/dashboard/activity/moderation',
            ),
            this.def('myPublishedPostsToday', 'activityPost', {
              tenantId,
              createdById: actor.userId,
              publishedAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
            }),
            this.def('myDraftPosts', 'activityPost', {
              tenantId,
              createdById: actor.userId,
              status: 'DRAFT',
            }),
          ]
        : [
            this.def(
              'pendingModeration',
              'activityPost',
              { tenantId, status: 'PENDING_APPROVAL' },
              'Review activity moderation',
              '/dashboard/activity/moderation',
            ),
            this.def('publishedToday', 'activityPost', {
              tenantId,
              publishedAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
            }),
            this.def('draftCount', 'activityPost', {
              tenantId,
              status: 'DRAFT',
            }),
            this.def(
              'failedMediaProcessing',
              'activityAttachment',
              { tenantId, processingStatus: 'FAILED' },
              'Review failed activity media',
              '/dashboard/activity/gallery',
            ),
            this.def(
              'failedDeliveries',
              'notificationDelivery',
              {
                tenantId,
                activityPostId: { not: null },
                status: { in: ['FAILED', 'RETRY_PENDING'] },
              },
              'Review failed activity deliveries',
              '/dashboard/activity/deliveries',
            ),
          ],
      m6_homework_timetable: teacherOnly
        ? [
            this.def('assignedHomeworkDueToday', 'homeworkAssignment', {
              tenantId,
              assignedByStaffId: teacherScope?.staffId,
              status: 'PUBLISHED',
              dueDate: { gte: day.startUtc, lt: day.endExclusiveUtc },
            }),
            this.def(
              'pendingSubmissionReview',
              'homeworkSubmission',
              {
                tenantId,
                status: 'SUBMITTED',
                homework: { assignedByStaffId: teacherScope?.staffId },
              },
              'Review homework submissions',
              '/dashboard/homework/submissions',
            ),
            this.def('todayTimetablePeriods', 'timetableSlot', {
              tenantId,
              staffId: teacherScope?.staffId,
            }),
            this.def(
              'assignedSubstitutionsToday',
              'timetableSubstitution',
              {
                tenantId,
                date: { gte: day.startUtc, lt: day.endExclusiveUtc },
                OR: [
                  { absentTeacherId: teacherScope?.staffId },
                  { substituteTeacherId: teacherScope?.staffId },
                ],
              },
              'Review substitutions',
              '/dashboard/timetable/substitutions',
            ),
          ]
        : [
            this.def('homeworkDueToday', 'homeworkAssignment', {
              tenantId,
              status: 'PUBLISHED',
              dueDate: { gte: day.startUtc, lt: day.endExclusiveUtc },
            }),
            this.def(
              'overdueHomework',
              'homeworkAssignment',
              { tenantId, status: 'PUBLISHED', dueDate: { lt: day.startUtc } },
              'Review overdue homework',
              '/dashboard/homework',
            ),
            this.def('timetablePeriods', 'timetableSlot', { tenantId }),
            this.def(
              'unassignedSubstitutionsToday',
              'timetableSubstitution',
              {
                tenantId,
                date: { gte: day.startUtc, lt: day.endExclusiveUtc },
                substituteTeacherId: null,
              },
              'Assign substitutes',
              '/dashboard/timetable/substitutions',
            ),
            this.def(
              'failedHomeworkReminders',
              'homeworkReminderBatch',
              { tenantId, status: 'FAILED' },
              'Review homework reminder failures',
              '/dashboard/homework',
            ),
          ],
      m7_hr_payroll: [
        this.def('staffOnApprovedLeaveToday', 'staffLeaveRequest', {
          tenantId,
          status: 'APPROVED',
          startsOn: { lte: day.endExclusiveUtc },
          endsOn: { gte: day.startUtc },
        }),
        this.def(
          'pendingLeaveRequests',
          'staffLeaveRequest',
          { tenantId, status: 'PENDING' },
          'Review leave requests',
          '/dashboard/hr/leave',
        ),
        this.def(
          'staffAttendanceAnomalies',
          'staffAttendance',
          {
            tenantId,
            attendanceDate: { gte: day.startUtc, lt: day.endExclusiveUtc },
            status: { in: ['ABSENT', 'LATE'] },
          },
          'Review staff attendance',
          '/dashboard/hr/attendance',
        ),
        this.def(
          'contractsExpiringSoon',
          'staffContract',
          { tenantId, endDate: { gte: day.startUtc, lte: thirtyDays } },
          'Review expiring staff contracts',
          '/dashboard/hr/contracts',
        ),
        this.def(
          'draftPayrollRuns',
          'payrollRun',
          { tenantId, status: 'DRAFT' },
          'Review payroll run blockers',
          '/dashboard/payroll/runs',
        ),
        this.def('payslipsNotIssued', 'payslip', {
          tenantId,
          issuedAt: null,
        }),
      ],
      m8a_library: [
        this.def('activeLoans', 'libraryIssue', { tenantId, status: 'ISSUED' }),
        this.def(
          'overdueLoans',
          'libraryIssue',
          { tenantId, status: 'OVERDUE' },
          'Review overdue loans',
          '/dashboard/library/overdue',
        ),
        this.def('returnsDueToday', 'libraryIssue', {
          tenantId,
          dueAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
          returnedAt: null,
        }),
        this.def(
          'activeReservations',
          'libraryReservation',
          { tenantId, status: 'ACTIVE', expiresAt: { gt: now } },
          'Review library reservations',
          '/dashboard/library',
        ),
        this.def(
          'lostOrDamagedCopies',
          'libraryCopy',
          { tenantId, status: { in: ['LOST', 'DAMAGED'] } },
          'Review library copy alerts',
          '/dashboard/library/copies',
        ),
      ],
      m8b_transport: [
        this.def('activeTripsToday', 'transportTrip', {
          tenantId,
          status: 'ACTIVE',
          startedAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
        }),
        this.def(
          'delayedTrips',
          'transportTrip',
          { tenantId, status: 'ACTIVE', isDelayed: true },
          'Review delayed transport trips',
          '/dashboard/transport/trips',
        ),
        this.def(
          'tripsWithStaleGps',
          'transportTrip',
          {
            tenantId,
            status: 'ACTIVE',
            locationPings: { none: { recordedAt: { gte: staleGpsAt } } },
          },
          'Review GPS freshness',
          '/dashboard/transport/gps-quality',
        ),
        this.def(
          'vehicleDocumentRisks',
          'transportVehicle',
          {
            tenantId,
            OR: [
              { insuranceExpiry: { lte: thirtyDays } },
              { fitnessCertificateExp: { lte: thirtyDays } },
              { registrationExpiry: { lte: thirtyDays } },
              { documentExpiry: { lte: thirtyDays } },
            ],
          },
          'Review vehicle documents',
          '/dashboard/transport/vehicles',
        ),
      ],
      m8c_canteen: [
        this.def('completedSalesToday', 'canteenPosSale', {
          tenantId,
          completedAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
        }),
        this.def('servingsToday', 'canteenMealServing', {
          tenantId,
          mealDate: { gte: day.startUtc, lt: day.endExclusiveUtc },
        }),
        this.def(
          'outOfStockItems',
          'canteenInventoryItem',
          { tenantId, currentStock: { lte: 0 }, isActive: true },
          'Review canteen stock',
          '/dashboard/canteen/inventory',
        ),
        this.def('availableMenuItems', 'canteenMenuItem', {
          tenantId,
          status: 'ACTIVE',
        }),
      ],
      m9_accounting: [
        this.def('openFiscalPeriods', 'fiscalPeriod', {
          tenantId,
          status: 'OPEN',
        }),
        this.def(
          'unpostedJournals',
          'journalEntry',
          { tenantId, status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] } },
          'Review unposted journals',
          '/dashboard/accounting/journals',
        ),
        this.def(
          'unreconciledStatements',
          'bankStatement',
          { tenantId, isReconciled: false },
          'Review reconciliation exceptions',
          '/dashboard/accounting/reconciliation',
        ),
        this.def(
          'periodCloseBlockers',
          'accountingPeriod',
          { tenantId, status: { in: ['OPEN', 'LOCKED'] } },
          'Review period close status',
          '/dashboard/accounting/period-close',
        ),
      ],
      m10_communications: [
        this.def('scheduledNotices', 'notice', {
          tenantId,
          scheduledFor: { gt: now },
          publishedAt: null,
        }),
        this.def(
          'failedDeliveries',
          'notificationDelivery',
          { tenantId, status: { in: ['FAILED', 'RETRY_PENDING'] } },
          'Review failed notice deliveries',
          '/dashboard/notices/delivery',
        ),
        this.def(
          'unreadNoticeRecipients',
          'notificationDelivery',
          { tenantId, noticeId: { not: null }, readReceipts: { none: {} } },
          'Follow up on unread notices',
          '/dashboard/notices/delivery',
        ),
        this.def(
          'highImpactNoticesAwaitingPublication',
          'notice',
          {
            tenantId,
            priority: { in: ['URGENT', 'EMERGENCY'] },
            publishedAt: null,
          },
          'Review high-impact notices',
          '/dashboard/notices',
        ),
      ],
      m12_learning: teacherOnly
        ? [
            this.def('myDraftActivities', 'learningActivity', {
              tenantId,
              teacherId: teacherScope?.staffId,
              status: 'DRAFT',
            }),
            this.def('myLiveSessions', 'learningSession', {
              tenantId,
              teacherId: teacherScope?.staffId,
              status: 'LIVE',
              expiresAt: { gt: now },
            }),
            this.def(
              'mySessionRisks',
              'learningSession',
              {
                tenantId,
                teacherId: teacherScope?.staffId,
                OR: [{ expiresAt: { lte: now } }, { status: 'PAUSED' }],
              },
              'Review live session health',
              '/dashboard/learning/sessions',
            ),
            this.def('submittedAttemptsToday', 'learningAttempt', {
              tenantId,
              activity: { teacherId: teacherScope?.staffId },
              submittedAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
            }),
          ]
        : [
            this.def('draftActivities', 'learningActivity', {
              tenantId,
              status: 'DRAFT',
            }),
            this.def('liveSessions', 'learningSession', {
              tenantId,
              status: 'LIVE',
              expiresAt: { gt: now },
            }),
            this.def('activeParticipants', 'learningParticipant', {
              tenantId,
              status: 'JOINED',
            }),
            this.def(
              'sessionRisks',
              'learningSession',
              {
                tenantId,
                OR: [{ expiresAt: { lte: now } }, { status: 'PAUSED' }],
              },
              'Review live session health',
              '/dashboard/learning/sessions',
            ),
            this.def('submittedAttemptsToday', 'learningAttempt', {
              tenantId,
              submittedAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
            }),
            this.def(
              'resourceAvailabilityRisks',
              'learningResource',
              { tenantId, fileAssetId: null, url: null, status: 'ACTIVE' },
              'Review learning resources',
              '/dashboard/learning/resources',
            ),
          ],
    };

    const metrics = await Promise.all(
      definitions[module].map((definition) => this.countMetric(definition)),
    );
    if (module === 'm3_fees') {
      metrics.unshift(
        await this.decimalMetric(
          'collectedTodayAmount',
          'payment',
          {
            tenantId,
            status: 'SUCCESS',
            paidAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
          },
          'amount',
        ),
      );
    }
    if (module === 'm8c_canteen') {
      metrics.unshift(
        await this.decimalMetric(
          'salesTodayAmount',
          'canteenPosSale',
          {
            tenantId,
            completedAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
          },
          'totalAmount',
        ),
      );
    }
    return metrics;
  }

  private teacherAttendanceDefinitions(
    actor: AuthContext,
    day: Day,
    scope: TeacherScope,
  ): MetricDefinition[] {
    if (scope.classSectionScopes.length === 0) {
      return [
        this.def('assignedRegistersToday', 'attendanceSession', {
          tenantId: actor.tenantId,
          id: '__no_assigned_scope__',
        }),
      ];
    }
    return [
      this.def('assignedRegistersToday', 'attendanceSession', {
        tenantId: actor.tenantId,
        attendanceDate: { gte: day.startUtc, lt: day.endExclusiveUtc },
        OR: scope.classSectionScopes,
      }),
      this.def(
        'pendingRegistersToday',
        'attendanceSession',
        {
          tenantId: actor.tenantId,
          attendanceDate: { gte: day.startUtc, lt: day.endExclusiveUtc },
          submittedAt: null,
          OR: scope.classSectionScopes,
        },
        'Complete your pending attendance registers',
        '/dashboard/attendance/daily',
      ),
    ];
  }

  private async getTeacherScope(
    actor: AuthContext,
  ): Promise<TeacherScope | null> {
    const staff = await this.prisma.staff.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
      select: { id: true },
    });
    if (!staff) return null;

    const assignments = await this.prisma.subjectTeacherAssignment.findMany({
      where: { tenantId: actor.tenantId, staffId: staff.id },
      select: { classId: true, sectionId: true, subjectId: true },
      take: 100,
    });
    return {
      staffId: staff.id,
      subjectIds: [
        ...new Set(assignments.map((assignment) => assignment.subjectId)),
      ],
      classSectionScopes: assignments.map((assignment) => ({
        classId: assignment.classId,
        sectionId: assignment.sectionId ?? null,
      })),
    };
  }

  private async parentMobileSummary(
    actor: AuthContext,
    day: Day,
    modules: Set<string>,
  ) {
    const studentIds = (await getParentStudentIds(this.prisma, actor)) ?? [];
    if (studentIds.length === 0)
      return this.mobileSummary('parent', day, 'empty');

    const [attendance, invoices, reports, libraryLoans, notices] =
      await Promise.all([
        modules.has('attendance')
          ? this.safeCount('attendanceRecord', {
              tenantId: actor.tenantId,
              studentId: { in: studentIds },
              attendanceSession: {
                attendanceDate: { gte: day.startUtc, lt: day.endExclusiveUtc },
              },
            })
          : noMetric(),
        modules.has('fees')
          ? this.safeCount('invoice', {
              tenantId: actor.tenantId,
              studentId: { in: studentIds },
              status: { in: ['ISSUED', 'PARTIAL'] },
            })
          : noMetric(),
        modules.has('exams')
          ? this.safeCount('reportCard', {
              tenantId: actor.tenantId,
              studentId: { in: studentIds },
              publishedAt: { not: null },
            })
          : noMetric(),
        modules.has('library')
          ? this.safeCount('libraryIssue', {
              tenantId: actor.tenantId,
              borrowerStudentId: { in: studentIds },
              status: { in: ['ISSUED', 'OVERDUE'] },
            })
          : noMetric(),
        modules.has('notices')
          ? this.safeCount('notificationDelivery', {
              tenantId: actor.tenantId,
              OR: [
                { recipientUserId: actor.userId },
                { studentId: { in: studentIds } },
              ],
              readReceipts: { none: { userId: actor.userId } },
            })
          : noMetric(),
      ]);

    return this.mobileSummary(
      'parent',
      day,
      mobileStatus([attendance, invoices, reports, libraryLoans, notices]),
      {
        linkedChildren: studentIds.length,
        attendanceRecordsToday: attendance.value,
        unpaidInvoices: invoices.value,
        publishedReportCards: reports.value,
        activeLibraryLoans: libraryLoans.value,
        unreadNotices: notices.value,
      },
    );
  }

  private async teacherMobileSummary(
    actor: AuthContext,
    day: Day,
    modules: Set<string>,
  ) {
    if (!modules.has('attendance'))
      return this.mobileSummary('teacher', day, 'locked');
    const scope = await this.getTeacherScope(actor);
    if (!scope) return this.mobileSummary('teacher', day, 'empty');
    const definitions = this.teacherAttendanceDefinitions(actor, day, scope);
    const values = await Promise.all(
      definitions.map((definition) => this.countMetric(definition)),
    );
    return this.mobileSummary(
      'teacher',
      day,
      mobileStatus(values),
      Object.fromEntries(values.map((value) => [value.key, value.value])),
    );
  }

  private async driverMobileSummary(
    actor: AuthContext,
    day: Day,
    modules: Set<string>,
  ) {
    if (!modules.has('transport'))
      return this.mobileSummary('driver', day, 'locked');
    const staff = await this.prisma.staff.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
      select: { id: true },
    });
    if (!staff) return this.mobileSummary('driver', day, 'empty');

    const assignments = await this.prisma.transportDriverAssignment.findMany({
      where: {
        tenantId: actor.tenantId,
        staffId: staff.id,
        startsAt: { lte: day.endExclusiveUtc },
        OR: [{ endsAt: null }, { endsAt: { gte: day.startUtc } }],
      },
      select: { id: true },
      take: 20,
    });
    const trips = await this.safeCount('transportTrip', {
      tenantId: actor.tenantId,
      driverAssignmentId: {
        in: assignments.map((assignment) => assignment.id),
      },
      startedAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
    });

    return this.mobileSummary(
      'driver',
      day,
      trips.failed ? 'partial' : assignments.length === 0 ? 'empty' : 'ready',
      {
        assignedDriverAssignments: assignments.length,
        assignedTripsToday: trips.value,
      },
    );
  }

  private async staffMobileSummary(
    actor: AuthContext,
    day: Day,
    modules: Set<string>,
  ) {
    const staff = await this.prisma.staff.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
      select: { id: true },
    });
    if (!staff) return this.mobileSummary('staff', day, 'empty');

    const [attendance, leave, payslips] = await Promise.all([
      this.safeCount('staffAttendance', {
        tenantId: actor.tenantId,
        staffId: staff.id,
        attendanceDate: { gte: day.startUtc, lt: day.endExclusiveUtc },
      }),
      this.safeCount('staffLeaveRequest', {
        tenantId: actor.tenantId,
        staffId: staff.id,
        status: { in: ['PENDING', 'APPROVED'] },
      }),
      modules.has('hr')
        ? this.safeCount('payslip', {
            tenantId: actor.tenantId,
            staffId: staff.id,
            issuedAt: { not: null },
          })
        : noMetric(),
    ]);

    return this.mobileSummary(
      'staff',
      day,
      mobileStatus([attendance, leave, payslips]),
      {
        attendanceRecordsToday: attendance.value,
        activeLeaveRequests: leave.value,
        issuedPayslips: payslips.value,
      },
    );
  }

  private async principalMobileSummary(actor: AuthContext, day: Day) {
    const dashboard = await this.getDashboardSummary(actor);
    return this.mobileSummary(
      'principal',
      day,
      dashboard.status,
      dashboard.summary,
      dashboard.attentionItems.slice(0, 5),
    );
  }

  private def(
    key: string,
    model: string,
    where: Record<string, unknown>,
    label?: string,
    action?: string,
  ): MetricDefinition {
    return {
      key,
      model,
      where,
      attention:
        label && action ? { label, action, severity: 'warning' } : undefined,
    };
  }

  private async countMetric(definition: MetricDefinition): Promise<Metric> {
    const result = await this.safeCount(definition.model, definition.where);
    return {
      key: definition.key,
      value: result.value,
      failed: result.failed,
      attention:
        definition.attention &&
        typeof result.value === 'number' &&
        result.value > 0
          ? {
              key: definition.key,
              label: definition.attention.label,
              count: result.value,
              severity: definition.attention.severity ?? 'warning',
              action: definition.attention.action,
            }
          : undefined,
    };
  }

  private async decimalMetric(
    key: string,
    model: string,
    where: Record<string, unknown>,
    field: string,
  ): Promise<Metric> {
    const delegate = this.delegate(model);
    if (!delegate?.aggregate) return { key, value: null, failed: true };
    try {
      const result = (await delegate.aggregate({
        where,
        _sum: { [field]: true },
      })) as { _sum?: Record<string, { toString(): string } | null> };
      return {
        key,
        value: result._sum?.[field]?.toString() ?? '0',
        failed: false,
      };
    } catch {
      return { key, value: null, failed: true };
    }
  }

  private async safeCount(model: string, where: Record<string, unknown>) {
    const delegate = this.delegate(model);
    if (!delegate) return { value: null, failed: true };
    try {
      return { value: await delegate.count({ where }), failed: false };
    } catch {
      return { value: null, failed: true };
    }
  }

  private async recentItems(
    model: string,
    where: Record<string, unknown>,
    label: string,
  ) {
    const delegate = this.delegate(model);
    if (!delegate?.findMany) {
      return { items: [] as OperationalRecentItem[], failed: true };
    }
    try {
      const rows = await delegate.findMany({
        where,
        select: { id: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
      return {
        failed: false,
        items: rows.map((row) => ({
          id: row.id,
          label: `Recent ${label}`,
          occurredAt: row.createdAt.toISOString(),
        })),
      };
    } catch {
      return { items: [] as OperationalRecentItem[], failed: true };
    }
  }

  private recentModel(module: SummaryModule) {
    return {
      m1_students: 'enrollment',
      m2_attendance: 'attendanceSession',
      m3_fees: 'payment',
      m4_academics: 'reportCard',
      m5_activity: 'activityPost',
      m6_homework_timetable: 'homeworkAssignment',
      m7_hr_payroll: 'payrollRun',
      m8a_library: 'libraryIssue',
      m8b_transport: 'transportTrip',
      m8c_canteen: 'canteenPosSale',
      m9_accounting: 'journalEntry',
      m10_communications: 'notificationDelivery',
      m12_learning: 'learningSession',
    }[module];
  }

  private recentWhere(
    module: SummaryModule,
    actor: AuthContext,
    teacherScope: TeacherScope | null,
  ) {
    if (!this.isTeachingOnly(actor)) return { tenantId: actor.tenantId };
    const teacherId = teacherScope?.staffId ?? '__no_staff_profile__';
    switch (module) {
      case 'm2_attendance':
        return {
          tenantId: actor.tenantId,
          OR: teacherScope?.classSectionScopes ?? [],
        };
      case 'm4_academics':
        return {
          tenantId: actor.tenantId,
          subjectId: { in: teacherScope?.subjectIds ?? [] },
        };
      case 'm5_activity':
        return { tenantId: actor.tenantId, createdById: actor.userId };
      case 'm6_homework_timetable':
        return { tenantId: actor.tenantId, assignedByStaffId: teacherId };
      case 'm12_learning':
        return { tenantId: actor.tenantId, teacherId };
      default:
        return { tenantId: actor.tenantId, id: '__not_visible__' };
    }
  }

  private emptySummary(
    module: OperationalSummaryModule,
    day: Day,
    status: OperationalSummaryStatus,
    canView: boolean,
    summary: Record<string, number | string | null> = {},
  ): OperationalModuleSummary {
    return {
      generatedAt: new Date().toISOString(),
      schoolDay: day.gregorianDate,
      module,
      status,
      permissions: { canView },
      summary,
      attentionItems: [],
      recentItems: [],
      nextActions: [],
      nextCursor: null,
    };
  }

  private mobileSummary(
    persona: string,
    day: Day,
    status: OperationalSummaryStatus,
    summary: Record<string, number | string | null> = {},
    attentionItems: OperationalAttentionItem[] = [],
  ) {
    return {
      generatedAt: new Date().toISOString(),
      schoolDay: day.gregorianDate,
      module: `mobile_${persona}`,
      status,
      summary,
      attentionItems,
      recentItems: [],
      nextActions: [],
      nextCursor: null,
    };
  }

  private delegate(model: string): ModelDelegate | null {
    const candidate = (this.prisma as unknown as Record<string, unknown>)[
      model
    ];
    return candidate && typeof candidate === 'object'
      ? (candidate as ModelDelegate)
      : null;
  }

  private canView(
    module: SummaryModule,
    actor: AuthContext,
    permissions: string[],
  ) {
    if (this.isTeachingOnly(actor)) {
      return (
        TEACHER_MODULES.has(module) &&
        permissions.some((permission) => actor.permissions.includes(permission))
      );
    }
    return permissions.some((permission) =>
      actor.permissions.includes(permission),
    );
  }

  private isTeachingOnly(actor: AuthContext) {
    const roles = new Set(actor.roles.map((role) => role.toLowerCase()));
    return (
      [...TEACHING_ROLES].some((role) => roles.has(role)) &&
      !roles.has('principal') &&
      !roles.has('admin') &&
      !roles.has('school_admin')
    );
  }
}

function noMetric() {
  return { value: null, failed: false };
}

function severityOrder(severity: OperationalAttentionItem['severity']) {
  return severity === 'critical' ? -3 : severity === 'warning' ? -2 : -1;
}

function dashboardStatus(
  summaries: OperationalModuleSummary[],
): OperationalSummaryStatus {
  if (summaries.length === 0) return 'empty';
  if (summaries.some((summary) => summary.status === 'partial'))
    return 'partial';
  if (
    summaries.every(
      (summary) => summary.status === 'empty' || summary.status === 'locked',
    )
  ) {
    return 'empty';
  }
  return 'ready';
}

function mobileStatus(
  metrics: Array<{ value: number | string | null; failed: boolean }>,
): OperationalSummaryStatus {
  if (metrics.some((metric) => metric.failed)) return 'partial';
  const values = metrics
    .map((metric) => metric.value)
    .filter((value): value is number => typeof value === 'number');
  return values.length > 0 && values.every((value) => value === 0)
    ? 'empty'
    : 'ready';
}
