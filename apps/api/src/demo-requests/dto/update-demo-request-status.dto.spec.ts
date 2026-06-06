import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateDemoRequestStatusDto } from './update-demo-request-status.dto';

describe('UpdateDemoRequestStatusDto', () => {
  it('accepts a valid status update payload', () => {
    const dto = plainToInstance(UpdateDemoRequestStatusDto, {
      status: 'SCHEDULED',
      internalNotes: 'Demo booked for next week',
    });

    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects unknown statuses and oversized notes', () => {
    const dto = plainToInstance(UpdateDemoRequestStatusDto, {
      status: 'UNKNOWN',
      internalNotes: 'x'.repeat(2001),
    });

    expect(validateSync(dto).length).toBeGreaterThan(0);
  });
});
