import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ListDemoRequestsDto } from './list-demo-requests.dto';

describe('ListDemoRequestsDto', () => {
  it('accepts valid pagination and filter fields', () => {
    const dto = plainToInstance(ListDemoRequestsDto, {
      page: 2,
      limit: 50,
      search: 'everest',
      status: 'CONTACTED',
      dateFrom: '2026-06-01T00:00:00.000Z',
      dateTo: '2026-06-30T23:59:59.999Z',
    });

    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects invalid status and limit values', () => {
    const dto = plainToInstance(ListDemoRequestsDto, {
      status: 'INVALID',
      limit: 500,
    });

    expect(validateSync(dto).length).toBeGreaterThan(0);
  });
});
