import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { NotificationStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { decryptSensitiveField } from '../common/security/field-encryption';
import { ConfigService } from '../config/config.service';
import { PlansService } from '../plans/plans.service';
import { skipSuspendedTenantJob } from '../plans/processor-tenant.guard';
import { PrismaService } from '../prisma/prisma.service';

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

type NotificationJobData = EmailJobData | SmsJobData | PushJobData;
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

    if (typeof deliveryId !== 'string') {
      return;
    }

    await this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
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
    const provider = await this.resolveProvider('push');
    return this.deliverWithProvider(provider, {
      title: input.title,
      body: input.body,
      audience: input.audience,
      metadata: input.metadata ?? {},
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

function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}
