import { Injectable, NotFoundException } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationEventPriority,
  NotificationPreferenceCategory,
  NotificationStatus,
  UserStatus,
} from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

const NEPAL_OFFSET_MINUTES = 5 * 60 + 45;
const DEFAULT_QUIET_START = '20:00';
const DEFAULT_QUIET_END = '06:00';

export type NotificationPolicyDecision =
  | { action: 'IMMEDIATE'; reason: string; mandatory: boolean }
  | { action: 'DELAY'; reason: string; resumeAt: Date; mandatory: false }
  | { action: 'SKIP'; reason: string; mandatory: false };

export interface UpdateOwnNotificationPreferenceInput {
  category: NotificationPreferenceCategory;
  channel: NotificationChannel;
  enabled: boolean;
  quietHoursEnabled?: boolean;
}

@Injectable()
export class NotificationPreferencePolicy {
  constructor(private readonly prisma: PrismaService) {}

  async listOwnPreferences(actor: AuthContext) {
    const [preferences, settings] = await Promise.all([
      this.prisma.notificationPreference.findMany({
        where: { tenantId: actor.tenantId, userId: actor.userId },
        orderBy: [{ category: 'asc' }, { channel: 'asc' }],
      }),
      this.getTenantDefaults(actor.tenantId),
    ]);
    return { tenantDefaults: settings, overrides: preferences };
  }

  async updateOwnPreference(
    actor: AuthContext,
    input: UpdateOwnNotificationPreferenceInput,
  ) {
    return this.prisma.notificationPreference.upsert({
      where: {
        tenantId_userId_category_channel: {
          tenantId: actor.tenantId,
          userId: actor.userId,
          category: input.category,
          channel: input.channel,
        },
      },
      create: {
        tenantId: actor.tenantId,
        userId: actor.userId,
        ...input,
      },
      update: {
        enabled: input.enabled,
        quietHoursEnabled: input.quietHoursEnabled ?? null,
      },
    });
  }

  async resetOwnPreference(
    actor: AuthContext,
    input: Pick<UpdateOwnNotificationPreferenceInput, 'category' | 'channel'>,
  ) {
    await this.prisma.notificationPreference.deleteMany({
      where: {
        tenantId: actor.tenantId,
        userId: actor.userId,
        category: input.category,
        channel: input.channel,
      },
    });
    return { success: true as const };
  }

  async evaluateDelivery(
    tenantId: string,
    deliveryId: string,
    now = new Date(),
  ): Promise<NotificationPolicyDecision> {
    const delivery = await this.prisma.notificationDelivery.findFirst({
      where: { id: deliveryId, tenantId },
      select: {
        id: true,
        channel: true,
        sourceType: true,
        recipientUserId: true,
        guardianId: true,
        studentId: true,
        noticeId: true,
        recipientUser: { select: { status: true } },
        notice: { select: { lifecycleStatus: true } },
        notificationEvent: {
          select: { type: true, priority: true, status: true },
        },
      },
    });
    if (!delivery) {
      throw new NotFoundException('Notification delivery not found');
    }

    if (
      !delivery.recipientUserId ||
      delivery.recipientUser?.status !== UserStatus.ACTIVE
    ) {
      return inactiveDecision('Recipient is no longer active');
    }
    if (delivery.noticeId && delivery.notice?.lifecycleStatus !== 'PUBLISHED') {
      return inactiveDecision('Source notice is no longer published');
    }
    if (delivery.guardianId && delivery.studentId) {
      const currentLink = await this.prisma.studentGuardian.findFirst({
        where: {
          tenantId,
          guardianId: delivery.guardianId,
          studentId: delivery.studentId,
        },
        select: { id: true },
      });
      if (!currentLink) {
        return inactiveDecision('Guardian is no longer linked to the student');
      }
    }

    const category = categoryForDelivery(
      delivery.notificationEvent?.type,
      delivery.sourceType,
    );
    const mandatory =
      category === NotificationPreferenceCategory.SECURITY ||
      category === NotificationPreferenceCategory.EMERGENCY ||
      delivery.notificationEvent?.priority ===
        NotificationEventPriority.MANDATORY;
    const [preference, defaults] = await Promise.all([
      this.prisma.notificationPreference.findUnique({
        where: {
          tenantId_userId_category_channel: {
            tenantId,
            userId: delivery.recipientUserId,
            category,
            channel: delivery.channel,
          },
        },
      }),
      this.getTenantDefaults(tenantId),
    ]);

    if (!mandatory && preference?.enabled === false) {
      return inactiveDecision('Recipient disabled this channel and category');
    }
    if (mandatory) {
      return {
        action: 'IMMEDIATE',
        reason: 'Mandatory security or emergency delivery',
        mandatory: true,
      };
    }

    const quietHoursEnabled =
      preference?.quietHoursEnabled ?? defaults.quietHoursEnabled;
    if (
      quietHoursEnabled &&
      isDuringQuietHours(now, defaults.quietHoursStart, defaults.quietHoursEnd)
    ) {
      if (
        delivery.notificationEvent?.priority ===
        NotificationEventPriority.CRITICAL
      ) {
        return {
          action: 'IMMEDIATE',
          reason: 'Critical delivery bypasses quiet hours',
          mandatory: false,
        };
      }
      return {
        action: 'DELAY',
        reason: 'Recipient is currently in quiet hours',
        resumeAt: nextQuietHoursEnd(
          now,
          defaults.quietHoursStart,
          defaults.quietHoursEnd,
        ),
        mandatory: false,
      };
    }

    return {
      action: 'IMMEDIATE',
      reason: preference
        ? 'User override allows delivery'
        : 'Tenant default allows delivery',
      mandatory: false,
    };
  }

  private async getTenantDefaults(tenantId: string) {
    const rows = await this.prisma.tenantSetting.findMany({
      where: {
        tenantId,
        key: {
          in: [
            'quiet_hours_enabled',
            'notification_quiet_hours_start',
            'notification_quiet_hours_end',
          ],
        },
      },
      select: { key: true, value: true },
    });
    const settings = new Map(rows.map((row) => [row.key, row.value]));
    return {
      timezone: 'Asia/Kathmandu' as const,
      quietHoursEnabled: settings.get('quiet_hours_enabled') === true,
      quietHoursStart: validClock(
        settings.get('notification_quiet_hours_start'),
        DEFAULT_QUIET_START,
      ),
      quietHoursEnd: validClock(
        settings.get('notification_quiet_hours_end'),
        DEFAULT_QUIET_END,
      ),
    };
  }
}

function inactiveDecision(reason: string): NotificationPolicyDecision {
  return { action: 'SKIP', reason, mandatory: false };
}

function categoryForDelivery(
  eventType: string | undefined,
  sourceType: string,
): NotificationPreferenceCategory {
  if (
    eventType?.startsWith('ATTENDANCE_') ||
    sourceType.startsWith('attendance')
  ) {
    return NotificationPreferenceCategory.ATTENDANCE;
  }
  if (eventType === 'FEE_PAYMENT_CONFIRMED' || sourceType.includes('fee')) {
    return NotificationPreferenceCategory.FEES;
  }
  if (eventType?.startsWith('NOTICE_') || sourceType === 'notice') {
    return NotificationPreferenceCategory.NOTICE;
  }
  if (sourceType.includes('security') || sourceType.includes('auth')) {
    return NotificationPreferenceCategory.SECURITY;
  }
  if (sourceType.includes('emergency')) {
    return NotificationPreferenceCategory.EMERGENCY;
  }
  return NotificationPreferenceCategory.GENERAL;
}

function validClock(value: unknown, fallback: string) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
    ? value
    : fallback;
}

function localMinuteOfDay(now: Date) {
  const nepal = new Date(now.getTime() + NEPAL_OFFSET_MINUTES * 60_000);
  return nepal.getUTCHours() * 60 + nepal.getUTCMinutes();
}

function clockMinute(clock: string) {
  const [hour, minute] = clock.split(':').map(Number);
  return hour * 60 + minute;
}

function isDuringQuietHours(now: Date, start: string, end: string) {
  const minute = localMinuteOfDay(now);
  const startMinute = clockMinute(start);
  const endMinute = clockMinute(end);
  if (startMinute === endMinute) return false;
  return startMinute < endMinute
    ? minute >= startMinute && minute < endMinute
    : minute >= startMinute || minute < endMinute;
}

function nextQuietHoursEnd(now: Date, start: string, end: string) {
  const local = new Date(now.getTime() + NEPAL_OFFSET_MINUTES * 60_000);
  const currentMinute = local.getUTCHours() * 60 + local.getUTCMinutes();
  const startMinute = clockMinute(start);
  const endMinute = clockMinute(end);
  const endLocal = new Date(local);
  endLocal.setUTCHours(Math.floor(endMinute / 60), endMinute % 60, 0, 0);
  if (
    (startMinute < endMinute && currentMinute >= endMinute) ||
    (startMinute > endMinute && currentMinute >= startMinute)
  ) {
    endLocal.setUTCDate(endLocal.getUTCDate() + 1);
  }
  return new Date(endLocal.getTime() - NEPAL_OFFSET_MINUTES * 60_000);
}
