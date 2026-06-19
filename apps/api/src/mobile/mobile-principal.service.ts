import { Injectable, ForbiddenException } from '@nestjs/common';
import type { AuthContext } from '../auth/auth.types';
import { EntitlementsService } from '../plans/entitlements.service';
import { PrismaService } from '../prisma/prisma.service';

type Severity = 'critical' | 'high' | 'medium' | 'low';

type PrincipalMetric = {
  key: string;
  label: string;
  value: number | string;
  detail?: string;
  tone?: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'slate';
  route?: string;
  locked?: boolean;
};

type PrincipalItem = {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  detail?: string;
  severity?: Severity;
  status?: string;
  owner?: string;
  nextAction?: string;
  timestamp?: string | null;
  route?: string;
};

@Injectable()
export class MobilePrincipalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  async getDashboard(actor: AuthContext) {
    this.assertPrincipal(actor);
    const [tenant, modules, attention, attendance, staff, fees, approvals] =
      await Promise.all([
        this.getTenant(actor.tenantId),
        this.getModules(actor.tenantId),
        this.getAttention(actor, 'all'),
        this.getAttendanceSummary(actor),
        this.getStaffAbsence(actor),
        this.getFeesSummary(actor),
        this.getApprovals(actor, 'pending'),
      ]);

    const cards: PrincipalMetric[] = [
      {
        key: 'attendanceRisk',
        label: 'Attendance Risk',
        value: attendance.metrics.classesNotMarked,
        detail: 'classes',
        tone: attendance.metrics.classesNotMarked > 0 ? 'orange' : 'green',
        route: '/principal/attendance-risk',
        locked: !modules.attendance,
      },
      {
        key: 'staffAbsence',
        label: 'Staff Absence',
        value: staff.metrics.absentToday,
        detail: 'staff today',
        tone: staff.metrics.absentToday > 0 ? 'red' : 'green',
        route: '/principal/staff-absence',
        locked: !modules.hr,
      },
      {
        key: 'approvals',
        label: 'Approvals',
        value: approvals.summary.pending,
        detail: 'pending',
        tone: approvals.summary.pending > 0 ? 'blue' : 'green',
        route: '/principal/approvals',
      },
      {
        key: 'fees',
        label: 'Fees Snapshot',
        value: fees.metrics.collectedTodayFormatted,
        detail: 'today',
        tone: 'green',
        route: '/principal/fees-snapshot',
        locked: !modules.fees,
      },
    ];

    return {
      school: {
        id: tenant.id,
        name: tenant.name,
        role: 'Principal',
      },
      date: dayLabel(new Date()),
      attentionCount: attention.summary.total,
      cards,
      alerts: attention.items.slice(0, 5),
      quickActions: [
        {
          label: 'Review Approvals',
          icon: 'approvals',
          route: '/principal/approvals',
          enabled: true,
        },
        {
          label: 'Attendance Risk',
          icon: 'attendance',
          route: '/principal/attendance-risk',
          enabled: modules.attendance,
        },
        {
          label: 'Staff Coverage',
          icon: 'staff',
          route: '/principal/staff-absence',
          enabled: modules.hr,
        },
        {
          label: 'Emergency Notice',
          icon: 'notice',
          route: '/principal/notices',
          enabled: modules.notices,
        },
      ],
      recentUpdates: await this.getRecentUpdates(actor),
      modules,
      lastUpdated: nowIso(),
    };
  }

  async getAttention(actor: AuthContext, filter = 'all') {
    this.assertPrincipal(actor);
    const modules = await this.getModules(actor.tenantId);
    const [
      attendanceItems,
      staffItems,
      transportItems,
      noticeItems,
      feeItems,
      escalationItems,
      academicsItems,
    ] = await Promise.all([
      modules.attendance ? this.attendanceAttention(actor) : [],
      modules.hr ? this.staffAttention(actor) : [],
      modules.transport ? this.transportAttention(actor) : [],
      modules.notices ? this.noticeAttention(actor) : [],
      modules.fees ? this.feeAttention(actor) : [],
      this.escalationAttention(actor),
      modules.exams ? this.academicsAttention(actor) : [],
    ]);

    let items = [
      ...attendanceItems,
      ...staffItems,
      ...transportItems,
      ...noticeItems,
      ...feeItems,
      ...escalationItems,
      ...academicsItems,
    ].sort(compareAttention);

    const normalizedFilter = filter.toLowerCase();
    if (normalizedFilter === 'critical') {
      items = items.filter((item) => item.severity === 'critical');
    } else if (normalizedFilter === 'today') {
      const { start, end } = dayBounds(new Date());
      items = items.filter((item) => {
        const date = item.timestamp ? new Date(item.timestamp) : null;
        return date != null && date >= start && date < end;
      });
    } else if (normalizedFilter === 'assigned') {
      items = items.filter((item) => item.owner === 'Principal');
    }

    return {
      summary: {
        total: items.length,
        critical: items.filter((item) => item.severity === 'critical').length,
        high: items.filter((item) => item.severity === 'high').length,
        medium: items.filter((item) => item.severity === 'medium').length,
        assignedToMe: items.filter((item) => item.owner === 'Principal').length,
      },
      filters: ['all', 'critical', 'today', 'assigned'],
      activeFilter: normalizedFilter,
      items,
      modules,
      lastUpdated: nowIso(),
    };
  }

  async getApprovals(actor: AuthContext, status = 'pending') {
    this.assertPrincipal(actor);
    const statusKey = status.toUpperCase();
    const pending = ['PENDING', 'SUBMITTED', 'REQUESTED'].includes(statusKey)
      ? 'PENDING'
      : statusKey;

    const [
      leaveRequests,
      attendanceCorrections,
      financeApprovals,
      reportCardCorrections,
      workflowApprovals,
      noticeDrafts,
    ] = await Promise.all([
      this.prisma.staffLeaveRequest.findMany({
        where: { tenantId: actor.tenantId, status: pending as never },
        include: { staff: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.attendanceCorrectionRequest.findMany({
        where: { tenantId: actor.tenantId, status: pending as never },
        include: {
          student: {
            select: {
              firstNameEn: true,
              lastNameEn: true,
              class: { select: { name: true } },
              sectionRef: { select: { name: true } },
            },
          },
        },
        orderBy: { requestedAt: 'desc' },
        take: 20,
      }),
      this.prisma.financeApprovalRequest.findMany({
        where: { tenantId: actor.tenantId, status: pending as never },
        include: {
          payment: {
            select: {
              amount: true,
              student: {
                select: { firstNameEn: true, lastNameEn: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.reportCardCorrectionRequest.findMany({
        where: { tenantId: actor.tenantId, status: pending },
        include: {
          reportCard: {
            select: {
              class: { select: { name: true } },
              section: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.approvalRequest.findMany({
        where: { tenantId: actor.tenantId, status: pending as never },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      pending === 'PENDING'
        ? this.prisma.notice.findMany({
            where: {
              tenantId: actor.tenantId,
              publishedAt: null,
              priority: { in: ['URGENT', 'EMERGENCY'] as never },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          })
        : Promise.resolve([]),
    ]);

    const items: PrincipalItem[] = [
      ...leaveRequests.map((request) => ({
        id: request.id,
        type: 'leave',
        title: 'Leave Request',
        subtitle: staffName(request.staff),
        detail: `${decimalToNumber(request.days)} days leave`,
        status: request.status,
        severity: 'high' as Severity,
        timestamp: toIso(request.createdAt),
        owner: 'Principal',
        nextAction: 'Review leave request',
      })),
      ...attendanceCorrections.map((request) => ({
        id: request.id,
        type: 'attendance_correction',
        title: 'Attendance Correction',
        subtitle: classLabel(
          request.student.class?.name,
          request.student.sectionRef?.name,
        ),
        detail: request.reason,
        status: request.status,
        severity: 'medium' as Severity,
        timestamp: toIso(request.requestedAt),
        owner: 'Principal',
        nextAction: 'Review correction',
      })),
      ...financeApprovals.map((request) => ({
        id: request.id,
        type: 'finance',
        title: financeApprovalTitle(request.type),
        subtitle: studentName(request.payment.student),
        detail: formatNpr(
          decimalToNumber(request.amount ?? request.payment.amount),
        ),
        status: request.status,
        severity: 'medium' as Severity,
        timestamp: toIso(request.createdAt),
        owner: 'Principal',
        nextAction: 'Review finance request',
      })),
      ...reportCardCorrections.map((request) => ({
        id: request.id,
        type: 'report_card',
        title: 'Report-card Correction',
        subtitle: classLabel(
          request.reportCard.class?.name,
          request.reportCard.section?.name,
        ),
        detail: request.reason,
        status: request.status,
        severity: 'high' as Severity,
        timestamp: toIso(request.createdAt),
        owner: 'Principal',
        nextAction: 'Review publish blocker',
      })),
      ...workflowApprovals.map((request) => ({
        id: request.id,
        type: request.targetModule,
        title: request.title,
        subtitle: request.targetType,
        detail: request.reason,
        status: request.status,
        severity: (request.workflowType === 'EMERGENCY_HIGH_IMPACT_NOTICE'
          ? 'critical'
          : 'medium') as Severity,
        timestamp: toIso(request.createdAt),
        owner: 'Principal',
        nextAction: 'Review request',
      })),
      ...noticeDrafts.map((notice) => ({
        id: notice.id,
        type: 'notice',
        title: 'High-impact Notice Approval',
        subtitle: notice.title,
        detail: audienceLabel(notice.audienceType),
        status: 'PENDING',
        severity: (notice.priority === 'EMERGENCY'
          ? 'critical'
          : 'medium') as Severity,
        timestamp: toIso(notice.createdAt),
        owner: 'Principal',
        nextAction: 'Review notice',
        route: '/principal/notices',
      })),
    ].sort(compareAttention);

    return {
      tabs: ['pending', 'approved', 'rejected'],
      activeTab: status.toLowerCase(),
      summary: {
        pending: await this.countAllPendingApprovals(actor.tenantId),
        urgent: items.filter((item) => item.severity === 'critical').length,
        today: countToday(items),
      },
      items,
      lastUpdated: nowIso(),
    };
  }

  async getAttendanceSummary(actor: AuthContext, dateInput?: string) {
    this.assertPrincipal(actor);
    const date = parseDate(dateInput);
    const { start, end } = dayBounds(date);
    const [classes, sections, sessions, pendingCorrections, absences] =
      await Promise.all([
        this.prisma.class.findMany({
          where: { tenantId: actor.tenantId },
          select: { id: true, name: true },
          orderBy: { level: 'asc' },
        }),
        this.prisma.section.findMany({
          where: { tenantId: actor.tenantId },
          select: {
            id: true,
            name: true,
            classId: true,
            class: { select: { name: true } },
          },
          orderBy: { name: 'asc' },
        }),
        this.prisma.attendanceSession.findMany({
          where: {
            tenantId: actor.tenantId,
            attendanceDate: { gte: start, lt: end },
          },
          select: { classId: true, sectionId: true, records: true },
        }),
        this.prisma.attendanceCorrectionRequest.count({
          where: { tenantId: actor.tenantId, status: 'PENDING' },
        }),
        this.prisma.attendanceRecord.findMany({
          where: {
            tenantId: actor.tenantId,
            status: { in: ['ABSENT', 'LATE'] as never },
            attendanceSession: {
              attendanceDate: { gte: daysAgo(30), lt: end },
            },
          },
          include: {
            student: {
              select: {
                id: true,
                firstNameEn: true,
                lastNameEn: true,
                class: { select: { name: true } },
                sectionRef: { select: { name: true } },
              },
            },
            attendanceSession: {
              select: { attendanceDate: true, classId: true, sectionId: true },
            },
          },
          take: 500,
        }),
      ]);

    const classSections = sections.length
      ? sections.map((section) => ({
          classId: section.classId,
          sectionId: section.id,
          label: classLabel(section.class.name, section.name),
        }))
      : classes.map((klass) => ({
          classId: klass.id,
          sectionId: null,
          label: klass.name,
        }));
    const markedKeys = new Set(
      sessions.map((session) => sectionKey(session.classId, session.sectionId)),
    );
    const missing = classSections.filter(
      (row) => !markedKeys.has(sectionKey(row.classId, row.sectionId)),
    );
    const absenceCounts = new Map<string, number>();
    for (const record of absences) {
      absenceCounts.set(
        record.studentId,
        (absenceCounts.get(record.studentId) ?? 0) + 1,
      );
    }
    const repeated = [...absenceCounts.entries()].filter(
      ([, count]) => count >= 3,
    );
    const studentFollowUps = absences
      .filter((record) => (absenceCounts.get(record.studentId) ?? 0) >= 3)
      .slice(0, 6)
      .map((record) => ({
        id: record.student.id,
        name: studentName(record.student),
        context: classLabel(
          record.student.class?.name,
          record.student.sectionRef?.name,
        ),
        status: record.status,
        detail:
          record.status === 'LATE'
            ? 'Marked late recently'
            : `${absenceCounts.get(record.studentId) ?? 0} absence records`,
      }));

    return {
      date: dateLabel(date),
      metrics: {
        classesNotMarked: missing.length,
        repeatedAbsence: repeated.length,
        lateFollowUp: pendingCorrections,
      },
      classRisk: [
        ...missing.slice(0, 8).map((row) => ({
          id: sectionKey(row.classId, row.sectionId),
          title: row.label,
          subtitle: 'Attendance not submitted',
          detail: 'No attendance recorded today',
          severity: 'critical' as Severity,
        })),
      ],
      studentFollowUps,
      correctionQueue: {
        count: pendingCorrections,
        route: '/principal/approvals',
      },
      lastUpdated: nowIso(),
    };
  }

  async getStaffAbsence(actor: AuthContext, dateInput?: string) {
    this.assertPrincipal(actor);
    const date = parseDate(dateInput);
    const { start, end } = dayBounds(date);
    const [attendance, leaveRequests, substitutions] = await Promise.all([
      this.prisma.staffAttendance.findMany({
        where: {
          tenantId: actor.tenantId,
          attendanceDate: { gte: start, lt: end },
          NOT: { status: 'PRESENT' as never },
        },
        include: { staff: { select: safeStaffSelect } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.staffLeaveRequest.findMany({
        where: {
          tenantId: actor.tenantId,
          status: { in: ['PENDING', 'APPROVED'] as never },
          startsOn: { lte: end },
          endsOn: { gte: start },
        },
        include: { staff: { select: safeStaffSelect } },
        orderBy: { startsOn: 'asc' },
        take: 20,
      }),
      this.prisma.timetableSubstitution.findMany({
        where: {
          tenantId: actor.tenantId,
          date: { gte: start, lt: end },
        },
        include: {
          absentTeacher: { select: safeStaffSelect },
          substituteTeacher: { select: safeStaffSelect },
          timetableSlot: {
            select: {
              class: { select: { name: true } },
              section: { select: { name: true } },
              subject: { select: { name: true } },
              period: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const absenceItems: PrincipalItem[] = [
      ...attendance.map((row) => ({
        id: row.id,
        type: 'staff_absence',
        title: staffName(row.staff),
        subtitle: row.note ?? row.leaveType ?? 'Staff attendance',
        status: row.status,
        severity: (row.status === 'ABSENT' ? 'high' : 'medium') as Severity,
        timestamp: toIso(row.createdAt),
        nextAction: 'Review staff coverage',
      })),
      ...leaveRequests.map((row) => ({
        id: row.id,
        type: 'staff_leave',
        title: staffName(row.staff),
        subtitle: `${row.leaveType} leave`,
        detail: `${decimalToNumber(row.days)} days`,
        status: row.status,
        severity: (row.status === 'PENDING' ? 'high' : 'medium') as Severity,
        timestamp: toIso(row.createdAt),
        nextAction: 'Review leave coverage',
      })),
    ];
    const uncovered = substitutions.filter(
      (row) => row.status !== 'ASSIGNED' && row.status !== 'COMPLETED',
    );

    return {
      date: dateLabel(date),
      tabs: ['staff_absence', 'coverage'],
      metrics: {
        absentToday: absenceItems.length,
        uncoveredPeriods: uncovered.length,
        substitutionsAssigned: substitutions.length - uncovered.length,
      },
      absenceItems,
      coverageItems: substitutions.map((row) => ({
        id: row.id,
        type: 'coverage',
        title:
          row.timetableSlot?.subject?.name ??
          row.timetableSlot?.period?.name ??
          'Coverage period',
        subtitle: classLabel(
          row.timetableSlot?.class?.name,
          row.timetableSlot?.section?.name,
        ),
        detail: row.substituteTeacher
          ? `Covered by ${staffName(row.substituteTeacher)}`
          : 'No substitute assigned',
        status: row.status,
        severity:
          row.status === 'ASSIGNED' || row.status === 'COMPLETED'
            ? 'low'
            : 'high',
        nextAction: 'Review staff coverage',
      })),
      lastUpdated: nowIso(),
    };
  }

  async getFeesSummary(actor: AuthContext) {
    this.assertPrincipal(actor);
    const { start, end } = dayBounds(new Date());
    const [
      payments,
      overdueInvoices,
      financeApprovals,
      cashierClose,
      paidStudents,
    ] = await Promise.all([
      this.prisma.payment.aggregate({
        where: {
          tenantId: actor.tenantId,
          status: 'SUCCESS',
          paidAt: { gte: start, lt: end },
          reversedAt: null,
        },
        _sum: { amount: true },
      }),
      this.prisma.invoice.findMany({
        where: {
          tenantId: actor.tenantId,
          dueDate: { lt: start },
          status: { notIn: ['PAID', 'VOID'] as never },
        },
        include: {
          student: {
            select: {
              firstNameEn: true,
              lastNameEn: true,
              class: { select: { name: true } },
            },
          },
        },
        orderBy: { dueDate: 'asc' },
        take: 20,
      }),
      this.prisma.financeApprovalRequest.findMany({
        where: { tenantId: actor.tenantId, status: 'PENDING' },
        include: {
          payment: {
            select: {
              amount: true,
              student: { select: { firstNameEn: true, lastNameEn: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.cashierClose.findFirst({
        where: {
          tenantId: actor.tenantId,
          openedAt: { gte: start, lt: end },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.groupBy({
        by: ['studentId'],
        where: {
          tenantId: actor.tenantId,
          status: 'SUCCESS',
          paidAt: { gte: daysAgo(7), lt: end },
          reversedAt: null,
        },
      }),
    ]);
    const collectedToday = decimalToNumber(payments._sum.amount);
    const overdueTotal = overdueInvoices.reduce(
      (sum, row) => sum + decimalToNumber(row.totalAmount),
      0,
    );

    return {
      metrics: {
        collectedToday,
        collectedTodayFormatted: formatNpr(collectedToday),
        overdueFees: overdueTotal,
        overdueFeesFormatted: formatNpr(overdueTotal),
        pendingRefundApprovals: financeApprovals.length,
        cashierCloseStatus: cashierClose ? 'Closed' : 'Pending',
      },
      watchlist: [
        ...overdueInvoices.slice(0, 3).map((row) => ({
          id: row.id,
          type: 'overdue_fee',
          title: `${row.student.class?.name ?? 'Class'} overdue collection`,
          detail: formatNpr(decimalToNumber(row.totalAmount)),
          status: 'High',
          severity: 'high' as Severity,
        })),
        ...financeApprovals.slice(0, 3).map((row) => ({
          id: row.id,
          type: 'refund_approval',
          title: `${financeApprovalTitle(row.type)} - ${studentName(row.payment.student)}`,
          detail: formatNpr(decimalToNumber(row.amount ?? row.payment.amount)),
          status: 'Pending',
          severity: 'medium' as Severity,
        })),
        ...(cashierClose?.varianceAmount
          ? [
              {
                id: cashierClose.id,
                type: 'cashier_variance',
                title: 'Cashier close variance',
                detail: formatNpr(decimalToNumber(cashierClose.varianceAmount)),
                status: 'Medium',
                severity: 'medium' as Severity,
              },
            ]
          : []),
      ],
      collectionTrend: await this.collectionTrend(actor.tenantId),
      quickSnapshot: {
        paidStudents: paidStudents.length,
        dueThisWeek: await this.prisma.invoice.count({
          where: {
            tenantId: actor.tenantId,
            dueDate: { gte: start, lt: daysFromNow(7) },
            status: { notIn: ['PAID', 'VOID'] as never },
          },
        }),
      },
      readOnly: true,
      lastUpdated: nowIso(),
    };
  }

  async getAcademicsReadiness(actor: AuthContext) {
    this.assertPrincipal(actor);
    const [components, marks, reportCardsReady, reportCardBlockers, classes] =
      await Promise.all([
        this.prisma.assessmentComponent.count({
          where: { tenantId: actor.tenantId },
        }),
        this.prisma.markEntry.count({ where: { tenantId: actor.tenantId } }),
        this.prisma.reportCard.count({
          where: {
            tenantId: actor.tenantId,
            isCurrent: true,
            publishStatus: { in: ['READY', 'PUBLISHED'] },
          },
        }),
        this.prisma.reportCardCorrectionRequest.count({
          where: { tenantId: actor.tenantId, status: 'PENDING' },
        }),
        this.prisma.class.findMany({
          where: { tenantId: actor.tenantId },
          select: {
            id: true,
            name: true,
            _count: { select: { students: true, reportCards: true } },
          },
          orderBy: { level: 'asc' },
          take: 8,
        }),
      ]);
    const readiness =
      components > 0
        ? Math.min(100, Math.round((marks / components) * 100))
        : 0;

    return {
      metrics: {
        pendingMarks: Math.max(0, components - marks),
        publishBlockers: reportCardBlockers,
        reportCardsReady,
        examReadinessPercent: readiness,
      },
      marksEntryStatus: classes.map((klass) => {
        const total = Math.max(klass._count.students, 1);
        const percent = Math.min(
          100,
          Math.round((klass._count.reportCards / total) * 100),
        );
        return {
          id: klass.id,
          title: klass.name,
          percent,
          status:
            percent >= 90
              ? 'Nearly complete'
              : percent >= 50
                ? 'In progress'
                : 'Partial',
        };
      }),
      reportCardReadiness: await this.academicsAttention(actor),
      lastUpdated: nowIso(),
    };
  }

  async getTransportAlerts(actor: AuthContext) {
    this.assertPrincipal(actor);
    const { start, end } = dayBounds(new Date());
    const [activeRoutes, delayedTrips, completedTrips, trips, stalePingTrips] =
      await Promise.all([
        this.prisma.transportRoute.count({
          where: { tenantId: actor.tenantId, isActive: true },
        }),
        this.prisma.transportTrip.count({
          where: {
            tenantId: actor.tenantId,
            status: 'ACTIVE',
            isDelayed: true,
            startedAt: { gte: start, lt: end },
          },
        }),
        this.prisma.transportTrip.count({
          where: {
            tenantId: actor.tenantId,
            status: 'COMPLETED',
            completedAt: { gte: start, lt: end },
          },
        }),
        this.prisma.transportTrip.findMany({
          where: {
            tenantId: actor.tenantId,
            startedAt: { gte: start, lt: end },
          },
          include: {
            route: { select: { name: true } },
            studentStatuses: { select: { studentId: true } },
            locationPings: {
              select: { recordedAt: true },
              orderBy: { recordedAt: 'desc' },
              take: 1,
            },
            driverAssignment: {
              select: { staff: { select: safeStaffSelect } },
            },
          },
          orderBy: { startedAt: 'desc' },
          take: 20,
        }),
        this.prisma.transportTrip.findMany({
          where: {
            tenantId: actor.tenantId,
            status: 'ACTIVE',
            startedAt: { gte: start, lt: end },
            locationPings: { none: { recordedAt: { gte: minutesAgo(10) } } },
          },
          select: { id: true },
        }),
      ]);

    return {
      metrics: {
        activeRoutes,
        delays: delayedTrips,
        staleGps: stalePingTrips.length,
        completedTrips,
      },
      routes: trips.map((trip) => {
        const lastPing = trip.locationPings[0]?.recordedAt;
        const stale =
          trip.status === 'ACTIVE' && (!lastPing || lastPing < minutesAgo(10));
        return {
          id: trip.id,
          title: `${trip.route.name}${trip.isDelayed ? ` - ${trip.delayMinutes ?? 0} min late` : ''}`,
          subtitle: `${trip.studentStatuses.length} students`,
          status: trip.isDelayed
            ? 'Delayed'
            : stale
              ? 'GPS stale'
              : trip.status === 'COMPLETED'
                ? 'Completed'
                : 'On time',
          severity: trip.isDelayed || stale ? 'high' : 'low',
        };
      }),
      driverContacts: trips.slice(0, 6).map((trip) => ({
        id: trip.id,
        name: staffName(trip.driverAssignment.staff),
        context: trip.route.name,
        action: 'Call school office',
      })),
      lastUpdated: nowIso(),
    };
  }

  async getEscalations(actor: AuthContext, status = 'open') {
    this.assertPrincipal(actor);
    const statusKey = status.toUpperCase();
    const whereStatus =
      statusKey === 'ASSIGNED'
        ? { escalatedToUserId: actor.userId }
        : {
            status: (statusKey === 'RESOLVED' ? 'RESOLVED' : 'OPEN') as never,
          };
    const escalations = await this.prisma.chatEscalation.findMany({
      where: {
        tenantId: actor.tenantId,
        ...whereStatus,
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    const items = escalations.map((row) => ({
      id: row.id,
      type: 'escalation',
      title: 'Parent concern or school escalation',
      subtitle: 'Escalation context is restricted on mobile',
      detail: row.reason,
      status: row.status,
      severity: (row.status === 'OPEN' ? 'high' : 'low') as Severity,
      timestamp: toIso(row.createdAt),
      owner: row.escalatedToUserId ? 'Assigned owner' : 'Unassigned',
      nextAction: 'Review escalation',
    }));
    return {
      tabs: ['open', 'assigned', 'resolved'],
      activeTab: status.toLowerCase(),
      metrics: {
        critical: items.filter((item) => item.severity === 'high').length,
        dueToday: countToday(items),
        pendingResponse: items.filter((item) => item.status !== 'RESOLVED')
          .length,
      },
      items,
      lastUpdated: nowIso(),
    };
  }

  async searchStudents(
    actor: AuthContext,
    params: { query?: string; classId?: string; sectionId?: string },
  ) {
    this.assertPrincipal(actor);
    const query = params.query?.trim();
    const students = await this.prisma.student.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(params.classId ? { classId: params.classId } : {}),
        ...(params.sectionId ? { sectionId: params.sectionId } : {}),
        ...(query
          ? {
              OR: [
                { firstNameEn: { contains: query, mode: 'insensitive' } },
                { lastNameEn: { contains: query, mode: 'insensitive' } },
                { admissionNumber: { contains: query, mode: 'insensitive' } },
                {
                  guardianLinks: {
                    some: {
                      guardian: {
                        OR: [
                          {
                            primaryPhone: {
                              contains: query,
                              mode: 'insensitive',
                            },
                          },
                          {
                            fullName: { contains: query, mode: 'insensitive' },
                          },
                        ],
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        class: { select: { name: true } },
        sectionRef: { select: { name: true } },
        guardianLinks: {
          where: { isPrimary: true },
          include: {
            guardian: { select: { fullName: true, primaryPhone: true } },
          },
          take: 1,
        },
        attendanceRecords: {
          select: { status: true },
          orderBy: { createdAt: 'desc' },
          take: 30,
        },
        invoices: {
          where: { status: { notIn: ['PAID', 'VOID'] as never } },
          select: { status: true, dueDate: true },
          take: 5,
        },
      },
      orderBy: [{ firstNameEn: 'asc' }, { lastNameEn: 'asc' }],
      take: 20,
    });
    const recentAdmissions = await this.prisma.student.count({
      where: {
        tenantId: actor.tenantId,
        admissionDate: { gte: daysAgo(7) },
      },
    });
    return {
      query: query ?? '',
      filters: {
        classId: params.classId ?? null,
        sectionId: params.sectionId ?? null,
      },
      items: students.map((student) => {
        const present = student.attendanceRecords.filter(
          (record) => record.status === 'PRESENT',
        ).length;
        const total = student.attendanceRecords.length;
        const overdue = student.invoices.some(
          (invoice) => invoice.dueDate < new Date(),
        );
        return {
          id: student.id,
          name: studentName(student),
          classLabel: classLabel(student.class?.name, student.sectionRef?.name),
          guardianName: student.guardianLinks[0]?.guardian.fullName ?? null,
          guardianPhoneAllowed: true,
          guardianPhone:
            student.guardianLinks[0]?.guardian.primaryPhone ?? null,
          attendanceSummary:
            total > 0
              ? `${Math.round((present / total) * 100)}%`
              : 'No recent records',
          feeRisk: overdue
            ? 'Caution'
            : student.invoices.length > 0
              ? 'Neutral'
              : 'Clear',
        };
      }),
      recentAdmissions,
      lastUpdated: nowIso(),
    };
  }

  async getReportsSnapshot(actor: AuthContext) {
    this.assertPrincipal(actor);
    const attendance = await this.getAttendanceSummary(actor);
    const fees = await this.getFeesSummary(actor);
    const academics = await this.getAcademicsReadiness(actor);
    const noticeRead = await this.noticeReadPercent(actor.tenantId);

    return {
      metrics: [
        {
          key: 'attendance',
          label: 'Attendance',
          value: `${Math.max(0, 100 - attendance.metrics.classesNotMarked * 5)}%`,
          status: 'School snapshot',
        },
        {
          key: 'collection',
          label: 'Collection',
          value: fees.metrics.collectedTodayFormatted,
          status: 'Today',
        },
        {
          key: 'marks',
          label: 'Marks Complete',
          value: `${academics.metrics.examReadinessPercent}%`,
          status: 'Academic readiness',
        },
        {
          key: 'noticeRead',
          label: 'Notice Read',
          value: `${noticeRead}%`,
          status: 'Latest notices',
        },
      ],
      coreReports: [
        reportRow(
          'attendance',
          'Attendance summary',
          'Daily and monthly attendance overview',
          attendance.lastUpdated,
          'Up to date',
        ),
        reportRow(
          'fees',
          'Fees collection summary',
          'Collections, dues, and trend overview',
          fees.lastUpdated,
          'Up to date',
        ),
        reportRow(
          'academics',
          'Academic readiness',
          'Syllabus coverage and evaluation status',
          academics.lastUpdated,
          'In progress',
        ),
        reportRow(
          'transport',
          'Transport status',
          'Routes, delays, and fleet overview',
          nowIso(),
          'Attention',
        ),
      ],
      protectedExports: [
        protectedExport(
          'monthly_report_pdf',
          'Monthly report PDF',
          'Comprehensive monthly report (PDF)',
        ),
        protectedExport(
          'collection_report',
          'Collection report',
          'Detailed collections report',
        ),
        protectedExport(
          'academic_summary',
          'Academic summary',
          'Academic performance summary',
        ),
      ],
      lastUpdated: nowIso(),
    };
  }

  async getTasks(actor: AuthContext, tab = 'my') {
    this.assertPrincipal(actor);
    const approvals = await this.getApprovals(
      actor,
      tab === 'completed' ? 'APPROVED' : 'PENDING',
    );
    const attention = await this.getAttention(
      actor,
      tab === 'assigned' ? 'assigned' : 'all',
    );
    const taskItems = [
      ...attention.items.slice(0, 8).map((item) => ({
        id: `attention:${item.id}`,
        title: item.nextAction ?? item.title,
        source: item.title,
        owner: item.owner ?? 'School team',
        dueLabel:
          item.severity === 'critical' || item.severity === 'high'
            ? 'Due today'
            : 'Due soon',
        priority: item.severity ?? 'medium',
        status: 'OPEN',
        createSupported: false,
      })),
      ...approvals.items.slice(0, 6).map((item) => ({
        id: `approval:${item.id}`,
        title: item.nextAction ?? item.title,
        source: item.title,
        owner: 'Principal',
        dueLabel: 'Due today',
        priority: item.severity ?? 'medium',
        status: item.status ?? 'PENDING',
        createSupported: false,
      })),
    ];
    return {
      tabs: ['my', 'assigned', 'completed'],
      activeTab: tab,
      metrics: {
        dueToday: taskItems.filter((item) => item.dueLabel === 'Due today')
          .length,
        overdue: taskItems.filter((item) => item.priority === 'critical')
          .length,
        completed: tab === 'completed' ? taskItems.length : 0,
      },
      items: tab === 'completed' ? [] : taskItems,
      createTask: {
        supported: false,
        message:
          'Follow-up task creation needs a principal-safe backend task workflow.',
      },
      lastUpdated: nowIso(),
    };
  }

  async getClassroomWalkthroughs(actor: AuthContext) {
    this.assertPrincipal(actor);
    const todaySlots = await this.prisma.timetableSlot.findMany({
      where: { tenantId: actor.tenantId },
      include: {
        class: { select: { name: true } },
        section: { select: { name: true } },
        subject: { select: { name: true } },
        staff: { select: safeStaffSelect },
        period: { select: { name: true, startsAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });
    return {
      metrics: {
        scheduled: todaySlots.length,
        completed: 0,
        followUp: 0,
      },
      todaysWalkthroughs: todaySlots.map((slot) => ({
        id: slot.id,
        title: `${classLabel(slot.class?.name, slot.section?.name)} - ${slot.subject?.name ?? 'Classroom visit'}`,
        subtitle: staffName(slot.staff),
        detail: slot.period?.name ?? 'Scheduled period',
        status: 'Scheduled',
      })),
      recentObservations: [],
      newObservation: {
        supported: false,
        message:
          'New classroom observations need an audited walkthrough endpoint before mobile writes are enabled.',
      },
      lastUpdated: nowIso(),
    };
  }

  async getEmergencyNotice(actor: AuthContext) {
    this.assertPrincipal(actor);
    const notice = await this.prisma.notice.findFirst({
      where: {
        tenantId: actor.tenantId,
        priority: { in: ['URGENT', 'EMERGENCY'] as never },
        publishedAt: null,
      },
      include: {
        deliveries: {
          select: {
            channel: true,
            status: true,
            recipientUserId: true,
            guardianId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!notice) {
      return {
        status: 'empty',
        message: 'There is no high-impact notice awaiting principal review.',
        actions: {
          approveAndSend: false,
          saveDraft: false,
          editAudience: false,
        },
        lastUpdated: nowIso(),
      };
    }
    const recipientCount = new Set(
      notice.deliveries.map(
        (delivery) =>
          delivery.recipientUserId ?? delivery.guardianId ?? delivery.channel,
      ),
    ).size;
    const failed = notice.deliveries.filter(
      (delivery) => delivery.status === 'FAILED',
    ).length;
    return {
      status: 'draft',
      id: notice.id,
      noticeType: notice.priority,
      audience: audienceLabel(notice.audienceType),
      priority: notice.priority,
      channels: [
        ...new Set(notice.deliveries.map((delivery) => delivery.channel)),
      ],
      subject: notice.title,
      messagePreview: notice.body,
      recipients: {
        total: recipientCount,
        parents: notice.deliveries.filter((delivery) => delivery.guardianId)
          .length,
        staff: notice.deliveries.filter((delivery) => delivery.recipientUserId)
          .length,
      },
      deliveryReadiness: {
        app: failed === 0,
        sms: failed === 0,
        email: failed === 0,
        message:
          failed > 0
            ? 'Some deliveries failed readiness checks.'
            : 'Delivery readiness is based on backend delivery records.',
      },
      actions: {
        approveAndSend: false,
        saveDraft: false,
        editAudience: false,
        message:
          'Mobile send is disabled until a high-impact notice approval endpoint is confirmed.',
      },
      lastUpdated: nowIso(),
    };
  }

  private async getModules(tenantId: string) {
    const entitlements =
      await this.entitlementsService.getEntitlements(tenantId);
    const enabled = new Set(entitlements.modules);
    return {
      students: enabled.has('students'),
      attendance: enabled.has('attendance'),
      fees: enabled.has('fees'),
      exams: enabled.has('exams'),
      hr: enabled.has('hr'),
      transport: enabled.has('transport'),
      canteen: enabled.has('canteen'),
      library: enabled.has('library'),
      notices: enabled.has('notices'),
      reports: true,
      tasks: true,
      classroomWalkthroughs: enabled.has('exams'),
    };
  }

  private async getTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { id: true, name: true, isActive: true },
    });
    if (!tenant.isActive) {
      throw new ForbiddenException('This school is not active.');
    }
    return tenant;
  }

  private assertPrincipal(actor: AuthContext) {
    if (
      !actor.roles.some((role) =>
        ['principal', 'admin', 'platform_super_admin'].includes(role),
      )
    ) {
      throw new ForbiddenException(
        'You do not have permission to view principal mobile information.',
      );
    }
  }

  private async countAllPendingApprovals(tenantId: string) {
    const [leave, attendance, finance, reportCard, workflow, notices] =
      await Promise.all([
        this.prisma.staffLeaveRequest.count({
          where: { tenantId, status: 'PENDING' },
        }),
        this.prisma.attendanceCorrectionRequest.count({
          where: { tenantId, status: 'PENDING' },
        }),
        this.prisma.financeApprovalRequest.count({
          where: { tenantId, status: 'PENDING' },
        }),
        this.prisma.reportCardCorrectionRequest.count({
          where: { tenantId, status: 'PENDING' },
        }),
        this.prisma.approvalRequest.count({
          where: { tenantId, status: 'PENDING' },
        }),
        this.prisma.notice.count({
          where: {
            tenantId,
            publishedAt: null,
            priority: { in: ['URGENT', 'EMERGENCY'] as never },
          },
        }),
      ]);
    return leave + attendance + finance + reportCard + workflow + notices;
  }

  private async attendanceAttention(
    actor: AuthContext,
  ): Promise<PrincipalItem[]> {
    const summary = await this.getAttendanceSummary(actor);
    return [
      ...summary.classRisk.slice(0, 5).map((item) => ({
        id: item.id,
        type: 'attendance',
        title: `${item.title} attendance`,
        subtitle: item.detail,
        severity: item.severity,
        nextAction: 'Open attendance risk',
        timestamp: nowIso(),
        route: '/principal/attendance-risk',
      })),
      ...(summary.metrics.lateFollowUp > 0
        ? [
            {
              id: 'attendance-corrections',
              type: 'attendance_correction',
              title: 'Attendance corrections awaiting review',
              subtitle: `${summary.metrics.lateFollowUp} requests`,
              severity: 'medium' as Severity,
              nextAction: 'Open correction queue',
              timestamp: nowIso(),
              route: '/principal/approvals',
            },
          ]
        : []),
    ];
  }

  private async staffAttention(actor: AuthContext): Promise<PrincipalItem[]> {
    const staff = await this.getStaffAbsence(actor);
    return [
      ...staff.coverageItems
        .filter((item) => item.severity === 'high')
        .map((item) => ({
          id: item.id,
          type: 'staff_coverage',
          title: item.title,
          subtitle: item.detail,
          severity: 'high' as Severity,
          nextAction: 'Review staff coverage',
          timestamp: nowIso(),
          route: '/principal/staff-absence',
        })),
    ];
  }

  private async transportAttention(
    actor: AuthContext,
  ): Promise<PrincipalItem[]> {
    const transport = await this.getTransportAlerts(actor);
    return transport.routes
      .filter((route) => route.severity === 'high')
      .map((route) => ({
        id: route.id,
        type: 'transport',
        title: route.title,
        subtitle: route.status,
        severity: 'high' as Severity,
        nextAction: 'Review transport status',
        timestamp: nowIso(),
        route: '/principal/transport-alerts',
      }));
  }

  private async noticeAttention(actor: AuthContext): Promise<PrincipalItem[]> {
    const notice = await this.getEmergencyNotice(actor);
    return notice.status === 'draft'
      ? [
          {
            id: String(notice.id),
            type: 'notice',
            title: 'High-impact notice awaiting approval',
            subtitle: notice.subject,
            severity: (notice.priority === 'EMERGENCY'
              ? 'critical'
              : 'medium') as Severity,
            nextAction: 'Review emergency notice',
            timestamp: nowIso(),
            route: '/principal/notices',
          },
        ]
      : [];
  }

  private async feeAttention(actor: AuthContext): Promise<PrincipalItem[]> {
    const fees = await this.getFeesSummary(actor);
    return fees.watchlist.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      subtitle: item.detail,
      severity: item.severity as Severity,
      nextAction: 'Review fees snapshot',
      timestamp: nowIso(),
      route: '/principal/fees-snapshot',
    }));
  }

  private async escalationAttention(
    actor: AuthContext,
  ): Promise<PrincipalItem[]> {
    const escalations = await this.getEscalations(actor, 'open');
    return escalations.items.map((item) => ({
      ...item,
      severity: item.severity as Severity,
      route: '/principal/escalations',
    }));
  }

  private async academicsAttention(
    actor: AuthContext,
  ): Promise<PrincipalItem[]> {
    const blockers = await this.prisma.reportCardCorrectionRequest.findMany({
      where: { tenantId: actor.tenantId, status: 'PENDING' },
      include: {
        reportCard: {
          select: {
            class: { select: { name: true } },
            section: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });
    return blockers.map((row) => ({
      id: row.id,
      type: 'academics',
      title: 'Report-card publish blocker',
      subtitle: classLabel(
        row.reportCard.class?.name,
        row.reportCard.section?.name,
      ),
      detail: row.reason,
      severity: 'high' as Severity,
      timestamp: toIso(row.createdAt),
      nextAction: 'Review publish blockers',
      route: '/principal/academics-readiness',
    }));
  }

  private async getRecentUpdates(actor: AuthContext): Promise<PrincipalItem[]> {
    const [reportCards, students] = await Promise.all([
      this.prisma.reportCard.count({
        where: {
          tenantId: actor.tenantId,
          publishStatus: { in: ['READY', 'PUBLISHED'] },
        },
      }),
      this.prisma.student.count({
        where: {
          tenantId: actor.tenantId,
          admissionDate: { gte: daysAgo(7) },
        },
      }),
    ]);
    return [
      {
        id: 'report-cards-ready',
        type: 'academics',
        title: `${reportCards} report cards are ready for review`,
        subtitle: 'Academic Team',
        status: reportCards > 0 ? 'Completed' : 'No updates',
        timestamp: nowIso(),
      },
      {
        id: 'recent-admissions',
        type: 'students',
        title: `${students} new student admissions need document follow-up`,
        subtitle: 'Admission Office',
        status: students > 0 ? 'In progress' : 'No updates',
        timestamp: nowIso(),
      },
    ];
  }

  private async collectionTrend(tenantId: string) {
    const trend: Array<{ label: string; amount: number }> = [];
    for (let index = 5; index >= 0; index -= 1) {
      const date = daysAgo(index);
      const { start, end } = dayBounds(date);
      const total = await this.prisma.payment.aggregate({
        where: {
          tenantId,
          status: 'SUCCESS',
          reversedAt: null,
          paidAt: { gte: start, lt: end },
        },
        _sum: { amount: true },
      });
      trend.push({
        label: date.toLocaleDateString('en-US', { weekday: 'short' }),
        amount: decimalToNumber(total._sum.amount),
      });
    }
    return trend;
  }

  private async noticeReadPercent(tenantId: string) {
    const [deliveries, reads] = await Promise.all([
      this.prisma.notificationDelivery.count({ where: { tenantId } }),
      this.prisma.notificationReadReceipt.count({ where: { tenantId } }),
    ]);
    return deliveries > 0 ? Math.round((reads / deliveries) * 100) : 0;
  }
}

const safeStaffSelect = {
  id: true,
  firstName: true,
  lastName: true,
  designation: true,
  department: true,
};

function nowIso() {
  return new Date().toISOString();
}

function toIso(value?: Date | null) {
  return value ? value.toISOString() : null;
}

function parseDate(value?: string) {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function dayBounds(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function minutesAgo(minutes: number) {
  const date = new Date();
  date.setMinutes(date.getMinutes() - minutes);
  return date;
}

function decimalToNumber(value: unknown) {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value) || 0;
  if (typeof value === 'object' && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value) || 0;
}

function formatNpr(value: number) {
  return `NPR ${Math.round(value).toLocaleString('en-US')}`;
}

function studentName(student: {
  firstNameEn?: string | null;
  lastNameEn?: string | null;
}) {
  return [student.firstNameEn, student.lastNameEn]
    .filter(Boolean)
    .join(' ')
    .trim();
}

function staffName(staff: {
  firstName?: string | null;
  lastName?: string | null;
}) {
  return [staff.firstName, staff.lastName].filter(Boolean).join(' ').trim();
}

function classLabel(className?: string | null, sectionName?: string | null) {
  return [className, sectionName].filter(Boolean).join(' ');
}

function sectionKey(classId: string, sectionId?: string | null) {
  return `${classId}:${sectionId ?? 'none'}`;
}

function dateLabel(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dayLabel(date: Date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function compareAttention(left: PrincipalItem, right: PrincipalItem) {
  const severityOrder: Record<Severity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  const leftSeverity = severityOrder[left.severity ?? 'low'];
  const rightSeverity = severityOrder[right.severity ?? 'low'];
  if (leftSeverity !== rightSeverity) return leftSeverity - rightSeverity;
  return (
    new Date(right.timestamp ?? 0).getTime() -
    new Date(left.timestamp ?? 0).getTime()
  );
}

function countToday(items: Array<{ timestamp?: string | null }>) {
  const { start, end } = dayBounds(new Date());
  return items.filter((item) => {
    const date = item.timestamp ? new Date(item.timestamp) : null;
    return date != null && date >= start && date < end;
  }).length;
}

function financeApprovalTitle(type: string) {
  return type
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function audienceLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function reportRow(
  id: string,
  title: string,
  subtitle: string,
  updatedAt: string,
  status: string,
) {
  return { id, title, subtitle, updatedAt, status };
}

function protectedExport(id: string, title: string, subtitle: string) {
  return {
    id,
    title,
    subtitle,
    status: 'Unavailable until generated by backend reports',
    protected: true,
    downloadSupported: false,
  };
}
