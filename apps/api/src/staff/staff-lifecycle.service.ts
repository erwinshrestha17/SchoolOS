import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthContext } from '../auth/auth.types';
import { StaffLifecycleEventType, Prisma } from '@prisma/client';

@Injectable()
export class StaffLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.staffLifecycleEvent.create({
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
  }

  async getStaffHistory(staffId: string, actor: AuthContext) {
    return this.prisma.staffLifecycleEvent.findMany({
      where: { staffId, tenantId: actor.tenantId },
      orderBy: { eventDate: 'desc' },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            staff: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  }
}
