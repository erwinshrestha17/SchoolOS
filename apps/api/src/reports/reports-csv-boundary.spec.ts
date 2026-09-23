import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReportsService } from './reports.service';

interface ReportConversionBoundary {
  convertToCsv(rows: Record<string, unknown>[]): string;
  toStudentFeeLedgerQuery(filters: Record<string, unknown>): unknown;
}

const reportConversions =
  ReportsService.prototype as unknown as ReportConversionBoundary;

describe('ReportsService CSV and filter boundaries', () => {
  it('does not expand an unexpected object into protected CSV contents', () => {
    const csv = reportConversions.convertToCsv([
      { student: 'Student One', protected: { medical: 'private detail' } },
    ]);

    expect(csv).toBe('student,protected\n"Student One","[object Object]"');
    expect(csv).not.toContain('private detail');
  });

  it('keeps precise money and date scalar text in CSV cells', () => {
    const date = new Date('2026-09-22T00:00:00.000Z');
    const csv = reportConversions.convertToCsv([
      { money: new Prisma.Decimal('1234.56'), date },
    ]);

    expect(csv).toBe(`money,date\n"1234.56","${date.toString()}"`);
  });

  it('rejects non-scalar ledger filters before a report query is built', () => {
    expect(() =>
      reportConversions.toStudentFeeLedgerQuery({
        academicYearId: { tenantId: 'other-tenant' },
      }),
    ).toThrow(BadRequestException);
  });
});
