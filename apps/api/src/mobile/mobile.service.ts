import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityCategory,
  FileStatus,
  GuardianCapability,
  PaymentMethod,
  Prisma,
  type Student,
} from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { ParentScopeContextService } from './parent-scope-context.service';
import {
  buildActiveGuardianRelationshipWhere,
  createGuardianCapabilityDeniedException,
  getParentStudentIds,
  isParentOnly,
  requireGuardianCapability,
} from '../common/security/parent-scope';
import {
  assertConfirmStudentId,
  assertConfirmStudentIdAllowed,
} from '../common/security/confirm-student-action';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceService } from '../attendance/attendance.service';
import { FinanceService } from '../finance/finance.service';
import { EntitlementsService } from '../plans/entitlements.service';
import { ReportCardPdfService } from '../academics/report-card-pdf.service';
import { CommunicationsService } from '../communications/communications.service';
import { HomeworkAttachmentAccessService } from '../homework/homework-attachment-access.service';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { StorageService } from '../storage/storage.service';
import { InitiateParentPaymentDto } from './dto/initiate-parent-payment.dto';
import { CanteenService } from '../canteen/canteen.service';
import {
  ParentSandboxCanteenTopUpDto,
  ParentSandboxFeePaymentDto,
} from './dto/parent-sandbox-payment.dto';
import { MobileParentConsentDecisionDto } from './dto/mobile-parent-consent.dto';
import {
  MobileParentAttendanceCorrectionCancelDto,
  MobileParentAttendanceCorrectionDto,
} from './dto/mobile-parent-attendance-correction.dto';
import { ServiceRequestsService } from '../service-requests/service-requests.service';
import {
  CreateSchoolServiceRequestDto,
  ReasonedSchoolServiceRequestDto,
  UploadSchoolServiceRequestAttachmentDto,
} from '../service-requests/dto/service-request.dto';

interface MobileStudentRow extends Student {
  class: { id: string; name: string };
  sectionRef: {
    id: string;
    name: string;
    classTeacher?: {
      id: string;
      firstName: string;
      lastName: string;
    } | null;
  } | null;
  guardianLinks: Array<{
    relation: string;
    isPrimary: boolean;
    capabilities: GuardianCapability[];
    verificationStatus: string;
    status: string;
    effectiveFrom: Date;
    effectiveUntil: Date | null;
    approvalStatus: string;
    emergencyContactPriority: number | null;
    guardian: {
      id: string;
      userId: string | null;
    };
  }>;
  enrollments: Array<{
    academicYear: {
      name: string;
      startsOn: Date;
      endsOn: Date;
    };
  }>;
}

/**
 * Relations the parent-facing student payload renders. Extracted verbatim from
 * `getAccessibleStudent` so the shape stays identical while the query itself
 * can be memoized per request by `ParentScopeContextService`.
 *
 * This is a function of the calling user, not a constant: `guardianLinks` is
 * filtered to the *caller's own* guardian record. Hoisting it to a module-level
 * constant would drop that filter and return every guardian's link rows for the
 * child, leaking the other guardian's relationship data to this parent.
 */
function accessibleStudentInclude(userId: string) {
  return {
    class: {
      select: { id: true, name: true },
    },
    sectionRef: {
      select: {
        id: true,
        name: true,
        classTeacher: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    },
    guardianLinks: {
      where: {
        ...buildActiveGuardianRelationshipWhere(),
        guardian: { userId },
      },
      include: {
        guardian: { select: { id: true, userId: true } },
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    },
    enrollments: {
      where: { status: 'ACTIVE' },
      include: {
        academicYear: {
          select: { name: true, startsOn: true, endsOn: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 1,
    },
  } satisfies Prisma.StudentInclude;
}

type ParentActionPriority = 'URGENT' | 'HIGH' | 'NORMAL';
type ParentActionSource =
  | 'notices'
  | 'homework'
  | 'fees'
  | 'attendance'
  | 'serviceRequests'
  | 'exams';

interface ParentActionItem {
  id: string;
  source: ParentActionSource;
  type: string;
  priority: ParentActionPriority;
  title: string;
  description: string;
  child: { id: string; name: string; classSection: string } | null;
  dueAt: string | null;
  isOverdue: boolean;
  action: { label: string; route: string };
}

type ParentDigestSourceStatus =
  | 'available'
  | 'empty'
  | 'partial'
  | 'locked'
  | 'unavailable';

interface ParentDigestSourceState {
  status: ParentDigestSourceStatus;
  reason: string | null;
}

@Injectable()
export class MobileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceService: AttendanceService,
    private readonly financeService: FinanceService,
    private readonly entitlementsService: EntitlementsService,
    private readonly reportCardPdfService: ReportCardPdfService,
    private readonly communicationsService: CommunicationsService,
    private readonly homeworkAttachmentAccessService: HomeworkAttachmentAccessService,
    private readonly fileRegistryService: FileRegistryService,
    private readonly storageService: StorageService,
    private readonly canteenService: CanteenService,
    private readonly serviceRequestsService: ServiceRequestsService,
    private readonly parentScope: ParentScopeContextService,
  ) {}

  async listMyStudents(actor: AuthContext) {
    const studentIds = await this.getAllowedStudentIds(actor);

    if (studentIds.length === 0) {
      return { items: [] };
    }

    // Uses the same include as `getAccessibleStudent`. That include is a strict
    // superset of what this endpoint previously requested — it adds only
    // `sectionRef.classTeacher`, which `toMobileStudent` does not render, so
    // the response is unchanged. Sharing it lets the rows be primed into the
    // request cache below, which turns the selected child's profile lookup on
    // the dashboard into a cache hit instead of a second query cluster.
    const students = await this.prisma.student.findMany({
      where: {
        tenantId: actor.tenantId,
        id: { in: studentIds },
        lifecycleStatus: 'ACTIVE',
        enrollments: {
          some: { status: 'ACTIVE' },
        },
      },
      include: accessibleStudentInclude(actor.userId),
      orderBy: [{ firstNameEn: 'asc' }, { lastNameEn: 'asc' }],
    });

    for (const student of students) {
      this.parentScope.primeAccessibleStudent(actor, student.id, student);
    }

    return {
      items: students.map((student) => toMobileStudent(student)),
    };
  }

  async getDashboard(actor: AuthContext, requestedStudentId?: string) {
    const children = await this.listMyStudents(actor);
    if (
      requestedStudentId &&
      !children.items.some((child) => child.id === requestedStudentId)
    ) {
      throw new ForbiddenException(
        'Mobile access denied for this active student.',
      );
    }
    const selectedStudentId = requestedStudentId ?? children.items[0]?.id;
    const entitlements = await this.entitlementsService.getEntitlements(
      actor.tenantId,
    );
    const modules = new Set(entitlements.modules);
    const enabled = (moduleName: string) => modules.has(moduleName);
    const selectedChild = children.items.find(
      (child) => child.id === selectedStudentId,
    );
    const guardianCapabilities = new Set(selectedChild?.capabilities ?? []);
    const can = (capability: GuardianCapability) =>
      guardianCapabilities.has(capability);
    const moduleAvailability = {
      attendance:
        enabled('attendance') && can(GuardianCapability.ATTENDANCE_VIEW),
      fees: enabled('fees') && can(GuardianCapability.FEES_VIEW),
      homework: enabled('homework') && can(GuardianCapability.ACADEMICS_VIEW),
      activity: enabled('activity') && can(GuardianCapability.ACADEMICS_VIEW),
      transport:
        enabled('transport') && can(GuardianCapability.EMERGENCY_ALERT_RECEIVE),
      canteen: enabled('canteen') && can(GuardianCapability.FEES_VIEW),
    };

    if (!selectedStudentId) {
      return {
        selectedStudent: null,
        children: children.items,
        attendance: null,
        fees: null,
        homework: null,
        notices: await this.listNotifications(actor),
        transport: null,
        canteen: null,
        latestActivity: null,
        modules: moduleAvailability,
      };
    }

    const [
      student,
      attendance,
      fees,
      homework,
      notices,
      transport,
      canteen,
      activity,
    ] = await Promise.all([
      can(GuardianCapability.ACADEMICS_VIEW)
        ? this.getStudentProfile(selectedStudentId, actor)
        : Promise.resolve(null),
      moduleAvailability.attendance
        ? this.getStudentAttendanceSummary(selectedStudentId, actor)
        : Promise.resolve(null),
      moduleAvailability.fees
        ? this.getStudentFeesSummary(selectedStudentId, actor)
        : Promise.resolve(null),
      moduleAvailability.homework
        ? this.getStudentHomework(selectedStudentId, actor, '5')
        : Promise.resolve(null),
      this.listNotifications(actor, {}, [selectedStudentId]),
      moduleAvailability.transport
        ? this.getStudentTransport(selectedStudentId, actor)
        : Promise.resolve(null),
      moduleAvailability.canteen
        ? this.getStudentCanteen(selectedStudentId, actor)
        : Promise.resolve(null),
      moduleAvailability.activity
        ? this.getStudentActivityFeed(selectedStudentId, actor, '1')
        : Promise.resolve(null),
    ]);

    return {
      selectedStudent: student?.child ?? selectedChild ?? null,
      children: children.items,
      attendance,
      fees,
      homework: homework
        ? {
            pendingCount: homework.items.filter((item) =>
              ['NOT_SUBMITTED', 'NEEDS_CORRECTION'].includes(
                item.submissionStatus,
              ),
            ).length,
            nextDueAt: homework.items[0]?.dueAt ?? null,
          }
        : null,
      notices,
      transport,
      canteen,
      latestActivity: activity?.items[0] ?? null,
      modules: moduleAvailability,
      guardianCapabilities: [...guardianCapabilities],
    };
  }

  async getParentActionCentre(actor: AuthContext, requestedStudentId?: string) {
    if (!isParentOnly(actor)) {
      throw new ForbiddenException(
        'Parent action centre is not available for this account.',
      );
    }
    const children = await this.listMyStudents(actor);
    if (
      requestedStudentId &&
      !children.items.some((child) => child.id === requestedStudentId)
    ) {
      throw new ForbiddenException(
        'Mobile access denied for this active student.',
      );
    }
    const scopedChildren = requestedStudentId
      ? children.items.filter((child) => child.id === requestedStudentId)
      : children.items;
    const studentIds = scopedChildren.map((child) => child.id);
    const entitlements = await this.entitlementsService.getEntitlements(
      actor.tenantId,
    );
    const modules = new Set(entitlements.modules);
    const enabled = (moduleName: string) => modules.has(moduleName);
    const capabilityState = (
      capability: GuardianCapability,
      label: string,
    ): {
      status: 'available' | 'partial' | 'locked';
      reason: string | null;
    } => {
      const allowedCount = scopedChildren.filter((child) =>
        child.capabilities.includes(capability),
      ).length;
      if (allowedCount === 0) {
        return {
          status: 'locked',
          reason: `Your guardian access does not include ${label}.`,
        };
      }
      if (allowedCount < scopedChildren.length) {
        return {
          status: 'partial',
          reason: `${label} is available for some linked children only.`,
        };
      }
      return { status: 'available', reason: null };
    };
    const sourceStates: Record<
      ParentActionSource,
      {
        status: 'available' | 'partial' | 'locked' | 'unavailable';
        reason: string | null;
      }
    > = {
      notices: { status: 'available', reason: null },
      homework: enabled('homework')
        ? capabilityState(GuardianCapability.ACADEMICS_VIEW, 'homework')
        : {
            status: 'locked',
            reason: 'Homework is not enabled for this school.',
          },
      fees: enabled('fees')
        ? capabilityState(GuardianCapability.FEES_VIEW, 'fee information')
        : { status: 'locked', reason: 'Fees are not enabled for this school.' },
      attendance: enabled('attendance')
        ? capabilityState(
            GuardianCapability.COMPLAINT_OR_CORRECTION_SUBMIT,
            'attendance correction requests',
          )
        : {
            status: 'locked',
            reason: 'Attendance is not enabled for this school.',
          },
      serviceRequests: capabilityState(
        GuardianCapability.COMPLAINT_OR_CORRECTION_SUBMIT,
        'school requests',
      ),
      exams: enabled('academics')
        ? capabilityState(
            GuardianCapability.ACADEMICS_VIEW,
            'published examinations',
          )
        : {
            status: 'locked',
            reason: 'Examinations are not enabled for this school.',
          },
    };
    const actions: ParentActionItem[] = [];
    const load = async <T>(
      source: ParentActionSource,
      work: () => Promise<T>,
    ): Promise<T | null> => {
      try {
        return await work();
      } catch {
        sourceStates[source] = {
          status: 'unavailable',
          reason: `Could not load ${parentActionSourceLabel(source)} right now.`,
        };
        return null;
      }
    };

    const notifications = await load('notices', () =>
      this.listNotifications(actor, { limit: 100 }, studentIds),
    );
    if (notifications?.nextCursor) {
      sourceStates.notices = {
        status: 'partial',
        reason: 'More notices are available in Updates.',
      };
    }
    for (const notice of notifications?.items ?? []) {
      if (
        !notice.requiresAcknowledgement ||
        notice.acknowledgedAt ||
        !notice.noticeId
      ) {
        continue;
      }
      const child = notice.childId
        ? scopedChildren.find((item) => item.id === notice.childId)
        : null;
      actions.push({
        id: `notice-ack:${notice.noticeId}`,
        source: 'notices',
        type: 'NOTICE_ACKNOWLEDGEMENT',
        priority: 'URGENT',
        title: notice.title,
        description: 'Review and confirm this school notice.',
        child: child ? parentActionChild(child) : null,
        dueAt: null,
        isOverdue: false,
        action: { label: 'Review notice', route: notice.route },
      });
    }

    await Promise.all(
      scopedChildren.map(async (child) => {
        const can = (capability: GuardianCapability) =>
          child.capabilities.includes(capability);
        const [homework, fees, corrections, requests, exams] =
          await Promise.all([
            enabled('homework') && can(GuardianCapability.ACADEMICS_VIEW)
              ? load('homework', () =>
                  this.getStudentHomework(child.id, actor, '30'),
                )
              : Promise.resolve(null),
            enabled('fees') && can(GuardianCapability.FEES_VIEW)
              ? load('fees', () => this.getStudentFeesSummary(child.id, actor))
              : Promise.resolve(null),
            enabled('attendance') &&
            can(GuardianCapability.COMPLAINT_OR_CORRECTION_SUBMIT)
              ? load('attendance', () =>
                  this.listStudentAttendanceCorrections(child.id, actor),
                )
              : Promise.resolve(null),
            can(GuardianCapability.COMPLAINT_OR_CORRECTION_SUBMIT)
              ? load('serviceRequests', () =>
                  this.listStudentServiceRequests(child.id, actor),
                )
              : Promise.resolve(null),
            enabled('academics') && can(GuardianCapability.ACADEMICS_VIEW)
              ? load('exams', () =>
                  this.getStudentExamSchedule(child.id, actor),
                )
              : Promise.resolve(null),
          ]);
        const actionChild = parentActionChild(child);

        for (const item of homework?.items ?? []) {
          if (
            !item.submissionRequired ||
            !['NOT_SUBMITTED', 'NEEDS_CORRECTION'].includes(
              item.submissionStatus,
            )
          ) {
            continue;
          }
          const dueAt = item.dueAt ?? item.dueDate;
          actions.push({
            id: `homework:${child.id}:${item.id}`,
            source: 'homework',
            type: 'HOMEWORK_DUE',
            priority: parentActionPriorityForDate(dueAt),
            title: item.title,
            description:
              item.submissionStatus === 'NEEDS_CORRECTION'
                ? `${item.subject.name} needs correction before resubmission.`
                : `${item.subject.name} homework is not submitted.`,
            child: actionChild,
            dueAt,
            isOverdue: isPastDate(dueAt),
            action: {
              label: 'View homework',
              route: `/parent/homework/${encodeURIComponent(item.id)}`,
            },
          });
        }

        for (const invoice of fees?.recentInvoices ?? []) {
          if (invoice.outstandingAmount <= 0) continue;
          actions.push({
            id: `fee:${child.id}:${invoice.id}`,
            source: 'fees',
            type: 'FEE_DUE',
            priority: invoice.isOverdue ? 'URGENT' : 'HIGH',
            title: `Fee balance for ${invoice.invoiceNumber}`,
            description: `NPR ${invoice.outstandingAmount.toFixed(2)} remains due.`,
            child: actionChild,
            dueAt: invoice.dueDate,
            isOverdue: invoice.isOverdue,
            action: {
              label: 'Review fees',
              route: `/parent/fees?child=${encodeURIComponent(child.id)}`,
            },
          });
        }

        for (const correction of corrections?.items ?? []) {
          if (correction.status !== 'REJECTED' || !correction.canResubmit) {
            continue;
          }
          actions.push({
            id: `attendance-correction:${child.id}:${correction.id}`,
            source: 'attendance',
            type: 'ATTENDANCE_CORRECTION_REJECTED',
            priority: 'HIGH',
            title: 'Attendance correction needs follow-up',
            description:
              correction.reviewReason ??
              'Review the school response and resubmit if needed.',
            child: actionChild,
            dueAt: null,
            isOverdue: false,
            action: {
              label: 'Review correction',
              route: `/parent/attendance?child=${encodeURIComponent(child.id)}`,
            },
          });
        }

        for (const request of requests?.items ?? []) {
          if (
            request.status !== 'RESOLVED' ||
            !request.actions.confirmResolution
          ) {
            continue;
          }
          actions.push({
            id: `service-request:${child.id}:${request.id}`,
            source: 'serviceRequests',
            type: 'SERVICE_REQUEST_CONFIRMATION',
            priority: request.isOverdue ? 'URGENT' : 'HIGH',
            title: request.subject,
            description:
              'Review the school response and confirm the resolution.',
            child: actionChild,
            dueAt: request.responseDeadline,
            isOverdue: request.isOverdue,
            action: {
              label: 'Review response',
              route: `/parent/more/help-requests?child=${encodeURIComponent(child.id)}`,
            },
          });
        }

        const examWindowEnd = Date.now() + 30 * 24 * 60 * 60 * 1000;
        for (const exam of exams?.items ?? []) {
          const startsAt = Date.parse(exam.startsAt);
          if (
            !Number.isFinite(startsAt) ||
            startsAt < Date.now() ||
            startsAt > examWindowEnd
          ) {
            continue;
          }
          actions.push({
            id: `exam:${child.id}:${exam.id}`,
            source: 'exams',
            type: 'UPCOMING_EXAM',
            priority: parentActionPriorityForDate(exam.startsAt),
            title: `${exam.subject.name} examination`,
            description: `${exam.examTerm.name} is coming up.`,
            child: actionChild,
            dueAt: exam.startsAt,
            isOverdue: false,
            action: {
              label: 'View calendar',
              route: `/parent/more/calendar?child=${encodeURIComponent(child.id)}`,
            },
          });
        }
      }),
    );

    actions.sort(compareParentActions);
    const returnedItems = actions.slice(0, 20);
    const partialSources = Object.entries(sourceStates)
      .filter(([, value]) => value.status !== 'available')
      .map(([source]) => source);
    return {
      generatedAt: new Date().toISOString(),
      dataState: 'LIVE',
      scope: {
        selectedStudentId: requestedStudentId ?? null,
        children: scopedChildren.map(parentActionChild),
      },
      summary: {
        visibleActionCount: actions.length,
        urgentCount: actions.filter((item) => item.priority === 'URGENT')
          .length,
        returnedCount: returnedItems.length,
        isPartial: partialSources.length > 0,
      },
      items: returnedItems,
      truncated: actions.length > returnedItems.length,
      sources: sourceStates,
    };
  }

  async getStudentWeeklyProgress(studentId: string, actor: AuthContext) {
    if (!isParentOnly(actor)) {
      throw new ForbiddenException(
        'Parent weekly progress is not available for this account.',
      );
    }
    const student = await this.getAccessibleStudent(studentId, actor);
    const generatedAt = new Date();
    const periodStart = new Date(
      generatedAt.getTime() - 7 * 24 * 60 * 60 * 1000,
    );
    const upcomingEnd = new Date(
      generatedAt.getTime() + 7 * 24 * 60 * 60 * 1000,
    );
    const entitlements = await this.entitlementsService.getEntitlements(
      actor.tenantId,
    );
    const modules = new Set(entitlements.modules);
    const enabled = (moduleName: string) => modules.has(moduleName);
    const relationship = student.guardianLinks.find(
      (link) => link.guardian.userId === actor.userId,
    );
    const can = (capability: GuardianCapability) =>
      relationship?.capabilities.includes(capability) ?? false;
    const sources: Record<
      'attendance' | 'homework' | 'academics' | 'comments' | 'actions',
      ParentDigestSourceState
    > = {
      attendance:
        enabled('attendance') && can(GuardianCapability.ATTENDANCE_VIEW)
          ? { status: 'available', reason: null }
          : {
              status: 'locked',
              reason: enabled('attendance')
                ? 'Your guardian access does not include attendance.'
                : 'Attendance is not enabled for this school.',
            },
      homework: enabled('homework')
        ? { status: 'available', reason: null }
        : {
            status: 'locked',
            reason: 'Homework is not enabled for this school.',
          },
      academics: enabled('academics')
        ? { status: 'available', reason: null }
        : {
            status: 'locked',
            reason: 'Published results are not enabled for this school.',
          },
      comments: enabled('homework')
        ? { status: 'available', reason: null }
        : {
            status: 'locked',
            reason: 'Teacher homework feedback is not enabled for this school.',
          },
      actions: { status: 'available', reason: null },
    };
    const load = async <T>(
      source: keyof typeof sources,
      work: () => Promise<T>,
    ): Promise<T | null> => {
      try {
        return await work();
      } catch {
        sources[source] = {
          status: 'unavailable',
          reason: `Could not load ${parentDigestSourceLabel(source)} right now.`,
        };
        return null;
      }
    };

    const [attendance, homeworkRows, reportCards, actionCentre] =
      await Promise.all([
        enabled('attendance') && can(GuardianCapability.ATTENDANCE_VIEW)
          ? load('attendance', () =>
              this.getStudentAttendanceSummary(studentId, actor),
            )
          : Promise.resolve(null),
        enabled('homework')
          ? load('homework', () =>
              this.prisma.homeworkAssignment.findMany({
                where: {
                  tenantId: actor.tenantId,
                  classId: student.classId,
                  status: { in: ['ASSIGNED', 'CLOSED'] },
                  OR: [
                    {
                      AND: [
                        { dueAt: { gte: periodStart, lte: generatedAt } },
                        {
                          OR: [
                            { sectionId: null },
                            { sectionId: student.sectionId },
                          ],
                        },
                      ],
                    },
                    {
                      submissions: {
                        some: {
                          tenantId: actor.tenantId,
                          studentId,
                          updatedAt: {
                            gte: periodStart,
                            lte: generatedAt,
                          },
                          feedback: { not: null },
                        },
                      },
                    },
                  ],
                },
                select: {
                  id: true,
                  title: true,
                  dueAt: true,
                  submissionRequired: true,
                  subject: { select: { id: true, name: true } },
                  submissions: {
                    where: {
                      tenantId: actor.tenantId,
                      studentId,
                    },
                    select: {
                      status: true,
                      feedback: true,
                      reviewedAt: true,
                      returnedAt: true,
                      updatedAt: true,
                    },
                    take: 1,
                  },
                },
                orderBy: [{ dueAt: 'desc' }, { id: 'asc' }],
                take: 101,
              }),
            )
          : Promise.resolve(null),
        enabled('academics')
          ? load('academics', () =>
              this.getStudentReportCards(studentId, actor),
            )
          : Promise.resolve(null),
        load('actions', () => this.getParentActionCentre(actor, studentId)),
      ]);

    const attendanceRows = (attendance?.recentHistory ?? []).filter((record) =>
      isTimestampBetween(record.date, periodStart, generatedAt),
    );
    const presentStatuses = new Set(['PRESENT', 'LATE']);
    const attendanceSummary = {
      availability:
        sources.attendance.status === 'locked'
          ? 'LOCKED'
          : attendance === null
            ? 'UNAVAILABLE'
            : attendanceRows.length === 0
              ? 'EMPTY'
              : 'AVAILABLE',
      recordedDays: attendanceRows.length,
      presentDays: attendanceRows.filter((record) =>
        presentStatuses.has(record.status),
      ).length,
      absentDays: attendanceRows.filter((record) => record.status === 'ABSENT')
        .length,
      lateDays: attendanceRows.filter((record) => record.status === 'LATE')
        .length,
      excusedDays: attendanceRows.filter((record) =>
        ['EXCUSED', 'LEAVE'].includes(record.status),
      ).length,
      attendanceRate:
        attendanceRows.length > 0
          ? roundMoney(
              (attendanceRows.filter((record) =>
                presentStatuses.has(record.status),
              ).length /
                attendanceRows.length) *
                100,
            )
          : null,
    };
    if (attendance && attendanceRows.length === 0) {
      sources.attendance = {
        status: 'empty',
        reason: 'No attendance was recorded in this seven-day period.',
      };
    }

    const boundedHomework = (homeworkRows ?? []).slice(0, 100);
    if (enabled('homework') && homeworkRows === null) {
      sources.comments = {
        status: 'unavailable',
        reason: 'Could not load teacher feedback right now.',
      };
    }
    if ((homeworkRows?.length ?? 0) > boundedHomework.length) {
      sources.homework = {
        status: 'partial',
        reason:
          'More than 100 homework records changed in this period; the digest is bounded.',
      };
      sources.comments = sources.homework;
    }
    const periodHomework = boundedHomework.filter(
      (assignment) =>
        assignment.submissionRequired &&
        isTimestampBetween(assignment.dueAt, periodStart, generatedAt),
    );
    const completedStatuses = new Set([
      'SUBMITTED',
      'LATE',
      'REVIEWED',
      'EXCUSED',
      'COMPLETED',
    ]);
    const completedHomework = periodHomework.filter((assignment) =>
      completedStatuses.has(
        assignment.submissions[0]?.status ?? 'NOT_SUBMITTED',
      ),
    );
    const needsFollowUp = periodHomework.filter((assignment) =>
      ['NOT_SUBMITTED', 'NEEDS_CORRECTION', 'INCOMPLETE', 'ABSENT'].includes(
        assignment.submissions[0]?.status ?? 'NOT_SUBMITTED',
      ),
    ).length;
    const homeworkSummary = {
      availability:
        sources.homework.status === 'locked'
          ? 'LOCKED'
          : homeworkRows === null
            ? 'UNAVAILABLE'
            : periodHomework.length === 0
              ? 'EMPTY'
              : 'AVAILABLE',
      requiredCount: periodHomework.length,
      completedCount: completedHomework.length,
      needsFollowUpCount: needsFollowUp,
      completionRate:
        periodHomework.length > 0
          ? roundMoney((completedHomework.length / periodHomework.length) * 100)
          : null,
    };
    if (
      homeworkRows &&
      periodHomework.length === 0 &&
      sources.homework.status === 'available'
    ) {
      sources.homework = {
        status: 'empty',
        reason: 'No submission-required homework was due in this period.',
      };
    }

    const comments = boundedHomework
      .flatMap((assignment) => {
        const submission = assignment.submissions[0];
        const feedback = submission?.feedback?.trim();
        const sharedAt =
          submission?.reviewedAt ??
          submission?.returnedAt ??
          submission?.updatedAt;
        if (
          !feedback ||
          !sharedAt ||
          !isTimestampBetween(sharedAt, periodStart, generatedAt)
        ) {
          return [];
        }
        return [
          {
            id: `homework-feedback:${assignment.id}`,
            subject: assignment.subject.name,
            title: assignment.title,
            comment: feedback,
            sharedAt: toIso(sharedAt),
          },
        ];
      })
      .sort(
        (left, right) =>
          timestampOrZero(right.sharedAt) - timestampOrZero(left.sharedAt),
      )
      .slice(0, 5);
    if (
      homeworkRows &&
      comments.length === 0 &&
      sources.comments.status === 'available'
    ) {
      sources.comments = {
        status: 'empty',
        reason: 'No parent-visible teacher feedback was shared this period.',
      };
    }

    const academicTrend =
      sources.academics.status === 'locked'
        ? {
            availability: 'LOCKED',
            direction: null,
            changePoints: null,
            current: null,
            previous: null,
            reason: sources.academics.reason,
          }
        : reportCards === null
          ? {
              availability: 'UNAVAILABLE',
              direction: null,
              changePoints: null,
              current: null,
              previous: null,
              reason: sources.academics.reason,
            }
          : buildParentAcademicTrend(reportCards.items);
    if (reportCards && academicTrend.availability === 'UNAVAILABLE') {
      sources.academics = {
        status: 'empty',
        reason: academicTrend.reason,
      };
    }

    const requiredActions = (actionCentre?.items ?? []).slice(0, 10);
    const upcomingDeadlines = requiredActions
      .filter((item) =>
        isTimestampBetween(item.dueAt, generatedAt, upcomingEnd),
      )
      .slice(0, 5);
    if (actionCentre?.summary.isPartial) {
      sources.actions = {
        status: 'partial',
        reason:
          'Some action sources are locked or unavailable; only visible actions are included.',
      };
    } else if (actionCentre && requiredActions.length === 0) {
      sources.actions = {
        status: 'empty',
        reason: 'No parent action is visible right now.',
      };
    }

    return {
      generatedAt: generatedAt.toISOString(),
      dataState: 'LIVE',
      student: {
        id: student.id,
        name: [student.firstNameEn, student.lastNameEn]
          .filter(Boolean)
          .join(' '),
        classSection: [student.class.name, student.sectionRef?.name]
          .filter(Boolean)
          .join(' - '),
      },
      period: {
        startAt: periodStart.toISOString(),
        endAt: generatedAt.toISOString(),
        upcomingEndAt: upcomingEnd.toISOString(),
        days: 7,
      },
      attendance: attendanceSummary,
      homework: homeworkSummary,
      academicTrend,
      teacherComments: comments,
      upcomingDeadlines,
      requiredActions,
      sources,
      isPartial: Object.values(sources).some(
        (source) =>
          source.status === 'partial' ||
          source.status === 'locked' ||
          source.status === 'unavailable',
      ),
    };
  }

  async listNotifications(
    actor: AuthContext,
    query: { limit?: number; cursor?: string; unreadOnly?: boolean } = {},
    scopedStudentIds?: string[],
  ) {
    const studentIds =
      scopedStudentIds ?? (await this.getNotificationStudentScope(actor));
    const childScoped = scopedStudentIds !== undefined;
    const visibility = this.parentNotificationVisibility(
      actor,
      studentIds,
      childScoped,
    );
    const limit = Math.min(Math.max(query.limit ?? 30, 1), 100);
    const notifications = await this.prisma.notificationDelivery.findMany({
      where: {
        ...visibility,
        ...(query.unreadOnly
          ? {
              readReceipts: {
                none: { tenantId: actor.tenantId, userId: actor.userId },
              },
            }
          : {}),
      },
      include: {
        readReceipts: {
          where: {
            tenantId: actor.tenantId,
            userId: actor.userId,
          },
          select: {
            readAt: true,
          },
        },
        student: {
          select: {
            id: true,
            firstNameEn: true,
            lastNameEn: true,
            class: { select: { name: true } },
            sectionRef: { select: { name: true } },
          },
        },
        notice: {
          select: {
            audienceType: true,
            category: true,
            priority: true,
            isPinned: true,
            requiresAcknowledgement: true,
            acknowledgements: {
              where: {
                tenantId: actor.tenantId,
                recipientUserId: actor.userId,
              },
              select: { firstAcknowledgedAt: true },
              take: 1,
            },
            class: { select: { name: true } },
            section: { select: { name: true } },
          },
        },
        event: {
          select: {
            audienceType: true,
            class: { select: { name: true } },
            section: { select: { name: true } },
          },
        },
        activityPost: {
          select: {
            audienceType: true,
            class: { select: { name: true } },
            section: { select: { name: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = notifications.length > limit;
    const page = hasMore ? notifications.slice(0, limit) : notifications;
    const items = page.map((item) => ({
      id: item.id,
      title: item.title,
      message: item.body,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      childId: item.studentId,
      noticeId: item.noticeId,
      eventId: item.eventId,
      activityPostId: item.activityPostId,
      route: parentNotificationRoute(item),
      channel: item.channel,
      status: item.status,
      createdAt: toIso(item.createdAt),
      sentAt: toIso(item.sentAt),
      readAt: toIso(item.readReceipts[0]?.readAt),
      isRead: item.readReceipts.length > 0,
      requiresAcknowledgement: item.notice?.requiresAcknowledgement ?? false,
      noticeCategory: item.notice?.category ?? null,
      noticePriority: item.notice?.priority ?? null,
      isPinned: item.notice?.isPinned ?? false,
      acknowledgedAt: toIso(
        item.notice?.acknowledgements[0]?.firstAcknowledgedAt,
      ),
      audience: parentNotificationAudience(item),
    }));

    return {
      unreadCount: await this.countUnreadNotifications(
        actor,
        studentIds,
        childScoped,
      ),
      items,
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  async getNotificationUnreadCount(actor: AuthContext) {
    const studentIds = await this.getNotificationStudentScope(actor);
    return {
      unreadCount: await this.countUnreadNotifications(actor, studentIds),
    };
  }

  async markAllNotificationsRead(actor: AuthContext) {
    const studentIds = await this.getNotificationStudentScope(actor);
    const unread = await this.prisma.notificationDelivery.findMany({
      where: {
        ...this.parentNotificationVisibility(actor, studentIds),
        readReceipts: {
          none: { tenantId: actor.tenantId, userId: actor.userId },
        },
      },
      select: { id: true },
    });

    if (unread.length === 0) {
      return { success: true, markedCount: 0 };
    }

    const result = await this.prisma.notificationReadReceipt.createMany({
      data: unread.map((item) => ({
        tenantId: actor.tenantId,
        notificationDeliveryId: item.id,
        userId: actor.userId,
      })),
      skipDuplicates: true,
    });

    return { success: true, markedCount: result.count };
  }

  async markNotificationRead(notificationId: string, actor: AuthContext) {
    const studentIds = await this.getNotificationStudentScope(actor);
    const notification = await this.prisma.notificationDelivery.findFirst({
      where: {
        id: notificationId,
        ...this.parentNotificationVisibility(actor, studentIds),
      },
      select: { id: true },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notificationReadReceipt.upsert({
      where: {
        tenantId_notificationDeliveryId_userId: {
          tenantId: actor.tenantId,
          notificationDeliveryId: notification.id,
          userId: actor.userId,
        },
      },
      create: {
        tenantId: actor.tenantId,
        notificationDeliveryId: notification.id,
        userId: actor.userId,
      },
      update: { readAt: new Date() },
    });

    return { success: true };
  }

  async getNotificationDetail(notificationId: string, actor: AuthContext) {
    const notification = await this.getVisibleNotification(
      notificationId,
      actor,
    );
    const attachment = notification.noticeId
      ? await this.getNoticeAttachmentDescriptor(
          notification.noticeId,
          notification.id,
          actor,
        )
      : null;

    return {
      id: notification.id,
      title: notification.title,
      message: notification.body,
      sourceType: notification.sourceType,
      sourceId: notification.sourceId,
      childId: notification.studentId,
      noticeId: notification.noticeId,
      eventId: notification.eventId,
      activityPostId: notification.activityPostId,
      route: parentNotificationRoute(notification),
      channel: notification.channel,
      status: notification.status,
      createdAt: toIso(notification.createdAt),
      sentAt: toIso(notification.sentAt),
      readAt: toIso(notification.readReceipts[0]?.readAt),
      isRead: notification.readReceipts.length > 0,
      requiresAcknowledgement:
        notification.notice?.requiresAcknowledgement ?? false,
      noticeCategory: notification.notice?.category ?? null,
      noticePriority: notification.notice?.priority ?? null,
      isPinned: notification.notice?.isPinned ?? false,
      acknowledgedAt: toIso(
        notification.notice?.acknowledgements[0]?.firstAcknowledgedAt,
      ),
      audience: parentNotificationAudience(notification),
      attachment,
    };
  }

  async getNotificationAttachment(notificationId: string, actor: AuthContext) {
    const notification = await this.getVisibleNotification(
      notificationId,
      actor,
    );
    if (!notification.noticeId) {
      throw new NotFoundException('Notice attachment not found');
    }

    const [asset] = await this.fileRegistryService.listFilesByEntity(
      actor.tenantId,
      'notices',
      notification.noticeId,
    );
    if (!asset) {
      throw new NotFoundException('Notice attachment not found');
    }

    await this.fileRegistryService.assertFileAccessForAuth(asset, actor);
    await this.fileRegistryService.auditAccess(
      actor.tenantId,
      asset.id,
      actor.userId,
      'download',
    );
    return {
      fileName: asset.originalFilename,
      mimeType: asset.mimeType,
      content: await this.storageService.getObjectBuffer(asset.objectKey),
    };
  }

  private async getVisibleNotification(
    notificationId: string,
    actor: AuthContext,
  ) {
    const studentIds = await this.getNotificationStudentScope(actor);
    const notification = await this.prisma.notificationDelivery.findFirst({
      where: {
        id: notificationId,
        ...this.parentNotificationVisibility(actor, studentIds),
      },
      include: {
        readReceipts: {
          where: { tenantId: actor.tenantId, userId: actor.userId },
          select: { readAt: true },
        },
        student: {
          select: {
            id: true,
            firstNameEn: true,
            lastNameEn: true,
            class: { select: { name: true } },
            sectionRef: { select: { name: true } },
          },
        },
        notice: {
          select: {
            audienceType: true,
            category: true,
            priority: true,
            isPinned: true,
            requiresAcknowledgement: true,
            acknowledgements: {
              where: {
                tenantId: actor.tenantId,
                recipientUserId: actor.userId,
              },
              select: { firstAcknowledgedAt: true },
              take: 1,
            },
            class: { select: { name: true } },
            section: { select: { name: true } },
          },
        },
        event: {
          select: {
            audienceType: true,
            class: { select: { name: true } },
            section: { select: { name: true } },
          },
        },
        activityPost: {
          select: {
            audienceType: true,
            class: { select: { name: true } },
            section: { select: { name: true } },
          },
        },
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return notification;
  }

  private async getNoticeAttachmentDescriptor(
    noticeId: string,
    notificationId: string,
    actor: AuthContext,
  ) {
    const [asset] = await this.fileRegistryService.listFilesByEntity(
      actor.tenantId,
      'notices',
      noticeId,
    );
    if (!asset) {
      return null;
    }

    return {
      id: asset.id,
      fileName: asset.originalFilename,
      mimeType: asset.mimeType,
      sizeBytes: Number(asset.sizeBytes),
      downloadPath: `/mobile/me/notifications/${encodeURIComponent(notificationId)}/attachment`,
    };
  }

  async getStudentProfile(studentId: string, actor: AuthContext) {
    const student = await this.getAccessibleStudent(studentId, actor);
    const [documents, qrCredential] = await Promise.all([
      this.listMobileStudentDocuments(studentId, actor),
      this.prisma.studentQrCredential.findFirst({
        where: {
          tenantId: actor.tenantId,
          studentId,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
          expiresAt: true,
          lastScannedAt: true,
          rotatedAt: true,
          revokedAt: true,
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
    ]);

    return {
      child: toMobileStudent(student),
      profile: {
        classTeacher: student.sectionRef?.classTeacher
          ? {
              id: student.sectionRef.classTeacher.id,
              name: [
                student.sectionRef.classTeacher.firstName,
                student.sectionRef.classTeacher.lastName,
              ]
                .filter(Boolean)
                .join(' '),
            }
          : null,
        studentSystemId: student.studentSystemId,
        admissionNumber: student.admissionNumber,
        admissionDate: toIso(student.admissionDate),
        dateOfBirth: toIso(student.dateOfBirth),
        gender: student.gender,
        bloodGroup: student.bloodGroup,
        nationality: student.nationality,
        lifecycleStatus: student.lifecycleStatus,
        emergencyContact: student.emergencyName
          ? {
              name: student.emergencyName,
              phone: student.emergencyPhone,
            }
          : null,
        medicalSummary: {
          hasMedicalConsent: Boolean(student.medicalConsentAt),
          medicalConditions: student.medicalConsentAt
            ? student.medicalConditions
            : null,
          severeAllergies: student.medicalConsentAt
            ? student.severeAllergies
            : null,
          specialNeeds: student.medicalConsentAt ? student.specialNeeds : null,
        },
        privacy: {
          photoUsageConsent: Boolean(student.photoUsageConsentAt),
          dataProcessingConsent: Boolean(student.dataProcessingConsentedAt),
        },
        documents,
        qrStatus: qrCredential
          ? {
              status: qrCredential.status,
              credentialId: qrCredential.id,
              createdAt: toIso(qrCredential.createdAt),
              expiresAt: toIso(qrCredential.expiresAt),
              lastScannedAt: toIso(qrCredential.lastScannedAt),
              rotatedAt: toIso(qrCredential.rotatedAt),
              revokedAt: toIso(qrCredential.revokedAt),
            }
          : {
              status: 'UNAVAILABLE',
              credentialId: null,
              createdAt: null,
              expiresAt: null,
              lastScannedAt: null,
              rotatedAt: null,
              revokedAt: null,
            },
      },
    };
  }

  async getStudentDocumentDownloadUrl(
    studentId: string,
    documentId: string,
    actor: AuthContext,
  ) {
    await this.assertStudentAccess(
      studentId,
      actor,
      GuardianCapability.ACADEMICS_VIEW,
    );
    const document = await this.prisma.studentDocument.findFirst({
      where: {
        id: documentId,
        tenantId: actor.tenantId,
        studentId,
      },
      select: {
        id: true,
        studentId: true,
        fileId: true,
        kind: true,
        status: true,
        fileName: true,
      },
    });

    if (!document) {
      throw new NotFoundException('Student document not found');
    }

    if (!document.fileId) {
      throw new NotFoundException('Student document file is not available');
    }

    if (!isMobileVisibleStudentDocumentStatus(document.status)) {
      throw new ForbiddenException('Student document is not active');
    }

    const asset = await this.fileRegistryService.getFileMetadata(
      actor.tenantId,
      document.fileId,
    );

    if (asset.status !== FileStatus.UPLOADED) {
      throw new NotFoundException('Student document file is not available');
    }

    if (
      asset.module &&
      asset.module !== 'students' &&
      asset.module !== 'student-documents'
    ) {
      throw new ForbiddenException('Student document file module is invalid');
    }

    if (asset.entityId && asset.entityId !== studentId) {
      throw new ForbiddenException(
        'Student document file is not linked to this student',
      );
    }

    await this.fileRegistryService.auditAccess(
      actor.tenantId,
      asset.id,
      actor.userId,
      'download',
    );

    return {
      documentId: document.id,
      studentId,
      fileName: document.fileName || asset.originalFilename,
      kind: document.kind,
      url: await this.fileRegistryService.getSignedUrl(
        actor.tenantId,
        asset.id,
      ),
      expiresInSeconds: 60,
    };
  }

  async getStudentAttendanceSummary(
    studentId: string,
    actor: AuthContext,
    query?: { month?: number; year?: number },
  ) {
    await this.assertStudentAccess(
      studentId,
      actor,
      GuardianCapability.ATTENDANCE_VIEW,
    );
    return this.attendanceService.getParentSummary(studentId, actor, query);
  }

  async listStudentAttendanceCorrections(
    studentId: string,
    actor: AuthContext,
  ) {
    await this.assertStudentAccess(
      studentId,
      actor,
      GuardianCapability.ATTENDANCE_VIEW,
    );
    return this.attendanceService.listParentCorrectionRequests(
      studentId,
      actor,
    );
  }

  async createStudentAttendanceCorrection(
    studentId: string,
    dto: MobileParentAttendanceCorrectionDto,
    actor: AuthContext,
  ) {
    assertConfirmStudentId(studentId, dto.confirmStudentId);
    await this.assertStudentAccess(
      studentId,
      actor,
      GuardianCapability.COMPLAINT_OR_CORRECTION_SUBMIT,
    );
    return this.attendanceService.createParentCorrectionRequest(
      {
        studentId,
        attendanceDate: dto.attendanceDate,
        requestedStatus: dto.requestedStatus,
        reason: dto.reason,
      },
      actor,
    );
  }

  async cancelStudentAttendanceCorrection(
    studentId: string,
    requestId: string,
    dto: MobileParentAttendanceCorrectionCancelDto,
    actor: AuthContext,
  ) {
    assertConfirmStudentId(studentId, dto.confirmStudentId);
    await this.assertStudentAccess(
      studentId,
      actor,
      GuardianCapability.COMPLAINT_OR_CORRECTION_SUBMIT,
    );
    return this.attendanceService.cancelParentCorrectionRequest(
      requestId,
      dto.reason,
      actor,
    );
  }

  async listStudentServiceRequests(studentId: string, actor: AuthContext) {
    await this.assertStudentAccess(
      studentId,
      actor,
      GuardianCapability.COMPLAINT_OR_CORRECTION_SUBMIT,
    );
    return this.serviceRequestsService.listParentRequests(studentId, actor);
  }

  async createStudentServiceRequest(
    studentId: string,
    dto: CreateSchoolServiceRequestDto,
    actor: AuthContext,
  ) {
    assertConfirmStudentId(studentId, dto.confirmStudentId);
    await this.assertStudentAccess(
      studentId,
      actor,
      GuardianCapability.COMPLAINT_OR_CORRECTION_SUBMIT,
    );
    return this.serviceRequestsService.createParentRequest(
      studentId,
      dto,
      actor,
    );
  }

  async getStudentServiceRequest(requestId: string, actor: AuthContext) {
    return this.serviceRequestsService.getParentRequest(requestId, actor);
  }

  async cancelStudentServiceRequest(
    requestId: string,
    dto: ReasonedSchoolServiceRequestDto,
    actor: AuthContext,
  ) {
    return this.serviceRequestsService.cancelParentRequest(
      requestId,
      dto,
      actor,
    );
  }

  async confirmStudentServiceRequestResolution(
    requestId: string,
    actor: AuthContext,
  ) {
    return this.serviceRequestsService.confirmParentResolution(
      requestId,
      actor,
    );
  }

  async reopenStudentServiceRequest(
    requestId: string,
    dto: ReasonedSchoolServiceRequestDto,
    actor: AuthContext,
  ) {
    return this.serviceRequestsService.reopenParentRequest(
      requestId,
      dto,
      actor,
    );
  }

  async uploadStudentServiceRequestAttachment(
    requestId: string,
    dto: UploadSchoolServiceRequestAttachmentDto,
    actor: AuthContext,
  ) {
    return this.serviceRequestsService.uploadParentAttachment(
      requestId,
      dto,
      actor,
    );
  }

  async downloadStudentServiceRequestAttachment(
    requestId: string,
    attachmentId: string,
    actor: AuthContext,
  ) {
    return this.serviceRequestsService.downloadAttachment(
      requestId,
      attachmentId,
      actor,
    );
  }

  async getStudentFeesSummary(studentId: string, actor: AuthContext) {
    await this.assertStudentAccess(
      studentId,
      actor,
      GuardianCapability.FEES_VIEW,
    );
    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId: actor.tenantId,
        studentId,
        status: { in: ['ISSUED', 'PARTIAL', 'PAID'] },
      },
      include: {
        // The printed receipt has always itemised the bill (see buildReceiptPdf
        // in finance.service.ts). The app showed only a total, so a parent
        // could not tell what a charge was for without the paper copy.
        lines: {
          include: {
            feeHead: { select: { code: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        payments: {
          where: {
            status: 'SUCCESS',
            reversedAt: null,
          },
          select: {
            id: true,
            amount: true,
            method: true,
            paidAt: true,
            receipt: {
              select: {
                id: true,
                receiptNumber: true,
                issuedAt: true,
              },
            },
          },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { issuedAt: 'desc' }],
      take: 20,
    });

    const now = new Date();
    const items = invoices.map((invoice) => {
      const totalAmount = money(invoice.totalAmount);
      const paidAmount = invoice.payments.reduce(
        (sum, payment) => sum + money(payment.amount),
        0,
      );
      const outstandingAmount = Math.max(totalAmount - paidAmount, 0);
      const receipts = invoice.payments.flatMap((payment) => {
        if (!payment.receipt) {
          return [];
        }

        return [
          {
            id: payment.receipt.id,
            receiptNumber: payment.receipt.receiptNumber,
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            paymentId: payment.id,
            amount: money(payment.amount),
            method: payment.method,
            paidAt: toIso(payment.paidAt),
            issuedAt: toIso(payment.receipt.issuedAt),
          },
        ];
      });

      return {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        dueDate: toIso(invoice.dueDate),
        issuedAt: toIso(invoice.issuedAt),
        subtotal: money(invoice.subtotal),
        vatAmount: money(invoice.vatAmount),
        totalAmount,
        paidAmount,
        outstandingAmount,
        isOverdue: outstandingAmount > 0 && invoice.dueDate < now,
        lines: invoice.lines.map((line) => ({
          id: line.id,
          description: line.description,
          feeHead: {
            code: line.feeHead.code,
            name: line.feeHead.name,
          },
          quantity: line.quantity,
          unitAmount: money(line.unitAmount),
          vatAmount: money(line.vatAmount),
          totalAmount: money(line.totalAmount),
        })),
        receipts,
      };
    });
    const recentReceipts = items
      .flatMap((item) => item.receipts)
      .sort(
        (a, b) =>
          timestampOrZero(b.issuedAt ?? b.paidAt) -
          timestampOrZero(a.issuedAt ?? a.paidAt),
      )
      .slice(0, 10);
    const totalAmount = roundMoney(
      items.reduce((sum, item) => sum + item.totalAmount, 0),
    );
    const paidAmount = roundMoney(
      items.reduce((sum, item) => sum + item.paidAmount, 0),
    );
    const totalOutstanding = roundMoney(
      items.reduce((sum, item) => sum + item.outstandingAmount, 0),
    );

    return {
      status:
        totalOutstanding <= 0 ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'DUE',
      totalAmount,
      paidAmount,
      totalOutstanding,
      overdueCount: items.filter((item) => item.isOverdue).length,
      nextDueDate:
        items.find((item) => item.outstandingAmount > 0)?.dueDate ?? null,
      recentInvoices: items.slice(0, 10),
      recentReceipts,
    };
  }

  async getStudentPaymentGatewayReadiness(
    studentId: string,
    actor: AuthContext,
  ) {
    await this.assertStudentAccess(
      studentId,
      actor,
      GuardianCapability.FEES_PAY,
    );
    return this.financeService.getParentPaymentGatewayReadiness();
  }

  async initiateStudentPayment(
    studentId: string,
    dto: InitiateParentPaymentDto,
    actor: AuthContext,
  ) {
    assertConfirmStudentId(studentId, dto.confirmStudentId);
    await this.assertStudentAccess(
      studentId,
      actor,
      GuardianCapability.FEES_PAY,
    );
    return this.financeService.initiateParentOnlinePayment(
      studentId,
      dto,
      actor,
    );
  }

  async collectStudentSandboxFeePayment(
    studentId: string,
    dto: ParentSandboxFeePaymentDto,
    actor: AuthContext,
  ) {
    assertConfirmStudentId(studentId, dto.confirmStudentId);
    await this.assertStudentAccess(
      studentId,
      actor,
      GuardianCapability.FEES_PAY,
    );
    return this.financeService.collectParentSandboxPayment(
      studentId,
      dto,
      actor,
    );
  }

  async topUpStudentCanteenSandbox(
    studentId: string,
    dto: ParentSandboxCanteenTopUpDto,
    actor: AuthContext,
  ) {
    assertConfirmStudentId(studentId, dto.confirmStudentId);
    await this.assertStudentAccess(
      studentId,
      actor,
      GuardianCapability.FEES_PAY,
    );
    const readiness =
      await this.financeService.getParentPaymentGatewayReadiness();
    if (!('sandbox' in readiness) || !readiness.sandbox) {
      throw new ForbiddenException('Parent sandbox top-up is disabled.');
    }
    const result = await this.canteenService.topUpWallet(
      studentId,
      {
        amount: dto.amount,
        note: `Parent sandbox top-up via ${dto.provider}`,
        idempotencyKey: `parent-sandbox-canteen:${dto.idempotencyKey}`,
        paymentMethod: PaymentMethod.MOBILE,
      },
      actor,
    );
    return {
      sandbox: true,
      status: 'SUCCEEDED',
      provider: dto.provider,
      amount: dto.amount,
      wallet: {
        id: result.wallet.id,
        balance: money(result.wallet.balance),
      },
      transactionId: result.transaction.id,
    };
  }

  async getStudentReceiptPdf(
    studentId: string,
    receiptNumber: string,
    actor: AuthContext,
  ) {
    await this.assertStudentAccess(
      studentId,
      actor,
      GuardianCapability.FEES_VIEW,
    );
    return this.financeService.getReceiptPdfForStudent(
      receiptNumber,
      studentId,
      actor,
    );
  }

  async getMyConsentStatus(actor: AuthContext) {
    const authorizedStudentIds = await this.getAllowedStudentIds(
      actor,
      GuardianCapability.SPECIFIC_CONSENT_GIVE,
    );
    if (authorizedStudentIds.length === 0) {
      throw createGuardianCapabilityDeniedException(
        GuardianCapability.SPECIFIC_CONSENT_GIVE,
      );
    }

    const guardian = await this.prisma.guardian.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
      select: { id: true },
    });

    if (!guardian) {
      throw new ForbiddenException('Parent consent status is not available');
    }

    const items = await this.communicationsService.getGuardianConsentStatus(
      guardian.id,
      actor,
    );

    return {
      guardianId: guardian.id,
      items: items.map((item) => ({
        ...item,
        capturedAt: toIso(item.capturedAt),
        revokedAt: toIso(item.revokedAt),
      })),
    };
  }

  async decideMyConsent(
    dto: MobileParentConsentDecisionDto,
    actor: AuthContext,
  ) {
    const authorizedStudentIds = await this.getAllowedStudentIds(
      actor,
      GuardianCapability.SPECIFIC_CONSENT_GIVE,
    );
    if (authorizedStudentIds.length === 0) {
      throw createGuardianCapabilityDeniedException(
        GuardianCapability.SPECIFIC_CONSENT_GIVE,
      );
    }
    assertConfirmStudentIdAllowed(dto.confirmStudentId, authorizedStudentIds);

    const guardian = await this.prisma.guardian.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
      select: {
        id: true,
        studentLinks: {
          where: { studentId: { in: authorizedStudentIds } },
          select: { studentId: true },
          take: 1,
        },
      },
    });

    if (!guardian || guardian.studentLinks.length === 0) {
      throw new ForbiddenException('Parent consent decision is not available');
    }

    const consent = await this.communicationsService.captureConsent(
      {
        guardianId: guardian.id,
        consentType: dto.consentType,
        version: dto.version,
        granted: dto.granted,
        metadata: {
          ...(dto.metadata ?? {}),
          source: 'mobile_guardian',
          childLinkVerified: true,
        },
      },
      actor,
    );

    return {
      consentType: consent.consentType,
      granted: consent.granted,
      version: consent.version,
      capturedAt: toIso(consent.capturedAt),
      revokedAt: toIso(consent.revokedAt),
    };
  }

  async getStudentActivityFeed(
    studentId: string,
    actor: AuthContext,
    take?: string,
    category?: string,
    month?: string,
  ) {
    const student = await this.getAccessibleStudent(studentId, actor);

    // Same predicate as the check `getAccessibleStudent` just applied
    // (it defaults to ACADEMICS_VIEW), so in practice this branch is only
    // reachable when that call already succeeded. It is kept because it owns a
    // distinct error message, but it now reads the memoized relationship
    // instead of re-issuing the Guardian + StudentGuardian query pair.
    const guardianLink = await this.parentScope.tryGuardianCapability(
      actor,
      studentId,
      GuardianCapability.ACADEMICS_VIEW,
    );
    if (!guardianLink) {
      throw new ForbiddenException(
        'This child is not linked to your guardian account',
      );
    }
    const guardian = { id: guardianLink.guardianId };
    const monthRange = month ? parseMonthRange(month) : null;
    const tenantId = actor.tenantId;
    const audienceWhere = {
      tenantId,
      status: 'APPROVED' as const,
      softDeletedAt: null,
      parentVisible: true,
      ...(category ? { category: category as ActivityCategory } : {}),
      ...(monthRange
        ? { publishedAt: { gte: monthRange.start, lt: monthRange.end } }
        : {}),
      OR: [
        { audienceType: 'ALL' as const },
        { audienceType: 'STUDENT' as const, studentTags: { some: { studentId } } },
        { audienceType: 'CLASS' as const, classId: student.classId },
        {
          audienceType: 'SECTION' as const,
          classId: student.classId,
          sectionId: student.sectionId,
        },
      ],
    };

    // Phase 1 — root posts only. Prisma resolves every `include` as its own
    // round-trip even when no rows match; the previous version cost ~8
    // statements for a single dashboard preview post.
    const posts = await this.prisma.activityPost.findMany({
      where: audienceWhere,
      select: {
        id: true,
        title: true,
        caption: true,
        category: true,
        publishedAt: true,
        createdAt: true,
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: boundedTake(take, 20),
    });

    if (posts.length === 0) {
      return { items: [] };
    }

    const postIds = posts.map((post) => post.id);

    // Phase 2 — batched attachment and reaction lookups for the bounded
    // result set only. Counts are derived in memory instead of `_count`
    // aggregates that each cost an extra round-trip.
    const [attachments, reactions] = await Promise.all([
      this.prisma.activityAttachment.findMany({
        where: { tenantId, activityPostId: { in: postIds } },
        select: {
          id: true,
          activityPostId: true,
          fileName: true,
          contentType: true,
          sizeBytes: true,
          processingStatus: true,
          thumbnailFileAssetId: true,
          optimizedObjectKey: true,
          sortOrder: true,
        },
        orderBy: [{ sortOrder: 'asc' }],
      }),
      this.prisma.activityReaction.findMany({
        where: { tenantId, activityPostId: { in: postIds } },
        select: {
          activityPostId: true,
          guardianId: true,
          reaction: true,
          createdAt: true,
        },
      }),
    ]);

    const attachmentsByPost = new Map<string, typeof attachments>();
    for (const attachment of attachments) {
      const list = attachmentsByPost.get(attachment.activityPostId) ?? [];
      list.push(attachment);
      attachmentsByPost.set(attachment.activityPostId, list);
    }

    const reactionsByPost = new Map<string, typeof reactions>();
    for (const reaction of reactions) {
      const list = reactionsByPost.get(reaction.activityPostId) ?? [];
      list.push(reaction);
      reactionsByPost.set(reaction.activityPostId, list);
    }

    return {
      items: posts.map((post) => {
        const postAttachments = attachmentsByPost.get(post.id) ?? [];
        const postReactions = reactionsByPost.get(post.id) ?? [];
        const seenReaction = postReactions.find(
          (reaction) =>
            reaction.guardianId === guardian.id && reaction.reaction === 'SEEN',
        );

        return {
          id: post.id,
          title: post.title,
          caption: post.caption,
          category: post.category,
          publishedAt: toIso(post.publishedAt ?? post.createdAt),
          seenAt: toIso(seenReaction?.createdAt ?? null),
          attachmentCount: postAttachments.length,
          reactionCount: postReactions.length,
          attachments: postAttachments.map((attachment) => ({
            id: attachment.id,
            fileName: attachment.fileName,
            contentType: attachment.contentType,
            sizeBytes: attachment.sizeBytes,
            processingStatus: attachment.processingStatus,
            thumbnailPath:
              attachment.thumbnailFileAssetId || attachment.optimizedObjectKey
                ? `/activity-feed/attachments/${encodeURIComponent(
                    attachment.id,
                  )}/thumbnail`
                : null,
            previewPath: `/activity-feed/attachments/${encodeURIComponent(
              attachment.id,
            )}/preview`,
          })),
        };
      }),
    };
  }

  async getStudentHomework(
    studentId: string,
    actor: AuthContext,
    take?: string,
  ) {
    const student = await this.getAccessibleStudent(studentId, actor);
    const assignments = await this.prisma.homeworkAssignment.findMany({
      where: {
        tenantId: actor.tenantId,
        classId: student.classId,
        status: { in: ['ASSIGNED', 'CLOSED'] },
        OR: [{ sectionId: null }, { sectionId: student.sectionId }],
      },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        assignedByStaff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        submissions: {
          where: {
            tenantId: actor.tenantId,
            studentId,
          },
          select: {
            id: true,
            status: true,
            submittedAt: true,
            score: true,
            feedback: true,
            returnedAt: true,
          },
          take: 1,
        },
        _count: {
          select: {
            attachments: true,
          },
        },
      },
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      take: boundedTake(take, 30),
    });

    return {
      items: assignments.map((assignment) => {
        const submission = assignment.submissions[0];
        return {
          id: assignment.id,
          title: assignment.title,
          subject: assignment.subject,
          status: assignment.status,
          assignedDate: toIso(assignment.assignedDate),
          dueDate: toIso(assignment.dueDate),
          dueAt: toIso(assignment.dueAt),
          submissionRequired: assignment.submissionRequired,
          submissionStatus: submission?.status ?? 'NOT_SUBMITTED',
          submittedAt: toIso(submission?.submittedAt),
          score: submission?.score === null ? null : money(submission?.score),
          maxScore:
            assignment.maxScore === null ? null : money(assignment.maxScore),
          feedback: submission?.feedback ?? null,
          attachmentCount: assignment._count.attachments,
          assignedBy: assignment.assignedByStaff
            ? {
                id: assignment.assignedByStaff.id,
                name: [
                  assignment.assignedByStaff.firstName,
                  assignment.assignedByStaff.lastName,
                ]
                  .filter(Boolean)
                  .join(' ')
                  .trim(),
              }
            : null,
        };
      }),
    };
  }

  async getStudentHomeworkAttachments(
    studentId: string,
    homeworkId: string,
    actor: AuthContext,
  ) {
    const assignment = await this.getVisibleHomeworkAssignment(
      studentId,
      homeworkId,
      actor,
    );

    return {
      homeworkId: assignment.id,
      items: assignment.attachments.map((attachment) => ({
        id: attachment.id,
        fileName: attachment.fileAsset.originalFilename,
        mimeType: attachment.fileAsset.mimeType,
        sizeBytes: Number(attachment.fileAsset.sizeBytes),
        createdAt: toIso(attachment.createdAt),
      })),
    };
  }

  async getStudentHomeworkAttachmentDownloadUrl(
    studentId: string,
    homeworkId: string,
    attachmentId: string,
    actor: AuthContext,
  ) {
    const assignment = await this.getVisibleHomeworkAssignment(
      studentId,
      homeworkId,
      actor,
    );
    const visibleAttachment = assignment.attachments.find(
      (attachment) => attachment.id === attachmentId,
    );

    if (!visibleAttachment) {
      throw new NotFoundException('Homework attachment not found');
    }

    return this.homeworkAttachmentAccessService.getAttachmentAccessUrl(
      attachmentId,
      actor,
      'download',
    );
  }

  async getStudentTimetable(studentId: string, actor: AuthContext) {
    const student = await this.getAccessibleStudent(studentId, actor);
    const version = await this.prisma.timetableVersion.findFirst({
      where: {
        tenantId: actor.tenantId,
        classId: student.classId,
        status: { in: ['PUBLISHED', 'LOCKED'] },
        OR: [{ sectionId: null }, { sectionId: student.sectionId }],
      },
      orderBy: [{ publishedAt: 'desc' }, { effectiveFrom: 'desc' }],
    });

    if (!version) {
      return { version: null, slots: [] };
    }

    const slots = await this.prisma.timetableSlot.findMany({
      where: {
        tenantId: actor.tenantId,
        versionId: version.id,
        classId: student.classId,
        OR: [{ sectionId: null }, { sectionId: student.sectionId }],
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        staff: { select: { id: true, firstName: true, lastName: true } },
        period: { select: { id: true, name: true, sortOrder: true } },
        roomRef: { select: { id: true, name: true } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { startsAt: 'asc' }],
    });

    return {
      version: {
        id: version.id,
        name: version.versionName,
        status: version.status,
        effectiveFrom: toIso(version.effectiveFrom),
        effectiveTo: toIso(version.effectiveTo),
      },
      slots: slots.map((slot) => ({
        id: slot.id,
        dayOfWeek: slot.dayOfWeek,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        subject: slot.subject,
        teacherName: [slot.staff.firstName, slot.staff.lastName]
          .filter(Boolean)
          .join(' '),
        period: slot.period,
        room: slot.roomRef?.name ?? slot.room ?? null,
      })),
    };
  }

  async getStudentReportCards(studentId: string, actor: AuthContext) {
    await this.assertStudentAccess(
      studentId,
      actor,
      GuardianCapability.ACADEMICS_VIEW,
    );
    const reportCards = await this.prisma.reportCard.findMany({
      where: {
        tenantId: actor.tenantId,
        studentId,
        isCurrent: true,
        publishStatus: 'PUBLISHED',
      },
      include: {
        academicYear: { select: { id: true, name: true } },
        examTerm: { select: { id: true, name: true } },
        subjectResults: {
          orderBy: [{ subjectCode: 'asc' }, { subjectName: 'asc' }],
        },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    });

    return {
      items: reportCards.map((card) => ({
        id: card.id,
        academicYear: card.academicYear,
        examTerm: card.examTerm,
        totalMarks: money(card.totalMarks),
        maxMarks: money(card.maxMarks),
        percentage: money(card.percentage),
        grade: card.grade,
        gpa: money(card.gpa),
        remarks: card.remarks,
        publishedAt: toIso(card.publishedAt),
        hasFile: Boolean(card.fileId),
        attendancePercentage: null,
        classTeacherRemark: card.remarks,
        subjects: card.subjectResults
          .filter((subject) => subject.version === card.version)
          .map((subject) => ({
            subjectId: subject.subjectId,
            subjectName: subject.subjectName,
            marksObtained: money(subject.marksObtained),
            maxMarks: money(subject.maxMarks),
            percentage: money(subject.percentage),
            grade: subject.grade,
          })),
      })),
    };
  }

  async getStudentExamSchedule(studentId: string, actor: AuthContext) {
    const student = await this.getAccessibleStudent(studentId, actor);
    const enrollment = student.enrollments[0];
    if (!enrollment) {
      return { academicYear: null, items: [] };
    }

    const items = await this.prisma.examTimetableSlot.findMany({
      where: {
        tenantId: actor.tenantId,
        academicYearId: enrollment.academicYearId,
        classId: student.classId,
        publishedAt: { not: null },
        OR: student.sectionId
          ? [{ sectionId: null }, { sectionId: student.sectionId }]
          : [{ sectionId: null }],
      },
      include: {
        examTerm: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ startsAt: 'asc' }, { subject: { code: 'asc' } }],
      take: 100,
    });

    return {
      academicYear: {
        id: enrollment.academicYearId,
        name: enrollment.academicYear.name,
      },
      items: items.map((item) => ({
        id: item.id,
        examTerm: item.examTerm,
        subject: item.subject,
        startsAt: item.startsAt.toISOString(),
        endsAt: item.endsAt.toISOString(),
        room: item.room,
        publishedAt: item.publishedAt?.toISOString() ?? '',
      })),
    };
  }

  async getStudentReportCardPdf(
    studentId: string,
    reportCardId: string,
    actor: AuthContext,
  ) {
    await this.assertStudentAccess(
      studentId,
      actor,
      GuardianCapability.ACADEMICS_VIEW,
    );
    const reportCard = await this.prisma.reportCard.findFirst({
      where: {
        id: reportCardId,
        tenantId: actor.tenantId,
        studentId,
        isCurrent: true,
        publishStatus: 'PUBLISHED',
      },
      select: { id: true },
    });

    if (!reportCard) {
      throw new NotFoundException('Published report card not found');
    }

    return this.reportCardPdfService.getReportCardPdf(reportCard.id, actor);
  }

  async getStudentCanteen(studentId: string, actor: AuthContext) {
    await this.assertStudentAccess(
      studentId,
      actor,
      GuardianCapability.FEES_VIEW,
    );
    const [wallet, enrollments, recentTransactions, menuItems, recentServings] =
      await Promise.all([
        this.prisma.canteenWallet.findFirst({
          where: { tenantId: actor.tenantId, studentId },
        }),
        this.prisma.canteenStudentEnrollment.findMany({
          where: {
            tenantId: actor.tenantId,
            studentId,
            status: 'ACTIVE',
          },
          include: {
            mealPlan: {
              select: {
                id: true,
                name: true,
                mealType: true,
                price: true,
                billingFrequency: true,
              },
            },
          },
          orderBy: [{ startsOn: 'desc' }],
          take: 5,
        }),
        this.prisma.canteenWalletTransaction.findMany({
          where: { tenantId: actor.tenantId, studentId },
          orderBy: [{ transactionDate: 'desc' }],
          take: 10,
        }),
        this.prisma.canteenMenuItem.findMany({
          where: { tenantId: actor.tenantId, status: 'ACTIVE' },
          orderBy: [{ category: 'asc' }, { name: 'asc' }],
          take: 25,
        }),
        this.prisma.canteenMealServing.findMany({
          where: { tenantId: actor.tenantId, studentId },
          select: {
            id: true,
            mealType: true,
            mealDate: true,
            servedAt: true,
            status: true,
            notes: true,
            mealPlan: { select: { name: true } },
          },
          orderBy: [{ mealDate: 'desc' }, { servedAt: 'desc' }],
          take: 30,
        }),
      ]);

    return {
      wallet: wallet
        ? {
            id: wallet.id,
            balance: money(wallet.balance),
            lowBalanceThreshold: money(wallet.lowBalanceThreshold),
            isLowBalance:
              money(wallet.balance) <= money(wallet.lowBalanceThreshold),
          }
        : null,
      activeMealPlans: enrollments.map((enrollment) => ({
        id: enrollment.id,
        status: enrollment.status,
        startsOn: toIso(enrollment.startsOn),
        endsOn: toIso(enrollment.endsOn),
        mealPlan: {
          ...enrollment.mealPlan,
          price: money(enrollment.mealPlan.price),
        },
      })),
      recentTransactions: recentTransactions.map((transaction) => ({
        id: transaction.id,
        type: transaction.type,
        source: transaction.source,
        amount: money(transaction.amount),
        balanceAfter: money(transaction.balanceAfter),
        transactionDate: toIso(transaction.transactionDate),
        note: transaction.note,
      })),
      menuItems: menuItems.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        description: item.description,
        unitPrice: money(item.unitPrice),
        isMealItem: item.isMealItem,
        allergenTags: item.allergenTags,
      })),
      recentServings: recentServings.map((serving) => ({
        id: serving.id,
        mealType: serving.mealType,
        mealDate: toIso(serving.mealDate),
        servedAt: toIso(serving.servedAt),
        status: serving.status,
        notes: serving.notes,
        mealPlanName: serving.mealPlan?.name ?? null,
      })),
    };
  }

  async getStudentLibrary(studentId: string, actor: AuthContext) {
    await this.assertStudentAccess(
      studentId,
      actor,
      GuardianCapability.ACADEMICS_VIEW,
    );
    const [issues, fines] = await Promise.all([
      this.prisma.libraryIssue.findMany({
        where: {
          tenantId: actor.tenantId,
          borrowerStudentId: studentId,
        },
        include: {
          copy: {
            include: {
              book: {
                select: {
                  id: true,
                  title: true,
                  author: true,
                },
              },
            },
          },
        },
        orderBy: [{ dueAt: 'asc' }],
        take: 20,
      }),
      this.prisma.libraryFine.findMany({
        where: {
          tenantId: actor.tenantId,
          issue: {
            borrowerStudentId: studentId,
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        take: 20,
      }),
    ]);

    return {
      activeIssues: issues
        .filter(
          (issue) => issue.status === 'ISSUED' || issue.status === 'OVERDUE',
        )
        .map((issue) => ({
          id: issue.id,
          status: issue.status,
          issuedAt: toIso(issue.issuedAt),
          dueAt: toIso(issue.dueAt),
          fineAmount: money(issue.fineAmount),
          book: issue.copy.book,
          copy: {
            id: issue.copy.id,
            barcode: issue.copy.barcode,
            shelfLocation: issue.copy.shelfLocation,
          },
        })),
      recentHistory: issues.slice(0, 10).map((issue) => ({
        id: issue.id,
        status: issue.status,
        issuedAt: toIso(issue.issuedAt),
        returnedAt: toIso(issue.returnedAt),
        book: issue.copy.book,
      })),
      fines: fines.map((fine) => ({
        id: fine.id,
        status: fine.status,
        amount: money(fine.amount),
        waivedAmount: money(fine.waivedAmount),
        feeInvoiceId: fine.feeInvoiceId,
      })),
    };
  }

  async getStudentTransport(studentId: string, actor: AuthContext) {
    await this.assertStudentAccess(
      studentId,
      actor,
      GuardianCapability.EMERGENCY_ALERT_RECEIVE,
    );
    const tenantId = actor.tenantId;

    // Phase 1 — the three independent root rows, in parallel.
    //
    // These deliberately select scalars and foreign keys only, with no
    // `include`. Prisma issues every included relation as its own round-trip
    // *even when the root row is null*: measured against a child with no
    // transport at all, the previous `include`-based version cost 12
    // statements, 9 of which resolved relations of rows that did not exist.
    // Most children are not transported, so that was the common case.
    //
    // The `trip: { status: 'ACTIVE' }` filter stays a relation *filter*, not an
    // include, so it remains part of this single statement.
    const [assignment, enrollment, activeStatus] = await Promise.all([
      this.prisma.transportStudentAssignment.findFirst({
        where: { tenantId, studentId, status: 'ACTIVE' },
        select: {
          id: true,
          routeId: true,
          stopId: true,
          pickupDirection: true,
          status: true,
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
      this.prisma.transportEnrollment.findFirst({
        where: { tenantId, studentId, status: 'ACTIVE' },
        select: {
          id: true,
          routeId: true,
          stopId: true,
          feeAmount: true,
          status: true,
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
      this.prisma.transportTripStudentStatus.findFirst({
        where: {
          tenantId,
          studentId,
          trip: {
            status: 'ACTIVE',
          },
        },
        select: { id: true, tripId: true, stopId: true, status: true },
        orderBy: [{ updatedAt: 'desc' }],
      }),
    ]);

    // Phase 2 — the active trip, only when the student is actually on one.
    const trip = activeStatus
      ? await this.prisma.transportTrip.findFirst({
          where: { tenantId, id: activeStatus.tripId },
          select: {
            id: true,
            routeId: true,
            vehicleId: true,
            direction: true,
            status: true,
            isDelayed: true,
            delayMinutes: true,
            delayReason: true,
          },
        })
      : null;

    // Phase 3 — batched reference lookups.
    //
    // Route and stop were each fetched three times (once per root row). They
    // are now resolved with one set-based query apiece over the ids actually
    // referenced. Every lookup stays tenant-scoped, so a reference pointing at
    // another tenant's route, stop, or vehicle resolves to null rather than
    // being returned.
    const routeIds = uniqueIds([
      assignment?.routeId,
      enrollment?.routeId,
      trip?.routeId,
    ]);
    const stopIds = uniqueIds([
      assignment?.stopId,
      enrollment?.stopId,
      activeStatus?.stopId,
    ]);

    const [routes, stops, vehicle, latestPing] = await Promise.all([
      routeIds.length
        ? this.prisma.transportRoute.findMany({
            where: { tenantId, id: { in: routeIds } },
            select: { id: true, name: true, code: true },
          })
        : Promise.resolve([]),
      stopIds.length
        ? this.prisma.transportStop.findMany({
            where: { tenantId, id: { in: stopIds } },
            select: { id: true, name: true, sequence: true },
          })
        : Promise.resolve([]),
      trip
        ? this.prisma.transportVehicle.findFirst({
            where: { tenantId, id: trip.vehicleId },
            select: {
              id: true,
              registrationNumber: true,
              model: true,
              capacity: true,
            },
          })
        : Promise.resolve(null),
      trip
        ? // Only the latest verified position is needed; raw GPS history is
          // never loaded.
          this.prisma.transportLocationPing.findFirst({
            where: { tenantId, tripId: trip.id },
            select: {
              latitude: true,
              longitude: true,
              speedKph: true,
              recordedAt: true,
            },
            orderBy: [{ recordedAt: 'desc' }],
          })
        : Promise.resolve(null),
    ]);

    const routeById = new Map(
      routes.map((route) => [route.id, route] as const),
    );
    const stopById = new Map(stops.map((stop) => [stop.id, stop] as const));
    const routeFor = (id?: string) => (id ? (routeById.get(id) ?? null) : null);
    const stopFor = (id?: string) => (id ? (stopById.get(id) ?? null) : null);

    return {
      assignment: assignment
        ? {
            id: assignment.id,
            route: routeFor(assignment.routeId),
            stop: stopFor(assignment.stopId),
            pickupDirection: assignment.pickupDirection,
            status: assignment.status,
          }
        : null,
      enrollment: enrollment
        ? {
            id: enrollment.id,
            route: routeFor(enrollment.routeId),
            stop: stopFor(enrollment.stopId),
            feeAmount: money(enrollment.feeAmount),
            status: enrollment.status,
          }
        : null,
      // `activeTrip` is emitted only when the trip row itself resolved. The
      // previous shape dereferenced `activeStatus.trip` unconditionally, which
      // was safe only because the include always materialised it; resolving the
      // trip separately makes the null case explicit rather than a crash.
      activeTrip:
        activeStatus && trip
          ? {
              id: trip.id,
              route: routeFor(trip.routeId),
              vehicle,
              direction: trip.direction,
              status: trip.status,
              studentStatus: activeStatus.status,
              stop: stopFor(activeStatus.stopId),
              isDelayed: trip.isDelayed,
              delayMinutes: trip.delayMinutes,
              delayReason: trip.delayReason,
              latestLocation: latestPing
                ? {
                    latitude: money(latestPing.latitude),
                    longitude: money(latestPing.longitude),
                    speedKph:
                      latestPing.speedKph === null
                        ? null
                        : money(latestPing.speedKph),
                    recordedAt: toIso(latestPing.recordedAt),
                    ...transportLocationFreshness(latestPing.recordedAt),
                  }
                : null,
            }
          : null,
    };
  }

  private async listMobileStudentDocuments(
    studentId: string,
    actor: AuthContext,
  ) {
    const documents = await this.prisma.studentDocument.findMany({
      where: {
        tenantId: actor.tenantId,
        studentId,
        fileId: { not: null },
        status: {
          in: ['ACTIVE', 'VERIFIED'],
        },
      },
      select: {
        id: true,
        kind: true,
        status: true,
        title: true,
        fileName: true,
        contentType: true,
        sizeBytes: true,
        expiryDate: true,
        verifiedAt: true,
        createdAt: true,
      },
      orderBy: [{ verifiedAt: 'desc' }, { createdAt: 'desc' }],
      take: 20,
    });

    return documents.map((document) => ({
      id: document.id,
      kind: document.kind,
      status: document.status,
      title: document.title,
      fileName: document.fileName,
      mimeType: document.contentType,
      sizeBytes: document.sizeBytes,
      expiryDate: toIso(document.expiryDate),
      verifiedAt: toIso(document.verifiedAt),
      uploadedAt: toIso(document.createdAt),
      downloadPath: `/mobile/students/${encodeURIComponent(
        studentId,
      )}/documents/${encodeURIComponent(document.id)}/download-url`,
    }));
  }

  private async getAccessibleStudent(
    studentId: string,
    actor: AuthContext,
    capability = GuardianCapability.ACADEMICS_VIEW,
  ) {
    await this.assertStudentAccess(studentId, actor, capability);

    // The `include` is unchanged, so the mapped response is byte-identical.
    // Only the number of times this query is issued changes: three dashboard
    // sub-services (profile, homework, activity feed) each called this for the
    // same child.
    const student = await this.parentScope.accessibleStudent(
      actor,
      studentId,
      accessibleStudentInclude(actor.userId),
    );

    if (!student) {
      throw new NotFoundException('Student not found in this school.');
    }

    return student;
  }

  private async getVisibleHomeworkAssignment(
    studentId: string,
    homeworkId: string,
    actor: AuthContext,
  ) {
    const student = await this.getAccessibleStudent(studentId, actor);
    const assignment = await this.prisma.homeworkAssignment.findFirst({
      where: {
        id: homeworkId,
        tenantId: actor.tenantId,
        classId: student.classId,
        status: { in: ['ASSIGNED', 'CLOSED'] },
        OR: [{ sectionId: null }, { sectionId: student.sectionId }],
      },
      include: {
        attachments: {
          include: {
            fileAsset: {
              select: {
                id: true,
                originalFilename: true,
                mimeType: true,
                sizeBytes: true,
              },
            },
          },
          orderBy: [{ createdAt: 'asc' }],
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException('Homework assignment not found');
    }

    return assignment;
  }

  /**
   * Unchanged authorization semantics: student existence is still checked
   * before capability, the capability branch still short-circuits, and the
   * fallback still requires the student to be in this parent's allowed set.
   *
   * The queries now go through `ParentScopeContextService`, which memoizes
   * them for the lifetime of the request. The dashboard calls this helper
   * seven times across its sub-services; previously each call re-issued the
   * same student and guardian lookups.
   */
  private async assertStudentAccess(
    studentId: string,
    actor: AuthContext,
    capability?: GuardianCapability,
  ) {
    const student = await this.parentScope.activeStudent(actor, studentId);

    if (!student) {
      throw new NotFoundException('Student not found in this school.');
    }

    if (capability) {
      await this.parentScope.guardianCapability(actor, studentId, capability);
      return;
    }

    const allowedStudentIds = await this.getAllowedStudentIds(actor);
    if (!allowedStudentIds.includes(studentId)) {
      throw new ForbiddenException('Mobile access denied for this student.');
    }
  }

  private parentNotificationVisibility(
    actor: AuthContext,
    studentIds: string[],
    childScoped = false,
  ) {
    void childScoped;
    return {
      tenantId: actor.tenantId,
      AND: [
        {
          OR: [
            { recipientUserId: actor.userId, studentId: null },
            ...(studentIds.length > 0
              ? [{ studentId: { in: studentIds } }]
              : []),
          ],
        },
        {
          OR: [
            { noticeId: null },
            { notice: { is: { lifecycleStatus: 'PUBLISHED' as const } } },
          ],
        },
      ],
    };
  }

  private countUnreadNotifications(
    actor: AuthContext,
    studentIds: string[],
    childScoped = false,
  ) {
    return this.prisma.notificationDelivery.count({
      where: {
        ...this.parentNotificationVisibility(actor, studentIds, childScoped),
        readReceipts: {
          none: { tenantId: actor.tenantId, userId: actor.userId },
        },
      },
    });
  }

  /**
   * Notification visibility is the union of "addressed to me" and "about one
   * of my children". Only the second half is parent-specific, so a teacher or
   * principal has a legitimate, non-empty answer here: their own deliveries.
   * Resolving the child fan-out through `getAllowedStudentIds` made every
   * notification route 403 for staff, which broke the unread count on the
   * teacher dashboard. Non-parents simply get no child fan-out.
   */
  private async getNotificationStudentScope(actor: AuthContext) {
    if (!isParentOnly(actor)) {
      return [];
    }

    return this.getAllowedStudentIds(actor);
  }

  private async getAllowedStudentIds(
    actor: AuthContext,
    capability?: GuardianCapability,
  ) {
    if (!isParentOnly(actor)) {
      throw new ForbiddenException('Mobile student scope is not available');
    }

    // Same query and same guard, memoized for this request only. The dashboard
    // resolved this set at least twice per call (child list + notification
    // fan-out) and `assertStudentAccess` resolved it again per sub-service.
    return this.parentScope.allowedStudentIds(actor, capability);
  }
}

/**
 * Collapse a set of optional foreign keys into a deduplicated id list for a
 * batched `findMany`. Sorted so the generated `IN (...)` list — and therefore
 * the query plan and any query-log diff — is stable across requests.
 */
function uniqueIds(ids: Array<string | undefined | null>): string[] {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))].sort();
}

function transportLocationFreshness(recordedAt: Date) {
  const ageSeconds = Math.max(
    0,
    Math.floor((Date.now() - recordedAt.getTime()) / 1000),
  );
  const confidence =
    ageSeconds > 600 ? 'stale' : ageSeconds > 120 ? 'delayed' : 'fresh';

  return {
    ageSeconds,
    confidence,
    isStale: confidence === 'stale',
  };
}

function parentNotificationRoute(item: {
  id: string;
  sourceType: string;
  sourceId: string;
  studentId: string | null;
  noticeId: string | null;
  eventId: string | null;
  activityPostId: string | null;
}) {
  const source = item.sourceType.toLowerCase();
  if (item.noticeId || source.includes('notice')) {
    return `/notices/${item.id}`;
  }
  if (source.includes('message')) {
    return '/notifications';
  }
  if (source.includes('homework')) {
    return `/parent/homework/${encodeURIComponent(item.sourceId)}`;
  }
  if (item.eventId || source.includes('event')) {
    return `/parent/updates?eventId=${encodeURIComponent(item.eventId ?? item.sourceId)}`;
  }
  if (item.activityPostId || source.includes('gallery')) {
    return `/parent/activity?postId=${encodeURIComponent(item.activityPostId ?? item.sourceId)}`;
  }
  if (
    source.includes('fee') ||
    source.includes('invoice') ||
    source.includes('payment')
  ) {
    return `/parent/fees?invoiceId=${encodeURIComponent(item.sourceId)}`;
  }
  if (source.includes('attendance') && item.studentId) {
    return `/parent/children/${encodeURIComponent(item.studentId)}/attendance`;
  }
  if (
    (source.includes('transport') || source.includes('trip')) &&
    item.studentId
  ) {
    return `/parent/more/transport?childId=${encodeURIComponent(item.studentId)}`;
  }
  return '/parent/updates';
}

function parentNotificationAudience(item: {
  audienceType: string;
  studentId: string | null;
  student?: {
    firstNameEn: string;
    lastNameEn: string;
    class: { name: string };
    sectionRef: { name: string } | null;
  } | null;
  notice?: {
    audienceType: string;
    class: { name: string } | null;
    section: { name: string } | null;
  } | null;
  event?: {
    audienceType: string;
    class: { name: string } | null;
    section: { name: string } | null;
  } | null;
  activityPost?: {
    audienceType: string;
    class: { name: string } | null;
    section: { name: string } | null;
  } | null;
}) {
  const source = item.notice ?? item.event ?? item.activityPost;
  const audienceType = source?.audienceType ?? item.audienceType;
  const className = source?.class?.name ?? item.student?.class.name ?? null;
  const sectionName =
    source?.section?.name ?? item.student?.sectionRef?.name ?? null;
  const childName = item.student
    ? [item.student.firstNameEn, item.student.lastNameEn]
        .filter(Boolean)
        .join(' ')
    : null;

  if (audienceType === 'STUDENT' || item.studentId) {
    return {
      type: 'STUDENT',
      label: childName ? `For ${childName}` : 'For a specific child',
      childName,
      className,
      sectionName,
    };
  }
  if (audienceType === 'SECTION') {
    return {
      type: 'SECTION',
      label: [className, sectionName].filter(Boolean).join(' - ') || 'Section',
      childName: null,
      className,
      sectionName,
    };
  }
  if (audienceType === 'CLASS') {
    return {
      type: 'CLASS',
      label: className ? `Class: ${className}` : 'Specific class',
      childName: null,
      className,
      sectionName: null,
    };
  }
  if (audienceType === 'ROLE') {
    return {
      type: 'ROLE',
      label: 'Parent-specific update',
      childName: null,
      className: null,
      sectionName: null,
    };
  }
  return {
    type: 'ALL',
    label: 'Whole school',
    childName: null,
    className: null,
    sectionName: null,
  };
}

function parentActionChild(child: {
  id: string;
  name: string;
  classSection: string;
}) {
  return {
    id: child.id,
    name: child.name,
    classSection: child.classSection,
  };
}

function parentActionPriorityForDate(
  value: string | null | undefined,
): ParentActionPriority {
  if (!value) return 'NORMAL';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 'NORMAL';
  const remaining = timestamp - Date.now();
  if (remaining <= 24 * 60 * 60 * 1000) return 'URGENT';
  if (remaining <= 7 * 24 * 60 * 60 * 1000) return 'HIGH';
  return 'NORMAL';
}

function isPastDate(value: string | null | undefined) {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp < Date.now();
}

function compareParentActions(left: ParentActionItem, right: ParentActionItem) {
  const ranks: Record<ParentActionPriority, number> = {
    URGENT: 0,
    HIGH: 1,
    NORMAL: 2,
  };
  const priority = ranks[left.priority] - ranks[right.priority];
  if (priority !== 0) return priority;
  const leftDue = left.dueAt
    ? Date.parse(left.dueAt)
    : Number.POSITIVE_INFINITY;
  const rightDue = right.dueAt
    ? Date.parse(right.dueAt)
    : Number.POSITIVE_INFINITY;
  if (leftDue !== rightDue) return leftDue - rightDue;
  return left.id.localeCompare(right.id);
}

function parentActionSourceLabel(source: ParentActionSource) {
  const labels: Record<ParentActionSource, string> = {
    notices: 'required notices',
    homework: 'homework actions',
    fees: 'fee actions',
    attendance: 'attendance follow-up',
    serviceRequests: 'school request follow-up',
    exams: 'upcoming examinations',
  };
  return labels[source];
}

function parentDigestSourceLabel(
  source: 'attendance' | 'homework' | 'academics' | 'comments' | 'actions',
) {
  const labels = {
    attendance: 'weekly attendance',
    homework: 'weekly homework',
    academics: 'published result comparisons',
    comments: 'teacher feedback',
    actions: 'required parent actions',
  };
  return labels[source];
}

function isTimestampBetween(
  value: Date | string | null | undefined,
  start: Date,
  end: Date,
) {
  if (!value) return false;
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  return (
    Number.isFinite(timestamp) &&
    timestamp >= start.getTime() &&
    timestamp <= end.getTime()
  );
}

function buildParentAcademicTrend(
  cards: Array<{
    id: string;
    academicYear: { id: string; name: string };
    examTerm: { id: string; name: string };
    percentage: number;
    publishedAt: string | null;
    subjects: Array<{
      subjectId: string;
      maxMarks: number;
    }>;
  }>,
) {
  const [current, previous] = cards;
  const unavailable = {
    availability: 'UNAVAILABLE' as const,
    direction: null,
    changePoints: null,
    current: null,
    previous: null,
    reason:
      'Two comparable published results are not available for this child.',
  };
  if (!current || !previous) return unavailable;
  if (
    current.academicYear.id !== previous.academicYear.id ||
    current.examTerm.id === previous.examTerm.id ||
    current.subjects.length === 0 ||
    current.subjects.length !== previous.subjects.length
  ) {
    return unavailable;
  }
  const previousSubjects = new Map(
    previous.subjects.map((subject) => [subject.subjectId, subject.maxMarks]),
  );
  const comparableSubjects = current.subjects.every(
    (subject) =>
      previousSubjects.has(subject.subjectId) &&
      previousSubjects.get(subject.subjectId) === subject.maxMarks,
  );
  if (!comparableSubjects) return unavailable;

  const changePoints = roundMoney(current.percentage - previous.percentage);
  const direction =
    changePoints > 0 ? 'IMPROVED' : changePoints < 0 ? 'DECLINED' : 'STABLE';
  return {
    availability: 'AVAILABLE' as const,
    direction,
    changePoints,
    current: {
      reportCardId: current.id,
      termName: current.examTerm.name,
      percentage: current.percentage,
      publishedAt: current.publishedAt,
    },
    previous: {
      reportCardId: previous.id,
      termName: previous.examTerm.name,
      percentage: previous.percentage,
      publishedAt: previous.publishedAt,
    },
    reason: null,
  };
}

function boundedTake(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), 50);
}

function parseMonthRange(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new BadRequestException('month must use YYYY-MM format');
  }

  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;

  if (monthIndex < 0 || monthIndex > 11) {
    throw new BadRequestException('month must use YYYY-MM format');
  }

  return {
    start: new Date(Date.UTC(year, monthIndex, 1)),
    end: new Date(Date.UTC(year, monthIndex + 1, 1)),
  };
}

function money(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    return Number(value);
  }

  if (hasToNumber(value)) {
    return value.toNumber();
  }

  return Number(value);
}

function hasToNumber(value: unknown): value is { toNumber: () => number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toNumber' in value &&
    typeof value.toNumber === 'function'
  );
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function isMobileVisibleStudentDocumentStatus(status: string) {
  return status === 'ACTIVE' || status === 'VERIFIED';
}

function timestampOrZero(value: string | null) {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function toMobileStudent(student: MobileStudentRow) {
  const guardianLink = student.guardianLinks[0];
  const sectionName = student.sectionRef?.name ?? student.section ?? null;

  return {
    id: student.id,
    name: [student.firstNameEn, student.lastNameEn].filter(Boolean).join(' '),
    classSection: [student.class.name, sectionName].filter(Boolean).join(' - '),
    classId: student.class.id,
    sectionId: student.sectionId,
    rollNumber: student.rollNumber?.toString() ?? '',
    academicYear: student.enrollments[0]?.academicYear.name ?? '',
    academicYearStartsOn: toIso(student.enrollments[0]?.academicYear.startsOn),
    academicYearEndsOn: toIso(student.enrollments[0]?.academicYear.endsOn),
    relationship: guardianLink?.relation ?? 'Self',
    isPrimaryGuardian: guardianLink?.isPrimary ?? false,
    guardianId: guardianLink?.guardian?.id ?? null,
    capabilities: guardianLink?.capabilities ?? [],
    relationshipState: guardianLink
      ? {
          verificationStatus: guardianLink.verificationStatus,
          status: guardianLink.status,
          effectiveFrom: toIso(guardianLink.effectiveFrom),
          effectiveUntil: toIso(guardianLink.effectiveUntil),
          approvalStatus: guardianLink.approvalStatus,
          emergencyContactPriority: guardianLink.emergencyContactPriority,
        }
      : null,
  };
}
