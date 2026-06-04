import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ParentAttendanceSummaryQueryDto } from './parent-attendance-summary-query.dto';

describe('ParentAttendanceSummaryQueryDto', () => {
  it('coerces valid month and year query values', () => {
    const dto = plainToInstance(ParentAttendanceSummaryQueryDto, {
      month: '5',
      year: '2026',
    });

    expect(validateSync(dto)).toHaveLength(0);
    expect(dto.month).toBe(5);
    expect(dto.year).toBe(2026);
  });

  it('rejects impossible attendance month values', () => {
    const dto = plainToInstance(ParentAttendanceSummaryQueryDto, {
      month: '13',
      year: '2026',
    });

    expect(validateSync(dto).map((error) => error.property)).toContain('month');
  });

  it('rejects non-numeric attendance years', () => {
    const dto = plainToInstance(ParentAttendanceSummaryQueryDto, {
      month: '5',
      year: 'not-a-year',
    });

    expect(validateSync(dto).map((error) => error.property)).toContain('year');
  });
});
