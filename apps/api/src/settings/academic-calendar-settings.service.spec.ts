import { AcademicCalendarSettingsService } from './academic-calendar-settings.service';

describe('AcademicCalendarSettingsService', () => {
  const tenantId = 'tenant-a';
  const userId = 'user-a';

  function buildService() {
    const tx = {
      academicYear: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
    };
    const prisma = {
      academicYear: { findMany: jest.fn() },
      schoolCalendarDay: { findMany: jest.fn(), upsert: jest.fn() },
      $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
    };
    const auditService = { record: jest.fn() };
    return {
      service: new AcademicCalendarSettingsService(prisma as never, auditService as never),
      prisma,
      tx,
      auditService,
    };
  }

  it('stores a BS calendar day at Nepal local midnight in UTC', async () => {
    const { service, prisma, auditService } = buildService();
    prisma.schoolCalendarDay.upsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) => ({
      id: 'day-1',
      ...create,
    }));

    await service.upsertCalendarDay(tenantId, {
      calendarDateBs: '2081-01-01',
      isWorkingDay: false,
      label: 'New year holiday',
      holidayType: 'Public holiday',
    }, userId);

    const input = prisma.schoolCalendarDay.upsert.mock.calls[0][0];
    expect(input.where.tenantId_calendarDate.calendarDate.toISOString()).toBe('2024-04-12T18:15:00.000Z');
    expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      userId,
      action: 'school_calendar_day_upserted',
    }));
  });

  it('creates BS academic years atomically and makes the requested year current', async () => {
    const { service, tx, auditService } = buildService();
    tx.academicYear.findUnique.mockResolvedValue(null);
    tx.academicYear.findFirst.mockResolvedValue(null);
    tx.academicYear.updateMany.mockResolvedValue({ count: 1 });
    tx.academicYear.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'year-1', ...data }));

    await service.createAcademicYear(tenantId, {
      name: '2081/82',
      startsOnBs: '2081-01-01',
      endsOnBs: '2081-01-02',
      isCurrent: true,
    }, userId);

    const data = tx.academicYear.create.mock.calls[0][0].data;
    expect(data.startsOn.toISOString()).toBe('2024-04-12T18:15:00.000Z');
    expect(tx.academicYear.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId, isCurrent: true },
    }));
    expect(auditService.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'academic_calendar_year_created',
      tenantId,
      userId,
    }));
  });
});
