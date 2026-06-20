import { Injectable } from '@nestjs/common';
import { getNepalSchoolDay } from '@schoolos/core';
import type { AuthContext } from '../auth/auth.types';
import { getParentStudentIds, getStudentOwnId } from '../common/security/parent-scope';
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
type DelegateRow = { id: string; createdAt: Date; [key: string]: unknown };
type ModelDelegate = {
  count: (args?: unknown) => Promise<number>;
  findMany?: (args?: unknown) => Promise<DelegateRow[]>;
  aggregate?: (args?: unknown) => Promise<unknown>;
};
type Metric = {
  key: string;
  value: number | string | null;
  failed: boolean;
  attention?: OperationalAttentionItem;
};
type Definition = {
  key: string;
  model: string;
  where: Record<string, unknown>;
  attention?: { label: string; action: string; severity?: OperationalAttentionItem['severity'] };
};

const MODULES: Record<
  Exclude<OperationalSummaryModule, 'm11_intelligence'>,
  { entitlement: string; permissions: string[]; route: string; label: string }
> = {
  m1_students: { entitlement: 'students', permissions: ['students:read', 'admissions:read'], route: '/dashboard/students', label: 'Students' },
  m2_attendance: { entitlement: 'attendance', permissions: ['attendance:read'], route: '/dashboard/attendance', label: 'Attendance' },
  m3_fees: { entitlement: 'fees', permissions: ['fees:read', 'fees:manage', 'payments:close'], route: '/dashboard/fees', label: 'Fees' },
  m4_academics: { entitlement: 'exams', permissions: ['academics:read', 'marks:read'], route: '/dashboard/academics', label: 'Academics' },
  m5_activity: { entitlement: 'activity', permissions: ['activity:read', 'activity:manage'], route: '/dashboard/activity', label: 'Activity' },
  m6_homework_timetable: { entitlement: 'homework', permissions: ['homework:read', 'timetable:read'], route: '/dashboard/homework', label: 'Homework & Timetable' },
  m7_hr_payroll: { entitlement: 'payroll', permissions: ['staff:read', 'payroll:read', 'hr:read'], route: '/dashboard/hr', label: 'HR & Payroll' },
  m8a_library: { entitlement: 'library', permissions: ['library:read'], route: '/dashboard/library', label: 'Library' },
  m8b_transport: { entitlement: 'transport', permissions: ['transport:trips:read', 'transport:reports:read'], route: '/dashboard/transport', label: 'Transport' },
  m8c_canteen: { entitlement: 'canteen', permissions: ['canteen:read', 'canteen:manage'], route: '/dashboard/canteen', label: 'Canteen' },
  m9_accounting: { entitlement: 'accounting', permissions: ['accounting:read'], route: '/dashboard/accounting', label: 'Accounting' },
  m10_communications: { entitlement: 'communications', permissions: ['notices:read', 'communications:read'], route: '/dashboard/notices', label: 'Notices & Communication' },
  m12_learning: { entitlement: 'learning', permissions: ['learning:read', 'learning:manage'], route: '/dashboard/learning', label: 'Learning' },
};

const TENANT_WIDE_ROLES = new Set(['principal', 'admin', 'school_admin', 'platform_super_admin']);
const TEACHING_ROLES = new Set(['teacher', 'subject_teacher']);

@Injectable()
export class OperationalSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  async getDashboardSummary(actor: AuthContext) {
    const day = getNepalSchoolDay();
    const entitlements = await this.entitlementsService.getEntitlements(actor.tenantId);
    const all = await Promise.all(
      OPERATIONAL_SUMMARY_MODULES.filter((module) => module !== 'm11_intelligence').map((module) =>
        this.getModuleSummaryInternal(module, actor, day, entitlements.modules),
      ),
    );
    const modules = all.filter((item) => item.permissions.canView);
    const attentionItems = modules
      .flatMap((item) => item.attentionItems.map((attention) => ({ ...attention, module: item.module })))
      .sort((left, right) => severity(left.severity) - severity(right.severity))
      .slice(0, 10);
    const recentItems = modules
      .flatMap((item) => item.recentItems.map((recent) => ({ ...recent, module: item.module })))
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .slice(0, 10);

    return {
      generatedAt: new Date().toISOString(),
      schoolDay: day.gregorianDate,
      module: 'dashboard',
      status: dashboardStatus(modules),
      summary: {
        visibleModuleCount: modules.length,
        readyModuleCount: modules.filter((item) => item.status === 'ready').length,
        attentionItemCount: attentionItems.length,
      },
      attentionItems,
      recentItems,
      nextActions: modules.flatMap((item) => item.nextActions).slice(0, 8),
      modules,
    };
  }

  async getModuleSummary(module: OperationalSummaryModule, actor: AuthContext) {
    const day = getNepalSchoolDay();
    const entitlements = await this.entitlementsService.getEntitlements(actor.tenantId);
    return this.getModuleSummaryInternal(module, actor, day, entitlements.modules);
  }

  async getMobileSummary(
    persona: 'parent' | 'teacher' | 'principal' | 'driver' | 'staff' | 'student',
    actor: AuthContext,
  ) {
    const day = getNepalSchoolDay();
    const entitlements = new Set((await this.entitlementsService.getEntitlements(actor.tenantId)).modules);
    if (persona === 'parent') return this.parentMobileSummary(actor, day, entitlements);
    if (persona === 'teacher') return this.teacherMobileSummary(actor, day, entitlements);
    if (persona === 'principal') return this.principalMobileSummary(actor, day);
    if (persona === 'driver') return this.driverMobileSummary(actor, day, entitlements);
    if (persona === 'staff') return this.staffMobileSummary(actor, day, entitlements);
    return this.studentMobileSummary(actor, day, entitlements);
  }

  private async getModuleSummaryInternal(
    module: OperationalSummaryModule,
    actor: AuthContext,
    day: Day,
    enabledModules: string[],
  ): Promise<OperationalModuleSummary> {
    if (module === 'm11_intelligence') {
      return this.empty(module, day, 'locked', false, { roadmapOnly: 'M11 Intelligence is roadmap-only.' });
    }

    const config = MODULES[module];
    if (!this.canView(module, actor, config.permissions)) {
      return this.empty(module, day, 'permissionDenied', false);
    }
    if (!enabledModules.includes(config.entitlement)) {
      return this.empty(module, day, 'locked', true);
    }

    if (this.isTeachingOnly(actor) && module !== 'm2_attendance') {
      return this.empty(module, day, 'permissionDenied', false);
    }

    const metrics = await this.moduleMetrics(module, actor, day);
    const recent = await this.recentItems(this.recentModel(module), { tenantId: actor.tenantId }, config.label);
    const status = metrics.some((item) => item.failed) || recent.failed
      ? 'partial'
      : metrics.every((item) => item.value === 0)
        ? 'empty'
        : 'ready';

    return {
      generatedAt: new Date().toISOString(),
      schoolDay: day.gregorianDate,
      module,
      status,
      permissions: { canView: true },
      summary: Object.fromEntries(metrics.map((item) => [item.key, item.value])),
      attentionItems: metrics.flatMap((item) => item.attention ? [item.attention] : []).slice(0, 10),
      recentItems: recent.items,
      nextActions: [{ key: `open_${module}`, label: `Open ${config.label}`, route: config.route }],
      nextCursor: null,
    };
  }

  private async moduleMetrics(module: Exclude<OperationalSummaryModule, 'm11_intelligence'>, actor: AuthContext, day: Day) {
    const tenantId = actor.tenantId;
    const now = new Date();
    const thirtyDays = new Date(day.endExclusiveUtc.getTime() + 30 * 86_400_000);
    const definitions: Record<Exclude<OperationalSummaryModule, 'm11_intelligence'>, Definition[]> = {
      m1_students: [
        this.def('pendingApplications', 'admissionApplication', { tenantId, status: { in: ['APPLICATION', 'DOCUMENT_PENDING', 'INTERVIEW', 'ACCEPTED'] } }, 'Review pending admissions', '/dashboard/admissions'),
        this.def('unverifiedDocuments', 'studentDocument', { tenantId, verifiedAt: null }, 'Review student documents', '/dashboard/students/documents'),
        this.def('duplicateCandidates', 'admissionImportRow', { tenantId, status: 'DUPLICATE' }, 'Review duplicate candidates', '/dashboard/students/duplicates'),
        this.def('recentAdmissions', 'student', { tenantId, admissionDate: { gte: day.startUtc, lt: day.endExclusiveUtc } }),
        this.def('qrCredentialIssues', 'studentQrCredential', { tenantId, OR: [{ expiresAt: { lte: now } }, { status: { in: ['EXPIRED', 'REVOKED'] } }] }, 'Review student QR credentials', '/dashboard/students/qr'),
        this.def('iemisBlockers', 'student', { tenantId, OR: [{ nationalStudentId: null }, { admissionNumber: null }] }, 'Review iEMIS readiness', '/dashboard/students/iemis'),
      ],
      m2_attendance: this.isTeachingOnly(actor) ? await this.teacherAttendanceMetrics(actor, day) : [
        this.def('expectedStudents', 'student', { tenantId, lifecycleStatus: 'ACTIVE' }),
        this.def('attendanceRecordsToday', 'attendanceRecord', { tenantId, createdAt: { gte: day.startUtc, lt: day.endExclusiveUtc } }),
        this.def('absentToday', 'attendanceRecord', { tenantId, status: 'ABSENT', createdAt: { gte: day.startUtc, lt: day.endExclusiveUtc } }, 'Review absent students', '/dashboard/attendance/daily'),
        this.def('lateToday', 'attendanceRecord', { tenantId, status: 'LATE', createdAt: { gte: day.startUtc, lt: day.endExclusiveUtc } }, 'Review late arrivals', '/dashboard/attendance/daily'),
        this.def('pendingCorrections', 'attendanceCorrectionRequest', { tenantId, status: 'PENDING' }, 'Review attendance corrections', '/dashboard/attendance/corrections'),
        this.def('lockWindowWarnings', 'attendanceSession', { tenantId, attendanceDate: { gte: day.startUtc, lt: day.endExclusiveUtc }, submittedAt: null, lockAt: { lte: now } }, 'Complete pending attendance registers', '/dashboard/attendance/daily'),
      ],
      m3_fees: [
        this.def('paymentCountToday', 'payment', { tenantId, status: 'SUCCESS', paidAt: { gte: day.startUtc, lt: day.endExclusiveUtc } }),
        this.def('overdueInvoices', 'invoice', { tenantId, status: { in: ['ISSUED', 'PARTIAL'] }, dueDate: { lt: day.endExclusiveUtc } }, 'Review overdue fee follow-up', '/dashboard/fees/dues'),
        this.def('invoicesDueToday', 'invoice', { tenantId, status: { in: ['ISSUED', 'PARTIAL'] }, dueDate: { gte: day.startUtc, lt: day.endExclusiveUtc } }),
        this.def('reversedPaymentsToday', 'payment', { tenantId, status: 'REVERSED', updatedAt: { gte: day.startUtc, lt: day.endExclusiveUtc } }, 'Review payment reversals', '/dashboard/fees/reversals'),
        this.def('billingRunsInDraft', 'billingRun', { tenantId, status: 'DRAFT' }, 'Review billing run status', '/dashboard/fees/invoices'),
      ],
      m4_academics: [
        this.def('currentAcademicYear', 'academicYear', { tenantId, isCurrent: true }),
        this.def('openExamTerms', 'examTerm', { tenantId, status: { in: ['DRAFT', 'PUBLISHED'] } }),
        this.def('marksOpen', 'markEntry', { tenantId, isLocked: false }, 'Review marks entry progress', '/dashboard/academics/marks'),
        this.def('casPending', 'casRecord', { tenantId, status: { in: ['DRAFT', 'PENDING'] } }, 'Review CAS completion', '/dashboard/academics/cas'),
        this.def('reportCardPublishBlockers', 'reportCard', { tenantId, publishedAt: null }, 'Review report-card readiness', '/dashboard/academics/report-cards'),
      ],
      m5_activity: [
        this.def('pendingModeration', 'activityPost', { tenantId, status: 'PENDING' }, 'Review activity moderation', '/dashboard/activity/pending'),
        this.def('publishedToday', 'activityPost', { tenantId, status: 'PUBLISHED', publishedAt: { gte: day.startUtc, lt: day.endExclusiveUtc } }),
        this.def('consentBlockedPosts', 'activityPost', { tenantId, status: 'CONSENT_BLOCKED' }, 'Resolve consent blockers', '/dashboard/activity/pending'),
      ],
      m6_homework_timetable: [
        this.def('homeworkDueToday', 'homework', { tenantId, dueDate: { gte: day.startUtc, lt: day.endExclusiveUtc }, isPublished: true }),
        this.def('overdueHomework', 'homework', { tenantId, dueDate: { lt: day.endExclusiveUtc }, isPublished: true }, 'Review overdue homework', '/dashboard/homework'),
        this.def('publishedTimetablePeriods', 'timetableSlot', { tenantId }),
        this.def('activeSubstitutions', 'timetableSubstitution', { tenantId, status: { in: ['DRAFT', 'PUBLISHED'] } }, 'Review substitutions', '/dashboard/timetable/substitutions'),
      ],
      m7_hr_payroll: [
        this.def('staffOnLeave', 'staff', { tenantId, status: 'ON_LEAVE' }),
        this.def('pendingLeaveRequests', 'staffLeaveRequest', { tenantId, status: 'PENDING' }, 'Review leave requests', '/dashboard/hr/leave'),
        this.def('contractsExpiringSoon', 'staffContract', { tenantId, endDate: { gte: day.startUtc, lte: thirtyDays } }, 'Review expiring staff contracts', '/dashboard/hr/contracts'),
        this.def('payrollRunsInProgress', 'payrollRun', { tenantId, status: { in: ['DRAFT', 'REVIEW', 'APPROVED'] } }, 'Review payroll run blockers', '/dashboard/payroll/runs'),
      ],
      m8a_library: [
        this.def('activeLoans', 'libraryIssue', { tenantId, status: 'ISSUED' }),
        this.def('overdueLoans', 'libraryIssue', { tenantId, status: 'OVERDUE' }, 'Review overdue loans', '/dashboard/library/overdue'),
        this.def('dueToday', 'libraryIssue', { tenantId, dueDate: { gte: day.startUtc, lt: day.endExclusiveUtc } }),
        this.def('reservationQueue', 'libraryReservation', { tenantId, status: 'PENDING' }, 'Review library reservations', '/dashboard/library'),
      ],
      m8b_transport: [
        this.def('activeTripsToday', 'transportTrip', { tenantId, status: 'ACTIVE', startedAt: { gte: day.startUtc, lt: day.endExclusiveUtc } }),
        this.def('delayedTrips', 'transportTrip', { tenantId, status: 'ACTIVE', isDelayed: true }, 'Review delayed transport trips', '/dashboard/transport/trips'),
        this.def('staleGpsPings', 'transportLocationPing', { tenantId, recordedAt: { lt: new Date(now.getTime() - 15 * 60_000) } }, 'Review GPS freshness', '/dashboard/transport/gps-quality'),
        this.def('vehicleDocumentRisks', 'transportVehicle', { tenantId, OR: [{ insuranceExpiry: { lte: thirtyDays } }, { fitnessCertificateExp: { lte: thirtyDays } }] }, 'Review vehicle documents', '/dashboard/transport/vehicles'),
      ],
      m8c_canteen: [
        this.def('salesCountToday', 'canteenPosSale', { tenantId, createdAt: { gte: day.startUtc, lt: day.endExclusiveUtc } }),
        this.def('pendingServings', 'canteenMealServing', { tenantId, status: 'PENDING' }, 'Review canteen serving queue', '/dashboard/canteen/serving'),
        this.def('lowStockItems', 'canteenInventoryItem', { tenantId, quantityOnHand: { lte: 0 } }, 'Review canteen stock', '/dashboard/canteen/inventory'),
      ],
      m9_accounting: [
        this.def('openFiscalPeriods', 'fiscalPeriod', { tenantId, status: 'OPEN' }),
        this.def('unpostedJournals', 'journalEntry', { tenantId, status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] } }, 'Review unposted journals', '/dashboard/accounting/journals'),
        this.def('unreconciledStatements', 'bankStatement', { tenantId, isReconciled: false }, 'Review reconciliation exceptions', '/dashboard/accounting/reconciliation'),
        this.def('periodCloseBlockers', 'accountingPeriod', { tenantId, status: { in: ['OPEN', 'LOCKED'] } }, 'Review period close status', '/dashboard/accounting/period-close'),
      ],
      m10_communications: [
        this.def('scheduledNotices', 'notice', { tenantId, status: 'SCHEDULED' }),
        this.def('failedDeliveries', 'notificationDelivery', { tenantId, status: { in: ['FAILED', 'RETRY_PENDING'] } }, 'Review failed notice deliveries', '/dashboard/notices/delivery'),
        this.def('unreadNoticeRecipients', 'notificationDelivery', { tenantId, noticeId: { not: null }, readReceipts: { none: {} } }, 'Follow up on unread notices', '/dashboard/notices/delivery'),
        this.def('highImpactAwaitingApproval', 'notice', { tenantId, priority: { in: ['URGENT', 'EMERGENCY'] }, status: 'PENDING_APPROVAL' }, 'Review high-impact notices', '/dashboard/notices'),
        this.def('openEscalations', 'communicationEscalation', { tenantId, status: { in: ['OPEN', 'ESCALATED'] } }, 'Review communication escalations', '/dashboard/messages/escalations'),
      ],
      m12_learning: [
        this.def('draftActivities', 'learningActivity', { tenantId, status: 'DRAFT' }),
        this.def('liveSessions', 'learningSession', { tenantId, status: 'LIVE', expiresAt: { gt: now } }),
        this.def('sessionRisks', 'learningSession', { tenantId, OR: [{ expiresAt: { lte: now } }, { status: 'PAUSED' }] }, 'Review live session health', '/dashboard/learning/sessions'),
        this.def('submittedAttemptsToday', 'learningAttempt', { tenantId, submittedAt: { gte: day.startUtc, lt: day.endExclusiveUtc } }),
        this.def('resourceRisks', 'learningResource', { tenantId, status: { in: ['ARCHIVED', 'UNAVAILABLE'] } }, 'Review learning resources', '/dashboard/learning/resources'),
      ],
    };

    const results = await Promise.all(definitions[module].map((definition) => this.countMetric(definition)));
    if (module === 'm3_fees') {
      results.unshift(await this.decimalMetric('collectedTodayAmount', 'payment', { tenantId, status: 'SUCCESS', paidAt: { gte: day.startUtc, lt: day.endExclusiveUtc } }, 'amount'));
    }
    if (module === 'm8c_canteen') {
      results.unshift(await this.decimalMetric('salesTodayAmount', 'canteenPosSale', { tenantId, createdAt: { gte: day.startUtc, lt: day.endExclusiveUtc } }, 'amount'));
    }
    return results;
  }

  private async teacherAttendanceMetrics(actor: AuthContext, day: Day): Promise<Definition[]> {
    const staff = await this.prisma.staff.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
      select: { id: true },
    });
    if (!staff) return [this.def('assignedRegisters', 'attendanceSession', { tenantId: actor.tenantId, id: '__no_staff_profile__' })];
    const assignments = await this.prisma.subjectTeacherAssignment.findMany({
      where: { tenantId: actor.tenantId, staffId: staff.id },
      select: { classId: true, sectionId: true },
      take: 100,
    });
    const scopes = assignments.map((assignment) => ({ classId: assignment.classId, sectionId: assignment.sectionId ?? null }));
    if (scopes.length === 0) return [this.def('assignedRegisters', 'attendanceSession', { tenantId: actor.tenantId, id: '__no_assigned_scope__' })];
    return [
      this.def('assignedRegistersToday', 'attendanceSession', { tenantId: actor.tenantId, attendanceDate: { gte: day.startUtc, lt: day.endExclusiveUtc }, OR: scopes }),
      this.def('pendingRegistersToday', 'attendanceSession', { tenantId: actor.tenantId, attendanceDate: { gte: day.startUtc, lt: day.endExclusiveUtc }, submittedAt: null, OR: scopes }, 'Complete your pending attendance registers', '/dashboard/attendance/daily'),
    ];
  }

  private async parentMobileSummary(actor: AuthContext, day: Day, modules: Set<string>) {
    const studentIds = (await getParentStudentIds(this.prisma, actor)) ?? [];
    if (studentIds.length === 0) return this.mobile('parent', day, 'empty');
    const attendance = modules.has('attendance')
      ? await this.safeCount('attendanceRecord', { tenantId: actor.tenantId, studentId: { in: studentIds }, createdAt: { gte: day.startUtc, lt: day.endExclusiveUtc } })
      : { value: null, failed: false };
    const fees = modules.has('fees')
      ? await this.safeCount('invoice', { tenantId: actor.tenantId, studentId: { in: studentIds }, status: { in: ['ISSUED', 'PARTIAL'] } })
      : { value: null, failed: false };
    const notices = await this.safeCount('notificationDelivery', { tenantId: actor.tenantId, OR: [{ recipientUserId: actor.userId }, { studentId: { in: studentIds } }], readReceipts: { none: { userId: actor.userId } } });
    return this.mobile('parent', day, mobileStatus([attendance, fees, notices]), {
      linkedChildren: studentIds.length,
      attendanceRecordsToday: attendance.value,
      unpaidInvoices: fees.value,
      unreadNotices: notices.value,
    });
  }

  private async studentMobileSummary(actor: AuthContext, day: Day, modules: Set<string>) {
    const studentId = await getStudentOwnId(this.prisma, actor);
    if (!studentId) return this.mobile('student', day, 'empty');
    const attempts = modules.has('learning')
      ? await this.safeCount('learningAttempt', { tenantId: actor.tenantId, studentId, status: 'IN_PROGRESS' })
      : { value: null, failed: false };
    const reports = modules.has('exams')
      ? await this.safeCount('reportCard', { tenantId: actor.tenantId, studentId, publishedAt: { not: null } })
      : { value: null, failed: false };
    return this.mobile('student', day, mobileStatus([attempts, reports]), {
      activeLearningAttempts: attempts.value,
      publishedReportCards: reports.value,
    });
  }

  private async teacherMobileSummary(actor: AuthContext, day: Day, modules: Set<string>) {
    if (!modules.has('attendance')) return this.mobile('teacher', day, 'locked');
    const metrics = await this.teacherAttendanceMetrics(actor, day);
    const values = await Promise.all(metrics.map((metric) => this.countMetric(metric)));
    return this.mobile('teacher', day, mobileStatus(values), Object.fromEntries(values.map((item) => [item.key, item.value])));
  }

  private async driverMobileSummary(actor: AuthContext, day: Day, modules: Set<string>) {
    if (!modules.has('transport')) return this.mobile('driver', day, 'locked');
    const staff = await this.prisma.staff.findFirst({ where: { tenantId: actor.tenantId, userId: actor.userId }, select: { id: true } });
    if (!staff) return this.mobile('driver', day, 'empty');
    const assignments = await this.prisma.transportDriverAssignment.findMany({
      where: { tenantId: actor.tenantId, staffId: staff.id, startsAt: { lte: day.endExclusiveUtc }, OR: [{ endsAt: null }, { endsAt: { gte: day.startUtc } }] },
      select: { id: true },
      take: 20,
    });
    const tripCount = await this.safeCount('transportTrip', { tenantId: actor.tenantId, driverAssignmentId: { in: assignments.map((assignment) => assignment.id) }, startedAt: { gte: day.startUtc, lt: day.endExclusiveUtc } });
    return this.mobile('driver', day, tripCount.failed ? 'partial' : assignments.length ? 'ready' : 'empty', {
      assignedDriverAssignments: assignments.length,
      assignedTripsToday: tripCount.value,
    });
  }

  private async staffMobileSummary(actor: AuthContext, day: Day, modules: Set<string>) {
    const staff = await this.prisma.staff.findFirst({ where: { tenantId: actor.tenantId, userId: actor.userId }, select: { id: true } });
    if (!staff) return this.mobile('staff', day, 'empty');
    const leave = await this.safeCount('staffLeaveRequest', { tenantId: actor.tenantId, staffId: staff.id, status: { in: ['DRAFT', 'PENDING', 'APPROVED'] } });
    const payslips = modules.has('payroll')
      ? await this.safeCount('payrollSlip', { tenantId: actor.tenantId, staffId: staff.id, publishedAt: { not: null } })
      : { value: null, failed: false };
    return this.mobile('staff', day, mobileStatus([leave, payslips]), {
      activeLeaveRequests: leave.value,
      publishedPayslips: payslips.value,
    });
  }

  private async principalMobileSummary(actor: AuthContext, day: Day) {
    const dashboard = await this.getDashboardSummary(actor);
    return this.mobile('principal', day, dashboard.status, dashboard.summary, dashboard.attentionItems.slice(0, 5));
  }

  private def(key: string, model: string, where: Record<string, unknown>, label?: string, action?: string): Definition {
    return { key, model, where, attention: label && action ? { label, action, severity: 'warning' } : undefined };
  }

  private async countMetric(definition: Definition): Promise<Metric> {
    const result = await this.safeCount(definition.model, definition.where);
    return {
      key: definition.key,
      value: result.value,
      failed: result.failed,
      attention: definition.attention && typeof result.value === 'number' && result.value > 0
        ? { key: definition.key, label: definition.attention.label, count: result.value, severity: definition.attention.severity ?? 'warning', action: definition.attention.action }
        : undefined,
    };
  }

  private async decimalMetric(key: string, model: string, where: Record<string, unknown>, field: string): Promise<Metric> {
    const delegate = this.delegate(model);
    if (!delegate?.aggregate) return { key, value: null, failed: true };
    try {
      const aggregate = (await delegate.aggregate({ where, _sum: { [field]: true } })) as { _sum?: Record<string, { toString?: () => string } | null> };
      return { key, value: aggregate._sum?.[field]?.toString?.() ?? '0', failed: false };
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

  private async recentItems(model: string, where: Record<string, unknown>, label: string) {
    const delegate = this.delegate(model);
    if (!delegate?.findMany) return { items: [] as OperationalRecentItem[], failed: true };
    try {
      const rows = await delegate.findMany({ where, select: { id: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 5 });
      return {
        failed: false,
        items: rows.map((row) => ({ id: row.id, label: `Recent ${label}`, occurredAt: row.createdAt.toISOString() })),
      };
    } catch {
      return { items: [] as OperationalRecentItem[], failed: true };
    }
  }

  private recentModel(module: Exclude<OperationalSummaryModule, 'm11_intelligence'>) {
    return {
      m1_students: 'student', m2_attendance: 'attendanceSession', m3_fees: 'payment', m4_academics: 'reportCard',
      m5_activity: 'activityPost', m6_homework_timetable: 'homework', m7_hr_payroll: 'payrollRun', m8a_library: 'libraryIssue',
      m8b_transport: 'transportTrip', m8c_canteen: 'canteenPosSale', m9_accounting: 'journalEntry', m10_communications: 'notificationDelivery',
      m12_learning: 'learningSession',
    }[module];
  }

  private empty(module: OperationalSummaryModule, day: Day, status: OperationalSummaryStatus, canView: boolean, summary: Record<string, number | string | null> = {}): OperationalModuleSummary {
    return { generatedAt: new Date().toISOString(), schoolDay: day.gregorianDate, module, status, permissions: { canView }, summary, attentionItems: [], recentItems: [], nextActions: [], nextCursor: null };
  }

  private mobile(persona: string, day: Day, status: OperationalSummaryStatus, summary: Record<string, number | string | null> = {}, attentionItems: OperationalAttentionItem[] = []) {
    return { generatedAt: new Date().toISOString(), schoolDay: day.gregorianDate, module: `mobile_${persona}`, status, summary, attentionItems, recentItems: [], nextActions: [], nextCursor: null };
  }

  private delegate(model: string): ModelDelegate | null {
    const candidate = (this.prisma as unknown as Record<string, unknown>)[model];
    return candidate && typeof candidate === 'object' ? candidate as ModelDelegate : null;
  }

  private canView(module: OperationalSummaryModule, actor: AuthContext, permissions: string[]) {
    const roles = new Set(actor.roles.map((role) => role.toLowerCase()));
    if ([...TENANT_WIDE_ROLES].some((role) => roles.has(role))) return true;
    if (module === 'm2_attendance' && [...TEACHING_ROLES].some((role) => roles.has(role))) return actor.permissions.includes('attendance:read');
    return permissions.some((permission) => actor.permissions.includes(permission));
  }

  private isTeachingOnly(actor: AuthContext) {
    const roles = new Set(actor.roles.map((role) => role.toLowerCase()));
    return [...TEACHING_ROLES].some((role) => roles.has(role)) && ![...TENANT_WIDE_ROLES].some((role) => roles.has(role));
  }
}

function severity(value: OperationalAttentionItem['severity']) {
  return value === 'critical' ? -3 : value === 'warning' ? -2 : -1;
}

function dashboardStatus(summaries: OperationalModuleSummary[]): OperationalSummaryStatus {
  if (!summaries.length) return 'empty';
  if (summaries.some((summary) => summary.status === 'partial')) return 'partial';
  if (summaries.every((summary) => summary.status === 'empty' || summary.status === 'locked')) return 'empty';
  return 'ready';
}

function mobileStatus(items: Array<{ value: number | string | null; failed: boolean }>): OperationalSummaryStatus {
  if (items.some((item) => item.failed)) return 'partial';
  const values = items.map((item) => item.value).filter((value): value is number => typeof value === 'number');
  return values.length > 0 && values.every((value) => value === 0) ? 'empty' : 'ready';
}
