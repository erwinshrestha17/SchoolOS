import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { AuthContext } from '../src/auth/auth.types';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { AttendanceController } from '../src/attendance/attendance.controller';
import { MobileController } from '../src/mobile/mobile.controller';
import { ReportsService } from '../src/reports/reports.service';
import { getQueueToken } from '@nestjs/bullmq';
import { PrismaMock, createPrismaMock, createQueueMock } from './test-helpers';
import { AttendanceStatus, EnrollmentStatus } from '@prisma/client';

describe('Attendance Hardening (E2E)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaMock;
  let attendanceController: AttendanceController;
  let mobileController: MobileController;
  let reportsService: ReportsService;

  const tenantId = 'tenant-1';
  const otherTenantId = 'tenant-2';

  const adminActor: AuthContext = {
    tenantId,
    tenantSlug: 'tenant-one',
    userId: 'admin-1',
    email: 'admin@school.test',
    authMethod: 'PASSWORD',
    roles: ['admin'],
    permissions: [
      'attendance:read',
      'attendance:mark',
      'attendance:read_all',
      'attendance:mark_all',
      'attendance:override_lock',
      'attendance:review_conflicts',
      'reports:read',
      'reports:export',
    ],
  };

  const teacherActor: AuthContext = {
    tenantId,
    tenantSlug: 'tenant-one',
    userId: 'teacher-1',
    email: 'teacher@school.test',
    authMethod: 'PASSWORD',
    roles: ['teacher'],
    permissions: ['attendance:read', 'attendance:mark', 'reports:read'],
  };

  const parentActor: AuthContext = {
    tenantId,
    tenantSlug: 'tenant-one',
    userId: 'parent-1',
    email: 'parent@school.test',
    authMethod: 'PASSWORD',
    roles: ['parent'],
    permissions: ['attendance:read'],
  };

  const otherParentActor: AuthContext = {
    tenantId,
    tenantSlug: 'tenant-one',
    userId: 'parent-2',
    email: 'other-parent@school.test',
    authMethod: 'PASSWORD',
    roles: ['parent'],
    permissions: ['attendance:read'],
  };

  const otherTenantAdmin: AuthContext = {
    tenantId: otherTenantId,
    tenantSlug: 'tenant-two',
    userId: 'admin-2',
    email: 'admin-two@school.test',
    authMethod: 'PASSWORD',
    roles: ['admin'],
    permissions: [
      'attendance:read',
      'attendance:mark',
      'attendance:read_all',
      'attendance:review_conflicts',
      'reports:read',
      'reports:export',
    ],
  };

  beforeEach(async () => {
    prisma = createPrismaMock();

    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(RedisService)
      .useValue({
        ping: jest.fn(() => Promise.resolve('PONG')),
        onModuleDestroy: jest.fn(() => Promise.resolve(undefined)),
      })
      .overrideProvider(getQueueToken('finance'))
      .useValue(createQueueMock())
      .overrideProvider(getQueueToken('notifications'))
      .useValue(createQueueMock())
      .overrideProvider(getQueueToken('payroll'))
      .useValue(createQueueMock())
      .compile();

    attendanceController = moduleRef.get(AttendanceController);
    mobileController = moduleRef.get(MobileController);
    reportsService = moduleRef.get(ReportsService);

    // Setup basic records in mocked Prisma
    prisma.__state.tenants = [
      {
        id: tenantId,
        slug: 'tenant-one',
        name: 'Tenant One',
        mode: 'MULTI',
        isActive: true,
      },
      {
        id: otherTenantId,
        slug: 'tenant-two',
        name: 'Tenant Two',
        mode: 'MULTI',
        isActive: true,
      },
    ];

    prisma.__state.academicYears = [
      { id: 'year-2081', tenantId, name: '2081', isCurrent: true },
    ];

    prisma.__state.classes = [
      { id: 'class-1', tenantId, name: 'Class 1' },
      { id: 'class-2', tenantId, name: 'Class 2' },
      {
        id: 'class-other-tenant',
        tenantId: otherTenantId,
        name: 'Class Other Tenant',
      },
    ];

    prisma.__state.sections = [
      { id: 'section-1', tenantId, classId: 'class-1', name: 'A' },
    ];

    prisma.__state.students = [
      {
        id: 'student-1',
        tenantId,
        classId: 'class-1',
        sectionId: 'section-1',
        firstNameEn: 'Student',
        lastNameEn: 'One',
        studentSystemId: 'ST-1',
      },
      {
        id: 'student-2',
        tenantId,
        classId: 'class-2',
        sectionId: null,
        firstNameEn: 'Student',
        lastNameEn: 'Two',
        studentSystemId: 'ST-2',
      },
      {
        id: 'student-other-tenant',
        tenantId: otherTenantId,
        classId: 'class-other-tenant',
        sectionId: null,
        firstNameEn: 'Student',
        lastNameEn: 'Other',
        studentSystemId: 'ST-OTHER',
      },
    ];

    prisma.__state.enrollments = [
      {
        id: 'enrollment-1',
        tenantId,
        academicYearId: 'year-2081',
        studentId: 'student-1',
        classId: 'class-1',
        sectionId: 'section-1',
        status: EnrollmentStatus.ACTIVE,
      },
      {
        id: 'enrollment-2',
        tenantId,
        academicYearId: 'year-2081',
        studentId: 'student-2',
        classId: 'class-2',
        sectionId: null,
        status: EnrollmentStatus.ACTIVE,
      },
    ];

    prisma.__state.staff = [
      {
        id: 'staff-1',
        tenantId,
        userId: 'teacher-1',
        employeeId: 'EMP-1',
        firstName: 'Tara',
        lastName: 'Teacher',
      },
    ];

    // Parent setup
    prisma.__state.guardians = [
      {
        id: 'guardian-1',
        tenantId,
        userId: 'parent-1',
        fullName: 'Guardian One',
        primaryPhone: '9800000000',
        studentLinks: [{ studentId: 'student-1' }],
      },
      {
        id: 'guardian-2',
        tenantId,
        userId: 'parent-2',
        fullName: 'Guardian Two',
        primaryPhone: '9811111111',
        studentLinks: [{ studentId: 'student-2' }],
      },
    ];

    prisma.__state.studentGuardians = [
      {
        id: 'sg-1',
        tenantId,
        studentId: 'student-1',
        guardianId: 'guardian-1',
        relation: 'Father',
        isPrimary: true,
      },
      {
        id: 'sg-2',
        tenantId,
        studentId: 'student-2',
        guardianId: 'guardian-2',
        relation: 'Mother',
        isPrimary: true,
      },
    ];
  });

  afterEach(async () => {
    await moduleRef?.close();
  });

  describe('Attendance Monthly Register Export Scoping & Metadata', () => {
    it('allows admin to export attendance register and verifies retained file registry metadata', async () => {
      const result = await attendanceController.exportMonthlyRegister(
        {
          academicYearId: 'year-2081',
          classId: 'class-1',
          sectionId: 'section-1',
          month: 5,
          year: 2026,
        },
        'csv',
        adminActor,
      );

      expect(result).toContain('"Student Name"');

      // Verify a report export record was created in the DB
      const exports = prisma.__state.reportExports;
      expect(exports.length).toBeGreaterThan(0);
      const latestExport = exports[exports.length - 1];
      expect(latestExport.reportKey).toBe('attendance_monthly_register');
      expect(latestExport.tenantId).toBe(tenantId);
      expect(latestExport.requestedBy).toBe('admin-1');
      expect(latestExport.fileAssetId).toBeDefined();

      // Verify the generated file registry asset
      const assets = prisma.__state.fileAssets;
      expect(assets.length).toBeGreaterThan(0);
      const latestAsset = assets[assets.length - 1];
      expect(latestAsset.tenantId).toBe(tenantId);
      expect(latestAsset.module).toBe('attendance');
      expect(latestAsset.uploadedByUserId).toBe('admin-1');
      expect(latestAsset.metadata).toEqual(
        expect.objectContaining({
          reportKey: 'attendance_monthly_register',
          format: 'csv',
        }),
      );
    });

    it('denies teacher from exporting a register for an unauthorized class/section', async () => {
      // Teacher is not assigned to class-1/section-1
      prisma.__state.subjectTeacherAssignments = [];

      await expect(
        attendanceController.exportMonthlyRegister(
          {
            academicYearId: 'year-2081',
            classId: 'class-1',
            sectionId: 'section-1',
            month: 5,
            year: 2026,
          },
          'csv',
          teacherActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows teacher to export a register for their assigned class/section', async () => {
      // Setup teacher assignment
      prisma.__state.subjectTeacherAssignments = [
        {
          id: 'assign-1',
          tenantId,
          staffId: 'staff-1',
          classId: 'class-1',
          sectionId: 'section-1',
          subjectId: 'sub-1',
        },
      ];

      const result = await attendanceController.exportMonthlyRegister(
        {
          academicYearId: 'year-2081',
          classId: 'class-1',
          sectionId: 'section-1',
          month: 5,
          year: 2026,
        },
        'csv',
        teacherActor,
      );

      expect(result).toBeDefined();
    });

    it('denies cross-tenant attendance export and throws NotFoundException', async () => {
      // tenant-1 admin trying to export class-other-tenant which belongs to tenant-2
      await expect(
        attendanceController.exportMonthlyRegister(
          {
            academicYearId: 'year-2081',
            classId: 'class-other-tenant',
            sectionId: undefined,
            month: 5,
            year: 2026,
          },
          'csv',
          adminActor,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Parent/Mobile Attendance Summary Scope', () => {
    it('allows parent to view summary of their own child only', async () => {
      const summary = await mobileController.getStudentAttendanceSummary(
        'student-1',
        parentActor,
        5,
        2026,
      );

      expect(summary.studentId).toBe('student-1');
    });

    it('denies parent from viewing summary of an unrelated student', async () => {
      await expect(
        mobileController.getStudentAttendanceSummary(
          'student-2', // student-2 is child of guardian-2 / parent-2
          parentActor,
          5,
          2026,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('denies cross-tenant student summary request and throws NotFoundException', async () => {
      await expect(
        mobileController.getStudentAttendanceSummary(
          'student-other-tenant',
          parentActor,
          5,
          2026,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Correction Request Approval/Rejection Permissions & Reasons', () => {
    beforeEach(() => {
      prisma.__state.attendanceCorrectionRequests = [
        {
          id: 'correction-1',
          tenantId,
          studentId: 'student-1',
          attendanceDate: new Date('2026-05-10T00:00:00.000Z'),
          requestedStatus: AttendanceStatus.PRESENT,
          previousStatus: AttendanceStatus.ABSENT,
          reason: 'Correction reason',
          status: 'PENDING',
          requestedById: 'teacher-1',
        },
      ];
    });

    it('allows admin with review_conflicts permission to approve correction with a reason', async () => {
      const approved = await attendanceController.approveCorrectionRequest(
        'correction-1',
        {
          status: 'APPROVED',
          reviewReason: 'Validated note from parent',
        },
        adminActor,
      );

      expect(approved.status).toBe('APPROVED');
      expect(approved.reviewReason).toBe('Validated note from parent');
    });

    it('denies correction review to actor without appropriate permissions', async () => {
      // teacher has only attendance:mark / attendance:read
      await expect(
        attendanceController.approveCorrectionRequest(
          'correction-1',
          {
            status: 'APPROVED',
            reviewReason: 'Valid reason',
          },
          teacherActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('denies correction review to parent/guardian actor', async () => {
      await expect(
        attendanceController.approveCorrectionRequest(
          'correction-1',
          {
            status: 'APPROVED',
            reviewReason: 'Valid reason',
          },
          parentActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException if reason/note is omitted during review', async () => {
      await expect(
        attendanceController.approveCorrectionRequest(
          'correction-1',
          {
            status: 'APPROVED',
            reviewReason: '', // Empty reason
          },
          adminActor,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('denies cross-tenant correction approval request and throws NotFoundException', async () => {
      await expect(
        attendanceController.approveCorrectionRequest(
          'correction-1',
          {
            status: 'APPROVED',
            reviewReason: 'Valid reason',
          },
          otherTenantAdmin,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
