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
            subjectTeacherAssignment: {
              findFirst: jest.fn(),
            },
            staff: {
              findFirst: jest.fn(),
            },
            section: {
              findFirst: jest.fn(),
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
            class: { name: 'Class 1' },
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

  describe('getIemisReadiness', () => {
    it('returns backend-owned required-check counts for a ready student', async () => {
      (prisma.student.findFirst as jest.Mock).mockResolvedValue(
        buildReadinessStudent(),
      );

      const result = await service.getIemisReadiness('student-ready', mockAuth);

      expect(prisma.student.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'student-ready', tenantId: mockAuth.tenantId },
        }),
      );
      expect(result.status).toBe('READY');
      expect(result.passedRequiredChecks).toBe(result.totalRequiredChecks);
      expect(result.blockingIssueCount).toBe(0);
      expect(result.warningCount).toBe(0);
      expect(result.exportEligible).toBe(true);
      expect(result.eligible).toBe(true);
      expect(result.academicYear).toBe('2082/83');
      expect(result.className).toBe('Class 12');
      expect(result.sectionName).toBe('A');
      expect(result.requirementVersion).toBe('SCHOLOS-IEMIS-1.0');
    });

    it('returns exact blocking issues and safe fix metadata', async () => {
      (prisma.student.findFirst as jest.Mock).mockResolvedValue(
        buildReadinessStudent({
          firstNameNp: null,
          lastNameNp: null,
          enrollments: [
            {
              id: 'enrollment-1',
              status: EnrollmentStatus.ACTIVE,
              academicYear: { name: '2082/83', startsOn: null },
              class: { name: 'Class 12' },
              section: null,
              rollNumber: 20,
              admissionDate: new Date('2025-04-14'),
            },
          ],
        }),
      );

      const result = await service.getIemisReadiness(
        'student-blocked',
        mockAuth,
      );

      expect(result.status).toBe('BLOCKED');
      expect(result.exportEligible).toBe(false);
      expect(result.blockingIssueCount).toBe(2);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'NEPALI_NAME_REQUIRED',
            severity: 'BLOCKING',
            field: 'fullNameNp',
            fixTarget: 'STUDENT_PROFILE',
            requiredPermission: 'students:update',
          }),
          expect.objectContaining({
            code: 'SECTION_PLACEMENT_REQUIRED',
            severity: 'BLOCKING',
            field: 'sectionId',
            fixTarget: 'ENROLLMENT',
            requiredPermission: 'students:update',
          }),
        ]),
      );
    });

    it('keeps a warning-only student export-eligible', async () => {
      (prisma.student.findFirst as jest.Mock).mockResolvedValue(
        buildReadinessStudent({ nationalStudentId: null }),
      );

      const result = await service.getIemisReadiness(
        'student-warning',
        mockAuth,
      );

      expect(result.status).toBe('READY_WITH_WARNINGS');
      expect(result.exportEligible).toBe(true);
      expect(result.blockingIssueCount).toBe(0);
      expect(result.warningCount).toBe(1);
      expect(result.issues).toEqual([
        expect.objectContaining({
          code: 'NATIONAL_STUDENT_ID_MISSING',
          severity: 'WARNING',
          blocking: false,
        }),
      ]);
    });

    it('allows an assigned teacher to read readiness for an active-placement student', async () => {
      const teacherAuth: AuthContext = {
        ...mockAuth,
        userId: 'teacher-user-1',
        roles: ['teacher'],
      };
      (prisma.student.findFirst as jest.Mock).mockResolvedValue(
        buildReadinessStudent(),
      );
      (prisma.staff.findFirst as jest.Mock).mockResolvedValue({
        id: 'staff-1',
      });
      (
        prisma.subjectTeacherAssignment.findFirst as jest.Mock
      ).mockResolvedValue({ id: 'assignment-1' });

      const result = await service.getIemisReadiness(
        'student-assigned',
        teacherAuth,
      );

      expect(prisma.subjectTeacherAssignment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: teacherAuth.tenantId,
            staffId: 'staff-1',
            classId: 'class-12',
          }),
        }),
      );
      expect(result.status).toBe('READY');
    });

    it('fails closed when a teacher is not assigned to the active placement', async () => {
      const teacherAuth: AuthContext = {
        ...mockAuth,
        userId: 'teacher-user-2',
        roles: ['subject_teacher'],
      };
      (prisma.student.findFirst as jest.Mock).mockResolvedValue(
        buildReadinessStudent(),
      );
      (prisma.staff.findFirst as jest.Mock).mockResolvedValue({
        id: 'staff-2',
      });
      (
        prisma.subjectTeacherAssignment.findFirst as jest.Mock
      ).mockResolvedValue(null);
      (prisma.section.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getIemisReadiness('student-unassigned', teacherAuth),
      ).rejects.toThrow(
        'Student reporting readiness is outside your teaching scope',
      );
    });
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
            class: { name: 'Class 1' },
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

function buildReadinessStudent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'student-ready',
    studentSystemId: 'EA-2083-12-B-020',
    firstNameEn: 'Bikash',
    lastNameEn: 'Adhikari',
    firstNameNp: 'विकास',
    lastNameNp: 'अधिकारी',
    dateOfBirth: new Date('2008-01-01'),
    gender: 'MALE',
    nationality: 'Nepali',
    nationalStudentId: 'IEMIS-001',
    admissionDate: new Date('2025-04-14'),
    admissionNumber: 'ADM-001',
    lifecycleStatus: StudentLifecycleStatus.ACTIVE,
    classId: 'class-12',
    class: { name: 'Class 12' },
    sectionRef: { name: 'A' },
    guardianLinks: [
      {
        isPrimary: true,
        relation: 'Father',
        guardian: {
          fullName: 'Guardian Adhikari',
          primaryPhone: '9800000000',
          email: null,
          wardNumber: '5',
        },
      },
    ],
    enrollments: [
      {
        id: 'enrollment-1',
        status: EnrollmentStatus.ACTIVE,
        classId: 'class-12',
        sectionId: 'section-a',
        academicYear: { name: '2082/83', startsOn: null },
        class: { name: 'Class 12' },
        section: { name: 'A' },
        rollNumber: 20,
        admissionDate: new Date('2025-04-14'),
      },
    ],
    tenant: { name: 'Test School' },
    ...overrides,
  };
}
