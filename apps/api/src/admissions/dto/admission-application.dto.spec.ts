import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ListAdmissionApplicationsDto,
  UpdateAdmissionApplicationStatusDto,
} from './admission-application.dto';

describe('Admission application DTOs', () => {
  it('accepts unified admission-case statuses as list filters', async () => {
    const dto = plainToInstance(ListAdmissionApplicationsDto, {
      status: 'ADMITTED',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('keeps direct status mutations limited to compatibility statuses', async () => {
    const dto = plainToInstance(UpdateAdmissionApplicationStatusDto, {
      status: 'ADMITTED',
    });

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });
});
