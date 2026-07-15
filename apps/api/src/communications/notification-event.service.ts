import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  isNotificationEventType,
  NOTIFICATION_EVENT_CATALOGUE,
  type NotificationEventPriority as ContractEventPriority,
  type NotificationEventType as ContractEventType,
} from '@schoolos/core';
import {
  AttendanceStatus,
  NoticeLifecycleStatus,
  NotificationEventPriority,
  NotificationEventStatus,
  NotificationEventType,
  PaymentStatus,
  Prisma,
  StudentLifecycleStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PlansService } from '../plans/plans.service';
import { PrismaService } from '../prisma/prisma.service';

const MAX_METADATA_BYTES = 4096;
const FORBIDDEN_METADATA_KEY =
  /(secret|password|token|credential|provider.?payload|attachment.?url|object.?key|private.?url)/i;

type EventMetadataValue = string | number | boolean | null;

export interface AcceptNotificationEventInput {
  tenantId: string;
  type: ContractEventType | string;
  sourceEntityId: string;
  actorId?: string | null;
  priority?: ContractEventPriority;
  idempotencyKey: string;
  metadata?: Record<string, EventMetadataValue>;
}

@Injectable()
export class NotificationEventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plansService: PlansService,
    private readonly auditService: AuditService,
  ) {}

  async accept(input: AcceptNotificationEventInput) {
    await this.plansService.assertTenantActive(input.tenantId);
    if (!isNotificationEventType(input.type)) {
      throw new BadRequestException(
        `Unknown notification event type: ${input.type}`,
      );
    }

    const catalogueEntry = NOTIFICATION_EVENT_CATALOGUE[input.type];
    const metadata = this.validateMetadata(input.metadata);
    await this.assertActor(input.tenantId, input.actorId);
    await this.assertSourceLifecycle(
      input.tenantId,
      input.type,
      input.sourceEntityId,
      metadata,
    );

    const existing = await this.prisma.notificationEvent.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId: input.tenantId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing) return existing;

    let notificationEvent;
    try {
      notificationEvent = await this.prisma.notificationEvent.create({
        data: {
          tenantId: input.tenantId,
          type: input.type as NotificationEventType,
          sourceModule: catalogueEntry.sourceModule,
          sourceEntityType: catalogueEntry.sourceEntityType,
          sourceEntityId: input.sourceEntityId,
          actorId:
            input.actorId && input.actorId !== 'system' ? input.actorId : null,
          priority: (input.priority ??
            catalogueEntry.defaultPriority) as NotificationEventPriority,
          metadata: metadata ?? Prisma.JsonNull,
          idempotencyKey: input.idempotencyKey,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const duplicate = await this.prisma.notificationEvent.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId: input.tenantId,
              idempotencyKey: input.idempotencyKey,
            },
          },
        });
        if (duplicate) return duplicate;
      }
      throw error;
    }

    await this.auditService.record({
      action: 'create',
      resource: 'notification_event',
      tenantId: input.tenantId,
      userId: notificationEvent.actorId,
      resourceId: notificationEvent.id,
      after: {
        type: notificationEvent.type,
        sourceModule: notificationEvent.sourceModule,
        sourceEntityType: notificationEvent.sourceEntityType,
        sourceEntityId: notificationEvent.sourceEntityId,
        priority: notificationEvent.priority,
        status: notificationEvent.status,
      },
    });

    return notificationEvent;
  }

  async markDispatched(tenantId: string, eventId: string) {
    return this.prisma.notificationEvent.update({
      where: { id: eventId, tenantId },
      data: {
        status: NotificationEventStatus.DISPATCHED,
        dispatchedAt: new Date(),
        failedAt: null,
        failureCode: null,
      },
    });
  }

  async markFailed(tenantId: string, eventId: string, failureCode: string) {
    return this.prisma.notificationEvent.update({
      where: { id: eventId, tenantId },
      data: {
        status: NotificationEventStatus.FAILED,
        failedAt: new Date(),
        failureCode: failureCode.slice(0, 80),
      },
    });
  }

  private validateMetadata(
    metadata?: Record<string, EventMetadataValue>,
  ): Record<string, EventMetadataValue> | undefined {
    if (!metadata) return undefined;
    for (const key of Object.keys(metadata)) {
      if (FORBIDDEN_METADATA_KEY.test(key)) {
        throw new BadRequestException(
          `Notification event metadata key is not allowed: ${key}`,
        );
      }
    }
    if (
      Buffer.byteLength(JSON.stringify(metadata), 'utf8') > MAX_METADATA_BYTES
    ) {
      throw new BadRequestException(
        `Notification event metadata exceeds ${MAX_METADATA_BYTES} bytes`,
      );
    }
    return metadata;
  }

  private async assertActor(tenantId: string, actorId?: string | null) {
    if (!actorId || actorId === 'system') return;
    const actor = await this.prisma.user.findFirst({
      where: { id: actorId, tenantId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!actor) {
      throw new ConflictException(
        'Notification event actor is not active in this school',
      );
    }
  }

  private async assertSourceLifecycle(
    tenantId: string,
    type: ContractEventType,
    sourceEntityId: string,
    metadata?: Record<string, EventMetadataValue>,
  ) {
    if (
      type === 'NOTICE_PUBLISHED' ||
      type === 'NOTICE_ACKNOWLEDGEMENT_FOLLOW_UP'
    ) {
      const notice = await this.prisma.notice.findFirst({
        where: {
          id: sourceEntityId,
          tenantId,
          lifecycleStatus: NoticeLifecycleStatus.PUBLISHED,
        },
        select: { id: true },
      });
      if (!notice) {
        throw new ConflictException(
          'Notification event notice is not currently published',
        );
      }
      return;
    }

    if (type === 'STUDENT_ADMITTED') {
      const student = await this.prisma.student.findFirst({
        where: {
          id: sourceEntityId,
          tenantId,
          lifecycleStatus: StudentLifecycleStatus.ACTIVE,
        },
        select: { id: true },
      });
      if (!student) {
        throw new ConflictException(
          'Notification event student is not active in this school',
        );
      }
      return;
    }

    if (type === 'FEE_PAYMENT_CONFIRMED') {
      const payment = await this.prisma.payment.findFirst({
        where: {
          id: sourceEntityId,
          tenantId,
          status: PaymentStatus.SUCCESS,
        },
        select: { id: true },
      });
      if (!payment) {
        throw new ConflictException(
          'Notification event payment is not confirmed in this school',
        );
      }
      return;
    }

    const attendanceSessionId = metadata?.attendanceSessionId;
    const studentId = metadata?.studentId;
    if (
      typeof attendanceSessionId !== 'string' ||
      typeof studentId !== 'string'
    ) {
      throw new BadRequestException(
        'Attendance notification events require attendanceSessionId and studentId metadata',
      );
    }
    const allowedStatuses = attendanceStatusesForEvent(type);
    const record = await this.prisma.attendanceRecord.findFirst({
      where: {
        tenantId,
        attendanceSessionId,
        studentId,
        status: { in: allowedStatuses },
      },
      select: { id: true },
    });
    if (!record) {
      throw new NotFoundException(
        'Notification event attendance record is not in the required lifecycle state',
      );
    }
  }
}

function attendanceStatusesForEvent(
  type: ContractEventType,
): AttendanceStatus[] {
  switch (type) {
    case 'ATTENDANCE_STUDENT_ABSENT':
    case 'ATTENDANCE_STUDENT_CONSECUTIVE_ABSENCE':
      return [AttendanceStatus.ABSENT];
    case 'ATTENDANCE_STUDENT_LATE':
      return [AttendanceStatus.LATE];
    case 'ATTENDANCE_STUDENT_LEAVE':
      return [
        AttendanceStatus.LEAVE,
        AttendanceStatus.ON_LEAVE,
        AttendanceStatus.SICK_LEAVE,
        AttendanceStatus.EXCUSED_LEAVE,
        AttendanceStatus.UNEXCUSED_LEAVE,
      ];
    default:
      return [];
  }
}
