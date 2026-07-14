import { Test, TestingModule } from '@nestjs/testing';
import { StudentsService } from './students.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { FileRegistryService } from '../file-registry/file-registry.service';
import { CommunicationsService } from '../communications/communications.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsageService } from '../usage/usage.service';
import { UsersService } from '../users/users.service';
import { StudentPhotoService } from './student-photo.service';
import { StudentLifecycleStatus, EnrollmentStatus } from '@prisma/client';
import { AuthContext } from '../auth/auth.types';

describe('StudentsService (iEMIS Export)', () => {
  let service: StudentsService;
  let prisma: PrismaService;
  let storageService: { saveBufferObject: jest.Mock };
  let fileRegistryService: {
    registerFile: jest.Mock;
    markUploaded: jest.Mock;
  };

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
            tenantSetting: {
              findUnique: jest.fn(),
            },
          },
        },
        { provide: AuditService, useValue: { record: jest.fn() } },
        { provide: UsersService, useValue: {} },
        { provide: CommunicationsService, useValue: {} },
        {
          provide: NotificationsService,
          useValue: { sendEmail: jest.fn(), sendSms: jest.fn() },
        },
        {
          provide: UsageService,
          useValue: { verifyLimit: jest.fn(), checkLimit: jest.fn() },
        },
        {
          provide: StorageService,
          useValue: {
            saveBufferObject: jest.fn(),
          },
        },
        {
          provide: FileRegistryService,
          useValue: {
            registerFile: jest.fn(),
            markUploaded: jest.fn(),
          },
        },
        {
          provide: StudentPhotoService,
          useValue: { getPhotoContent: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<StudentsService>(StudentsService);
    prisma = module.get<PrismaService>(PrismaService);
    storageService = module.get(StorageService) as never;
    fileRegistryService = module.get(FileRegistryService) as never;
    storageService.saveBufferObject.mockResolvedValue({
      objectKey: 'tenant-1/exports/iemis/iemis-students-school-1.csv',
      sizeBytes: 256,
    });
    fileRegistryService.registerFile.mockResolvedValue({
      id: 'file-asset-1',
    });
    fileRegistryService.markUploaded.mockResolvedValue({
      id: 'file-asset-1',
    });
    (prisma.tenantSetting.findUnique as jest.Mock).mockResolvedValue(null);
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
    (prisma.tenantSetting.findUnique as jest.Mock).mockResolvedValue({
      key: 'iemis_school_code',
      value: 'school-code-123',
    });
    (prisma.reportExport.create as jest.Mock).mockResolvedValue({
      id: 'export-1',
    });

    const result = await service.exportIemis(mockAuth);

    expect(result.totalRecords).toBe(1);
    expect(result.validRecords).toBe(1);
    expect(result.exportId).toBe('export-1');
    expect(result.fileAssetId).toBe('file-asset-1');
    expect(result.fileName).toMatch(
      /^iemis-students-school-1-\d{4}-\d{2}-\d{2}\.csv$/,
    );
    expect(result.headers).toContain('iemisSchoolCode');
    expect(result.headers).toContain('fatherName');
    expect(result.headers).toContain('motherName');
    expect(result.headers).toContain('stream');
    expect(result.headers).toContain('dobBs');

    const firstRow = result.rows[0];
    expect(firstRow.iemisSchoolCode).toBe('school-code-123');
    expect(firstRow.fatherName).toBe('James Doe');
    expect(firstRow.motherName).toBe('');
    expect(firstRow.stream).toBe('');
    expect(firstRow.dobBs).toBe('');

    expect(storageService.saveBufferObject).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: mockAuth.tenantId,
        prefix: 'exports/iemis',
        contentType: 'text/csv',
      }),
    );
    expect(fileRegistryService.registerFile).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: mockAuth.tenantId,
        module: 'students',
        entityId: mockAuth.tenantId,
        mimeType: 'text/csv',
      }),
    );
    expect(prisma.reportExport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reportKey: 'iemis_student_export',
          status: 'COMPLETED',
          fileAssetId: 'file-asset-1',
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

  describe('getIemisValidationList', () => {
    const mockStudents = [
      {
        id: 'student-valid',
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
      {
        id: 'student-invalid',
        studentSystemId: 'SCH-2026-0002',
        firstNameEn: 'Jane',
        lastNameEn: 'Doe',
        firstNameNp: null,
        lastNameNp: null,
        dateOfBirth: new Date('2015-01-01'),
        gender: 'FEMALE',
        nationality: 'Nepali',
        admissionDate: new Date('2026-01-01'),
        admissionNumber: 'ADM-002',
        lifecycleStatus: StudentLifecycleStatus.ACTIVE,
        classId: 'class-1',
        class: { name: 'Class 1' },
        guardianLinks: [],
        enrollments: [],
        tenant: { name: 'Test School' },
      },
    ];

    it('returns all students with correct eligibility and score calculations', async () => {
      (prisma.student.findMany as jest.Mock).mockResolvedValue(mockStudents);

      const result = await service.getIemisValidationList({}, mockAuth);

      expect(result).toHaveLength(2);
      expect(result[0].studentId).toBe('student-valid');
      expect(result[0].eligible).toBe(true);
      expect(result[0].score).toBe(100);

      expect(result[1].studentId).toBe('student-invalid');
      expect(result[1].eligible).toBe(false);
      expect(result[1].score).toBeLessThan(100);
      expect(result[1].issuesCount).toBeGreaterThan(0);
    });

    it('filters by status ready or has_issues', async () => {
      (prisma.student.findMany as jest.Mock).mockResolvedValue(mockStudents);

      const readyOnly = await service.getIemisValidationList(
        { status: 'ready' },
        mockAuth,
      );
      expect(readyOnly).toHaveLength(1);
      expect(readyOnly[0].studentId).toBe('student-valid');

      const issuesOnly = await service.getIemisValidationList(
        { status: 'has_issues' },
        mockAuth,
      );
      expect(issuesOnly).toHaveLength(1);
      expect(issuesOnly[0].studentId).toBe('student-invalid');
    });
  });
});
