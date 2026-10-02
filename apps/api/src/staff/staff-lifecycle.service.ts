import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hasDomainPermission } from '../authorization/policies/domain-permission';
import { PrismaService } from '../prisma/prisma.service';
import { AuthContext } from '../auth/auth.types';
import { StaffLifecycleEventType, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class StaffLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async recordEvent(
    staffId: string,
    eventType: StaffLifecycleEventType,
    actor: AuthContext,
    options: {
      reason?: string;
      notes?: string;
      metadata?: Prisma.InputJsonValue;
      eventDate?: Date;
    } = {},
  ) {
    const event = await this.prisma.staffLifecycleEvent.create({
      data: {
        tenantId: actor.tenantId,
        staffId,
        eventType,
        eventDate: options.eventDate || new Date(),
        reason: options.reason,
        notes: options.notes,
        metadata: options.metadata || {},
        createdById: actor.userId,
      },
    });

    await this.auditService.record({
      action: 'record',
      resource: 'staff_lifecycle_event',
      tenantId: actor.tenantId,
      userId: actor.userId,
      resourceId: event.id,
      after: { staffId, eventType, reason: options.reason },
    });

    return event;
  }

  /**
   * Lifecycle events routinely carry termination and disciplinary reasons.
   * The route is gated only by hr:staff:read, so the service enforces the same
   * owner-or-HR-manager rule as the detail view and releases reasons, notes
   * and metadata only to holders of hr:disciplinary:read.
   */
  async getStaffHistory(staffId: string, actor: AuthContext) {
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId: actor.tenantId },
      select: { id: true, userId: true },
    });
    if (!staff) throw new NotFoundException('Staff member not found');
    const manager =
      hasDomainPermission(actor, 'hr:manage') ||
      hasDomainPermission(actor, 'hr:staff:update');
    if (staff.userId !== actor.userId && !manager)
      throw new ForbiddenException('You can only view your own staff history');
    const restricted = hasDomainPermission(actor, 'hr:disciplinary:read');
    const events = await this.prisma.staffLifecycleEvent.findMany({
      where: { staffId, tenantId: actor.tenantId },
      orderBy: { eventDate: 'desc' },
      select: {
        id: true,
        staffId: true,
        eventType: true,
        eventDate: true,
        reason: true,
        notes: true,
        metadata: true,
        createdAt: true,
        createdBy: {
          select: {
            id: true,
            email: true,
            staff: { select: { firstName: true, lastName: true } },
          },
        },
      },
      take: 200,
    });
    return events.map(({ reason, notes, metadata, createdBy, ...event }) => ({
      ...event,
      reason: restricted ? reason : null,
      notes: restricted ? notes : null,
      metadata: restricted ? metadata : null,
      // Who recorded the event is shown to HR managers only.
      createdBy: manager ? createdBy : null,
    }));
  }
}
