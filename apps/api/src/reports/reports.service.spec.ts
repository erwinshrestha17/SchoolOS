import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthContext } from '../auth/auth.types';
import { AuthMethod } from '@prisma/client';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

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
          },
        },
        {
          provide: AuditService,
          useValue: {
            record: jest.fn(),
          },
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
  });

  it('filters out reports user cannot access', () => {
    const restrictedActor = { ...actor, permissions: ['reports:read'] };
    const reports = service.listReports(restrictedActor);
    // student-roster requires students:read
    expect(reports.find((r) => r.key === 'student-roster')).toBeUndefined();
    // class-roster requires classes:read and students:read
    expect(reports.find((r) => r.key === 'class-roster')).toBeUndefined();
  });

  it('exports student-roster in CSV format', async () => {
    const result = await service.exportReport(
      'student-roster',
      {
        format: 'csv',
        filters: {},
      },
      actor,
    );

    expect(result.format).toBe('csv');
    const csvString = result.content.toString();
    expect(csvString).toContain('System ID,First Name,Last Name');
    expect(csvString).toContain('"SCH-001","Erwin","Shrestha"');
  });

  it('exports class-roster in CSV format', async () => {
    const result = await service.exportReport(
      'class-roster',
      {
        format: 'csv',
        filters: { academicYearId: 'ay1' },
      },
      actor,
    );

    expect(result.format).toBe('csv');
    const csvString = result.content.toString();
    expect(csvString).toContain(
      'Student ID,Full Name,Gender,Date of Birth,Class,Section,Roll Number,Guardian Name,Guardian Phone,Admission Date,Status',
    );
    expect(csvString).toContain('"SCH-001","Erwin Shrestha","MALE"');
    expect(csvString).toContain('"Guardian Name","9800000000"');
    expect(audit.record).toHaveBeenCalled();
  });

  it('enforces tenant scoping during class-roster execution', async () => {
    await service.exportReport(
      'class-roster',
      {
        format: 'json',
        filters: { classId: 'c1' },
      },
      actor,
    );

    expect(prisma.enrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: actor.tenantId,
          classId: 'c1',
        }),
      }),
    );
  });

  it('throws NotFoundException for unknown reports', async () => {
    await expect(
      service.exportReport(
        'ghost-report',
        {
          format: 'json',
          filters: {},
        },
        actor,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException for unsupported formats', async () => {
    await expect(
      service.exportReport(
        'student-roster',
        {
          format: 'pdf',
          filters: {},
        },
        actor,
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
