import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthContext } from '../auth/auth.types';
import { FinanceService } from '../finance/finance.service';
import { AuthMethod } from '@prisma/client';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { FileRegistryService } from '../file-registry/file-registry.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: PrismaService;
  let audit: AuditService;

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
            getProtectedDownload: jest.fn(),
          },
        },
        {
          provide: getQueueToken('reports'),
          useValue: { add: jest.fn().mockResolvedValue({ id: 'job-1' }) },
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
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
    const csvString = result.content.toString();
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
    const csvString = result.content.toString();
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
    const csvString = result.content.toString();
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
    const csvString = result.content.toString();
    expect(csvString).toContain(
      'Student ID,Student,Class,Section,Roll Number,Percentage,Grade,GPA,Promotion Eligible,Status,Version',
    );
    expect(csvString).toContain(
      '"SCH-001","Erwin Shrestha","Grade 1","A","1","85.50","A","3.60","YES","LOCKED","1"',
    );
  });
});
