import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentMethod, type Student } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { getParentStudentIds } from '../common/security/parent-scope';
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
    guardian: {
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
  ) {}

  async listMyStudents(actor: AuthContext) {
    const studentIds = await this.getAllowedStudentIds(actor);

    if (studentIds.length === 0) {
      return { items: [] };
    }

    const students = await this.prisma.student.findMany({
      where: {
        tenantId: actor.tenantId,
        id: { in: studentIds },
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        sectionRef: {
          select: {
            id: true,
            name: true,
          },
        },
        guardianLinks: {
          where: {
            guardian: {
              userId: actor.userId,
            },
          },
          include: {
            guardian: {
              select: {
                userId: true,
              },
            },
          },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
        enrollments: {
          include: {
            academicYear: {
              select: {
                name: true,
                startsOn: true,
                endsOn: true,
              },
            },
          },
          orderBy: [{ createdAt: 'desc' }],
          take: 1,
        },
      },
      orderBy: [{ firstNameEn: 'asc' }, { lastNameEn: 'asc' }],
    });

    return {
      items: students.map((student) => toMobileStudent(student)),
    };
  }

  async getDashboard(actor: AuthContext, requestedStudentId?: string) {
    const children = await this.listMyStudents(actor);
    const selectedStudentId = requestedStudentId ?? children.items[0]?.id;
    const entitlements = await this.entitlementsService.getEntitlements(
      actor.tenantId,
    );
    const modules = new Set(entitlements.modules);
    const enabled = (moduleName: string) => modules.has(moduleName);
    const moduleAvailability = {
      attendance: enabled('attendance'),
      fees: enabled('fees'),
      homework: enabled('homework'),
      activity: enabled('activity'),
      transport: enabled('transport'),
      canteen: enabled('canteen'),
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
      this.getStudentProfile(selectedStudentId, actor),
      enabled('attendance')
        ? this.getStudentAttendanceSummary(selectedStudentId, actor)
        : Promise.resolve(null),
      enabled('fees')
        ? this.getStudentFeesSummary(selectedStudentId, actor)
        : Promise.resolve(null),
      enabled('homework')
        ? this.getStudentHomework(selectedStudentId, actor, '5')
        : Promise.resolve(null),
      this.listNotifications(actor),
      enabled('transport')
        ? this.getStudentTransport(selectedStudentId, actor)
        : Promise.resolve(null),
      enabled('canteen')
        ? this.getStudentCanteen(selectedStudentId, actor)
        : Promise.resolve(null),
      enabled('activity')
        ? this.getStudentActivityFeed(selectedStudentId, actor, '1')
        : Promise.resolve(null),
    ]);

    return {
      selectedStudent: student.child,
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
    };
  }

  async listNotifications(
    actor: AuthContext,
    query: { limit?: number; cursor?: string; unreadOnly?: boolean } = {},
  ) {
    const studentIds = await this.getAllowedStudentIds(actor);
    const visibility = this.parentNotificationVisibility(actor, studentIds);
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
      audience: parentNotificationAudience(item),
    }));

    return {
      unreadCount: await this.countUnreadNotifications(actor, studentIds),
      items,
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  async getNotificationUnreadCount(actor: AuthContext) {
    const studentIds = await this.getAllowedStudentIds(actor);
    return {
      unreadCount: await this.countUnreadNotifications(actor, studentIds),
    };
  }

  async markAllNotificationsRead(actor: AuthContext) {
    const studentIds = await this.getAllowedStudentIds(actor);
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
    const studentIds = await this.getAllowedStudentIds(actor);
    const notification = await this.prisma.notificationDelivery.findFirst({
      where: {
        id: notificationId,
        tenantId: actor.tenantId,
        OR: [
          { recipientUserId: actor.userId },
          ...(studentIds.length > 0 ? [{ studentId: { in: studentIds } }] : []),
        ],
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
    const studentIds = await this.getAllowedStudentIds(actor);
    const notification = await this.prisma.notificationDelivery.findFirst({
      where: {
        id: notificationId,
        tenantId: actor.tenantId,
        OR: [
          { recipientUserId: actor.userId },
          ...(studentIds.length > 0 ? [{ studentId: { in: studentIds } }] : []),
        ],
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
      },
    };
  }

  async getStudentAttendanceSummary(
    studentId: string,
    actor: AuthContext,
    query?: { month?: number; year?: number },
  ) {
    await this.assertStudentAccess(studentId, actor);
    return this.attendanceService.getParentSummary(studentId, actor, query);
  }

  async getStudentFeesSummary(studentId: string, actor: AuthContext) {
    await this.assertStudentAccess(studentId, actor);
    const invoices = await this.prisma.invoice.findMany({
      where: {
        tenantId: actor.tenantId,
        studentId,
        status: { in: ['ISSUED', 'PARTIAL', 'PAID'] },
      },
      include: {
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
        totalAmount,
        paidAmount,
        outstandingAmount,
        isOverdue: outstandingAmount > 0 && invoice.dueDate < now,
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
    await this.assertStudentAccess(studentId, actor);
    return this.financeService.getParentPaymentGatewayReadiness();
  }

  async initiateStudentPayment(
    studentId: string,
    dto: InitiateParentPaymentDto,
    actor: AuthContext,
  ) {
    await this.assertStudentAccess(studentId, actor);
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
    await this.assertStudentAccess(studentId, actor);
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
    await this.assertStudentAccess(studentId, actor);
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
    await this.assertStudentAccess(studentId, actor);
    return this.financeService.getReceiptPdfForStudent(
      receiptNumber,
      studentId,
      actor,
    );
  }

  async getMyConsentStatus(actor: AuthContext) {
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
    const guardian = await this.prisma.guardian.findFirst({
      where: { tenantId: actor.tenantId, userId: actor.userId },
      select: {
        id: true,
        studentLinks: {
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
  ) {
    const student = await this.getAccessibleStudent(studentId, actor);
    const items = await this.prisma.activityPost.findMany({
      where: {
        tenantId: actor.tenantId,
        status: 'APPROVED',
        softDeletedAt: null,
        OR: [
          { audienceType: 'ALL' },
          { audienceType: 'STUDENT', studentTags: { some: { studentId } } },
          { audienceType: 'CLASS', classId: student.classId },
          {
            audienceType: 'SECTION',
            classId: student.classId,
            sectionId: student.sectionId,
          },
        ],
      },
      include: {
        _count: {
          select: {
            attachments: true,
            reactions: true,
          },
        },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: boundedTake(take, 20),
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        caption: item.caption,
        category: item.category,
        publishedAt: toIso(item.publishedAt ?? item.createdAt),
        attachmentCount: item._count.attachments,
        reactionCount: item._count.reactions,
      })),
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
          feedback: submission?.feedback ?? null,
          attachmentCount: assignment._count.attachments,
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
    await this.assertStudentAccess(studentId, actor);
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
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    });
    const examTermIds = reportCards.map((card) => card.examTermId);
    const marks =
      examTermIds.length === 0
        ? []
        : await this.prisma.markEntry.findMany({
            where: {
              tenantId: actor.tenantId,
              studentId,
              examTermId: { in: examTermIds },
            },
            include: {
              subject: { select: { id: true, name: true, code: true } },
              assessmentComponent: { select: { maxMarks: true } },
            },
            orderBy: [{ subject: { code: 'asc' } }],
          });
    const subjectsByTerm = groupReportCardSubjects(marks);

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
        subjects: subjectsByTerm.get(card.examTermId) ?? [],
      })),
    };
  }

  async getStudentReportCardPdf(
    studentId: string,
    reportCardId: string,
    actor: AuthContext,
  ) {
    await this.assertStudentAccess(studentId, actor);
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
    await this.assertStudentAccess(studentId, actor);
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
    await this.assertStudentAccess(studentId, actor);
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
    await this.assertStudentAccess(studentId, actor);
    const [assignment, enrollment, activeStatus] = await Promise.all([
      this.prisma.transportStudentAssignment.findFirst({
        where: { tenantId: actor.tenantId, studentId, status: 'ACTIVE' },
        include: {
          route: { select: { id: true, name: true, code: true } },
          stop: { select: { id: true, name: true, sequence: true } },
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
      this.prisma.transportEnrollment.findFirst({
        where: { tenantId: actor.tenantId, studentId, status: 'ACTIVE' },
        include: {
          route: { select: { id: true, name: true, code: true } },
          stop: { select: { id: true, name: true, sequence: true } },
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
      this.prisma.transportTripStudentStatus.findFirst({
        where: {
          tenantId: actor.tenantId,
          studentId,
          trip: {
            status: 'ACTIVE',
          },
        },
        include: {
          trip: {
            include: {
              route: { select: { id: true, name: true, code: true } },
              vehicle: {
                select: {
                  id: true,
                  registrationNumber: true,
                  model: true,
                  capacity: true,
                },
              },
              locationPings: {
                orderBy: [{ recordedAt: 'desc' }],
                take: 1,
              },
            },
          },
          stop: { select: { id: true, name: true, sequence: true } },
        },
        orderBy: [{ updatedAt: 'desc' }],
      }),
    ]);

    return {
      assignment: assignment
        ? {
            id: assignment.id,
            route: assignment.route,
            stop: assignment.stop,
            pickupDirection: assignment.pickupDirection,
            status: assignment.status,
          }
        : null,
      enrollment: enrollment
        ? {
            id: enrollment.id,
            route: enrollment.route,
            stop: enrollment.stop,
            feeAmount: money(enrollment.feeAmount),
            status: enrollment.status,
          }
        : null,
      activeTrip: activeStatus
        ? {
            id: activeStatus.trip.id,
            route: activeStatus.trip.route,
            vehicle: activeStatus.trip.vehicle,
            direction: activeStatus.trip.direction,
            status: activeStatus.trip.status,
            studentStatus: activeStatus.status,
            stop: activeStatus.stop,
            isDelayed: activeStatus.trip.isDelayed,
            delayMinutes: activeStatus.trip.delayMinutes,
            delayReason: activeStatus.trip.delayReason,
            latestLocation: activeStatus.trip.locationPings[0]
              ? {
                  latitude: money(activeStatus.trip.locationPings[0].latitude),
                  longitude: money(
                    activeStatus.trip.locationPings[0].longitude,
                  ),
                  speedKph:
                    activeStatus.trip.locationPings[0].speedKph === null
                      ? null
                      : money(activeStatus.trip.locationPings[0].speedKph),
                  recordedAt: toIso(
                    activeStatus.trip.locationPings[0].recordedAt,
                  ),
                }
              : null,
          }
        : null,
    };
  }

  private async getAccessibleStudent(studentId: string, actor: AuthContext) {
    await this.assertStudentAccess(studentId, actor);
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId: actor.tenantId,
      },
      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
        sectionRef: {
          select: {
            id: true,
            name: true,
            classTeacher: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        guardianLinks: {
          where: {
            guardian: {
              userId: actor.userId,
            },
          },
          include: {
            guardian: {
              select: {
                userId: true,
              },
            },
          },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
        enrollments: {
          include: {
            academicYear: {
              select: {
                name: true,
                startsOn: true,
                endsOn: true,
              },
            },
          },
          orderBy: [{ createdAt: 'desc' }],
          take: 1,
        },
      },
    });

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

  private async assertStudentAccess(studentId: string, actor: AuthContext) {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId: actor.tenantId,
      },
      select: { id: true },
    });

    if (!student) {
      throw new NotFoundException('Student not found in this school.');
    }

    const allowedStudentIds = await this.getAllowedStudentIds(actor);
    if (!allowedStudentIds.includes(studentId)) {
      throw new ForbiddenException('Mobile access denied for this student.');
    }
  }

  private parentNotificationVisibility(
    actor: AuthContext,
    studentIds: string[],
  ) {
    return {
      tenantId: actor.tenantId,
      OR: [
        { recipientUserId: actor.userId },
        ...(studentIds.length > 0 ? [{ studentId: { in: studentIds } }] : []),
      ],
    };
  }

  private countUnreadNotifications(actor: AuthContext, studentIds: string[]) {
    return this.prisma.notificationDelivery.count({
      where: {
        ...this.parentNotificationVisibility(actor, studentIds),
        readReceipts: {
          none: { tenantId: actor.tenantId, userId: actor.userId },
        },
      },
    });
  }

  private async getAllowedStudentIds(actor: AuthContext) {
    const parentStudentIds = await getParentStudentIds(this.prisma, actor);
    if (parentStudentIds !== null) {
      return parentStudentIds;
    }

    throw new ForbiddenException('Mobile student scope is not available');
  }
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
    return `/parent/chat?threadId=${encodeURIComponent(item.sourceId)}`;
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

function boundedTake(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), 50);
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

function groupReportCardSubjects(
  marks: Array<{
    examTermId: string;
    subjectId: string;
    marksObtained: unknown;
    subject: { id: string; name: string; code: string };
    assessmentComponent: { maxMarks: unknown };
  }>,
) {
  const grouped = new Map<
    string,
    Map<
      string,
      {
        subjectId: string;
        subjectName: string;
        marksObtained: number;
        maxMarks: number;
      }
    >
  >();

  for (const mark of marks) {
    const termSubjects =
      grouped.get(mark.examTermId) ??
      new Map<
        string,
        {
          subjectId: string;
          subjectName: string;
          marksObtained: number;
          maxMarks: number;
        }
      >();
    const subject = termSubjects.get(mark.subjectId) ?? {
      subjectId: mark.subject.id,
      subjectName: mark.subject.name,
      marksObtained: 0,
      maxMarks: 0,
    };
    subject.marksObtained += money(mark.marksObtained);
    subject.maxMarks += money(mark.assessmentComponent.maxMarks);
    termSubjects.set(mark.subjectId, subject);
    grouped.set(mark.examTermId, termSubjects);
  }

  return new Map(
    Array.from(grouped.entries()).map(([termId, subjects]) => [
      termId,
      Array.from(subjects.values()).map((subject) => {
        const percentage =
          subject.maxMarks <= 0
            ? 0
            : roundMoney((subject.marksObtained / subject.maxMarks) * 100);
        return {
          ...subject,
          marksObtained: roundMoney(subject.marksObtained),
          maxMarks: roundMoney(subject.maxMarks),
          percentage,
          grade: gradeFromPercentage(percentage),
        };
      }),
    ]),
  );
}

function gradeFromPercentage(percentage: number) {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C+';
  if (percentage >= 40) return 'C';
  return 'D';
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
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
  };
}
