import { validate } from 'class-validator';
import { ReviewStaffLeaveDecisionDto } from './review-staff-leave-decision.dto';
import { ReviewStaffLeaveRequestDto } from './review-staff-leave-request.dto';

describe('ReviewStaffLeaveDecisionDto', () => {
  it('accepts an empty body since reviewNote is optional', async () => {
    const dto = Object.assign(new ReviewStaffLeaveDecisionDto(), {});

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('accepts a body with only a reviewNote', async () => {
    const dto = Object.assign(new ReviewStaffLeaveDecisionDto(), {
      reviewNote: 'Approved by principal',
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('rejects a reviewNote longer than 1000 characters', async () => {
    const dto = Object.assign(new ReviewStaffLeaveDecisionDto(), {
      reviewNote: 'x'.repeat(1001),
    });

    await expect(validate(dto)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'reviewNote' }),
      ]),
    );
  });

  it('rejects a client-supplied status under the app-wide whitelist ValidationPipe rules', async () => {
    const dto = Object.assign(new ReviewStaffLeaveDecisionDto(), {
      reviewNote: 'note',
      status: 'APPROVED',
    });

    await expect(
      validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'status' })]),
    );
  });
});

describe('ReviewStaffLeaveRequestDto (generic review route)', () => {
  it('requires a status of APPROVED or REJECTED', async () => {
    const dto = Object.assign(new ReviewStaffLeaveRequestDto(), {
      reviewNote: 'Missing status',
    });

    await expect(validate(dto)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'status' })]),
    );
  });

  it('rejects an unsupported status value', async () => {
    const dto = Object.assign(new ReviewStaffLeaveRequestDto(), {
      status: 'PENDING',
    });

    await expect(validate(dto)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ property: 'status' })]),
    );
  });

  it('passes validation with a valid status', async () => {
    const dto = Object.assign(new ReviewStaffLeaveRequestDto(), {
      status: 'APPROVED',
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });
});
