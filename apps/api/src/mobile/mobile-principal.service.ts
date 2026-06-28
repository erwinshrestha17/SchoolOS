import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import {
  ApprovalDecisionType,
  ApprovalRequestStatus,
  ApprovalStepStatus,
  ApprovalWorkflowType,
  AudienceType,
  ChatEscalationStatus,
  NoticePriority,
  NotificationStatus,
  Prisma,
  UserStatus,
} from '@prisma/client';
import { FEATURE_KEYS } from '@schoolos/core';
import { ApprovalWorkflowService } from '../advanced-operations/approval-workflow.service';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from '../communications/communications.service';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { EntitlementsService } from '../plans/entitlements.service';
import { PrismaService } from '../prisma/prisma.service';
import { MobilePrincipalApprovalDecisionDto } from './dto/mobile-principal-approval.dto';
import {
  MobilePrincipalEscalationAssignmentDto,
  MobilePrincipalEscalationNoteDto,
  MobilePrincipalEscalationReopenDto,
  MobilePrincipalEscalationResolutionDto,
} from './dto/mobile-principal-escalation.dto';
import {
  MobilePrincipalEmergencyNoticePreviewDto,
  MobilePrincipalEmergencyNoticeSubmitDto,
} from './dto/mobile-principal-emergency-notice.dto';

type Severity = 'critical' | 'high' | 'medium' | 'low';

interface PrincipalMetric {
  key: string;
  label: string;
  value: number | string;
  detail?: string;
  tone?: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'slate';
  route?: string;
  locked?: boolean;
}

interface PrincipalItem {
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
}

interface PrincipalNoticeDraft {
  id: string;
  title: string;
  audienceType: AudienceType;
  priority: NoticePriority;
  createdAt: Date;
}

const MOBILE_APPROVAL_WORKFLOW_TYPES = [
  ApprovalWorkflowType.MARKS_CORRECTION,
  ApprovalWorkflowType.ATTENDANCE_CORRECTION,
  ApprovalWorkflowType.LEAVE_REQUEST,
  ApprovalWorkflowType.STUDENT_TRANSFER_WITHDRAWAL,
  ApprovalWorkflowType.EMERGENCY_HIGH_IMPACT_NOTICE,
] as const;

const HIGH_IMPACT_MOBILE_APPROVAL_TYPES = new Set<ApprovalWorkflowType>([
  ApprovalWorkflowType.STUDENT_TRANSFER_WITHDRAWAL,
  ApprovalWorkflowType.EMERGENCY_HIGH_IMPACT_NOTICE,
]);

const MOBILE_APPROVAL_TARGETS = {
  [ApprovalWorkflowType.MARKS_CORRECTION]: {
    targetModule: 'academics',
    targetType: 'mark_entry',
  },
  [ApprovalWorkflowType.ATTENDANCE_CORRECTION]: {
    targetModule: 'attendance',
    targetType: 'attendance_record',
  },
  [ApprovalWorkflowType.LEAVE_REQUEST]: {
    targetModule: 'hr',
    targetType: 'staff_leave_request',
  },
  [ApprovalWorkflowType.STUDENT_TRANSFER_WITHDRAWAL]: {
    targetModule: 'students',
    targetType: 'student',
  },
  [ApprovalWorkflowType.EMERGENCY_HIGH_IMPACT_NOTICE]: {
    targetModule: 'communications',
    targetType: 'notice',
  },
} as const;

const MOBILE_APPROVAL_TARGET_FILTERS = MOBILE_APPROVAL_WORKFLOW_TYPES.map(
  (workflowType) => ({
    workflowType,
    ...MOBILE_APPROVAL_TARGETS[workflowType],
  }),
);

@Injectable()
export class MobilePrincipalService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlementsService: EntitlementsService,
    private readonly approvalWorkflowService: ApprovalWorkflowService,
    private readonly auditService: AuditService,
    private readonly communicationsService: CommunicationsService,
    private readonly fileRegistryService: FileRegistryService,
  ) {}

  onModuleInit() {
    this.approvalWorkflowService.registerFinalAction(
      'communications.notice.publish_high_impact',
      {
        apply: async ({ tenantId, targetId, payload, actor }) => {
          if (tenantId !== actor.tenantId) {
            throw new ForbiddenException(
              'Approval action is outside the active tenant.',
            );
          }
          const finalActionPayload = asRecord(payload);
          return this.communicationsService.publishNotice(targetId, actor, {
            scheduledFor:
              typeof finalActionPayload.scheduledFor === 'string'
                ? finalActionPayload.scheduledFor
                : null,
          });
        },
      },
    );
  }

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
    const noticeDraftsPromise: Promise<PrincipalNoticeDraft[]> =
      pending === 'PENDING'
        ? this.prisma.notice.findMany({
            where: {
              tenantId: actor.tenantId,
              publishedAt: null,
              priority: {
                in: [NoticePriority.URGENT, NoticePriority.EMERGENCY],
              },
            },
            select: {
              id: true,
              title: true,
              audienceType: true,
              priority: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          })
        : Promise.resolve([]);

    const [
      leaveRequests,
      attendanceCorrections,
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
        where: {
          tenantId: actor.tenantId,
          status: pending as never,
          OR: [...MOBILE_APPROVAL_TARGET_FILTERS],
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      noticeDraftsPromise,
    ]);

    const approvalBackedNotices = noticeDrafts.length
      ? await this.prisma.approvalRequest.findMany({
          where: {
            tenantId: actor.tenantId,
            workflowType: ApprovalWorkflowType.EMERGENCY_HIGH_IMPACT_NOTICE,
            targetModule: 'communications',
            targetType: 'notice',
            targetId: { in: noticeDrafts.map((notice) => notice.id) },
          },
          select: { targetId: true },
          take: noticeDrafts.length,
        })
      : [];
    const approvalBackedNoticeIds = new Set(
      approvalBackedNotices.map((request) => request.targetId),
    );
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
        route: `/principal/approvals/${request.id}`,
      })),
      ...noticeDrafts
        .filter((notice) => !approvalBackedNoticeIds.has(notice.id))
        .map((notice) => ({
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

  async getApprovalDetail(actor: AuthContext, approvalRequestId: string) {
    this.assertPrincipal(actor);
    this.assertActorPermissions(actor, ['advanced:approvals:read']);
    const request = await this.prisma.approvalRequest.findFirst({
      where: {
        id: approvalRequestId,
        tenantId: actor.tenantId,
        OR: [...MOBILE_APPROVAL_TARGET_FILTERS],
      },
      include: {
        policy: {
          select: {
            id: true,
            name: true,
            description: true,
            isActive: true,
            minApprovals: true,
          },
        },
        requestedBy: {
          select: {
            id: true,
            email: true,
            staff: { select: safeStaffSelect },
            guardian: { select: { fullName: true } },
          },
        },
        steps: {
          orderBy: { sequence: 'asc' },
          select: {
            id: true,
            sequence: true,
            name: true,
            status: true,
            approverRole: true,
            approverPermission: true,
            decidedAt: true,
          },
        },
        decisions: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            decision: true,
            reason: true,
            createdAt: true,
            decidedBy: {
              select: {
                id: true,
                email: true,
                staff: { select: safeStaffSelect },
                guardian: { select: { fullName: true } },
              },
            },
          },
        },
        _count: {
          select: {
            attachments: true,
            comments: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException(
        'Approval request not found or is not available on mobile.',
      );
    }

    const pendingStep = request.steps.find(
      (step) => step.status === ApprovalStepStatus.PENDING,
    );
    const actorCanDecide =
      request.status === ApprovalRequestStatus.PENDING &&
      request.requestedById !== actor.userId &&
      Boolean(
        pendingStep && this.canActorDecideApprovalStep(pendingStep, actor),
      );
    const approvalActionAvailable =
      actorCanDecide &&
      this.approvalWorkflowService.hasFinalActionExecutor(
        request.finalActionKey,
      );

    return {
      id: request.id,
      requestType: request.workflowType,
      title: request.title,
      reason: request.reason,
      target: {
        module: request.targetModule,
        type: request.targetType,
      },
      requester: {
        id: request.requestedBy.id,
        name: mobileUserLabel(request.requestedBy),
      },
      supportingContext: sanitizeMobileContext(request.safeContext),
      policy: request.policy
        ? {
            id: request.policy.id,
            name: request.policy.name,
            description: request.policy.description,
            isActive: request.policy.isActive,
            minApprovals: request.policy.minApprovals,
          }
        : {
            id: null,
            name: 'Default approval policy',
            description: null,
            isActive: true,
            minApprovals: 1,
          },
      status: request.status,
      finalActionStatus: request.finalActionStatus,
      timestamps: {
        createdAt: toIso(request.createdAt),
        updatedAt: toIso(request.updatedAt),
        appliedAt: toIso(request.finalActionAppliedAt),
      },
      steps: request.steps.map((step) => ({
        sequence: step.sequence,
        name: step.name,
        status: step.status,
        decidedAt: toIso(step.decidedAt),
      })),
      history: [
        {
          id: `${request.id}:created`,
          action: 'REQUESTED',
          actor: mobileUserLabel(request.requestedBy),
          reason: request.reason,
          timestamp: toIso(request.createdAt),
        },
        ...request.decisions.map((decision) => ({
          id: decision.id,
          action: decision.decision,
          actor: mobileUserLabel(decision.decidedBy),
          reason: decision.reason,
          timestamp: toIso(decision.createdAt),
        })),
      ],
      attachmentCount: request._count.attachments,
      commentCount: request._count.comments,
      actions: {
        approve: approvalActionAvailable,
        reject: actorCanDecide,
        requiresApprovalReason: HIGH_IMPACT_MOBILE_APPROVAL_TYPES.has(
          request.workflowType,
        ),
        rejectionReasonRequired: true,
        unavailableReason:
          request.requestedById === actor.userId
            ? 'Requesters cannot decide their own approval request.'
            : !actorCanDecide
              ? 'No permitted pending approval step is available.'
              : approvalActionAvailable
                ? null
                : 'Approval is unavailable until the module final action is registered.',
      },
      lastUpdated: nowIso(),
    };
  }

  async decideApproval(
    actor: AuthContext,
    approvalRequestId: string,
    dto: MobilePrincipalApprovalDecisionDto,
  ) {
    this.assertPrincipal(actor);
    this.assertActorPermissions(actor, ['advanced:approvals:decide']);
    const replay = await this.prisma.approvalDecision.findFirst({
      where: {
        tenantId: actor.tenantId,
        idempotencyKey: dto.idempotencyKey,
      },
      select: { requestId: true },
    });
    if (replay) {
      if (replay.requestId !== approvalRequestId) {
        throw new ConflictException(
          'Approval decision idempotency key was already used.',
        );
      }
      return this.getApprovalDetail(actor, approvalRequestId);
    }
    const request = await this.prisma.approvalRequest.findFirst({
      where: {
        id: approvalRequestId,
        tenantId: actor.tenantId,
        OR: [...MOBILE_APPROVAL_TARGET_FILTERS],
      },
      select: {
        id: true,
        requestedById: true,
        workflowType: true,
        targetModule: true,
        targetType: true,
        finalActionKey: true,
        status: true,
        steps: {
          orderBy: { sequence: 'asc' },
          select: {
            id: true,
            status: true,
            approverRole: true,
            approverPermission: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException(
        'Approval request not found or is not available on mobile.',
      );
    }
    if (
      !isMobileApprovalTarget(
        request.workflowType,
        request.targetModule,
        request.targetType,
      )
    ) {
      throw new NotFoundException(
        'Approval request not found or is not available on mobile.',
      );
    }
    if (request.requestedById === actor.userId) {
      throw new ForbiddenException(
        'You cannot decide your own approval request.',
      );
    }
    if (request.status !== ApprovalRequestStatus.PENDING) {
      throw new ConflictException('Approval request is not reviewable.');
    }
    if (
      dto.decision === ApprovalDecisionType.APPROVE &&
      !this.approvalWorkflowService.hasFinalActionExecutor(
        request.finalActionKey,
      )
    ) {
      throw new ConflictException(
        'Approval is unavailable until the module final action is registered.',
      );
    }

    const reason = dto.reason?.trim();
    if (dto.decision === ApprovalDecisionType.REJECT && !reason) {
      throw new BadRequestException('Rejection reason is required.');
    }
    if (
      dto.decision === ApprovalDecisionType.APPROVE &&
      HIGH_IMPACT_MOBILE_APPROVAL_TYPES.has(request.workflowType) &&
      !reason
    ) {
      throw new BadRequestException(
        'An approval reason is required for this high-impact request.',
      );
    }

    const pendingStep = request.steps.find(
      (step) => step.status === ApprovalStepStatus.PENDING,
    );
    if (!pendingStep) {
      throw new ConflictException('No pending approval step remains.');
    }
    if (!this.canActorDecideApprovalStep(pendingStep, actor)) {
      throw new ForbiddenException(
        'You cannot decide the current approval step.',
      );
    }

    let result: Awaited<ReturnType<ApprovalWorkflowService['decide']>>;
    try {
      result = await this.approvalWorkflowService.decide(
        request.id,
        {
          decision: dto.decision,
          reason,
          context: { source: 'principal_mobile' },
          idempotencyKey: dto.idempotencyKey,
        },
        actor,
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return this.getApprovalDetail(actor, request.id);
      }
      throw error;
    }

    await this.auditService.record({
      action: 'principal_mobile_approval_decided',
      resource: 'approval_request',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: request.id,
      after: {
        decision: dto.decision,
        workflowType: request.workflowType,
        status: result.status,
      },
    });

    return this.getApprovalDetail(actor, request.id);
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
        ? {
            escalatedToUserId: actor.userId,
            status: {
              in: [ChatEscalationStatus.OPEN, ChatEscalationStatus.REOPENED],
            },
          }
        : {
            status:
              statusKey === 'RESOLVED'
                ? ChatEscalationStatus.RESOLVED
                : statusKey === 'REOPENED'
                  ? ChatEscalationStatus.REOPENED
                  : ChatEscalationStatus.OPEN,
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
      severity: (row.status === ChatEscalationStatus.RESOLVED
        ? 'low'
        : 'high') as Severity,
      timestamp: toIso(row.createdAt),
      owner:
        row.escalatedToUserId === actor.userId
          ? 'Assigned to me'
          : row.escalatedToUserId
            ? 'Assigned owner'
            : 'Unassigned',
      nextAction: 'Review escalation',
      route: `/principal/escalations/${row.id}`,
    }));
    return {
      tabs: ['open', 'assigned', 'resolved', 'reopened'],
      activeTab: status.toLowerCase(),
      metrics: {
        critical: items.filter((item) => item.severity === 'high').length,
        dueToday: countToday(items),
        pendingResponse: items.filter(
          (item) => item.status !== ChatEscalationStatus.RESOLVED,
        ).length,
      },
      items,
      lastUpdated: nowIso(),
    };
  }

  async getEscalationDetail(actor: AuthContext, escalationId: string) {
    this.assertPrincipal(actor);
    this.assertActorPermissions(actor, ['messaging:manage']);
    const escalation = await this.prisma.chatEscalation.findFirst({
      where: {
        id: escalationId,
        tenantId: actor.tenantId,
      },
    });
    if (!escalation) {
      throw new NotFoundException('Escalation not found in the active tenant.');
    }

    const [assignee, auditHistory] = await Promise.all([
      escalation.escalatedToUserId
        ? this.prisma.user.findFirst({
            where: {
              id: escalation.escalatedToUserId,
              tenantId: actor.tenantId,
            },
            select: {
              id: true,
              email: true,
              staff: { select: safeStaffSelect },
              guardian: { select: { fullName: true } },
            },
          })
        : Promise.resolve(null),
      this.prisma.auditLog.findMany({
        where: {
          tenantId: actor.tenantId,
          resource: 'chat_escalation',
          resourceId: escalation.id,
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          action: true,
          userId: true,
          createdAt: true,
        },
        take: 100,
      }),
    ]);
    const isResolved = escalation.status === ChatEscalationStatus.RESOLVED;

    return {
      id: escalation.id,
      status: escalation.status,
      reason: escalation.reason,
      resolutionNote: escalation.resolutionNote,
      assignment: assignee
        ? {
            userId: assignee.id,
            name: mobileUserLabel(assignee),
            assignedToMe: assignee.id === actor.userId,
            assignedAt: toIso(escalation.assignedAt),
          }
        : null,
      timestamps: {
        createdAt: toIso(escalation.createdAt),
        updatedAt: toIso(escalation.updatedAt),
        resolvedAt: toIso(escalation.resolvedAt),
        reopenedAt: toIso(escalation.reopenedAt),
      },
      history: [
        {
          id: `${escalation.id}:created`,
          action: 'ESCALATED',
          actorUserId: escalation.escalatedByUserId,
          timestamp: toIso(escalation.createdAt),
        },
        ...auditHistory.map((entry) => ({
          id: entry.id,
          action: entry.action,
          actorUserId: entry.userId,
          timestamp: toIso(entry.createdAt),
        })),
      ],
      actions: {
        assignToSelf: !isResolved,
        assignToStaff: !isResolved,
        addResolutionNote: !isResolved,
        resolve: !isResolved,
        reopen: isResolved,
        resolutionReasonRequired: true,
      },
      lastUpdated: nowIso(),
    };
  }

  async assignEscalationToSelf(actor: AuthContext, escalationId: string) {
    this.assertActorPermissions(actor, ['messaging:manage']);
    return this.assignPrincipalEscalation(
      actor,
      escalationId,
      actor.userId,
      'principal_mobile_escalation_assigned_to_self',
    );
  }

  async assignEscalation(
    actor: AuthContext,
    escalationId: string,
    dto: MobilePrincipalEscalationAssignmentDto,
  ) {
    this.assertPrincipal(actor);
    this.assertActorPermissions(actor, ['messaging:manage']);
    await this.assertPermittedEscalationAssignee(
      actor.tenantId,
      dto.assigneeUserId,
    );
    return this.assignPrincipalEscalation(
      actor,
      escalationId,
      dto.assigneeUserId,
      'principal_mobile_escalation_assigned',
    );
  }

  async addEscalationNote(
    actor: AuthContext,
    escalationId: string,
    dto: MobilePrincipalEscalationNoteDto,
  ) {
    this.assertPrincipal(actor);
    this.assertActorPermissions(actor, ['messaging:manage']);
    const note = dto.note.trim();
    if (!note) {
      throw new BadRequestException('Resolution note is required.');
    }
    await this.assertMutableEscalation(actor, escalationId);

    const updated = await this.prisma.chatEscalation.updateMany({
      where: {
        id: escalationId,
        tenantId: actor.tenantId,
        status: {
          in: [ChatEscalationStatus.OPEN, ChatEscalationStatus.REOPENED],
        },
      },
      data: { resolutionNote: note },
    });
    if (updated.count !== 1) {
      throw new ConflictException(
        'Resolved escalations are locked and cannot be edited.',
      );
    }

    await this.auditService.record({
      action: 'principal_mobile_escalation_note_added',
      resource: 'chat_escalation',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: escalationId,
      after: { note },
    });
    return this.getEscalationDetail(actor, escalationId);
  }

  async resolveEscalation(
    actor: AuthContext,
    escalationId: string,
    dto: MobilePrincipalEscalationResolutionDto,
  ) {
    this.assertPrincipal(actor);
    this.assertActorPermissions(actor, ['messaging:manage']);
    const reason = dto.resolutionReason.trim();
    if (!reason) {
      throw new BadRequestException('Resolution reason is required.');
    }
    await this.assertMutableEscalation(actor, escalationId);

    const resolvedAt = new Date();
    const updated = await this.prisma.chatEscalation.updateMany({
      where: {
        id: escalationId,
        tenantId: actor.tenantId,
        status: {
          in: [ChatEscalationStatus.OPEN, ChatEscalationStatus.REOPENED],
        },
      },
      data: {
        status: ChatEscalationStatus.RESOLVED,
        resolutionNote: reason,
        resolvedAt,
        resolvedByUserId: actor.userId,
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException('Escalation is already resolved.');
    }

    await this.auditService.record({
      action: 'principal_mobile_escalation_resolved',
      resource: 'chat_escalation',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: escalationId,
      after: {
        status: ChatEscalationStatus.RESOLVED,
        resolutionReason: reason,
      },
    });
    return this.getEscalationDetail(actor, escalationId);
  }

  async reopenEscalation(
    actor: AuthContext,
    escalationId: string,
    dto: MobilePrincipalEscalationReopenDto,
  ) {
    this.assertPrincipal(actor);
    this.assertActorPermissions(actor, ['messaging:manage']);
    const reason = dto.reason.trim();
    if (!reason) {
      throw new BadRequestException('Reopen reason is required.');
    }
    const escalation = await this.prisma.chatEscalation.findFirst({
      where: {
        id: escalationId,
        tenantId: actor.tenantId,
      },
      select: { id: true, status: true },
    });
    if (!escalation) {
      throw new NotFoundException('Escalation not found in the active tenant.');
    }
    if (escalation.status !== ChatEscalationStatus.RESOLVED) {
      throw new ConflictException('Only resolved escalations can be reopened.');
    }

    const reopenedAt = new Date();
    const updated = await this.prisma.chatEscalation.updateMany({
      where: {
        id: escalationId,
        tenantId: actor.tenantId,
        status: ChatEscalationStatus.RESOLVED,
      },
      data: {
        status: ChatEscalationStatus.REOPENED,
        resolvedAt: null,
        resolvedByUserId: null,
        reopenedAt,
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException(
        'Escalation state changed before it could be reopened.',
      );
    }

    await this.auditService.record({
      action: 'principal_mobile_escalation_reopened',
      resource: 'chat_escalation',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: escalationId,
      after: {
        status: ChatEscalationStatus.REOPENED,
        reason,
      },
    });
    return this.getEscalationDetail(actor, escalationId);
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
          guardianPhone: maskPhone(
            student.guardianLinks[0]?.guardian.primaryPhone ?? null,
          ),
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
    const [notice, providerDiagnostics] = await Promise.all([
      this.prisma.notice.findFirst({
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
      }),
      this.communicationsService.getCommunicationProviderDiagnostics(actor),
    ]);
    if (!notice) {
      return {
        status: 'empty',
        message: 'There is no high-impact notice awaiting principal review.',
        providerState: mobileProviderState(
          providerDiagnostics,
          NoticePriority.EMERGENCY,
        ),
        actions: {
          approveAndSend: false,
          compose: true,
          previewRecipients: true,
          submit: true,
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
    const providerState = mobileProviderState(
      providerDiagnostics,
      notice.priority,
    );
    const pushProvider = providerState.channels.find(
      (channel) => channel.channel === 'PUSH',
    );
    const smsProvider = providerState.channels.find(
      (channel) => channel.channel === 'SMS',
    );
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
        push: Boolean(pushProvider?.available),
        sms: Boolean(smsProvider?.available),
        liveDelivery: providerState.channels.some(
          (channel) => channel.liveDelivery,
        ),
        message:
          failed > 0
            ? 'Some deliveries failed readiness checks.'
            : providerState.availableChannelCount > 0
              ? 'Delivery readiness reflects backend provider modes. Mock and dev-log modes are not live delivery.'
              : 'No configured delivery channel is currently available.',
      },
      providerState,
      actions: {
        approveAndSend: false,
        compose: true,
        previewRecipients: true,
        submit: true,
        message:
          'Use the controlled emergency-notice workflow to preview recipients and submit.',
      },
      lastUpdated: nowIso(),
    };
  }

  async previewEmergencyNoticeRecipients(
    actor: AuthContext,
    dto: MobilePrincipalEmergencyNoticePreviewDto,
  ) {
    this.assertPrincipal(actor);
    this.assertActorPermissions(actor, [
      'notices:create',
      'advanced:approvals:manage',
    ]);
    await this.assertEmergencyNoticeEntitlements(actor.tenantId);
    this.validateEmergencyAudience(dto);

    const [preview, providerDiagnostics, approvalPolicy, settings] =
      await Promise.all([
        this.communicationsService.previewNoticeRecipients(
          {
            title: dto.title.trim(),
            body: dto.body.trim(),
            priority: dto.priority,
            audienceType: dto.audienceType,
            classId: dto.classId,
            sectionId: dto.sectionId,
          },
          actor,
        ),
        this.communicationsService.getCommunicationProviderDiagnostics(actor),
        this.getEmergencyApprovalPolicy(actor.tenantId),
        this.getEmergencyNoticeSettings(actor.tenantId),
      ]);
    const providerState = mobileProviderState(
      providerDiagnostics,
      dto.priority,
    );
    const approval = emergencyApprovalState({
      actor,
      priority: dto.priority,
      policy: approvalPolicy,
      requiresAdmin: settings.emergencyOverrideRequiresAdmin,
    });

    return {
      audience: {
        type: preview.audienceType,
        classId: preview.classId,
        sectionId: preview.sectionId,
      },
      recipients: {
        total: preview.recipientCount,
        eligible: preview.allowedRecipientCount,
        skipped: preview.skippedRecipientCount,
        estimatedDeliveries: preview.estimatedDeliveryRows,
      },
      channels: preview.channels,
      providerState,
      quietHours: {
        enabled: settings.quietHoursEnabled,
        emergencyBypass: dto.priority === NoticePriority.EMERGENCY,
        sendNowAllowed:
          !settings.quietHoursEnabled ||
          dto.priority === NoticePriority.EMERGENCY,
        scheduleAllowed:
          !settings.quietHoursEnabled ||
          dto.priority === NoticePriority.EMERGENCY,
      },
      approval,
      canSubmit:
        preview.allowedRecipientCount > 0 &&
        (!settings.quietHoursEnabled ||
          dto.priority === NoticePriority.EMERGENCY) &&
        (providerState.availableChannelCount > 0 || approval.required),
      lastUpdated: nowIso(),
    };
  }

  async submitEmergencyNotice(
    actor: AuthContext,
    dto: MobilePrincipalEmergencyNoticeSubmitDto,
  ) {
    this.assertPrincipal(actor);
    this.assertActorPermissions(actor, [
      'notices:create',
      'advanced:approvals:manage',
    ]);
    await this.assertEmergencyNoticeEntitlements(actor.tenantId);
    this.validateEmergencyAudience(dto);
    const scheduledFor = this.validateEmergencySchedule(dto);
    const reason = dto.reason?.trim();
    if (dto.priority === NoticePriority.EMERGENCY && !reason) {
      throw new BadRequestException(
        'A reason is required for an emergency notice.',
      );
    }

    const [recipientPreview, providerDiagnostics, approvalPolicy, settings] =
      await Promise.all([
        this.communicationsService.previewNoticeRecipients(
          {
            title: dto.title.trim(),
            body: dto.body.trim(),
            priority: dto.priority,
            audienceType: dto.audienceType,
            classId: dto.classId,
            sectionId: dto.sectionId,
          },
          actor,
        ),
        this.communicationsService.getCommunicationProviderDiagnostics(actor),
        this.getEmergencyApprovalPolicy(actor.tenantId),
        this.getEmergencyNoticeSettings(actor.tenantId),
      ]);
    if (recipientPreview.allowedRecipientCount < 1) {
      throw new ConflictException(
        'No eligible recipients are available for this notice scope.',
      );
    }
    if (
      settings.quietHoursEnabled &&
      dto.priority !== NoticePriority.EMERGENCY
    ) {
      throw new ConflictException(
        'Urgent mobile dispatch is unavailable while quiet hours are enabled because no mobile-safe quiet-hours schedule contract exists.',
      );
    }

    const approval = emergencyApprovalState({
      actor,
      priority: dto.priority,
      policy: approvalPolicy,
      requiresAdmin: settings.emergencyOverrideRequiresAdmin,
    });
    if (approval.required && !approvalPolicy) {
      throw new ConflictException(
        'Emergency notice approval is required but no active approval policy is configured.',
      );
    }

    const providerState = mobileProviderState(
      providerDiagnostics,
      dto.priority,
    );
    if (
      dto.sendMode === 'SEND_NOW' &&
      !approval.required &&
      providerState.availableChannelCount < 1
    ) {
      throw new ConflictException(
        'No configured delivery channel is currently available.',
      );
    }

    const notice = await this.communicationsService.createNoticeDraft(
      {
        title: dto.title.trim(),
        body: dto.body.trim(),
        priority: dto.priority,
        audienceType: dto.audienceType,
        classId: dto.classId,
        sectionId: dto.sectionId,
        attachmentFileId: dto.attachmentFileId,
        scheduledFor: approval.required
          ? undefined
          : (scheduledFor ?? undefined),
        idempotencyKey: dto.idempotencyKey,
      },
      actor,
    );

    let approvalRequestId: string | null = null;
    if (approval.required && approvalPolicy) {
      const approvalRequest = await this.approvalWorkflowService.createRequest(
        {
          workflowType: ApprovalWorkflowType.EMERGENCY_HIGH_IMPACT_NOTICE,
          title: `Emergency notice: ${notice.title}`,
          reason: reason ?? 'High-impact notice approval requested.',
          targetModule: 'communications',
          targetType: 'notice',
          targetId: notice.id,
          policyId: approvalPolicy.id,
          safeContext: {
            priority: notice.priority,
            audienceType: notice.audienceType,
            recipientCount: recipientPreview.allowedRecipientCount,
            scheduledFor,
          },
          finalActionKey: 'communications.notice.publish_high_impact',
          finalActionPayload: { scheduledFor },
          idempotencyKey: `principal-mobile-notice:${dto.idempotencyKey}`,
        },
        actor,
      );
      approvalRequestId = approvalRequest.id;
    } else {
      await this.communicationsService.publishNotice(notice.id, actor, {
        scheduledFor,
      });
    }

    await this.auditService.record({
      action: 'principal_mobile_emergency_notice_submitted',
      resource: 'notice',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: notice.id,
      after: {
        priority: notice.priority,
        audienceType: notice.audienceType,
        sendMode: dto.sendMode,
        approvalRequired: approval.required,
        approvalRequestId,
        attachmentFileId: dto.attachmentFileId ?? null,
      },
    });
    return this.getEmergencyNoticeStatus(actor, notice.id);
  }

  async getEmergencyNoticeStatus(actor: AuthContext, noticeId: string) {
    this.assertPrincipal(actor);
    this.assertActorPermissions(actor, ['notices:read']);
    await this.assertEmergencyNoticeEntitlements(actor.tenantId);

    const notice = await this.prisma.notice.findFirst({
      where: {
        id: noticeId,
        tenantId: actor.tenantId,
        priority: {
          in: [NoticePriority.URGENT, NoticePriority.EMERGENCY],
        },
      },
      select: {
        id: true,
        title: true,
        body: true,
        priority: true,
        audienceType: true,
        classId: true,
        sectionId: true,
        scheduledFor: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!notice) {
      throw new NotFoundException(
        'High-impact notice not found in the active tenant.',
      );
    }

    const [deliveries, approvalRequest, linkedFiles, providerDiagnostics] =
      await Promise.all([
        this.prisma.notificationDelivery.groupBy({
          by: ['status', 'channel'],
          where: {
            tenantId: actor.tenantId,
            noticeId: notice.id,
          },
          _count: { status: true },
        }),
        this.prisma.approvalRequest.findFirst({
          where: {
            tenantId: actor.tenantId,
            targetModule: 'communications',
            targetType: 'notice',
            targetId: notice.id,
            workflowType: ApprovalWorkflowType.EMERGENCY_HIGH_IMPACT_NOTICE,
          },
          select: {
            id: true,
            status: true,
            finalActionStatus: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.fileRegistryService.listFilesByEntity(
          actor.tenantId,
          'notices',
          notice.id,
        ),
        this.communicationsService.getCommunicationProviderDiagnostics(actor),
      ]);
    const delivery = summarizeMobileNoticeDeliveries(deliveries);
    const providerState = mobileProviderState(
      providerDiagnostics,
      notice.priority,
    );
    const state = resolveMobileNoticeState({
      approvalStatus: approvalRequest?.status ?? null,
      scheduledFor: notice.scheduledFor,
      publishedAt: notice.publishedAt,
      delivery,
    });
    const attachment = linkedFiles[0];

    return {
      id: notice.id,
      state,
      title: notice.title,
      body: notice.body,
      priority: notice.priority,
      audience: {
        type: notice.audienceType,
        classId: notice.classId,
        sectionId: notice.sectionId,
      },
      schedule: {
        scheduledFor: toIso(notice.scheduledFor),
        publishedAt: toIso(notice.publishedAt),
      },
      approval: approvalRequest
        ? {
            requestId: approvalRequest.id,
            status: approvalRequest.status,
            finalActionStatus: approvalRequest.finalActionStatus,
            updatedAt: toIso(approvalRequest.updatedAt),
          }
        : null,
      delivery: {
        ...delivery,
        retryEligible:
          (delivery.failed > 0 || delivery.retryPending > 0) &&
          providerState.availableChannelCount > 0,
      },
      providerState,
      attachment: attachment
        ? {
            fileAssetId: attachment.id,
            fileName: attachment.originalFilename,
            protected: true,
          }
        : null,
      timestamps: {
        createdAt: toIso(notice.createdAt),
        updatedAt: toIso(notice.updatedAt),
      },
      lastUpdated: nowIso(),
    };
  }

  private async assertEmergencyNoticeEntitlements(tenantId: string) {
    await this.entitlementsService.assertModuleEnabled(tenantId, 'notices');
    await this.entitlementsService.assertFeatureEnabled(
      tenantId,
      FEATURE_KEYS.NOTICES_FULL,
    );
  }

  private async getEmergencyApprovalPolicy(tenantId: string) {
    return this.prisma.approvalPolicy.findFirst({
      where: {
        tenantId,
        workflowType: ApprovalWorkflowType.EMERGENCY_HIGH_IMPACT_NOTICE,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        minApprovals: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async getEmergencyNoticeSettings(tenantId: string) {
    const settings = await this.prisma.tenantSetting.findMany({
      where: {
        tenantId,
        key: {
          in: ['quiet_hours_enabled', 'emergency_override_requires_admin'],
        },
      },
      select: { key: true, value: true },
    });
    const byKey = new Map(
      settings.map((setting) => [setting.key, setting.value]),
    );
    return {
      quietHoursEnabled: byKey.get('quiet_hours_enabled') === true,
      emergencyOverrideRequiresAdmin:
        byKey.get('emergency_override_requires_admin') === true,
    };
  }

  private validateEmergencyAudience(
    dto: MobilePrincipalEmergencyNoticePreviewDto,
  ) {
    if (!dto.title.trim() || !dto.body.trim()) {
      throw new BadRequestException('Notice title and body are required.');
    }
    if (
      dto.audienceType === AudienceType.ALL &&
      (dto.classId || dto.sectionId)
    ) {
      throw new BadRequestException(
        'All-school notices cannot include class or section filters.',
      );
    }
    if (
      dto.audienceType === AudienceType.CLASS &&
      (!dto.classId || dto.sectionId)
    ) {
      throw new BadRequestException(
        'Class notices require one class and no section.',
      );
    }
    if (
      dto.audienceType === AudienceType.SECTION &&
      (!dto.classId || !dto.sectionId)
    ) {
      throw new BadRequestException(
        'Section notices require both class and section.',
      );
    }
  }

  private validateEmergencySchedule(
    dto: MobilePrincipalEmergencyNoticeSubmitDto,
  ) {
    if (dto.sendMode === 'SEND_NOW') {
      if (dto.scheduledFor) {
        throw new BadRequestException(
          'Send-now notices cannot include a scheduled time.',
        );
      }
      return null;
    }
    if (!dto.scheduledFor) {
      throw new BadRequestException(
        'A scheduled time is required for scheduled notices.',
      );
    }
    const scheduledFor = new Date(dto.scheduledFor);
    if (Number.isNaN(scheduledFor.getTime()) || scheduledFor <= new Date()) {
      throw new BadRequestException(
        'Scheduled notice time must be in the future.',
      );
    }
    return scheduledFor.toISOString();
  }

  private assertActorPermissions(
    actor: AuthContext,
    requiredPermissions: string[],
  ) {
    if (actor.roles.includes('platform_super_admin')) return;
    if (
      requiredPermissions.some(
        (permission) => !actor.permissions.includes(permission),
      )
    ) {
      throw new ForbiddenException(
        'You do not have permission to perform this principal mobile action.',
      );
    }
  }

  private canActorDecideApprovalStep(
    step: {
      approverRole: string | null;
      approverPermission: string | null;
    },
    actor: AuthContext,
  ) {
    if (actor.roles.includes('platform_super_admin')) {
      return true;
    }
    if (!step.approverRole && !step.approverPermission) {
      return actor.roles.includes('principal') || actor.roles.includes('admin');
    }
    return Boolean(
      (step.approverRole && actor.roles.includes(step.approverRole)) ||
      (step.approverPermission &&
        actor.permissions.includes(step.approverPermission)),
    );
  }

  private async assertMutableEscalation(
    actor: AuthContext,
    escalationId: string,
  ) {
    const escalation = await this.prisma.chatEscalation.findFirst({
      where: {
        id: escalationId,
        tenantId: actor.tenantId,
      },
      select: { id: true, status: true },
    });
    if (!escalation) {
      throw new NotFoundException('Escalation not found in the active tenant.');
    }
    if (escalation.status === ChatEscalationStatus.RESOLVED) {
      throw new ConflictException(
        'Resolved escalations are locked. Reopen before editing.',
      );
    }
    return escalation;
  }

  private async assignPrincipalEscalation(
    actor: AuthContext,
    escalationId: string,
    assigneeUserId: string,
    auditAction: string,
  ) {
    this.assertPrincipal(actor);
    await this.assertMutableEscalation(actor, escalationId);
    const assignedAt = new Date();
    const updated = await this.prisma.chatEscalation.updateMany({
      where: {
        id: escalationId,
        tenantId: actor.tenantId,
        status: {
          in: [ChatEscalationStatus.OPEN, ChatEscalationStatus.REOPENED],
        },
      },
      data: {
        escalatedToUserId: assigneeUserId,
        assignedAt,
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException(
        'Escalation state changed before assignment completed.',
      );
    }

    await this.auditService.record({
      action: auditAction,
      resource: 'chat_escalation',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: escalationId,
      after: { assigneeUserId },
    });
    return this.getEscalationDetail(actor, escalationId);
  }

  private async assertPermittedEscalationAssignee(
    tenantId: string,
    assigneeUserId: string,
  ) {
    const assignee = await this.prisma.user.findFirst({
      where: {
        id: assigneeUserId,
        tenantId,
        status: UserStatus.ACTIVE,
      },
      select: {
        id: true,
        staff: { select: { id: true } },
        userRoles: {
          where: { tenantId },
          select: {
            role: {
              select: {
                name: true,
                rolePermissions: {
                  select: {
                    permission: {
                      select: { resource: true, action: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!assignee?.staff) {
      throw new NotFoundException(
        'Permitted escalation assignee not found in the active tenant.',
      );
    }
    const isPermitted = assignee.userRoles.some(({ role }) => {
      if (['admin', 'principal'].includes(role.name)) {
        return true;
      }
      return role.rolePermissions.some(
        ({ permission }) =>
          permission.resource === 'messaging' && permission.action === 'manage',
      );
    });
    if (!isPermitted) {
      throw new ForbiddenException(
        'Selected staff member is not permitted to manage escalations.',
      );
    }
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
    const [leave, attendance, reportCard, workflow, notices] =
      await Promise.all([
        this.prisma.staffLeaveRequest.count({
          where: { tenantId, status: 'PENDING' },
        }),
        this.prisma.attendanceCorrectionRequest.count({
          where: { tenantId, status: 'PENDING' },
        }),
        this.prisma.reportCardCorrectionRequest.count({
          where: { tenantId, status: 'PENDING' },
        }),
        this.prisma.approvalRequest.count({
          where: {
            tenantId,
            status: 'PENDING',
            OR: [...MOBILE_APPROVAL_TARGET_FILTERS],
          },
        }),
        this.countUnlinkedHighImpactNoticeDrafts(tenantId),
      ]);
    return leave + attendance + reportCard + workflow + notices;
  }

  private async countUnlinkedHighImpactNoticeDrafts(tenantId: string) {
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>(
      Prisma.sql`
        SELECT COUNT(*)::bigint AS "count"
        FROM "Notice" AS notice
        WHERE notice."tenantId" = ${tenantId}
          AND notice."publishedAt" IS NULL
          AND notice."priority" IN ('URGENT', 'EMERGENCY')
          AND NOT EXISTS (
            SELECT 1
            FROM "ApprovalRequest" AS approval
            WHERE approval."tenantId" = notice."tenantId"
              AND approval."targetModule" = 'communications'
              AND approval."targetType" = 'notice'
              AND approval."targetId" = notice."id"
              AND approval."workflowType" = 'EMERGENCY_HIGH_IMPACT_NOTICE'
          )
      `,
    );
    return Number(rows[0]?.count ?? 0n);
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toIso(value?: Date | null) {
  return value ? value.toISOString() : null;
}

function maskPhone(value?: string | null) {
  const digits = (value ?? '').replace(/\D/g, '');
  if (digits.length < 4) return null;
  return `******${digits.slice(-4)}`;
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

function mobileUserLabel(user: {
  email?: string | null;
  staff?: { firstName?: string | null; lastName?: string | null } | null;
  guardian?: { fullName?: string | null } | null;
}) {
  return (
    (user.staff ? staffName(user.staff) : '') ||
    user.guardian?.fullName?.trim() ||
    user.email?.trim() ||
    'School user'
  );
}

function isMobileApprovalTarget(
  workflowType: ApprovalWorkflowType,
  targetModule: string,
  targetType: string,
) {
  if (
    !MOBILE_APPROVAL_WORKFLOW_TYPES.includes(
      workflowType as (typeof MOBILE_APPROVAL_WORKFLOW_TYPES)[number],
    )
  ) {
    return false;
  }
  const target =
    MOBILE_APPROVAL_TARGETS[
      workflowType as keyof typeof MOBILE_APPROVAL_TARGETS
    ];
  return (
    target.targetModule === targetModule && target.targetType === targetType
  );
}

function sanitizeMobileContext(value: unknown, depth = 0): unknown {
  if (value == null || depth > 3) return null;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value.slice(0, 500);
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, 20)
      .map((item) => sanitizeMobileContext(item, depth + 1));
  }
  if (typeof value !== 'object') return null;

  const blockedKey =
    /(salary|bank|account|payroll|password|secret|token|credential|object.?key|storage|provider|url)/i;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !blockedKey.test(key))
      .slice(0, 30)
      .map(([key, item]) => [key, sanitizeMobileContext(item, depth + 1)]),
  );
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

function mobileProviderState(
  diagnostics: {
    channels: Array<{
      channel: string;
      mode: string;
      health: string;
      message: string;
      dispatchAvailable?: boolean;
      liveDelivery?: boolean;
    }>;
  },
  priority: NoticePriority,
) {
  const requiredChannels =
    priority === NoticePriority.EMERGENCY ? ['PUSH', 'SMS'] : ['PUSH'];
  const channels = diagnostics.channels
    .filter((channel) => requiredChannels.includes(channel.channel))
    .map((channel) => ({
      channel: channel.channel,
      mode: channel.mode,
      health: channel.health,
      message: channel.message,
      available:
        channel.dispatchAvailable ??
        (channel.health !== 'unavailable' && channel.mode !== 'disabled'),
      liveDelivery: channel.liveDelivery ?? channel.mode === 'configured',
    }));
  const availableChannelCount = channels.filter(
    (channel) => channel.available,
  ).length;
  return {
    availableChannelCount,
    requiredChannelCount: requiredChannels.length,
    partial:
      availableChannelCount > 0 &&
      availableChannelCount < requiredChannels.length,
    channels,
  };
}

function emergencyApprovalState(input: {
  actor: AuthContext;
  priority: NoticePriority;
  policy: {
    id: string;
    name: string;
    minApprovals: number;
  } | null;
  requiresAdmin: boolean;
}) {
  const isEmergency = input.priority === NoticePriority.EMERGENCY;
  const actorIsAdmin = input.actor.roles.some((role) =>
    ['admin', 'platform_super_admin'].includes(role),
  );
  const required =
    isEmergency &&
    (Boolean(input.policy) || (input.requiresAdmin && !actorIsAdmin));
  return {
    required,
    policyConfigured: Boolean(input.policy),
    policyId: input.policy?.id ?? null,
    policyName: input.policy?.name ?? null,
    minApprovals: input.policy?.minApprovals ?? null,
    reason: required
      ? 'Emergency notice approval is required before dispatch.'
      : null,
  };
}

function summarizeMobileNoticeDeliveries(
  deliveries: Array<{
    status: NotificationStatus;
    channel: string;
    _count: { status: number };
  }>,
) {
  const count = (status: NotificationStatus) =>
    deliveries
      .filter((item) => item.status === status)
      .reduce((total, item) => total + item._count.status, 0);
  return {
    total: deliveries.reduce((total, item) => total + item._count.status, 0),
    queued: count(NotificationStatus.QUEUED),
    retryPending: count(NotificationStatus.RETRY_PENDING),
    sent: count(NotificationStatus.SENT),
    delivered: count(NotificationStatus.DELIVERED),
    failed: count(NotificationStatus.FAILED),
    skipped: count(NotificationStatus.SKIPPED),
    cancelled: count(NotificationStatus.CANCELLED),
    byChannel: deliveries.map((item) => ({
      channel: item.channel,
      status: item.status,
      count: item._count.status,
    })),
  };
}

function resolveMobileNoticeState(input: {
  approvalStatus: ApprovalRequestStatus | null;
  scheduledFor: Date | null;
  publishedAt: Date | null;
  delivery: ReturnType<typeof summarizeMobileNoticeDeliveries>;
}) {
  if (input.approvalStatus === ApprovalRequestStatus.PENDING) {
    return 'AWAITING_APPROVAL';
  }
  if (input.approvalStatus === ApprovalRequestStatus.REJECTED) {
    return 'REJECTED';
  }
  if (input.approvalStatus === ApprovalRequestStatus.APPLY_FAILED) {
    return 'FAILED';
  }
  if (
    !input.publishedAt &&
    input.scheduledFor &&
    input.scheduledFor > new Date()
  ) {
    return 'SCHEDULED';
  }
  const accepted = input.delivery.sent + input.delivery.delivered;
  const unsuccessful =
    input.delivery.failed + input.delivery.skipped + input.delivery.cancelled;
  if (accepted > 0 && unsuccessful > 0) {
    return 'PARTIAL_FAILURE';
  }
  if (input.delivery.queued > 0 || input.delivery.retryPending > 0) {
    return 'QUEUED';
  }
  if (accepted > 0) {
    return 'SENT';
  }
  if (unsuccessful > 0 || input.publishedAt) {
    return 'FAILED';
  }
  return 'DRAFT';
}
