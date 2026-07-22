import { AuthMethod } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { AdmissionDocumentReminderService } from './admission-document-reminder.service';

const actor: AuthContext = {
  tenantId: 'tenant-a',
  tenantSlug: 'tenant-a',
  userId: 'admin-a',
  email: 'admin@school.test',
  authMethod: AuthMethod.PASSWORD,
  roles: ['admin'],
  permissions: ['students:manage_lifecycle', 'guardians:read'],
};

describe('AdmissionDocumentReminderService', () => {
  it('returns honest batch outcomes without exposing contact or delivery details', async () => {
    const admissionCases = {
      resolveDocumentReminderCandidates: jest.fn().mockResolvedValue([
        {
          admissionCaseId: '11111111-1111-4111-8111-111111111111',
          state: 'READY',
          applicantName: 'Aarav Shrestha',
          guardianPhone: '9800000000',
          sourceUpdatedAt: '2026-07-20T04:00:00.000Z',
          missingDocumentLabels: ['Birth certificate'],
        },
        {
          admissionCaseId: '22222222-2222-4222-8222-222222222222',
          state: 'SKIPPED',
          reason: 'NO_GUARDIAN_PHONE',
        },
      ]),
    };
    const communications = {
      recordAdmissionDocumentReminder: jest.fn().mockResolvedValue({
        state: 'QUEUED',
        reason: null,
      }),
    };
    const audit = { record: jest.fn() };
    const service = new AdmissionDocumentReminderService(
      admissionCases as never,
      communications as never,
      audit as never,
    );
    const response = await service.requestReminders(
      {
        admissionCaseIds: [
          '11111111-1111-4111-8111-111111111111',
          '22222222-2222-4222-8222-222222222222',
        ],
      },
      actor,
    );

    expect(response).toEqual({
      requested: 2,
      queued: 1,
      alreadyQueued: 0,
      skipped: 1,
      results: [
        {
          admissionCaseId: '11111111-1111-4111-8111-111111111111',
          state: 'QUEUED',
          reason: null,
        },
        {
          admissionCaseId: '22222222-2222-4222-8222-222222222222',
          state: 'SKIPPED',
          reason: 'NO_GUARDIAN_PHONE',
        },
      ],
    });
    expect(JSON.stringify(response)).not.toContain('9800000000');
    expect(JSON.stringify(response)).not.toContain('Birth certificate');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'request_document_reminders',
        resource: 'admission_case',
        tenantId: 'tenant-a',
        userId: 'admin-a',
        after: expect.objectContaining({
          requested: 2,
          queued: 1,
          skipped: 1,
        }),
      }),
    );
  });

  it('contains one delivery failure and continues the bounded batch', async () => {
    const admissionCases = {
      resolveDocumentReminderCandidates: jest.fn().mockResolvedValue([
        {
          admissionCaseId: '11111111-1111-4111-8111-111111111111',
          state: 'READY',
          applicantName: 'Aarav Shrestha',
          guardianPhone: '9800000000',
          sourceUpdatedAt: '2026-07-20T04:00:00.000Z',
          missingDocumentLabels: ['Birth certificate'],
        },
      ]),
    };
    const communications = {
      recordAdmissionDocumentReminder: jest
        .fn()
        .mockRejectedValue(new Error('private provider failure')),
    };
    const service = new AdmissionDocumentReminderService(
      admissionCases as never,
      communications as never,
      { record: jest.fn() } as never,
    );

    await expect(
      service.requestReminders(
        {
          admissionCaseIds: ['11111111-1111-4111-8111-111111111111'],
        },
        actor,
      ),
    ).resolves.toEqual({
      requested: 1,
      queued: 0,
      alreadyQueued: 0,
      skipped: 1,
      results: [
        {
          admissionCaseId: '11111111-1111-4111-8111-111111111111',
          state: 'SKIPPED',
          reason: 'DELIVERY_UNAVAILABLE',
        },
      ],
    });
  });
});
