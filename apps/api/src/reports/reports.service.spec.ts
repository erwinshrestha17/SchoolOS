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
    permissions: ['reports:read', 'reports:export', 'students:read'],
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
    expect(reports[0].key).toBe('student-roster');
  });

  it('filters out reports user cannot access', () => {
    const restrictedActor = { ...actor, permissions: ['reports:read'] };
    const reports = service.listReports(restrictedActor);
    // student-roster requires students:read
    expect(reports.find((r) => r.key === 'student-roster')).toBeUndefined();
  });

  it('exports report data in JSON format', async () => {
    const result = await service.exportReport(
      'student-roster',
      {
        format: 'json',
        filters: {},
      },
      actor,
    );

    expect(result.format).toBe('json');
    expect(result.content).toHaveLength(1);
    expect(result.content[0]['First Name']).toBe('Erwin');
    expect(audit.record).toHaveBeenCalled();
  });

  it('exports report data in CSV format', async () => {
    const result = await service.exportReport(
      'student-roster',
      {
        format: 'csv',
        filters: {},
      },
      actor,
    );

    expect(result.format).toBe('csv');
    expect(Buffer.isBuffer(result.content)).toBe(true);
    const csvString = result.content.toString();
    expect(csvString).toContain('System ID,First Name,Last Name');
    expect(csvString).toContain('SCH-001,Erwin,Shrestha');
  });

  it('enforces tenant scoping during execution', async () => {
    await service.exportReport(
      'student-roster',
      {
        format: 'json',
        filters: { classId: 'c1' },
      },
      actor,
    );

    expect(prisma.student.findMany).toHaveBeenCalledWith(
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
    // Currently student-roster supports json, csv. Let's try pdf (which has a placeholder but we check executor.definition.formats)
    // Wait, the executor definition I wrote has formats: ['json', 'csv']
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
