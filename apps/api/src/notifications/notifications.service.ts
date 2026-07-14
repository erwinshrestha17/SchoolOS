import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';

interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  metadata?: Record<string, string>;
}

interface SendSmsInput {
  to: string;
  message: string;
  metadata?: Record<string, string>;
}

interface SendPushNotificationInput {
  title: string;
  body: string;
  audience: string;
  metadata?: Record<string, string>;
}

interface SendAuthCodeEmailInput {
  to: string;
  tenantName: string;
  code: string;
  purpose: 'login' | 'password_recovery' | 'mfa_setup';
  resetUrl?: string;
}

export interface NotificationProviderReadiness {
  enabled: boolean;
  failureCode: 'PROVIDER_DISABLED' | 'PROVIDER_NOT_READY' | null;
  failureReason: string | null;
}

import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectQueue('notifications') private notificationsQueue: Queue,
  ) {}

  async sendAuthCodeEmail(input: SendAuthCodeEmailInput) {
    const subject =
      input.purpose === 'password_recovery'
        ? `${input.tenantName}: password reset code`
        : `${input.tenantName}: security code`;

    const lines = [
      `Hello,`,
      '',
      `Your ${input.purpose.replaceAll('_', ' ')} code for ${input.tenantName} is: ${input.code}`,
      '',
      'This code expires soon. If you did not request it, you can ignore this email.',
    ];

    if (input.resetUrl) {
      lines.push('', `Reset page: ${input.resetUrl}`);
    }

    await this.sendEmail({
      to: input.to,
      subject,
      text: lines.join('\n'),
      html: `<p>Hello,</p><p>Your ${input.purpose.replaceAll('_', ' ')} code for <strong>${escapeHtml(input.tenantName)}</strong> is:</p><p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${escapeHtml(input.code)}</p><p>This code expires soon. If you did not request it, you can ignore this email.</p>${input.resetUrl ? `<p>Reset page: <a href="${escapeHtml(input.resetUrl)}">${escapeHtml(input.resetUrl)}</a></p>` : ''}`,
      metadata: {
        purpose: input.purpose,
      },
    });
  }

  async sendEmail(input: SendEmailInput) {
    await this.notificationsQueue.add('sendEmail', input, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }

  async sendSms(input: SendSmsInput) {
    await this.notificationsQueue.add('sendSms', input, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }

  async sendPushNotification(input: SendPushNotificationInput) {
    await this.notificationsQueue.add('sendPushNotification', input, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }

  getProviderReadiness(
    channel: NotificationChannel,
  ): Promise<NotificationProviderReadiness> {
    return Promise.resolve(resolveProviderReadiness(channel));
  }
}

function resolveProviderReadiness(
  channel: NotificationChannel,
): NotificationProviderReadiness {
  if (isDisabled(process.env.NOTIFICATIONS_DISABLED)) {
    return {
      enabled: false,
      failureCode: 'PROVIDER_DISABLED',
      failureReason: 'Notification dispatch is disabled for this environment.',
    };
  }

  const channelMode = getChannelMode(channel);
  if (isDisabled(process.env[channelMode.enabledEnv])) {
    return {
      enabled: false,
      failureCode: 'PROVIDER_DISABLED',
      failureReason: `${channelMode.label} dispatch is disabled.`,
    };
  }

  if (isDisabled(process.env[channelMode.readyEnv])) {
    return {
      enabled: false,
      failureCode: 'PROVIDER_NOT_READY',
      failureReason: `${channelMode.label} provider is not ready.`,
    };
  }

  if (
    channel !== NotificationChannel.IN_APP &&
    channel !== NotificationChannel.PUSH &&
    (!isEnabled(process.env[channelMode.enabledEnv]) ||
      !isEnabled(process.env[channelMode.readyEnv]))
  ) {
    return {
      enabled: false,
      failureCode: 'PROVIDER_NOT_READY',
      failureReason: `${channelMode.label} provider readiness has not been confirmed.`,
    };
  }

  if (channel === NotificationChannel.PUSH) {
    const providerMode = (
      process.env.PUSH_PROVIDER_MODE ??
      process.env.SCHOOLOS_NOTIFICATION_PROVIDER_MODE ??
      'dev-log'
    )
      .trim()
      .toLowerCase();
    if (providerMode === 'disabled') {
      return {
        enabled: false,
        failureCode: 'PROVIDER_DISABLED',
        failureReason: 'Push notification dispatch is disabled.',
      };
    }
    if (providerMode !== 'configured-provider' && providerMode !== 'webhook') {
      return {
        enabled: false,
        failureCode: 'PROVIDER_NOT_READY',
        failureReason:
          'Push notifications are registered, but this environment is not connected to a delivery provider.',
      };
    }
    if (!isEnabled(process.env.PUSH_PROVIDER_READY)) {
      return {
        enabled: false,
        failureCode: 'PROVIDER_NOT_READY',
        failureReason: 'Push notification provider is not ready.',
      };
    }
  }

  return {
    enabled: true,
    failureCode: null,
    failureReason: null,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getChannelMode(channel: NotificationChannel) {
  if (channel === NotificationChannel.EMAIL) {
    return {
      label: 'Email',
      enabledEnv: 'EMAIL_PROVIDER_ENABLED',
      readyEnv: 'EMAIL_PROVIDER_READY',
    };
  }

  if (channel === NotificationChannel.SMS) {
    return {
      label: 'SMS',
      enabledEnv: 'SMS_PROVIDER_ENABLED',
      readyEnv: 'SMS_PROVIDER_READY',
    };
  }

  if (channel === NotificationChannel.IN_APP) {
    return {
      label: 'In-app notification',
      enabledEnv: 'IN_APP_PROVIDER_ENABLED',
      readyEnv: 'IN_APP_PROVIDER_READY',
    };
  }

  return {
    label: 'Push notification',
    enabledEnv: 'PUSH_PROVIDER_ENABLED',
    readyEnv: 'PUSH_PROVIDER_READY',
  };
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
