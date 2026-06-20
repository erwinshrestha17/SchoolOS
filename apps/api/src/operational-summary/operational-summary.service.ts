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
  type OperationalNextAction,
  type OperationalRecentItem,
  type OperationalSummaryModule,
  type OperationalSummaryStatus,
} from './operational-summary.types';

type ModelDelegate = {
  count: (args?: unknown) => Promise<number>;
  findMany?: (args?: unknown) => Promise<Array<{ id: string; createdAt: Date }>>;
  aggregate?: (args?: unknown) => Promise<unknown>;
};

type MetricDefinition = {
  key: string;
  label: string;
  model: string;
  where: Record<string, unknown>;
  attention?: Omit<OperationalAttentionItem, 'key' | 'label' | 'count'>;
};

type MetricResult = {
  key: string;
  label: string;
  value: number | string | null;
  attention?: OperationalAttentionItem;
  failed: boolean;
};

const MODULE_CONFIG: Record<
  Exclude<OperationalSummaryModule, 'm11_intelligence'>,
  {
    entitlement: string;
    permissions: string[];
    route: string;
    action: string;
  }
> = {
  m1_students: {
    entitlement: 'students',
    permissions: ['students:read', 'admissions:read'],
    route: '/dashboard/students',
    action: 'Review admissions and student records',
  },
  m2_attendance: {
    entitlement: 'attendance',
    permissions: ['attendance:read'],
    route: '/dashboard/attendance',
    action: 'Review attendance completion',
  },
  m3_fees: {
    entitlement: 'fees',
    permissions: ['fees:read', 'fees:manage', 'payments:close'],
    route: '/dashboard/fees',
    action: 'Review collections and overdue invoices',
  },
  m4_academics: {
    entitlement: 'exams',
    permissions: ['academics:read', 'marks:read'],
    route: '/dashboard/academics',
    action: 'Review exam and marks readiness',
  },
  m5_activity: {
    entitlement: 'activity',
    permissions: ['activity:read', 'activity:manage'],
    route: '/dashboard/activity',
    action: 'Review activity moderation',
  },
  m6_homework_timetable: {
    entitlement: 'homework',
    permissions: ['homework:read', 'timetable:read'],
    route: '/dashboard/homework',
    action: 'Review homework and timetable work',
  },
  m7_hr_payroll: {
    entitlement: 'payroll',
    permissions: ['staff:read', 'payroll:read', 'hr:read'],
    route: '/dashboard/hr',
    action: 'Review leave, staff, and payroll status',
  },
  m8a_library: {
    entitlement: 'library',
    permissions: ['library:read'],
    route: '/dashboard/library',
    action: 'Review circulation and overdues',
  },
  m8b_transport: {
    entitlement: 'transport',
    permissions: ['transport:trips:read', 'transport:reports:read'],
    route: '/dashboard/transport',
    action: 'Review today’s trips and alerts',
  },
  m8c_canteen: {
    entitlement: 'canteen',
    permissions: ['canteen:read', 'canteen:manage'],
    route: '/dashboard/canteen',
    action: 'Review serving and stock status',
  },
  m9_accounting: {
    entitlement: 'accounting',
    permissions: ['accounting:read'],
    route: '/dashboard/accounting',
    action: 'Review accounting close blockers',
  },
  m10_communications: {
    entitlement: 'communications',
    permissions: ['notices:read', 'communications:read'],
    route: '/dashboard/notices',
    action: 'Review notice delivery and escalations',
  },
  m12_learning: {
    entitlement: 'learning',
    permissions: ['learning:read', 'learning:manage'],
    route: '/dashboard/learning',
    action: 'Review learning sessions and activity progress',
  },
};

const PRIVILEGED_ROLES = new Set([
  'principal',
  'admin',
  'school_admin',
  'platform_super_admin',
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
    const summaries = await Promise.all(
      OPERATIONAL_SUMMARY_MODULES.filter(
        (module) => module !== 'm11_intelligence',
      ).map((module) => this.getModuleSummaryInternal(module, actor, day, entitlements.modules)),
    );

    const visible = summaries.filter((item) => item.permissions.canView);
    const attentionItems = visible
      .flatMap((item) =>
        item.attentionItems.map((attention) => ({ ...attention, module: item.module })),
      )
      .sort((left, right) => severityRank(right.severity) - severityRank(left.severity))
      .slice(0, 10);
    const recentItems = visible
      .flatMap((item) =>
        item.recentItems.map((recent) => ({ ...recent, module: item.module })),
      )
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .slice(0, 10);

    return {
      generatedAt: new Date().toISOString(),
      schoolDay: day.gregorianDate,
      module: 'dashboard',
      status: deriveDashboardStatus(visible),
      summary: {
        visibleModuleCount: visible.length,
        readyModuleCount: visible.filter((item) => item.status === 'ready').length,
        attentionItemCount: attentionItems.length,
      },
      attentionItems,
      recentItems,
      nextActions: visible.flatMap((item) => item.nextActions).slice(0, 8),
      modules: visible,
    };
  }

  async getModuleSummary(module: OperationalSummaryModule, actor: AuthContext) {
    const day = getNepalSchoolDay();
    const entitlements = await this.entitlementsService.getEntitlements(
      actor.tenantId,
    );
    return this.getModuleSummaryInternal(module, actor, day, entitlements.modules);
  }

  /**
   * Purpose-limited mobile summaries. The caller must still apply persona route
   * guards. This method never falls back to tenant-wide data for a parent,
   * student, driver, or staff self-service actor.
   */
  async getMobileSummary(persona: 'parent' | 'teacher' | 'principal' | 'driver' | 'staff' | 'student', actor: AuthContext) {
    const day = getNepalSchoolDay();
    switch (persona) {
      case 'parent':
        return this.getParentMobileSummary(actor, day);
      case 'student':
        return this.getStudentMobileSummary(actor, day);
      case 'teacher':
        return this.getTeacherMobileSummary(actor, day);
      case 'driver':
        return this.getDriverMobileSummary(actor, day);
      case 'staff':
        return this.getStaffMobileSummary(actor, day);
      case 'principal':
        return this.getPrincipalMobileSummary(actor, day);
    }
  }

  private async getModuleSummaryInternal(
    module: OperationalSummaryModule,
    actor: AuthContext,
    day: ReturnType<typeof getNepalSchoolDay>,
    enabledModules: string[],
  ): Promise<OperationalModuleSummary> {
    if (module === 'm11_intelligence') {
      return this.staticSummary(module, day.gregorianDate, 'locked', false, {
        roadmapOnly: 'M11 Intelligence is not enabled in the current SchoolOS scope.',
      });
    }

    const config = MODULE_CONFIG[module];
    const canView = this.canViewModule(actor, config.permissions);
    if (!canView) {
      return this.staticSummary(module, day.gregorianDate, 'permissionDenied', false, {});
    }

    if (!enabledModules.includes(config.entitlement)) {
      return this.staticSummary(module, day.gregorianDate, 'locked', true, {});
    }

    const build = {
      m1_students: () => this.studentsSummary(actor, day),
      m2_attendance: () => this.attendanceSummary(actor, day),
      m3_fees: () => this.feesSummary(actor, day),
      m4_academics: () => this.academicsSummary(actor, day),
      m5_activity: () => this.activitySummary(actor, day),
      m6_homework_timetable: () => this.homeworkTimetableSummary(actor, day),
      m7_hr_payroll: () => this.hrPayrollSummary(actor, day),
      m8a_library: () => this.librarySummary(actor, day),
      m8b_transport: () => this.transportSummary(actor, day),
      m8c_canteen: () => this.canteenSummary(actor, day),
      m9_accounting: () => this.accountingSummary(actor, day),
      m10_communications: () => this.communicationsSummary(actor, day),
      m12_learning: () => this.learningSummary(actor, day),
    }[module];

    return build();
  }

  private async studentsSummary(actor: AuthContext, day: ReturnType<typeof getNepalSchoolDay>) {
    return this.buildSummary('m1_students', actor, day, [
      metric('pendingApplications', 'Applications needing review', 'admissionApplication', {
        tenantId: actor.tenantId,
        status: { in: ['APPLICATION', 'DOCUMENT_PENDING', 'INTERVIEW', 'ACCEPTED'] },
      }, reviewAttention('Review pending admissions', '/dashboard/admissions')),
      metric('unverifiedDocuments', 'Student documents needing verification', 'studentDocument', {
        tenantId: actor.tenantId,
        verifiedAt: null,
      }, reviewAttention('Review student documents', '/dashboard/students/documents')),
      metric('duplicateImportRows', 'Possible duplicate admission rows', 'admissionImportRow', {
        tenantId: actor.tenantId,
        status: 'DUPLICATE',
      }, reviewAttention('Review duplicate candidates', '/dashboard/students/duplicates')),
      metric('recentAdmissions', 'Students admitted today', 'student', {
        tenantId: actor.tenantId,
        admissionDate: { gte: day.startUtc, lt: day.endExclusiveUtc },
      }),
      metric('qrIssues', 'QR credentials needing action', 'studentQrCredential', {
        tenantId: actor.tenantId,
        OR: [{ expiresAt: { lte: new Date() } }, { status: { in: ['EXPIRED', 'REVOKED'] } }],
      }, reviewAttention('Review student QR credentials', '/dashboard/students/qr')),
      metric('iemisBlockers', 'Profiles missing export-ready fields', 'student', {
        tenantId: actor.tenantId,
        OR: [{ nationalStudentId: null }, { admissionNumber: null }],
      }, reviewAttention('Review iEMIS readiness', '/dashboard/students/iemis')),
    ], 'student', 'student records', '/dashboard/students');
  }

  private async attendanceSummary(actor: AuthContext, day: ReturnType<typeof getNepalSchoolDay>) {
    const teacherScope = await this.teacherScope(actor);
    const scope = teacherScope?.attendanceWhere ?? {};
    return this.buildSummary('m2_attendance', actor, day, [
      metric('expectedStudents', 'Expected active students', 'student', {
        tenantId: actor.tenantId,
        lifecycleStatus: 'ACTIVE',
        ...(teacherScope?.studentWhere ?? {}),
      }),
      metric('markedRecords', 'Attendance records marked today', 'attendanceRecord', {
        tenantId: actor.tenantId,
        createdAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
        ...scope,
      }),
      metric('present', 'Present records', 'attendanceRecord', {
        tenantId: actor.tenantId,
        status: 'PRESENT',
        createdAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
        ...scope,
      }),
      metric('absent', 'Absent records', 'attendanceRecord', {
        tenantId: actor.tenantId,
        status: 'ABSENT',
        createdAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
        ...scope,
      }, reviewAttention('Review absent students', '/dashboard/attendance/daily')),
      metric('late', 'Late records', 'attendanceRecord', {
        tenantId: actor.tenantId,
        status: 'LATE',
        createdAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
        ...scope,
      }, reviewAttention('Review late arrivals', '/dashboard/attendance/daily')),
      metric('pendingCorrections', 'Attendance corrections awaiting review', 'attendanceCorrectionRequest', {
        tenantId: actor.tenantId,
        status: 'PENDING',
      }, reviewAttention('Review attendance corrections', '/dashboard/attendance/corrections')),
      metric('lockWindowWarnings', 'Sessions approaching or past the lock window', 'attendanceSession', {
        tenantId: actor.tenantId,
        attendanceDate: { gte: day.startUtc, lt: day.endExclusiveUtc },
        submittedAt: null,
        lockAt: { lte: new Date() },
        ...scope,
      }, reviewAttention('Complete pending attendance registers', '/dashboard/attendance/daily')),
    ], 'attendanceSession', 'attendance sessions', '/dashboard/attendance');
  }

  private async feesSummary(actor: AuthContext, day: ReturnType<typeof getNepalSchoolDay>) {
    const collected = await this.decimalAggregate('payment', {
      tenantId: actor.tenantId,
      status: 'SUCCESS',
      paidAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
    }, 'amount');
    return this.buildSummary('m3_fees', actor, day, [
      metric('paymentCountToday', 'Payments received today', 'payment', {
        tenantId: actor.tenantId,
        status: 'SUCCESS',
        paidAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
      }),
      { key: 'collectedTodayAmount', label: 'Collected today', value: collected.value, failed: collected.failed },
      metric('overdueInvoices', 'Overdue invoices', 'invoice', {
        tenantId: actor.tenantId,
        status: { in: ['ISSUED', 'PARTIAL'] },
        dueDate: { lt: day.endExclusiveUtc },
      }, reviewAttention('Review overdue fee follow-up', '/dashboard/fees/dues')),
      metric('dueToday', 'Invoices due today', 'invoice', {
        tenantId: actor.tenantId,
        status: { in: ['ISSUED', 'PARTIAL'] },
        dueDate: { gte: day.startUtc, lt: day.endExclusiveUtc },
      }),
      metric('reversedPayments', 'Reversed payments requiring review', 'payment', {
        tenantId: actor.tenantId,
        status: 'REVERSED',
        updatedAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
      }, reviewAttention('Review payment reversals', '/dashboard/fees/reversals')),
      metric('billingRunsInProgress', 'Billing runs not finalized', 'billingRun', {
        tenantId: actor.tenantId,
        status: 'DRAFT',
      }, reviewAttention('Review billing run status', '/dashboard/fees/invoices')),
    ], 'payment', 'payments', '/dashboard/fees');
  }

  private async academicsSummary(actor: AuthContext, day: ReturnType<typeof getNepalSchoolDay>) {
    return this.buildSummary('m4_academics', actor, day, [
      metric('activeAcademicYears', 'Active academic years', 'academicYear', {
        tenantId: actor.tenantId,
        isCurrent: true,
      }),
      metric('openExamTerms', 'Open exam terms', 'examTerm', {
        tenantId: actor.tenantId,
        status: { in: ['DRAFT', 'PUBLISHED'] },
      }),
      metric('unlockedMarks', 'Marks still open for entry', 'markEntry', {
        tenantId: actor.tenantId,
        isLocked: false,
      }, reviewAttention('Review marks entry progress', '/dashboard/academics/marks')),
      metric('pendingCas', 'CAS records awaiting completion', 'casRecord', {
        tenantId: actor.tenantId,
        status: { in: ['DRAFT', 'PENDING'] },
      }, reviewAttention('Review CAS completion', '/dashboard/academics/cas')),
      metric('reportCardBlockers', 'Report cards not published', 'reportCard', {
        tenantId: actor.tenantId,
        publishedAt: null,
      }, reviewAttention('Review report-card readiness', '/dashboard/academics/report-cards')),
    ], 'reportCard', 'report cards', '/dashboard/academics');
  }

  private async activitySummary(actor: AuthContext, day: ReturnType<typeof getNepalSchoolDay>) {
    return this.buildSummary('m5_activity', actor, day, [
      metric('pendingModeration', 'Posts awaiting moderation', 'activityPost', {
        tenantId: actor.tenantId,
        status: 'PENDING',
      }, reviewAttention('Review activity moderation', '/dashboard/activity/pending')),
      metric('publishedToday', 'Posts published today', 'activityPost', {
        tenantId: actor.tenantId,
        status: 'PUBLISHED',
        publishedAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
      }),
      metric('consentBlockedPosts', 'Posts blocked by consent', 'activityPost', {
        tenantId: actor.tenantId,
        status: 'CONSENT_BLOCKED',
      }, reviewAttention('Resolve consent blockers', '/dashboard/activity/pending')),
    ], 'activityPost', 'activity posts', '/dashboard/activity');
  }

  private async homeworkTimetableSummary(actor: AuthContext, day: ReturnType<typeof getNepalSchoolDay>) {
    return this.buildSummary('m6_homework_timetable', actor, day, [
      metric('homeworkDueToday', 'Homework due today', 'homework', {
        tenantId: actor.tenantId,
        dueDate: { gte: day.startUtc, lt: day.endExclusiveUtc },
        isPublished: true,
      }),
      metric('overdueHomework', 'Homework overdue for review', 'homework', {
        tenantId: actor.tenantId,
        dueDate: { lt: day.endExclusiveUtc },
        isPublished: true,
      }, reviewAttention('Review overdue homework', '/dashboard/homework')),
      metric('timetableSlots', 'Published timetable periods', 'timetableSlot', {
        tenantId: actor.tenantId,
      }),
      metric('activeSubstitutions', 'Active substitutions', 'timetableSubstitution', {
        tenantId: actor.tenantId,
        status: { in: ['DRAFT', 'PUBLISHED'] },
      }, reviewAttention('Review substitutions', '/dashboard/timetable/substitutions')),
    ], 'homework', 'homework items', '/dashboard/homework');
  }

  private async hrPayrollSummary(actor: AuthContext, day: ReturnType<typeof getNepalSchoolDay>) {
    return this.buildSummary('m7_hr_payroll', actor, day, [
      metric('staffOnLeave', 'Staff on leave today', 'staff', {
        tenantId: actor.tenantId,
        status: 'ON_LEAVE',
      }),
      metric('pendingLeaveRequests', 'Leave requests awaiting review', 'staffLeaveRequest', {
        tenantId: actor.tenantId,
        status: 'PENDING',
      }, reviewAttention('Review leave requests', '/dashboard/hr/leave')),
      metric('contractsExpiringSoon', 'Contracts expiring soon', 'staffContract', {
        tenantId: actor.tenantId,
        endDate: { gte: day.startUtc, lte: new Date(day.endExclusiveUtc.getTime() + 30 * 86_400_000) },
      }, reviewAttention('Review expiring staff contracts', '/dashboard/hr/contracts')),
      metric('payrollRunsInProgress', 'Payroll runs in progress', 'payrollRun', {
        tenantId: actor.tenantId,
        status: { in: ['DRAFT', 'REVIEW', 'APPROVED'] },
      }, reviewAttention('Review payroll run blockers', '/dashboard/payroll/runs')),
    ], 'payrollRun', 'payroll runs', '/dashboard/hr');
  }

  private async librarySummary(actor: AuthContext, day: ReturnType<typeof getNepalSchoolDay>) {
    return this.buildSummary('m8a_library', actor, day, [
      metric('activeLoans', 'Active loans', 'libraryIssue', {
        tenantId: actor.tenantId,
        status: 'ISSUED',
      }),
      metric('overdueLoans', 'Overdue loans', 'libraryIssue', {
        tenantId: actor.tenantId,
        status: 'OVERDUE',
      }, reviewAttention('Review overdue loans', '/dashboard/library/overdue')),
      metric('dueToday', 'Loans due today', 'libraryIssue', {
        tenantId: actor.tenantId,
        dueDate: { gte: day.startUtc, lt: day.endExclusiveUtc },
      }),
      metric('reservationQueue', 'Reservations awaiting action', 'libraryReservation', {
        tenantId: actor.tenantId,
        status: 'PENDING',
      }, reviewAttention('Review library reservations', '/dashboard/library')),
    ], 'libraryIssue', 'library issues', '/dashboard/library');
  }

  private async transportSummary(actor: AuthContext, day: ReturnType<typeof getNepalSchoolDay>) {
    const staleAt = new Date(Date.now() - 15 * 60_000);
    return this.buildSummary('m8b_transport', actor, day, [
      metric('activeTrips', 'Active trips today', 'transportTrip', {
        tenantId: actor.tenantId,
        status: 'ACTIVE',
        startedAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
      }),
      metric('delayedTrips', 'Delayed trips', 'transportTrip', {
        tenantId: actor.tenantId,
        status: 'ACTIVE',
        isDelayed: true,
      }, reviewAttention('Review delayed transport trips', '/dashboard/transport/trips')),
      metric('staleGpsPings', 'Trips with stale GPS updates', 'transportLocationPing', {
        tenantId: actor.tenantId,
        recordedAt: { lt: staleAt },
      }, reviewAttention('Review GPS freshness', '/dashboard/transport/gps-quality')),
      metric('vehicleDocumentRisks', 'Vehicle documents expiring soon', 'transportVehicle', {
        tenantId: actor.tenantId,
        OR: [
          { insuranceExpiry: { lte: new Date(day.endExclusiveUtc.getTime() + 30 * 86_400_000) } },
          { fitnessCertificateExp: { lte: new Date(day.endExclusiveUtc.getTime() + 30 * 86_400_000) } },
        ],
      }, reviewAttention('Review vehicle documents', '/dashboard/transport/vehicles')),
    ], 'transportTrip', 'transport trips', '/dashboard/transport');
  }

  private async canteenSummary(actor: AuthContext, day: ReturnType<typeof getNepalSchoolDay>) {
    const sales = await this.decimalAggregate('canteenPosSale', {
      tenantId: actor.tenantId,
      createdAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
    }, 'amount');
    return this.buildSummary('m8c_canteen', actor, day, [
      metric('salesCountToday', 'Sales today', 'canteenPosSale', {
        tenantId: actor.tenantId,
        createdAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
      }),
      { key: 'salesTodayAmount', label: 'Sales today', value: sales.value, failed: sales.failed },
      metric('pendingServings', 'Serving actions awaiting completion', 'canteenMealServing', {
        tenantId: actor.tenantId,
        status: 'PENDING',
      }, reviewAttention('Review canteen serving queue', '/dashboard/canteen/serving')),
      metric('lowStockItems', 'Low stock items', 'canteenInventoryItem', {
        tenantId: actor.tenantId,
        quantityOnHand: { lte: 0 },
      }, reviewAttention('Review canteen stock', '/dashboard/canteen/inventory')),
    ], 'canteenPosSale', 'canteen sales', '/dashboard/canteen');
  }

  private async accountingSummary(actor: AuthContext, day: ReturnType<typeof getNepalSchoolDay>) {
    return this.buildSummary('m9_accounting', actor, day, [
      metric('openPeriods', 'Open accounting periods', 'fiscalPeriod', {
        tenantId: actor.tenantId,
        status: 'OPEN',
      }),
      metric('draftJournals', 'Unposted journal entries', 'journalEntry', {
        tenantId: actor.tenantId,
        status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
      }, reviewAttention('Review unposted journals', '/dashboard/accounting/journals')),
      metric('unreconciledStatements', 'Unreconciled bank statement entries', 'bankStatement', {
        tenantId: actor.tenantId,
        isReconciled: false,
      }, reviewAttention('Review reconciliation exceptions', '/dashboard/accounting/reconciliation')),
      metric('periodCloseBlockers', 'Accounting periods not ready to close', 'accountingPeriod', {
        tenantId: actor.tenantId,
        status: { in: ['OPEN', 'LOCKED'] },
      }, reviewAttention('Review period close status', '/dashboard/accounting/period-close')),
    ], 'journalEntry', 'journal entries', '/dashboard/accounting');
  }

  private async communicationsSummary(actor: AuthContext, day: ReturnType<typeof getNepalSchoolDay>) {
    return this.buildSummary('m10_communications', actor, day, [
      metric('scheduledNotices', 'Scheduled notices', 'notice', {
        tenantId: actor.tenantId,
        status: 'SCHEDULED',
      }),
      metric('failedDeliveries', 'Failed notice deliveries', 'notificationDelivery', {
        tenantId: actor.tenantId,
        status: { in: ['FAILED', 'RETRY_PENDING'] },
      }, reviewAttention('Review failed notice deliveries', '/dashboard/notices/delivery')),
      metric('unreadFollowUp', 'Unread notice recipients', 'notificationDelivery', {
        tenantId: actor.tenantId,
        noticeId: { not: null },
        readReceipts: { none: {} },
      }, reviewAttention('Follow up on unread notices', '/dashboard/notices/delivery')),
      metric('highImpactPending', 'High-impact notices awaiting approval', 'notice', {
        tenantId: actor.tenantId,
        priority: { in: ['URGENT', 'EMERGENCY'] },
        status: 'PENDING_APPROVAL',
      }, reviewAttention('Review high-impact notices', '/dashboard/notices')),
      metric('openEscalations', 'Open communication escalations', 'communicationEscalation', {
        tenantId: actor.tenantId,
        status: { in: ['OPEN', 'ESCALATED'] },
      }, reviewAttention('Review communication escalations', '/dashboard/messages/escalations')),
    ], 'notificationDelivery', 'notification deliveries', '/dashboard/notices');
  }

  private async learningSummary(actor: AuthContext, day: ReturnType<typeof getNepalSchoolDay>) {
    return this.buildSummary('m12_learning', actor, day, [
      metric('draftActivities', 'Draft activities', 'learningActivity', {
        tenantId: actor.tenantId,
        status: 'DRAFT',
      }),
      metric('liveSessions', 'Live learning sessions', 'learningSession', {
        tenantId: actor.tenantId,
        status: 'LIVE',
        expiresAt: { gt: new Date() },
      }),
      metric('sessionRisks', 'Expired or paused sessions', 'learningSession', {
        tenantId: actor.tenantId,
        OR: [{ expiresAt: { lte: new Date() } }, { status: 'PAUSED' }],
      }, reviewAttention('Review live session health', '/dashboard/learning/sessions')),
      metric('submittedAttemptsToday', 'Student attempts submitted today', 'learningAttempt', {
        tenantId: actor.tenantId,
        submittedAt: { gte: day.startUtc, lt: day.endExclusiveUtc },
      }),
      metric('resourceRisks', 'Unavailable learning resources', 'learningResource', {
        tenantId: actor.tenantId,
        status: { in: ['ARCHIVED', 'UNAVAILABLE'] },
      }, reviewAttention('Review learning resources', '/dashboard/learning/resources')),
    ], 'learningSession', 'learning sessions', '/dashboard/learning');
  }

  private async getParentMobileSummary(actor: AuthContext, day: ReturnType<typeof getNepalSchoolDay>) {
    const studentIds = await getParentStudentIds(this.prisma, actor);
    const base = this.mobileEnvelope('parent', day.gregorianDate, studentIds.length === 0 ? 'empty' : 'ready');
    if (studentIds.length === 0) return base;

    const [attendanceToday, unpaidInvoices, homeworkDue, unreadNotices] = await Promise.all([
      this.safeCount('attendanceRecord', { tenantId: actor.tenantId, studentId: { in: studentIds }, createdAt: { gte: day.startUtc, lt: day.endExclusiveUtc } }),
      this.safeCount('invoice', { tenantId: actor.tenantId, studentId: { in: studentIds }, status: { in: ['ISSUED', 'PARTIAL'] } }),
      this.safeCount('homework', { tenantId: actor.tenantId, dueDate: { gte: day.startUtc, lt: day.endExclusiveUtc }, isPublished: true }),
      this.safeCount('notificationDelivery', { tenantId: actor.tenantId, OR: [{ recipientUserId: actor.userId }, { studentId: { in: studentIds } }], readReceipts: { none: { userId: actor.userId } } }),
    ]);

    return this.mobileEnvelope('parent', day.gregorianDate, deriveSafeStatus([attendanceToday, unpaidInvoices, homeworkDue, unreadNotices]), {
      linkedChildren: studentIds.length,
      attendanceRecordsToday: attendanceToday.value,
      unpaidInvoices: unpaidInvoices.value,
      homeworkDueToday: homeworkDue.value,
      unreadNotices: unreadNotices.value,
    });
  }

  private async getStudentMobileSummary(actor: AuthContext, day: ReturnType<typeof getNepalSchoolDay>) {
    const studentId = await getStudentOwnId(this.prisma, actor);
    if (!studentId) return this.mobileEnvelope('student', day.gregorianDate, 'empty');
    const [activeAttempts, publishedResults] = await Promise.all([
      this.safeCount('learningAttempt', { tenantId: actor.tenantId, studentId, status: 'IN_PROGRESS' }),
      this.safeCount('reportCard', { tenantId: actor.tenantId, studentId, publishedAt: { not: null } }),
    ]);
    return this.mobileEnvelope('student', day.gregorianDate, deriveSafeStatus([activeAttempts, publishedResults]), {
      activeLearningAttempts: activeAttempts.value,
      publishedReportCards: publishedResults.value,
    });
  }

  private async getTeacherMobileSummary(actor: AuthContext, day: ReturnType<typeof getNepalSchoolDay>) {
    const scope = await this.teacherScope(actor);
    if (!scope) return this.mobileEnvelope('teacher', day.gregorianDate, 'empty');
    const [pendingRegisters, assignments] = await Promise.all([
      this.safeCount('attendanceSession', { tenantId: actor.tenantId, attendanceDate: { gte: day.startUtc, lt: day.endExclusiveUtc }, submittedAt: null, ...scope.attendanceWhere }),
      this.safeCount('subjectTeacherAssignment', { tenantId: actor.tenantId, staffId: scope.staffId }),
    ]);
    return this.mobileEnvelope('teacher', day.gregorianDate, deriveSafeStatus([pendingRegisters, assignments]), {
      assignedClassSubjectScopes: assignments.value,
      pendingAttendanceRegisters: pendingRegisters.value,
    });
  }

  private async getDriverMobileSummary(actor: AuthContext, day: ReturnType<typeof getNepalSchoolDay>) {
    const staff = await this.delegate('staff')?.findMany?.({
      where: { tenantId: actor.tenantId, userId: actor.userId },
      select: { id: true, createdAt: true },
      take: 1,
    });
    const staffId = staff?.[0]?.id;
    if (!staffId) return this.mobileEnvelope('driver', day.gregorianDate, 'empty');
    const assignments = await this.delegate('transportDriverAssignment')?.findMany?.({
      where: { tenantId: actor.tenantId, staffId, startsAt: { lte: day.endExclusiveUtc }, OR: [{ endsAt: null }, { endsAt: { gte: day.startUtc } }] },
      select: { id: true, createdAt: true },
      take: 10,
    });
    const assignmentIds = assignments?.map((item) => item.id) ?? [];
    const trips = await this.safeCount('transportTrip', { tenantId: actor.tenantId, driverAssignmentId: { in: assignmentIds }, startedAt: { gte: day.startUtc, lt: day.endExclusiveUtc } });
    return this.mobileEnvelope('driver', day.gregorianDate, trips.failed ? 'partial' : assignmentIds.length ? 'ready' : 'empty', {
      assignedDriverAssignments: assignmentIds.length,
      assignedTripsToday: trips.value,
    });
  }

  private async getStaffMobileSummary(actor: AuthContext, day: ReturnType<typeof getNepalSchoolDay>) {
    const staff = await this.delegate('staff')?.findMany?.({
      where: { tenantId: actor.tenantId, userId: actor.userId },
      select: { id: true, createdAt: true },
      take: 1,
    });
    const staffId = staff?.[0]?.id;
    if (!staffId) return this.mobileEnvelope('staff', day.gregorianDate, 'empty');
    const [leaveRequests, payslips] = await Promise.all([
      this.safeCount('staffLeaveRequest', { tenantId: actor.tenantId, staffId, status: { in: ['DRAFT', 'PENDING', 'APPROVED'] } }),
      this.safeCount('payrollSlip', { tenantId: actor.tenantId, staffId, publishedAt: { not: null } }),
    ]);
    return this.mobileEnvelope('staff', day.gregorianDate, deriveSafeStatus([leaveRequests, payslips]), {
      activeLeaveRequests: leaveRequests.value,
      publishedPayslips: payslips.value,
    });
  }

  private async getPrincipalMobileSummary(actor: AuthContext, day: ReturnType<typeof getNepalSchoolDay>) {
    const dashboard = await this.getDashboardSummary(actor);
    return this.mobileEnvelope('principal', day.gregorianDate, dashboard.status, {
      visibleModuleCount: dashboard.summary.visibleModuleCount,
      attentionItemCount: dashboard.summary.attentionItemCount,
      readyModuleCount: dashboard.summary.readyModuleCount,
    }, dashboard.attentionItems.slice(0, 5));
  }

  private mobileEnvelope(
    persona: string,
    schoolDay: string,
    status: OperationalSummaryStatus,
    summary: Record<string, number | string | null> = {},
    attentionItems: OperationalAttentionItem[] = [],
  ) {
    return {
      generatedAt: new Date().toISOString(),
      schoolDay,
      module: `mobile_${persona}`,
      status,
      summary,
      attentionItems,
      recentItems: [],
      nextActions: [],
      nextCursor: null,
    };
  }

  private async buildSummary(
    module: OperationalSummaryModule,
    actor: AuthContext,
    day: ReturnType<typeof getNepalSchoolDay>,
    definitions: Array<MetricDefinition | MetricResult>,
    recentModel: string,
    recentLabel: string,
    route: string,
  ): Promise<OperationalModuleSummary> {
    const results = await Promise.all(
      definitions.map((definition) =>
        'model' in definition ? this.resolveMetric(definition) : Promise.resolve(definition),
      ),
    );
    const recent = await this.recentItems(recentModel, { tenantId: actor.tenantId }, recentLabel);
    const attentions = results.flatMap((result) => result.attention ? [result.attention] : []).slice(0, 10);
    const status = deriveModuleStatus(results, recent.failed);

    return {
      generatedAt: new Date().toISOString(),
      schoolDay: day.gregorianDate,
      module,
      status,
      permissions: { canView: true },
      summary: Object.fromEntries(results.map((result) => [result.key, result.value])),
      attentionItems: attentions,
      recentItems: recent.items,
      nextActions: [{ key: `open_${module}`, label: MODULE_CONFIG[module as Exclude<OperationalSummaryModule, 'm11_intelligence'>].action, route }],
      nextCursor: null,
    };
  }

  private staticSummary(
    module: OperationalSummaryModule,
    schoolDay: string,
    status: OperationalSummaryStatus,
    canView: boolean,
    summary: Record<string, number | string | null>,
  ): OperationalModuleSummary {
    return {
      generatedAt: new Date().toISOString(),
      schoolDay,
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

  private async resolveMetric(definition: MetricDefinition): Promise<MetricResult> {
    const result = await this.safeCount(definition.model, definition.where);
    return {
      key: definition.key,
      label: definition.label,
      value: result.value,
      failed: result.failed,
      attention:
        definition.attention && typeof result.value === 'number' && result.value > 0
          ? {
              key: definition.key,
              label: definition.attention.label,
              count: result.value,
              severity: definition.attention.severity,
              action: definition.attention.action,
            }
          : undefined,
    };
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

  private async decimalAggregate(model: string, where: Record<string, unknown>, field: string) {
    const delegate = this.delegate(model);
    if (!delegate?.aggregate) return { value: null, failed: true };
    try {
      const result = (await delegate.aggregate({ where, _sum: { [field]: true } })) as { _sum?: Record<string, { toString?: () => string } | null> };
      return { value: result._sum?.[field]?.toString?.() ?? '0', failed: false };
    } catch {
      return { value: null, failed: true };
    }
  }

  private async recentItems(model: string, where: Record<string, unknown>, label: string) {
    const delegate = this.delegate(model);
    if (!delegate?.findMany) return { items: [], failed: true };
    try {
      const rows = await delegate.findMany({
        where,
        select: { id: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
      return {
        failed: false,
        items: rows.map<OperationalRecentItem>((row) => ({
          id: row.id,
          label: `Recent ${label}`,
          occurredAt: row.createdAt.toISOString(),
        })),
      };
    } catch {
      return { items: [], failed: true };
    }
  }

  private delegate(model: string): ModelDelegate | null {
    const candidate = (this.prisma as unknown as Record<string, unknown>)[model];
    return candidate && typeof candidate === 'object' ? (candidate as ModelDelegate) : null;
  }

  private canViewModule(actor: AuthContext, requiredPermissions: string[]) {
    const roles = new Set(actor.roles.map((role) => role.toLowerCase()));
    if ([...PRIVILEGED_ROLES].some((role) => roles.has(role))) return true;
    const permissions = new Set(actor.permissions);
    return requiredPermissions.some((permission) => permissions.has(permission));
  }

  private async teacherScope(actor: AuthContext) {
    const roles = new Set(actor.roles.map((role) => role.toLowerCase()));
    if (!roles.has('teacher') && !roles.has('subject_teacher')) return null;
    const staff = await this.delegate('staff')?.findMany?.({
      where: { tenantId: actor.tenantId, userId: actor.userId },
      select: { id: true, createdAt: true },
      take: 1,
    });
    const staffId = staff?.[0]?.id;
    if (!staffId) return null;
    const assignments = await this.delegate('subjectTeacherAssignment')?.findMany?.({
      where: { tenantId: actor.tenantId, staffId },
      select: { id: true, classId: true, sectionId: true, createdAt: true },
      take: 100,
    }) as Array<{ classId?: string; sectionId?: string | null }> | undefined;
    const classScopes = (assignments ?? []).flatMap((assignment) =>
      assignment.classId ? [{ classId: assignment.classId, sectionId: assignment.sectionId ?? null }] : [],
    );
    return {
      staffId,
      attendanceWhere: classScopes.length ? { OR: classScopes } : { id: '__no_assigned_scope__' },
      studentWhere: classScopes.length ? { OR: classScopes } : { id: '__no_assigned_scope__' },
    };
  }
}

function metric(
  key: string,
  label: string,
  model: string,
  where: Record<string, unknown>,
  attention?: Omit<OperationalAttentionItem, 'key' | 'label' | 'count'>,
): MetricDefinition {
  return { key, label, model, where, attention };
}

function reviewAttention(label: string, action: string): Omit<OperationalAttentionItem, 'key' | 'label' | 'count'> {
  return { label, action, severity: 'warning' };
}

function severityRank(value: OperationalAttentionItem['severity']) {
  return value === 'critical' ? 3 : value === 'warning' ? 2 : 1;
}

function deriveModuleStatus(results: MetricResult[], recentFailed: boolean): OperationalSummaryStatus {
  if (results.some((result) => result.failed) || recentFailed) return 'partial';
  const numeric = results.map((result) => result.value).filter((value): value is number => typeof value === 'number');
  return numeric.length > 0 && numeric.every((value) => value === 0) ? 'empty' : 'ready';
}

function deriveDashboardStatus(summaries: OperationalModuleSummary[]): OperationalSummaryStatus {
  if (summaries.length === 0) return 'empty';
  if (summaries.some((summary) => summary.status === 'partial')) return 'partial';
  if (summaries.every((summary) => summary.status === 'empty' || summary.status === 'locked')) return 'empty';
  return 'ready';
}

function deriveSafeStatus(results: Array<{ value: number | string | null; failed: boolean }>): OperationalSummaryStatus {
  if (results.some((result) => result.failed)) return 'partial';
  const numbers = results.map((result) => result.value).filter((value): value is number => typeof value === 'number');
  return numbers.length && numbers.every((value) => value === 0) ? 'empty' : 'ready';
}
