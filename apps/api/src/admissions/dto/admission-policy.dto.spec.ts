import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ADMISSION_POLICY_REQUIRED_FIELDS } from '@schoolos/core';
import {
  ArchiveAdmissionPolicyDto,
  UpdateAdmissionPolicyVersionDto,
} from './admission-policy.dto';

describe('UpdateAdmissionPolicyVersionDto required fields', () => {
  it('accepts every case field supported by the shared admission contract', async () => {
    const dto = plainToInstance(UpdateAdmissionPolicyVersionDto, {
      requiredFields: [...ADMISSION_POLICY_REQUIRED_FIELDS],
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects unsupported or duplicate required fields', async () => {
    const dto = plainToInstance(UpdateAdmissionPolicyVersionDto, {
      requiredFields: [
        'guardianEmail',
        'guardianEmail',
        'customFieldThatNoCaseCanStore',
      ],
    });

    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toContain('requiredFields');
  });
});

describe('ArchiveAdmissionPolicyDto', () => {
  it('trims and accepts a bounded audit reason', async () => {
    const dto = plainToInstance(ArchiveAdmissionPolicyDto, {
      reason: '  Superseded by the 2084 policy.  ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.reason).toBe('Superseded by the 2084 policy.');
  });

  it.each(['', '   ', 'no', 'x'.repeat(501)])(
    'rejects unsafe archive reason %p',
    async (reason) => {
      const dto = plainToInstance(ArchiveAdmissionPolicyDto, { reason });

      await expect(validate(dto)).resolves.not.toHaveLength(0);
    },
  );
});
