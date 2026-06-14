import { AcademicsProcessor } from './academics.processor';
import type { AuthContext } from '../auth/auth.types';

describe('AcademicsProcessor', () => {
  let processor: AcademicsProcessor;
  let reportCardsService: { generateReportCard: jest.Mock };
  let plansService: { shouldProcessTenantJob: jest.Mock };

  const actor: AuthContext = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    tenantSlug: 'tenant-one',
    email: 'admin@school.test',
    authMethod: 'PASSWORD',
    roles: ['admin'],
    permissions: ['academics:manage_report_cards'],
  } as AuthContext;

  beforeEach(() => {
    reportCardsService = {
      generateReportCard: jest.fn().mockResolvedValue({ id: 'rc-1' }),
    };
    plansService = {
      shouldProcessTenantJob: jest.fn().mockResolvedValue(true),
    };

    processor = new AcademicsProcessor(
      reportCardsService as any,
      plansService as any,
    );
  });

  it('runs generateReportCard in a loop for all provided studentIds', async () => {
    const jobData = {
      tenantId: 'tenant-1',
      academicYearId: 'year-1',
      examTermId: 'term-1',
      studentIds: ['student-1', 'student-2', 'student-3'],
      remarks: 'Batch Remarks',
      lock: true,
      actor,
    };

    await processor.process({
      name: 'batchGenerateReportCards',
      data: jobData,
    } as any);

    expect(plansService.shouldProcessTenantJob).toHaveBeenCalledWith(
      'tenant-1',
    );
    expect(reportCardsService.generateReportCard).toHaveBeenCalledTimes(3);
    expect(reportCardsService.generateReportCard).toHaveBeenNthCalledWith(
      1,
      {
        academicYearId: 'year-1',
        examTermId: 'term-1',
        studentId: 'student-1',
        remarks: 'Batch Remarks',
        lock: true,
      },
      actor,
    );
    expect(reportCardsService.generateReportCard).toHaveBeenNthCalledWith(
      3,
      {
        academicYearId: 'year-1',
        examTermId: 'term-1',
        studentId: 'student-3',
        remarks: 'Batch Remarks',
        lock: true,
      },
      actor,
    );
  });

  it('skips processing if tenant is suspended', async () => {
    plansService.shouldProcessTenantJob.mockResolvedValue(false);

    const jobData = {
      tenantId: 'tenant-suspended',
      academicYearId: 'year-1',
      examTermId: 'term-1',
      studentIds: ['student-1'],
      actor,
    };

    await processor.process({
      name: 'batchGenerateReportCards',
      data: jobData,
    } as any);

    expect(plansService.shouldProcessTenantJob).toHaveBeenCalledWith(
      'tenant-suspended',
    );
    expect(reportCardsService.generateReportCard).not.toHaveBeenCalled();
  });

  it('continues loop but fails the job if any student generation fails', async () => {
    reportCardsService.generateReportCard
      .mockRejectedValueOnce(new Error('Generation failed'))
      .mockResolvedValue({ id: 'rc-2' });

    const jobData = {
      tenantId: 'tenant-1',
      academicYearId: 'year-1',
      examTermId: 'term-1',
      studentIds: ['student-fail', 'student-success'],
      actor,
    };

    await expect(
      processor.process({
        name: 'batchGenerateReportCards',
        data: jobData,
      } as any),
    ).rejects.toThrow(
      'Report-card batch generation failed for 1 of 2 students',
    );

    expect(reportCardsService.generateReportCard).toHaveBeenCalledTimes(2);
    expect(reportCardsService.generateReportCard).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ studentId: 'student-success' }),
      actor,
    );
  });

  it('skips already generated locked report cards during batch retry without duplicating files', async () => {
    reportCardsService.generateReportCard
      .mockRejectedValueOnce(
        new Error(
          'Locked report cards cannot be regenerated without a correction workflow',
        ),
      )
      .mockResolvedValue({ id: 'rc-2' });

    const jobData = {
      tenantId: 'tenant-1',
      academicYearId: 'year-1',
      examTermId: 'term-1',
      studentIds: ['student-already-generated', 'student-new'],
      actor,
    };

    await processor.process({
      name: 'batchGenerateReportCards',
      data: jobData,
    } as any);

    expect(reportCardsService.generateReportCard).toHaveBeenCalledTimes(2);
    expect(reportCardsService.generateReportCard).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ studentId: 'student-new' }),
      actor,
    );
  });
});
