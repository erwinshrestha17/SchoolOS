import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Optional } from '@nestjs/common';
import { NotificationStatus } from '@prisma/client';
import { DelayedError, Job } from 'bullmq';
import { decryptSensitiveField } from '../common/security/field-encryption';
import { ConfigService } from '../config/config.service';
import { PlansService } from '../plans/plans.service';
import { skipSuspendedTenantJob } from '../plans/processor-tenant.guard';
import { PrismaService } from '../prisma/prisma.service';
import { DevicePushTokensService } from './device-push-tokens.service';
import { resolveMobilePushDeepLink } from './mobile-push-deep-link';
import { NotificationPreferencePolicy } from './notification-preference-policy';

interface EmailJobData {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  metadata?: Record<string, unknown>;
}

interface SmsJobData {
  to: string;
  message: string;
  metadata?: Record<string, unknown>;
}

interface PushJobData {
  title: string;
  body: string;
  audience?: unknown;
  metadata?: Record<string, unknown>;
}

interface InAppJobData {
  metadata: Record<string, unknown>;
}

type NotificationJobData =
  | EmailJobData
  | SmsJobData
  | PushJobData
  | InAppJobData;
type NotificationProviderMode = 'dev-log' | 'disabled' | 'configured-provider';

interface ProviderResolution {
  mode: NotificationProviderMode;
  channel: 'email' | 'sms' | 'push';
  providerName: string | null;
  webhookUrl: string | null;
  headers: Record<string, string>;
  reason?: string;
}

interface ProviderResult {
  status: NotificationStatus;
  errorMessage?: string;
  providerMessageId?: string;
}

@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly plansService: PlansService,
    private readonly configService?: ConfigService,
    @Optional()
    private readonly devicePushTokensService?: DevicePushTokensService,
    @Optional()
    private readonly notificationPreferencePolicy?: NotificationPreferencePolicy,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData, void>): Promise<void> {
    const tenantId = this.extractTenantId(job.data);
    if (
      await skipSuspendedTenantJob(
        this.plansService,
        tenantId,
        this.logger,
        `notification job ${job.name}`,
      )
    ) {
      return;
    }

    const deliveryId = job.data.metadata?.notificationDeliveryId;
    if (
      this.notificationPreferencePolicy &&
      typeof tenantId === 'string' &&
      typeof deliveryId === 'string'
    ) {
      const decision = await this.notificationPreferencePolicy.evaluateDelivery(
        tenantId,
        deliveryId,
      );
      if (decision.action === 'SKIP') {
        await this.markDelivery(
          job.data,
          NotificationStatus.SKIPPED,
          decision.reason,
        );
        return;
      }
      if (decision.action === 'DELAY') {
        await this.markDelivery(
          job.data,
          NotificationStatus.RETRY_PENDING,
          decision.reason,
        );
        await job.moveToDelayed(decision.resumeAt.getTime(), job.token);
        throw new DelayedError();
      }
    }

    try {
      let result: ProviderResult | undefined;
      switch (job.name) {
        case 'sendEmail':
          result = await this.handleSendEmail(job.data as EmailJobData);
          break;
        case 'sendSms':
          result = await this.handleSendSms(job.data as SmsJobData);
          break;
        case 'sendPushNotification':
          result = await this.handleSendPush(job.data as PushJobData);
          break;
        case 'releaseInAppNotification':
          result = { status: NotificationStatus.SENT };
          break;
        default:
          this.logger.warn(`Unknown job name: ${job.name}`);
      }

      await this.markDelivery(
        job.data,
        result?.status ?? NotificationStatus.SENT,
        result?.errorMessage,
        result?.providerMessageId,
      );
    } catch (error) {
      await this.markDelivery(
        job.data,
        NotificationStatus.FAILED,
        error instanceof Error ? error.message : 'Notification job failed',
      );
      throw error;
    }
  }

  private async markDelivery(
    input: NotificationJobData,
    status: NotificationStatus,
    errorMessage?: string,
    providerMessageId?: string,
  ) {
    const deliveryId = input.metadata?.notificationDeliveryId;
    const tenantId = input.metadata?.tenantId;

    if (typeof deliveryId !== 'string' || typeof tenantId !== 'string') {
      return;
    }

    await this.prisma.notificationDelivery.update({
      where: { id: deliveryId, tenantId },
      data: {
        status,
        sentAt: status === NotificationStatus.SENT ? new Date() : undefined,
        deliveredAt:
          status === NotificationStatus.DELIVERED ? new Date() : undefined,
        failedAt: status === NotificationStatus.FAILED ? new Date() : undefined,
        providerMessageId: providerMessageId ?? undefined,
        errorMessage: errorMessage ?? null,
      },
    });
  }

  private async handleSendEmail(input: EmailJobData): Promise<ProviderResult> {
    const provider = await this.resolveProvider('email');
    return this.deliverWithProvider(provider, {
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      metadata: input.metadata ?? {},
    });
  }

  private async handleSendSms(input: SmsJobData): Promise<ProviderResult> {
    const provider = await this.resolveProvider('sms');
    return this.deliverWithProvider(provider, {
      to: input.to,
      message: input.message,
      metadata: input.metadata ?? {},
    });
  }

  private async handleSendPush(input: PushJobData): Promise<ProviderResult> {
    const tenantId = input.metadata?.tenantId;
    const notificationDeliveryId = input.metadata?.notificationDeliveryId;
    if (
      typeof tenantId !== 'string' ||
      typeof notificationDeliveryId !== 'string'
    ) {
      return {
        status: NotificationStatus.SKIPPED,
        errorMessage: 'Push delivery metadata is incomplete',
      };
    }

    if (!this.devicePushTokensService) {
      return {
        status: NotificationStatus.SKIPPED,
        errorMessage: 'Device push token service is unavailable',
      };
    }

    const delivery = await this.prisma.notificationDelivery.findFirst({
      where: {
        id: notificationDeliveryId,
        tenantId,
      },
      select: {
        id: true,
        sourceType: true,
        sourceId: true,
        studentId: true,
        recipientUserId: true,
        recipientUser: {
          select: {
            userRoles: {
              select: {
                role: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });

    if (!delivery?.recipientUserId) {
      return {
        status: NotificationStatus.SKIPPED,
        errorMessage: 'Push recipient is not linked to an active user',
      };
    }

    const tokens = await this.devicePushTokensService.listActiveTokens(
      tenantId,
      delivery.recipientUserId,
    );
    if (tokens.length === 0) {
      return {
        status: NotificationStatus.SKIPPED,
        errorMessage: 'Recipient has no active mobile push token',
      };
    }

    const deepLink = resolveMobilePushDeepLink({
      notificationId: delivery.id,
      sourceType: delivery.sourceType,
      sourceId: delivery.sourceId,
      studentId: delivery.studentId,
      roles:
        delivery.recipientUser?.userRoles.map(({ role }) => role.name) ?? [],
    });
    if (!deepLink) {
      return {
        status: NotificationStatus.SKIPPED,
        errorMessage: 'Recipient does not have a supported mobile push persona',
      };
    }

    const provider = await this.resolveProvider('push');
    return this.deliverWithProvider(provider, {
      tokens,
      notification: {
        title: 'SchoolOS notification',
        body: 'Open SchoolOS to view this update.',
      },
      data: {
        notificationId: delivery.id,
        tenantId,
        route: deepLink.route,
        ...(deepLink.childId ? { childId: deepLink.childId } : {}),
      },
    });
  }

  private async deliverWithProvider(
    provider: ProviderResolution,
    payload: Record<string, unknown>,
  ): Promise<ProviderResult> {
    if (provider.mode === 'disabled') {
      return {
        status: NotificationStatus.SKIPPED,
        errorMessage:
          provider.reason ??
          `${provider.channel} notification provider disabled`,
      };
    }

    if (provider.mode === 'dev-log') {
      if (provider.channel === 'push') {
        const tokens = Array.isArray(payload.tokens) ? payload.tokens : [];
        this.logger.log(
          JSON.stringify({
            mode: 'dev-log',
            channel: provider.channel,
            provider: provider.providerName,
            tokenCount: tokens.length,
            data: payload.data,
          }),
        );
        return {
          status: NotificationStatus.SKIPPED,
          errorMessage:
            'Push provider is in dev-log mode; no device delivery occurred',
        };
      }

      this.logger.log(
        JSON.stringify({
          mode: 'dev-log',
          channel: provider.channel,
          provider: provider.providerName,
          ...payload,
        }),
      );
      return { status: NotificationStatus.SENT };
    }

    if (!provider.webhookUrl) {
      throw new Error(
        `${provider.channel} provider is configured-provider but no webhookUrl is configured`,
      );
    }

    const response = await fetch(provider.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...provider.headers,
      },
      body: JSON.stringify({
        channel: provider.channel,
        provider: provider.providerName,
        payload,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `${provider.channel} provider webhook failed with status ${response.status}`,
      );
    }

    return {
      status: NotificationStatus.SENT,
      providerMessageId:
        response.headers.get('x-provider-message-id') ?? undefined,
    };
  }

  private async resolveProvider(
    channel: 'email' | 'sms' | 'push',
  ): Promise<ProviderResolution> {
    const explicitMode = getChannelMode(channel);

    if (
      isDisabled(process.env.NOTIFICATIONS_DISABLED) ||
      isDisabled(process.env[`${channel.toUpperCase()}_PROVIDER_ENABLED`])
    ) {
      return {
        mode: 'disabled',
        channel,
        providerName: null,
        webhookUrl: null,
        headers: {},
        reason: `${channel} provider disabled by configuration`,
      };
    }

    if (explicitMode === 'disabled') {
      return {
        mode: 'disabled',
        channel,
        providerName: null,
        webhookUrl: null,
        headers: {},
        reason: `${channel} provider disabled by configuration`,
      };
    }

    if (
      channel === 'push' &&
      explicitMode === 'configured-provider' &&
      !isEnabled(process.env.PUSH_PROVIDER_READY)
    ) {
      return {
        mode: 'disabled',
        channel,
        providerName: null,
        webhookUrl: null,
        headers: {},
        reason: 'push provider is not ready',
      };
    }

    const providerType = getProviderType(channel);
    const provider = await this.prisma.providerConfig.findFirst({
      where: { type: providerType, enabled: true },
      orderBy: [{ updatedAt: 'desc' }],
    });

    if (explicitMode === 'configured-provider' && !provider) {
      throw new Error(
        `${channel} delivery requires an enabled ${providerType} provider`,
      );
    }

    if (!provider || explicitMode === 'dev-log') {
      return {
        mode: 'dev-log',
        channel,
        providerName: provider?.name ?? null,
        webhookUrl: getLegacyWebhookUrl(channel),
        headers: getLegacyWebhookHeaders(channel),
      };
    }

    const config = this.decryptProviderConfig(
      provider.configEncrypted as Record<string, unknown>,
      provider.secretKeys,
    );
    const webhookUrl =
      getString(config.webhookUrl) ?? getLegacyWebhookUrl(channel);
    const apiToken =
      getString(config.apiToken) ?? getLegacyWebhookToken(channel);

    return {
      mode: 'configured-provider',
      channel,
      providerName: provider.name,
      webhookUrl,
      headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
    };
  }

  private extractTenantId(data: NotificationJobData) {
    const metadata = data.metadata;
    if (!metadata || typeof metadata !== 'object') {
      return null;
    }

    const tenantId = metadata.tenantId;
    return typeof tenantId === 'string' ? tenantId : null;
  }

  private decryptProviderConfig(
    config: Record<string, unknown>,
    secretKeys: string[],
  ) {
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
      output[key] =
        secretKeys.includes(key) && typeof value === 'string'
          ? decryptSensitiveField(
              value,
              this.configService?.jwtSecret ?? 'school-os-access-secret',
            )
          : value;
    }
    return output;
  }
}

function getProviderType(channel: 'email' | 'sms' | 'push') {
  if (channel === 'email') return 'EMAIL';
  if (channel === 'sms') return 'SMS';
  return 'FCM';
}

function getChannelMode(channel: 'email' | 'sms' | 'push') {
  const raw =
    process.env[`${channel.toUpperCase()}_PROVIDER_MODE`] ??
    process.env.SCHOOLOS_NOTIFICATION_PROVIDER_MODE ??
    (channel === 'email' ? process.env.EMAIL_DELIVERY_MODE : undefined);
  const normalized = raw?.toLowerCase();

  if (normalized === 'disabled') return 'disabled';
  if (normalized === 'configured-provider' || normalized === 'webhook') {
    return 'configured-provider';
  }
  if (normalized === 'dev-log' || normalized === 'log') return 'dev-log';
  return 'dev-log';
}

function getLegacyWebhookUrl(channel: 'email' | 'sms' | 'push') {
  if (channel === 'email') return process.env.EMAIL_WEBHOOK_URL ?? null;
  if (channel === 'sms') return process.env.SMS_WEBHOOK_URL ?? null;
  return process.env.PUSH_WEBHOOK_URL ?? null;
}

function getLegacyWebhookToken(channel: 'email' | 'sms' | 'push') {
  if (channel === 'email') return process.env.EMAIL_WEBHOOK_TOKEN ?? null;
  if (channel === 'sms') return process.env.SMS_WEBHOOK_TOKEN ?? null;
  return process.env.PUSH_WEBHOOK_TOKEN ?? null;
}

function getLegacyWebhookHeaders(channel: 'email' | 'sms' | 'push') {
  const token = getLegacyWebhookToken(channel);
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function isDisabled(value: string | undefined) {
  if (!value) return false;
  return ['0', 'false', 'disabled', 'off', 'no'].includes(
    value.trim().toLowerCase(),
  );
}

function isEnabled(value: string | undefined) {
  if (!value) return false;
  return ['1', 'true', 'enabled', 'on', 'yes'].includes(
    value.trim().toLowerCase(),
  );
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}
