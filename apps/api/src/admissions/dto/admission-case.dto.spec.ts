import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReviewAdmissionCaseDto } from './admission-case.dto';

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
});
