import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ListAdmissionAssessmentCandidatesDto,
  RequestAdmissionDocumentRemindersDto,
  ReviewAdmissionCaseDto,
} from './admission-case.dto';

describe('Admission case review DTO', () => {
  it('accepts only shared admission case review actions', async () => {
    const accepted = plainToInstance(ReviewAdmissionCaseDto, {
      action: 'APPROVE',
      reason: 'Required admission checks were reviewed.',
    });
    const rejected = plainToInstance(ReviewAdmissionCaseDto, {
      action: 'SCORE_APPLICATION',
      reason: 'No shared scoring contract exists.',
    });

    await expect(validate(accepted)).resolves.toHaveLength(0);
    await expect(validate(rejected)).resolves.not.toHaveLength(0);
  });

  it('validates reviewer assignment fields without inventing reviewer detail', async () => {
    const dto = plainToInstance(ReviewAdmissionCaseDto, {
      action: 'ASSIGN_REVIEWER',
      reviewerUserId: 'reviewer-a',
      dueDate: '2026-07-10',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects review reasons that are too short to be auditable', async () => {
    const dto = plainToInstance(ReviewAdmissionCaseDto, {
      action: 'REJECT',
      reason: 'No',
    });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it('accepts a bounded unique list of admission case UUIDs for reminders', async () => {
    const dto = plainToInstance(RequestAdmissionDocumentRemindersDto, {
      admissionCaseIds: [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
      ],
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects empty, duplicate, oversized, and non-UUID reminder batches', async () => {
    const validId = '11111111-1111-4111-8111-111111111111';
    const cases = [
      [],
      [validId, validId],
      Array.from(
        { length: 26 },
        (_, index) =>
          `${String(index + 1).padStart(8, '0')}-1111-4111-8111-111111111111`,
      ),
      ['not-an-admission-case-id'],
    ];

    for (const admissionCaseIds of cases) {
      const dto = plainToInstance(RequestAdmissionDocumentRemindersDto, {
        admissionCaseIds,
      });
      await expect(validate(dto)).resolves.not.toHaveLength(0);
    }
  });

  it('accepts only a UUID for a case-specific assessment candidate query', async () => {
    const accepted = plainToInstance(ListAdmissionAssessmentCandidatesDto, {
      admissionCaseId: '11111111-1111-4111-8111-111111111111',
    });
    const rejected = plainToInstance(ListAdmissionAssessmentCandidatesDto, {
      admissionCaseId: 'case-from-another-screen',
    });

    await expect(validate(accepted)).resolves.toHaveLength(0);
    await expect(validate(rejected)).resolves.not.toHaveLength(0);
  });
});
