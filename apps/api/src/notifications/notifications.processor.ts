import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { NotificationStatus } from '@prisma/client';
import { Job } from 'bullmq';
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

@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<NotificationJobData, void>): Promise<void> {
    try {
      switch (job.name) {
        case 'sendEmail':
          await this.handleSendEmail(job.data as EmailJobData);
          break;
        case 'sendSms':
          await this.handleSendSms(job.data as SmsJobData);
          break;
        case 'sendPushNotification':
          await this.handleSendPush(job.data as PushJobData);
          break;
        default:
          this.logger.warn(`Unknown job name: ${job.name}`);
      }

      await this.markDelivery(job.data, NotificationStatus.SENT);
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
        errorMessage: errorMessage ?? null,
      },
    });
  }

  private async handleSendEmail(input: EmailJobData) {
    const mode = process.env.EMAIL_DELIVERY_MODE ?? 'log';

    if (mode === 'webhook') {
      const webhookUrl = process.env.EMAIL_WEBHOOK_URL;

      if (!webhookUrl) {
        throw new Error(
          'EMAIL_WEBHOOK_URL must be configured when EMAIL_DELIVERY_MODE=webhook',
        );
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.EMAIL_WEBHOOK_TOKEN
            ? {
                Authorization: `Bearer ${process.env.EMAIL_WEBHOOK_TOKEN}`,
              }
            : {}),
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM_ADDRESS ?? 'no-reply@schoolos.local',
          to: input.to,
          subject: input.subject,
          text: input.text,
          html: input.html,
          metadata: input.metadata ?? {},
        }),
      });

      if (!response.ok) {
        throw new Error(`Email webhook failed with status ${response.status}`);
      }
      return;
    }

    this.logger.log(
      JSON.stringify({
        mode: 'log',
        to: input.to,
        subject: input.subject,
        text: input.text,
        metadata: input.metadata ?? {},
      }),
    );
  }

  private async handleSendSms(input: SmsJobData) {
    this.logger.log(
      JSON.stringify({
        mode: 'log',
        channel: 'sms',
        to: input.to,
        message: input.message,
        metadata: input.metadata ?? {},
      }),
    );
  }

  private async handleSendPush(input: PushJobData) {
    this.logger.log(
      JSON.stringify({
        mode: 'log',
        channel: 'push',
        title: input.title,
        body: input.body,
        audience: input.audience,
        metadata: input.metadata ?? {},
      }),
    );
  }
}
