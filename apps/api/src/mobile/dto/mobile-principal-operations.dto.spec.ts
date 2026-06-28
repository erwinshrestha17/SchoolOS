import { validate } from 'class-validator';
import {
  MobilePrincipalApprovalDecisionDto,
  MobilePrincipalApprovalQueryDto,
} from './mobile-principal-approval.dto';
import {
  MobilePrincipalEmergencyNoticePreviewDto,
  MobilePrincipalEmergencyNoticeSubmitDto,
} from './mobile-principal-emergency-notice.dto';
import {
  MobilePrincipalEscalationQueryDto,
  MobilePrincipalEscalationResolutionDto,
} from './mobile-principal-escalation.dto';

describe('mobile principal operation DTOs', () => {
  it('rejects unsupported approval decisions', async () => {
    const dto = Object.assign(new MobilePrincipalApprovalDecisionDto(), {
      decision: 'CANCEL',
    });

    await expect(validate(dto)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'decision' }),
      ]),
    );
  });

  it('rejects unsupported approval and escalation filters', async () => {
    const approvalQuery = Object.assign(new MobilePrincipalApprovalQueryDto(), {
      status: 'all',
    });
    const escalationQuery = Object.assign(
      new MobilePrincipalEscalationQueryDto(),
      { status: 'closed' },
    );

    await expect(validate(approvalQuery)).resolves.toEqual([
      expect.objectContaining({ property: 'status' }),
    ]);
    await expect(validate(escalationQuery)).resolves.toEqual([
      expect.objectContaining({ property: 'status' }),
    ]);
  });

  it('rejects empty escalation resolution reasons', async () => {
    const dto = Object.assign(new MobilePrincipalEscalationResolutionDto(), {
      resolutionReason: '',
    });

    await expect(validate(dto)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'resolutionReason' }),
      ]),
    );
  });

  it('rejects normal-priority emergency composer input', async () => {
    const dto = Object.assign(new MobilePrincipalEmergencyNoticePreviewDto(), {
      title: 'Routine reminder',
      body: 'This is not a high-impact notice.',
      priority: 'NORMAL',
      audienceType: 'ALL',
    });

    await expect(validate(dto)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'priority' }),
      ]),
    );
  });

  it('requires valid idempotency and send-mode values', async () => {
    const dto = Object.assign(new MobilePrincipalEmergencyNoticeSubmitDto(), {
      title: 'Urgent update',
      body: 'Classes start one hour late.',
      priority: 'URGENT',
      audienceType: 'ALL',
      sendMode: 'LATER',
      idempotencyKey: 'not-a-uuid',
    });
    const errors = await validate(dto);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'sendMode' }),
        expect.objectContaining({ property: 'idempotencyKey' }),
      ]),
    );
  });
});
