import { Injectable } from '@nestjs/common';
import type { Prisma, ProviderType } from '@prisma/client';
import type {
  SchoolIntegrationStatusItem,
  SchoolIntegrationStatusLabel,
  SchoolIntegrationStatusSignal,
  SchoolIntegrationsStatus,
} from '@schoolos/core';
import { PrismaService } from '../prisma/prisma.service';

type ProviderRecord = {
  id: string;
  type: ProviderType;
  name: string;
  enabled: boolean;
  environment: string;
  configEncrypted: Prisma.JsonValue;
  validationStatus: string | null;
  lastValidatedAt: Date | string | null;
  updatedAt: Date | string;
};

const NOTIFICATION_PROVIDER_TYPES = {
  sms: 'SMS',
  email: 'EMAIL',
  push: 'FCM',
} as const;
const PAYMENT_GATEWAY_PROVIDER_TYPE = 'PAYMENT_GATEWAY' as ProviderType;

const NOTIFICATION_LABELS = {
  sms: 'SMS',
  email: 'Email',
  push: 'Push',
} as const;

@Injectable()
export class SchoolSettingsIntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getIntegrationsStatus(
    tenantId: string,
  ): Promise<SchoolIntegrationsStatus> {
    const checkedAt = new Date();
    const [payment, notifications, attendance] = await Promise.all([
      this.getPaymentGatewayStatus(checkedAt),
      this.getNotificationProviderStatus(checkedAt),
      this.getAttendanceDeviceStatus(tenantId, checkedAt),
    ]);

    return {
      generatedAt: checkedAt.toISOString(),
      items: [payment, notifications, attendance],
      safetyNotes: [
        'School settings show status labels only.',
        'Provider credentials, tokens, callback addresses, queue internals, storage details, and platform-only controls are not exposed here.',
      ],
    };
  }

  private async getPaymentGatewayStatus(
    checkedAt: Date,
  ): Promise<SchoolIntegrationStatusItem> {
    if (isEnabled(process.env.SCHOOLOS_PARENT_PAYMENT_SANDBOX)) {
      return {
        id: 'payment-gateway',
        title: 'Payment gateway mode',
        description:
          'School-visible online payment mode without provider identifiers or secrets.',
        status: 'mock',
        message:
          'Mock payment mode is active. No live payment gateway details are shown.',
        checkedAt: checkedAt.toISOString(),
        signals: [
          {
            id: 'payment-mode',
            label: 'Gateway mode',
            status: 'mock',
            message:
              'Test payments are handled by the backend sandbox path for approved flows.',
          },
        ],
      };
    }

    const activeProvider = await this.findProvider(
      PAYMENT_GATEWAY_PROVIDER_TYPE,
      true,
    );
    if (!activeProvider) {
      return {
        id: 'payment-gateway',
        title: 'Payment gateway mode',
        description:
          'School-visible online payment mode without provider identifiers or secrets.',
        status: 'disabled',
        message: 'Online payment gateway mode is disabled for this school.',
        checkedAt: checkedAt.toISOString(),
        signals: [
          {
            id: 'payment-mode',
            label: 'Gateway mode',
            status: 'disabled',
            message:
              'Schools can continue using cash, bank transfer, and other configured offline collection methods.',
          },
        ],
      };
    }

    const config = asRecord(activeProvider.configEncrypted);
    const requiredRuntimeReady =
      hasText(config.merchantId) &&
      hasText(config.adapter) &&
      (hasText(config.initiateUrl) || hasText(config.intentUrl)) &&
      (hasText(config.webhookUrl) || hasText(config.webhookPath)) &&
      hasText(config.settlementStatusUrl);
    const adapterReady = config.adapter === 'generic_json_v1';
    const validationReady = activeProvider.validationStatus === 'VALID';
    const sandboxReady =
      activeProvider.environment !== 'PRODUCTION' ||
      Boolean(
        await this.prisma.providerConfig.findFirst({
          where: {
            type: PAYMENT_GATEWAY_PROVIDER_TYPE,
            name: activeProvider.name,
            environment: 'TEST',
            validationStatus: 'VALID',
          },
          select: { id: true },
        }),
      );

    if (
      requiredRuntimeReady &&
      adapterReady &&
      validationReady &&
      sandboxReady
    ) {
      return {
        id: 'payment-gateway',
        title: 'Payment gateway mode',
        description:
          'School-visible online payment mode without provider identifiers or secrets.',
        status: 'configured',
        message:
          'Online payment gateway mode is configured through a validated backend adapter.',
        checkedAt: checkedAt.toISOString(),
        observedAt: toIso(activeProvider.lastValidatedAt),
        signals: [
          {
            id: 'payment-mode',
            label: 'Gateway mode',
            status: 'configured',
            message:
              'Payment initiation, callback verification, idempotency, and settlement checks are backend-owned.',
            observedAt: toIso(activeProvider.lastValidatedAt),
          },
        ],
      };
    }

    return {
      id: 'payment-gateway',
      title: 'Payment gateway mode',
      description:
        'School-visible online payment mode without provider identifiers or secrets.',
      status: 'needs attention',
      message:
        'Payment gateway configuration exists, but backend validation is incomplete.',
      checkedAt: checkedAt.toISOString(),
      observedAt: toIso(activeProvider.lastValidatedAt),
      signals: [
        {
          id: 'payment-mode',
          label: 'Gateway mode',
          status: 'needs attention',
          message:
            'Keep online payments unavailable until backend validation and sandbox evidence are complete.',
          observedAt: toIso(activeProvider.lastValidatedAt),
        },
      ],
    };
  }

  private async getNotificationProviderStatus(
    checkedAt: Date,
  ): Promise<SchoolIntegrationStatusItem> {
    const signals = await Promise.all(
      (['sms', 'email', 'push'] as const).map((channel) =>
        this.getNotificationChannelStatus(channel),
      ),
    );

    const status = combineChannelStatuses(
      signals.map((signal) => signal.status),
    );
    const message =
      status === 'needs attention'
        ? 'One or more notification channels request configured delivery but backend provider validation is incomplete.'
        : 'Notification delivery modes are visible without exposing provider records or credentials.';

    return {
      id: 'notification-providers',
      title: 'SMS, email and push mode',
      description:
        'M12-owned delivery mode labels for school-visible communication status.',
      status,
      message,
      checkedAt: checkedAt.toISOString(),
      signals,
    };
  }

  private async getNotificationChannelStatus(
    channel: keyof typeof NOTIFICATION_PROVIDER_TYPES,
  ): Promise<SchoolIntegrationStatusSignal> {
    if (isDisabled(process.env.NOTIFICATIONS_DISABLED)) {
      return notificationSignal(channel, 'disabled');
    }

    const enabledEnv = `${channel.toUpperCase()}_PROVIDER_ENABLED`;
    if (isDisabled(process.env[enabledEnv])) {
      return notificationSignal(channel, 'disabled');
    }

    const mode = normalizeNotificationMode(readNotificationMode(channel));
    if (mode === 'disabled' || mode === 'dev-log' || mode === 'mock') {
      return notificationSignal(channel, mode);
    }

    const provider = await this.findProvider(
      NOTIFICATION_PROVIDER_TYPES[channel] as ProviderType,
      true,
    );
    if (!provider) {
      return notificationSignal(channel, 'needs attention');
    }

    const requiredKeys = getNotificationRequiredKeys(channel);
    const config = asRecord(provider.configEncrypted);
    const requiredReady = requiredKeys.every((key) => hasText(config[key]));
    const validationFailed = provider.validationStatus === 'FAILED';

    return notificationSignal(
      channel,
      requiredReady && !validationFailed ? 'configured' : 'needs attention',
      toIso(provider.lastValidatedAt),
    );
  }

  private async getAttendanceDeviceStatus(
    tenantId: string,
    checkedAt: Date,
  ): Promise<SchoolIntegrationStatusItem> {
    const where = {
      tenantId,
      deviceId: { not: null },
    };
    const [syncSubmissionCount, latestSync] = await Promise.all([
      this.prisma.attendanceSyncSubmission.count({ where }),
      this.prisma.attendanceSyncSubmission.findFirst({
        where,
        orderBy: { serverReceivedAt: 'desc' },
        select: { serverReceivedAt: true },
      }),
    ]);
    const hasBackendOwnedSync = syncSubmissionCount > 0;
    const status: SchoolIntegrationStatusLabel = hasBackendOwnedSync
      ? 'configured'
      : 'unavailable';

    return {
      id: 'attendance-devices',
      title: 'Attendance sync devices',
      description:
        'Tenant-scoped attendance sync visibility where M2 has backend ownership.',
      status,
      message: hasBackendOwnedSync
        ? 'Browser or mobile attendance sync has backend-owned tenant-scoped activity. External biometric device administration is not exposed here.'
        : 'No school-owned attendance-device backend contract is available. External biometric device status remains unavailable.',
      checkedAt: checkedAt.toISOString(),
      observedAt: toIso(latestSync?.serverReceivedAt ?? null),
      signals: [
        {
          id: 'attendance-sync',
          label: 'Browser/mobile sync',
          status,
          message: hasBackendOwnedSync
            ? 'Offline attendance sync submissions are recorded without exposing device identifiers.'
            : 'No tenant-scoped attendance sync device activity has been recorded.',
          observedAt: toIso(latestSync?.serverReceivedAt ?? null),
        },
        {
          id: 'external-attendance-device',
          label: 'External device provider',
          status: 'unavailable',
          message:
            'External attendance-device provider setup is not a school-visible backend contract yet.',
        },
      ],
    };
  }

  private findProvider(type: ProviderType, enabled?: boolean) {
    return this.prisma.providerConfig.findFirst({
      where: {
        type,
        ...(enabled === undefined ? {} : { enabled }),
      },
      orderBy: [{ updatedAt: 'desc' }],
      select: {
        id: true,
        type: true,
        name: true,
        enabled: true,
        environment: true,
        configEncrypted: true,
        validationStatus: true,
        lastValidatedAt: true,
        updatedAt: true,
      },
    }) as Promise<ProviderRecord | null>;
  }
}

function notificationSignal(
  channel: keyof typeof NOTIFICATION_PROVIDER_TYPES,
  status: SchoolIntegrationStatusLabel,
  observedAt?: string | null,
): SchoolIntegrationStatusSignal {
  const messages: Record<SchoolIntegrationStatusLabel, string> = {
    disabled: `${NOTIFICATION_LABELS[channel]} delivery is disabled.`,
    'dev-log': `${NOTIFICATION_LABELS[channel]} delivery is in dev-log mode and is not treated as live provider delivery.`,
    mock: `${NOTIFICATION_LABELS[channel]} delivery is in mock mode and is not treated as live provider delivery.`,
    configured: `${NOTIFICATION_LABELS[channel]} delivery is configured through the backend provider boundary.`,
    'needs attention': `${NOTIFICATION_LABELS[channel]} delivery needs backend provider attention before live use.`,
    unavailable: `${NOTIFICATION_LABELS[channel]} delivery status is unavailable.`,
  };
  return {
    id: channel,
    label: NOTIFICATION_LABELS[channel],
    status,
    message: messages[status],
    observedAt,
  };
}

function combineChannelStatuses(
  statuses: SchoolIntegrationStatusLabel[],
): SchoolIntegrationStatusLabel {
  if (statuses.includes('needs attention')) return 'needs attention';
  if (statuses.includes('configured')) return 'configured';
  if (statuses.includes('mock')) return 'mock';
  if (statuses.includes('dev-log')) return 'dev-log';
  if (statuses.every((status) => status === 'disabled')) return 'disabled';
  return 'unavailable';
}

function readNotificationMode(channel: 'sms' | 'email' | 'push') {
  return (
    process.env[`${channel.toUpperCase()}_PROVIDER_MODE`] ??
    process.env.SCHOOLOS_NOTIFICATION_PROVIDER_MODE ??
    (channel === 'email' ? process.env.EMAIL_DELIVERY_MODE : undefined)
  );
}

function normalizeNotificationMode(
  raw: string | undefined,
): 'disabled' | 'dev-log' | 'mock' | 'configured-provider' {
  const normalized = raw?.trim().toLowerCase();
  if (normalized === 'disabled' || normalized === 'off') return 'disabled';
  if (normalized === 'mock' || normalized === 'sandbox') return 'mock';
  if (normalized === 'configured-provider' || normalized === 'webhook') {
    return 'configured-provider';
  }
  return 'dev-log';
}

function getNotificationRequiredKeys(
  channel: keyof typeof NOTIFICATION_PROVIDER_TYPES,
) {
  if (channel === 'sms') return ['apiToken', 'senderId'];
  if (channel === 'email') return ['apiToken', 'fromEmail'];
  return ['projectId'];
}

function asRecord(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...value }
    : {};
}

function hasText(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isDisabled(value: string | undefined) {
  if (!value) return false;
  return ['0', 'false', 'disabled', 'off', 'no'].includes(
    value.trim().toLowerCase(),
  );
}

function isEnabled(value: string | undefined) {
  return ['1', 'true', 'yes', 'enabled', 'on'].includes(
    value?.trim().toLowerCase() ?? '',
  );
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}
