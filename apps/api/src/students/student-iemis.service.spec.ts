import { Test, TestingModule } from '@nestjs/testing';
import { StudentsService } from './students.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { CommunicationsService } from '../communications/communications.service';
import { UsageService } from '../usage/usage.service';
import { UsersService } from '../users/users.service';
import { StudentLifecycleStatus, EnrollmentStatus } from '@prisma/client';
import { AuthContext } from '../auth/auth.types';

describe('StudentsService (iEMIS Export)', () => {
  let service: StudentsService;
  let prisma: PrismaService;

  const mockAuth: AuthContext = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    tenantSlug: 'school-1',
    email: 'admin@school.test',
    authMethod: 'PASSWORD',
    roles: ['admin'],
    permissions: ['students:read'],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentsService,
        {
          provide: PrismaService,
          useValue: {
            student: {
              findMany: jest.fn(),
              count: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
            },
            reportExport: {
              create: jest.fn(),
            },
          },
        },
        { provide: AuditService, useValue: { record: jest.fn() } },
        { provide: UsersService, useValue: {} },
        { provide: CommunicationsService, useValue: {} },
        { provide: UsageService, useValue: { verifyLimit: jest.fn() } },
        { provide: StorageService, useValue: {} },
        { provide: FileRegistryService, useValue: {} },
      ],
    }).compile();

    service = module.get<StudentsService>(StudentsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should export valid students to iEMIS CSV format', async () => {
    const mockStudents = [
      {
        id: 'student-1',
        studentSystemId: 'SCH-2026-0001',
        firstNameEn: 'John',
        lastNameEn: 'Doe',
        firstNameNp: 'जोन',
        lastNameNp: 'डो',
        dateOfBirth: new Date('2015-01-01'),
        gender: 'MALE',
        nationality: 'Nepali',
        admissionDate: new Date('2026-01-01'),
        admissionNumber: 'ADM-001',
        lifecycleStatus: StudentLifecycleStatus.ACTIVE,
        classId: 'class-1',
        class: { name: 'Class 1' },
        sectionRef: { name: 'A' },
        guardianLinks: [
          {
            isPrimary: true,
            relation: 'Father',
            guardian: {
              fullName: 'James Doe',
              primaryPhone: '9800000000',
              email: 'james@example.com',
              wardNumber: '5',
            },
          },
        ],
        enrollments: [
          {
            academicYear: { name: '2081' },
            section: { name: 'A' },
          },
        ],
        tenant: { name: 'Test School' },
      },
    ];

    (prisma.student.findMany as jest.Mock).mockResolvedValue(mockStudents);
    (prisma.reportExport.create as jest.Mock).mockResolvedValue({
      id: 'export-1',
    });

    const result = await service.exportIemis(mockAuth);

    expect(result.totalRecords).toBe(1);
    expect(result.validRecords).toBe(1);
    expect(result.exportId).toBe('export-1');
    expect(prisma.reportExport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reportKey: 'iemis_student_export',
          status: 'COMPLETED',
        }),
      }),
    );
  });

  it('should flag students with missing required iEMIS fields', async () => {
    const mockStudents = [
      {
        id: 'student-2',
        studentSystemId: 'SCH-2026-0002',
        firstNameEn: 'Jane',
        lastNameEn: 'Doe',
        firstNameNp: null, // Missing Nepali name
        lastNameNp: null,
        dateOfBirth: new Date('2015-01-01'),
        gender: 'FEMALE',
        nationality: 'Nepali',
        admissionDate: new Date('2026-01-01'),
        admissionNumber: 'ADM-002',
        lifecycleStatus: StudentLifecycleStatus.ACTIVE,
        classId: 'class-1',
        class: { name: 'Class 1' },
        guardianLinks: [], // Missing guardian contact
        enrollments: [], // Missing enrollment
        tenant: { name: 'Test School' },
      },
    ];

    (prisma.student.findMany as jest.Mock).mockResolvedValue(mockStudents);
    (prisma.reportExport.create as jest.Mock).mockResolvedValue({
      id: 'export-2',
    });

    const result = await service.exportIemis(mockAuth);

    expect(result.validRecords).toBe(0);
    expect(result.invalidRecords).toBe(1);
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
    expect(result.issues.some((i) => i.field === 'fullNameNp')).toBe(true);
    expect(result.issues.some((i) => i.field === 'guardianContact')).toBe(true);
  });
});
