import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthContext } from '../auth/auth.types';
import { FinanceService } from '../finance/finance.service';
import { AuthMethod, FileStatus } from '@prisma/client';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { PlansService } from '../plans/plans.service';
import { SUSPENDED_TENANT_MESSAGE } from '../plans/tenant-access.constants';
import sharp from 'sharp';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: PrismaService;
  let audit: AuditService;
  let fileRegistry: FileRegistryService;
  let plansService: jest.Mocked<PlansService>;
  let reportsQueue: { add: jest.Mock };

  const actor: AuthContext = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    email: 'admin@schoolos.test',
    authMethod: AuthMethod.PASSWORD,
    roles: ['admin'],
    permissions: [
      'reports:read',
      'reports:export',
      'students:read',
      'classes:read',
      'attendance:read',
      'ledger:read',
      'academics:read',
    ],
    tenantSlug: 'everest',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: PrismaService,
          useValue: {
            student: {
              findMany: jest.fn().mockResolvedValue([
                {
                  id: 's1',
                  studentSystemId: 'SCH-001',
                  firstNameEn: 'Erwin',
                  lastNameEn: 'Shrestha',
                  gender: 'MALE',
                  dateOfBirth: new Date('2010-01-01'),
                  admissionDate: new Date('2020-01-01'),
                  lifecycleStatus: 'ACTIVE',
                  class: { name: 'Grade 1' },
                  sectionRef: { name: 'A' },
                  section: 'A',
                  rollNumber: 1,
                },
              ]),
            },
            tenantSetting: {
              findMany: jest.fn().mockResolvedValue([]),
              findUnique: jest.fn().mockResolvedValue(null),
            },
            enrollment: {
              findMany: jest.fn().mockResolvedValue([
                {
                  id: 'e1',
                  studentId: 's1',
                  academicYearId: 'ay1',
                  classId: 'c1',
                  sectionId: 'sec1',
                  rollNumber: 5,
                  admissionDate: new Date('2020-01-01'),
                  status: 'ACTIVE',
                  class: { name: 'Grade 1' },
                  section: { name: 'A' },
                  student: {
                    id: 's1',
                    studentSystemId: 'SCH-001',
                    firstNameEn: 'Erwin',
                    lastNameEn: 'Shrestha',
                    gender: 'MALE',
                    dateOfBirth: new Date('2010-01-01'),
                    guardianLinks: [
                      {
                        isPrimary: true,
                        guardian: {
                          fullName: 'Guardian Name',
                          primaryPhone: '9800000000',
                        },
                      },
                    ],
                  },
                },
              ]),
            },
            attendanceSession: {
              findMany: jest.fn().mockResolvedValue([
                {
                  id: 'as1',
                  attendanceDate: new Date('2024-05-01'),
                  records: [{ studentId: 's1', status: 'PRESENT' }],
                },
                {
                  id: 'as2',
                  attendanceDate: new Date('2024-05-02'),
                  records: [{ studentId: 's1', status: 'ABSENT' }],
                },
              ]),
            },
            reportExport: {
              create: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn().mockResolvedValue([]),
              count: jest.fn().mockResolvedValue(0),
              findFirst: jest.fn(),
            },
            casRecord: {
              findMany: jest.fn().mockResolvedValue([
                {
                  student: {
                    studentSystemId: 'SCH-001',
                    firstNameEn: 'Erwin',
                    lastNameEn: 'Shrestha',
                  },
                  subject: {
                    code: 'ENG',
                    name: 'English',
                  },
                  category: 'PROJECT',
                  observedOn: new Date('2024-05-01'),
                  score: 8,
                  maxScore: 10,
                  note: 'Good',
                },
              ]),
            },
            reportCard: {
              findMany: jest.fn().mockResolvedValue([
                {
                  student: {
                    studentSystemId: 'SCH-001',
                    firstNameEn: 'Erwin',
                    lastNameEn: 'Shrestha',
                    rollNumber: 1,
                  },
                  class: { name: 'Grade 1' },
                  section: { name: 'A' },
                  percentage: 85.5,
                  grade: 'A',
                  gpa: 3.6,
                  status: 'LOCKED',
                  version: 1,
                },
              ]),
            },
            class: {
              findFirst: jest
                .fn()
                .mockResolvedValue({ id: 'c1', name: 'Grade 1' }),
            },
            section: {
              findFirst: jest.fn().mockResolvedValue({ id: 'sec1', name: 'A' }),
            },
          },
        },
        {
          provide: FinanceService,
          useValue: {
            getStudentFeeLedger: jest.fn().mockResolvedValue({
              student: {
                studentSystemId: 'SCH-001',
                name: 'Erwin Shrestha',
                className: 'Grade 10',
                sectionName: 'A',
                guardianName: 'John Doe',
                guardianPhone: '9800000000',
              },
              rows: [
                {
                  date: new Date('2024-05-01'),
                  type: 'INVOICE',
                  reference: 'INV-001',
                  description: 'Tuition Fee',
                  debit: 1000,
                  credit: 0,
                  runningBalance: 1000,
                  invoiceNumber: 'INV-001',
                  receiptNumber: null,
                  status: 'ISSUED',
                },
              ],
            }),
          },
        },
        {
          provide: AuditService,
          useValue: {
            record: jest.fn(),
          },
        },
        {
          provide: FileRegistryService,
          useValue: {
            registerGeneratedFile: jest
              .fn()
              .mockResolvedValue({ id: 'file-1' }),
            getFileMetadata: jest.fn(),
            getProtectedDownload: jest.fn(),
          },
        },
        {
          provide: getQueueToken('reports'),
          useValue: { add: jest.fn().mockResolvedValue({ id: 'job-1' }) },
        },
        {
          provide: PlansService,
          useValue: {
            assertTenantActive: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
    fileRegistry = module.get<FileRegistryService>(FileRegistryService);
    plansService = module.get(PlansService);
    reportsQueue = module.get(getQueueToken('reports'));
  });

  it('lists reports the user has permission to see', () => {
    const reports = service.listReports(actor);
    expect(reports.length).toBeGreaterThan(0);
    expect(reports.map((r) => r.key)).toContain('student-roster');
    expect(reports.map((r) => r.key)).toContain('class-roster');
    expect(reports.map((r) => r.key)).toContain('monthly-attendance-register');
    expect(reports.map((r) => r.key)).toContain('student-fee-ledger');
  });

  it('filters out reports user cannot access', () => {
    const restrictedActor = { ...actor, permissions: ['reports:read'] };
    const reports = service.listReports(restrictedActor);
    // monthly-attendance-register requires attendance:read
    expect(
      reports.find((r) => r.key === 'monthly-attendance-register'),
    ).toBeUndefined();
  });

  it('blocks report exports for suspended tenants before queueing or generating files', async () => {
    plansService.assertTenantActive.mockRejectedValue(
      new ForbiddenException(SUSPENDED_TENANT_MESSAGE),
    );

    await expect(
      service.exportReport(
        'student-roster',
        { format: 'json', filters: {} },
        actor,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(reportsQueue.add).not.toHaveBeenCalled();
  });

  it('exports monthly-attendance-register in CSV format', async () => {
    const result = await service.exportReport(
      'monthly-attendance-register',
      {
        format: 'csv',
        filters: {
          academicYearId: 'ay1',
          classId: 'c1',
          month: 5,
          year: 2024,
        },
      },
      actor,
    );

    expect(result.format).toBe('csv');
    const csvString = expectBufferText(result.content);
    expect(csvString).toContain('Student ID,Full Name,Class,Section');
    expect(csvString).toContain('Total School Days,Present Count,Absent Count');
    expect(csvString).toContain('"SCH-001","Erwin Shrestha","Grade 1"');
    // Daily columns
    expect(csvString).toContain('D01,D02');
    expect(csvString).toContain('"PRESENT","ABSENT"');
    expect(audit.record).toHaveBeenCalled();
  });

  it('enforces tenant scoping during attendance queries', async () => {
    await service.exportReport(
      'monthly-attendance-register',
      {
        format: 'json',
        filters: {
          academicYearId: 'ay1',
          classId: 'c1',
          month: 5,
          year: 2024,
        },
      },
      actor,
    );

    expect(prisma.attendanceSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: actor.tenantId,
        }),
      }),
    );
  });

  it('throws ForbiddenException for missing required filters', async () => {
    await expect(
      service.exportReport(
        'monthly-attendance-register',
        {
          format: 'json',
          filters: { month: 5, year: 2024 },
        },
        actor,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('exports student-fee-ledger in CSV format', async () => {
    const result = await service.exportReport(
      'student-fee-ledger',
      {
        format: 'csv',
        filters: {
          studentId: 's1',
        },
      },
      actor,
    );

    expect(result.format).toBe('csv');
    const csvString = expectBufferText(result.content);
    expect(csvString).toContain(
      'Student ID,Student Name,Class,Section,Guardian Name,Guardian Phone',
    );
    expect(csvString).toContain('Date,Type,Reference,Description,Debit,Credit');
    expect(csvString).toContain(
      '"SCH-001","Erwin Shrestha","Grade 10","A","John Doe","9800000000"',
    );
    expect(csvString).toContain('"2024-05-01","INVOICE","INV-001"');
    expect(audit.record).toHaveBeenCalled();
  });

  it('exports academic-cas-summary in CSV format', async () => {
    const result = await service.exportReport(
      'academic-cas-summary',
      {
        format: 'csv',
        filters: {
          academicYearId: 'ay1',
          classId: 'c1',
        },
      },
      actor,
    );

    expect(result.format).toBe('csv');
    const csvString = expectBufferText(result.content);
    expect(csvString).toContain(
      'Student ID,Student,Subject,Category,Observed On,Score,Max Score,Percentage,Note',
    );
    expect(csvString).toContain('"SCH-001","Erwin Shrestha","ENG - English"');
    expect(csvString).toContain(
      '"PROJECT","2024-05-01","8","10","80.00","Good"',
    );
  });

  it('exports academic-promotion-readiness in CSV format', async () => {
    const result = await service.exportReport(
      'academic-promotion-readiness',
      {
        format: 'csv',
        filters: {
          academicYearId: 'ay1',
          examTermId: 'et1',
        },
      },
      actor,
    );

    expect(result.format).toBe('csv');
    const csvString = expectBufferText(result.content);
    expect(csvString).toContain(
      'Student ID,Student,Class,Section,Roll Number,Percentage,Grade,GPA,Promotion Eligible,Status,Version',
    );
    expect(csvString).toContain(
      '"SCH-001","Erwin Shrestha","Grade 1","A","1","85.50","A","3.60","YES","LOCKED","1"',
    );
  });

  it('completes queued exports with a protected File Registry snapshot', async () => {
    await service.completeQueuedExport({
      exportId: 'export-1',
      reportKey: 'student-roster',
      filters: { status: 'ACTIVE' },
      format: 'csv',
      actor,
    });

    expect(fileRegistry.registerGeneratedFile).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: actor.tenantId,
        generatedByUserId: actor.userId,
        originalFilename: 'student-roster.csv',
        mimeType: 'text/csv',
        module: 'reports',
        metadata: expect.objectContaining({
          module: 'students',
          reportKey: 'student-roster',
          format: 'csv',
          filters: { status: 'ACTIVE' },
        }),
      }),
    );
    expect(prisma.reportExport.update).toHaveBeenCalledWith({
      where: { id: 'export-1' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        completedAt: expect.any(Date),
        errorSummary: null,
        fileAssetId: 'file-1',
      }),
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'export_report',
        resource: 'report',
        resourceId: 'student-roster',
        tenantId: actor.tenantId,
        userId: actor.userId,
        after: expect.objectContaining({
          async: true,
          fileAssetId: 'file-1',
        }),
      }),
    );
  });

  it('embeds the configured school logo in table report PDFs', async () => {
    const logoBytes = await createTestLogoJpeg();
    (prisma.tenantSetting.findUnique as jest.Mock).mockResolvedValueOnce({
      value: SCHOOL_LOGO_FILE_ASSET_ID,
    });
    (fileRegistry.getFileMetadata as jest.Mock).mockResolvedValueOnce({
      id: SCHOOL_LOGO_FILE_ASSET_ID,
      tenantId: actor.tenantId,
      module: 'settings',
      entityId: actor.tenantId,
      status: FileStatus.UPLOADED,
      originalFilename: 'school-logo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: BigInt(logoBytes.length),
      metadata: { kind: 'SCHOOL_LOGO' },
    });
    (fileRegistry.getProtectedDownload as jest.Mock).mockResolvedValueOnce({
      content: logoBytes,
    });

    const result = await service.exportReport(
      'academic-class-result-summary',
      {
        format: 'pdf',
        filters: { academicYearId: 'ay1', examTermId: 'et1' },
      },
      actor,
    );

    const pdf = result.content as Buffer;
    expect(pdf.toString('latin1')).toContain('/Filter /DCTDecode');
  });

  it('still generates table report PDFs when no school logo is configured', async () => {
    const result = await service.exportReport(
      'academic-class-result-summary',
      {
        format: 'pdf',
        filters: { academicYearId: 'ay1', examTermId: 'et1' },
      },
      actor,
    );

    const pdf = result.content as Buffer;
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.toString('latin1')).not.toContain('/Filter /DCTDecode');
  });

  it('lists export history with tenant scope and safe pagination bounds', async () => {
    (prisma.reportExport.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'export-1', tenantId: actor.tenantId },
    ]);
    (prisma.reportExport.count as jest.Mock).mockResolvedValueOnce(250);

    const result = await service.getExportHistory(actor.tenantId, {
      page: '-5',
      limit: '500',
    });

    expect(prisma.reportExport.findMany).toHaveBeenCalledWith({
      where: { tenantId: actor.tenantId },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 100,
    });
    expect(prisma.reportExport.count).toHaveBeenCalledWith({
      where: { tenantId: actor.tenantId },
    });
    expect(result).toEqual({
      items: [{ id: 'export-1', tenantId: actor.tenantId }],
      total: 250,
      page: 1,
      limit: 100,
      hasNextPage: true,
    });
  });

  it('retries failed exports with original filters and tenant scope', async () => {
    (prisma.reportExport.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'export-1',
      tenantId: actor.tenantId,
      reportKey: 'student-roster',
      format: 'csv',
      filters: { status: 'ACTIVE' },
      status: 'FAILED',
    });

    const result = await service.retryExport('export-1', actor);

    expect(prisma.reportExport.findFirst).toHaveBeenCalledWith({
      where: { id: 'export-1', tenantId: actor.tenantId },
    });
    expect(prisma.reportExport.update).toHaveBeenCalledWith({
      where: { id: 'export-1' },
      data: {
        status: 'QUEUED',
        errorSummary: null,
        completedAt: null,
        requestedBy: actor.userId,
      },
    });
    expect(reportsQueue.add).toHaveBeenCalledWith('generateReport', {
      exportId: 'export-1',
      reportKey: 'student-roster',
      filters: { status: 'ACTIVE' },
      format: 'csv',
      actor,
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'retry_report_export',
        resource: 'report_export',
        resourceId: 'export-1',
        tenantId: actor.tenantId,
        userId: actor.userId,
      }),
    );
    expect(result).toEqual({
      id: 'export-1',
      status: 'QUEUED',
      jobId: 'job-1',
    });
  });

  it('does not retry completed exports', async () => {
    (prisma.reportExport.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'export-1',
      tenantId: actor.tenantId,
      reportKey: 'student-roster',
      format: 'csv',
      filters: {},
      status: 'COMPLETED',
    });

    await expect(service.retryExport('export-1', actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(prisma.reportExport.update).not.toHaveBeenCalled();
    expect(reportsQueue.add).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'retry_report_export' }),
    );
  });
});

function expectBufferText(content: unknown) {
  expect(Buffer.isBuffer(content)).toBe(true);
  return (content as Buffer).toString();
}

const SCHOOL_LOGO_FILE_ASSET_ID = '11111111-1111-1111-1111-111111111111';

function createTestLogoJpeg() {
  return sharp({
    create: {
      width: 96,
      height: 48,
      channels: 3,
      background: { r: 24, g: 84, b: 140 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
}
