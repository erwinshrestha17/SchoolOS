import { Injectable, Logger } from '@nestjs/common';

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  metadata?: Record<string, string>;
};

type SendAuthCodeEmailInput = {
  to: string;
  tenantName: string;
  code: string;
  purpose: 'login' | 'password_recovery' | 'mfa_setup';
  resetUrl?: string;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

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
        throw new Error(
          `Email webhook failed with status ${response.status}`,
        );
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
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
