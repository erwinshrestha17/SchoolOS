import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceStatus, AuthMethod, Prisma } from '@prisma/client';
import { AttendanceService } from './attendance.service';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CommunicationsService } from '../communications/communications.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SettingsService } from '../settings/settings.service';
import { AuthContext } from '../auth/auth.types';
import { permissionCatalog, systemRolePermissions } from '@schoolos/core';

function daysAgo(count: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - count);
  return date;
}

describe('Attendance Hardening', () => {
  let service: AttendanceService;
  let prisma: PrismaService;
  let settingsService: { getSetting: jest.Mock };

  const mockActor: AuthContext = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    tenantSlug: 'school-1',
    email: 'teacher@school.test',
    authMethod: AuthMethod.PASSWORD,
    roles: ['teacher'],
    permissions: ['attendance:mark', 'attendance:read'],
  };

  const mockAdminActor: AuthContext = {
    userId: 'admin-1',
    tenantId: 'tenant-1',
    tenantSlug: 'school-1',
    email: 'admin@school.test',
    authMethod: AuthMethod.PASSWORD,
    roles: ['admin'],
    permissions: [
      'attendance:mark',
      'attendance:read',
      'attendance:override_lock',
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        {
          provide: PrismaService,
          useValue: {
            academicYear: { findFirst: jest.fn() },
            class: { findFirst: jest.fn(), findMany: jest.fn() },
            section: { findFirst: jest.fn(), findMany: jest.fn() },
            enrollment: { findMany: jest.fn() },
            staff: { findUnique: jest.fn(), findFirst: jest.fn() },
            student: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
            },
            attendanceSession: {
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              findUniqueOrThrow: jest.fn(),
              findMany: jest.fn(),
            },
            attendanceRecord: {
              deleteMany: jest.fn(),
              createMany: jest.fn(),
              findMany: jest.fn(),
            },
            schoolCalendarDay: { findFirst: jest.fn(), findMany: jest.fn() },
            subjectTeacherAssignment: { findFirst: jest.fn() },
            attendanceCorrectionRequest: {
              findFirst: jest.fn(),
              create: jest.fn(),
            },
            attendanceConflict: { create: jest.fn() },
            $transaction: jest.fn((cb) => cb(prisma)),
          },
        },
        {
          provide: CommunicationsService,
          useValue: {},
        },
        {
          provide: AuditService,
          useValue: { record: jest.fn() },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
        {
          provide: SettingsService,
          useValue: { getSetting: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
    prisma = module.get<PrismaService>(PrismaService);
    settingsService = module.get(SettingsService) as unknown as {
      getSetting: jest.Mock;
    };
    settingsService.getSetting.mockResolvedValue(24);
  });

  describe('Future Date Prevention', () => {
    it('should throw ForbiddenException if attendance date is in the future', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const dto = {
        academicYearId: 'year-1',
        classId: 'class-1',
        sectionId: 'section-1',
        attendanceDate: futureDate.toISOString(),
      };

      (prisma.academicYear.findFirst as jest.Mock).mockResolvedValue({
        id: 'year-1',
      });
      (prisma.class.findFirst as jest.Mock).mockResolvedValue({
        id: 'class-1',
      });
      (prisma.staff.findFirst as jest.Mock).mockResolvedValue({
        id: 'staff-1',
      });
      (prisma.section.findFirst as jest.Mock).mockResolvedValue({
        id: 'section-1',
        classId: 'class-1',
        classTeacherId: 'staff-1',
      });

      await expect(service.submitAttendance(dto, mockActor)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('Lock Override Permission', () => {
    it('should throw ForbiddenException if session is locked and user has no override permission', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      (prisma.academicYear.findFirst as jest.Mock).mockResolvedValue({
        id: 'year-1',
      });
      (prisma.class.findFirst as jest.Mock).mockResolvedValue({
        id: 'class-1',
      });
      (prisma.staff.findFirst as jest.Mock).mockResolvedValue({
        id: 'staff-1',
      });
      (prisma.section.findFirst as jest.Mock).mockResolvedValue({
        id: 'section-1',
        classId: 'class-1',
        classTeacherId: 'staff-1',
      });
      (prisma.schoolCalendarDay.findFirst as jest.Mock).mockResolvedValue({
        calendarDate: yesterday,
        isWorkingDay: true,
      });

      (prisma.attendanceSession.findFirst as jest.Mock).mockResolvedValue({
        id: 'session-1',
        lockAt: yesterday, // Locked
        submittedAt: new Date(),
      });

      const dto = {
        academicYearId: 'year-1',
        classId: 'class-1',
        sectionId: 'section-1',
        attendanceDate: yesterday.toISOString(),
      };

      await expect(service.submitAttendance(dto, mockActor)).rejects.toThrow(
        'Attendance for this date is locked. Please request a correction.',
      );
    });

    it('should allow submission if session is locked but user has override permission', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      (prisma.academicYear.findFirst as jest.Mock).mockResolvedValue({
        id: 'year-1',
      });
      (prisma.class.findFirst as jest.Mock).mockResolvedValue({
        id: 'class-1',
      });
      (prisma.staff.findFirst as jest.Mock).mockResolvedValue({
        id: 'staff-1',
      });
      (prisma.section.findFirst as jest.Mock).mockResolvedValue({
        id: 'section-1',
        classId: 'class-1',
        classTeacherId: 'staff-1',
      });
      (prisma.schoolCalendarDay.findFirst as jest.Mock).mockResolvedValue({
        calendarDate: yesterday,
        isWorkingDay: true,
      });
      (prisma.student.findMany as jest.Mock).mockResolvedValue([
        { id: 'student-1' },
      ]);
      (prisma.attendanceSession.findFirst as jest.Mock).mockResolvedValue({
        id: 'session-1',
        lockAt: yesterday,
        submittedAt: new Date(),
        records: [],
      });
      (prisma.attendanceSession.update as jest.Mock).mockResolvedValue({
        id: 'session-1',
      });
      (
        prisma.attendanceSession.findUniqueOrThrow as jest.Mock
      ).mockResolvedValue({
        id: 'session-1',
        attendanceDate: yesterday,
        class: { name: 'Class 1' },
        records: [],
      });

      const dto = {
        academicYearId: 'year-1',
        classId: 'class-1',
        sectionId: 'section-1',
        attendanceDate: yesterday.toISOString(),
      };

      const result = await service.submitAttendance(dto, mockAdminActor);
      expect(result).toBeDefined();
    });

    it('should be a real, catalog-registered permission that admin/principal can actually be granted', () => {
      // Regression guard: the checks above only exercise a hand-crafted
      // AuthContext.permissions array, which would pass even if
      // 'attendance:override_lock' were never assignable through the real
      // permission system. Confirm it is registered in the catalog and
      // actually flows to the roles meant to use this escape hatch.
      const isRegistered = permissionCatalog.some(
        (permission) =>
          permission.resource === 'attendance' &&
          permission.action === 'override_lock',
      );
      expect(isRegistered).toBe(true);

      expect(systemRolePermissions.admin).toContain('attendance:override_lock');
      expect(systemRolePermissions.principal).toContain(
        'attendance:override_lock',
      );
    });
  });

  describe('Correction Request Scoping', () => {
    it('should throw ForbiddenException if teacher is not assigned to the student class', async () => {
      (prisma.staff.findUnique as jest.Mock).mockResolvedValue({
        id: 'staff-1',
      });
      settingsService.getSetting.mockImplementation(async (_tenantId, key) =>
        key === 'allow_teacher_correction_request' ? true : 24,
      );

      (prisma.student.findUnique as jest.Mock).mockResolvedValue({
        id: 'student-1',
        classId: 'class-1',
        sectionId: 'section-1',
      });

      // Teacher is NOT assigned
      (prisma.section.findFirst as jest.Mock).mockResolvedValue(null);
      (
        prisma.subjectTeacherAssignment.findFirst as jest.Mock
      ).mockResolvedValue(null);

      const dto = {
        studentId: 'student-1',
        attendanceDate: new Date().toISOString(),
        requestedStatus: AttendanceStatus.PRESENT,
        reason: 'Mistake',
      };

      await expect(
        service.createCorrectionRequest(dto, mockActor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('New Depth Enhancements', () => {
    describe('Weekend Policy Integration', () => {
      it('should respect weekend_policy = SATURDAY', async () => {
        settingsService.getSetting.mockImplementation(
          async (_tenantId, key) => {
            if (key === 'weekend_policy') return 'SATURDAY';
            return null;
          },
        );

        (prisma.schoolCalendarDay.findFirst as jest.Mock).mockResolvedValue(
          null,
        );

        // Saturday
        const satResult = await (service as any).resolveCalendarDay(
          'tenant-1',
          new Date('2026-06-06'),
        ); // Saturday
        expect(satResult.isWorkingDay).toBe(false);

        // Sunday
        const sunResult = await (service as any).resolveCalendarDay(
          'tenant-1',
          new Date('2026-06-07'),
        ); // Sunday
        expect(sunResult.isWorkingDay).toBe(true);
      });

      it('should respect weekend_policy = FRIDAY_SATURDAY', async () => {
        settingsService.getSetting.mockImplementation(
          async (_tenantId, key) => {
            if (key === 'weekend_policy') return 'FRIDAY_SATURDAY';
            return null;
          },
        );

        (prisma.schoolCalendarDay.findFirst as jest.Mock).mockResolvedValue(
          null,
        );

        // Friday
        const friResult = await (service as any).resolveCalendarDay(
          'tenant-1',
          new Date('2026-06-05'),
        ); // Friday
        expect(friResult.isWorkingDay).toBe(false);

        // Saturday
        const satResult = await (service as any).resolveCalendarDay(
          'tenant-1',
          new Date('2026-06-06'),
        ); // Saturday
        expect(satResult.isWorkingDay).toBe(false);

        // Sunday
        const sunResult = await (service as any).resolveCalendarDay(
          'tenant-1',
          new Date('2026-06-07'),
        ); // Sunday
        expect(sunResult.isWorkingDay).toBe(true);
      });
    });

    describe('Deterministic Sync Conflict & Owner Check', () => {
      it('should prevent overwrite if deviceTimestamp is older than server submittedAt', async () => {
        const yesterday = new Date('2026-06-05T10:00:00.000Z');
        const deviceTime = '2026-06-05T09:00:00.000Z'; // older

        (prisma.academicYear.findFirst as jest.Mock).mockResolvedValue({
          id: 'year-1',
        });
        (prisma.class.findFirst as jest.Mock).mockResolvedValue({
          id: 'class-1',
        });
        (prisma.section.findFirst as jest.Mock).mockResolvedValue({
          id: 'section-1',
          classId: 'class-1',
          classTeacherId: 'staff-1',
        });
        (prisma.staff.findFirst as jest.Mock).mockResolvedValue({
          id: 'staff-1',
        });
        (prisma.schoolCalendarDay.findFirst as jest.Mock).mockResolvedValue({
          calendarDate: yesterday,
          isWorkingDay: true,
        });
        (prisma.student.findMany as jest.Mock).mockResolvedValue([
          { id: 'student-1' },
        ]);

        (prisma.attendanceSession.findFirst as jest.Mock).mockResolvedValue({
          id: 'session-1',
          submittedAt: yesterday,
          submittedById: 'user-1', // same owner, but device timestamp is older
          lockAt: new Date('2099-01-01'),
          records: [
            { studentId: 'student-1', status: AttendanceStatus.PRESENT },
          ],
        });

        (prisma.attendanceSession.update as jest.Mock).mockResolvedValue({
          id: 'session-1',
          submittedAt: yesterday,
          conflictStatus: 'FLAGGED',
        });

        (
          prisma.attendanceSession.findUniqueOrThrow as jest.Mock
        ).mockResolvedValue({
          id: 'session-1',
          attendanceDate: yesterday,
          conflictStatus: 'FLAGGED',
          class: { name: 'Class 1' },
          records: [
            { studentId: 'student-1', status: AttendanceStatus.PRESENT },
          ],
        });

        const dto = {
          academicYearId: 'year-1',
          classId: 'class-1',
          sectionId: 'section-1',
          attendanceDate: '2026-06-05',
          deviceTimestamp: deviceTime,
          exceptions: [
            { studentId: 'student-1', status: AttendanceStatus.ABSENT },
          ],
        };

        const result = await service.submitAttendance(dto as any, mockActor);
        // Overwrite should not occur, so conflictStatus is FLAGGED
        expect(result.conflictStatus).toBe('FLAGGED');
        expect(prisma.attendanceRecord.createMany).not.toHaveBeenCalled();
      });

      it('should prevent overwrite if submitting teacher is not the owner', async () => {
        const yesterday = new Date('2026-06-05T10:00:00.000Z');
        const deviceTime = '2026-06-05T11:00:00.000Z'; // newer, but owner mismatch

        (prisma.academicYear.findFirst as jest.Mock).mockResolvedValue({
          id: 'year-1',
        });
        (prisma.class.findFirst as jest.Mock).mockResolvedValue({
          id: 'class-1',
        });
        (prisma.section.findFirst as jest.Mock).mockResolvedValue({
          id: 'section-1',
          classId: 'class-1',
          classTeacherId: 'staff-1',
        });
        (prisma.staff.findFirst as jest.Mock).mockResolvedValue({
          id: 'staff-1',
        });
        (prisma.schoolCalendarDay.findFirst as jest.Mock).mockResolvedValue({
          calendarDate: yesterday,
          isWorkingDay: true,
        });
        (prisma.student.findMany as jest.Mock).mockResolvedValue([
          { id: 'student-1' },
        ]);

        (prisma.attendanceSession.findFirst as jest.Mock).mockResolvedValue({
          id: 'session-1',
          submittedAt: yesterday,
          submittedById: 'other-user', // different owner
          lockAt: new Date('2099-01-01'),
          records: [
            { studentId: 'student-1', status: AttendanceStatus.PRESENT },
          ],
        });

        (prisma.attendanceSession.update as jest.Mock).mockResolvedValue({
          id: 'session-1',
          submittedAt: yesterday,
          conflictStatus: 'FLAGGED',
        });

        (
          prisma.attendanceSession.findUniqueOrThrow as jest.Mock
        ).mockResolvedValue({
          id: 'session-1',
          attendanceDate: yesterday,
          conflictStatus: 'FLAGGED',
          class: { name: 'Class 1' },
          records: [
            { studentId: 'student-1', status: AttendanceStatus.PRESENT },
          ],
        });

        const dto = {
          academicYearId: 'year-1',
          classId: 'class-1',
          sectionId: 'section-1',
          attendanceDate: '2026-06-05',
          deviceTimestamp: deviceTime,
          exceptions: [
            { studentId: 'student-1', status: AttendanceStatus.ABSENT },
          ],
        };

        const result = await service.submitAttendance(dto as any, mockActor);
        expect(result.conflictStatus).toBe('FLAGGED');
        expect(prisma.attendanceRecord.createMany).not.toHaveBeenCalled();
      });
    });

    describe('Concurrence & P2002 Catches', () => {
      it('should catch P2002 unique constraint error and handle conflict gracefully', async () => {
        const dateStr = '2026-06-05';
        (prisma.academicYear.findFirst as jest.Mock).mockResolvedValue({
          id: 'year-1',
        });
        (prisma.class.findFirst as jest.Mock).mockResolvedValue({
          id: 'class-1',
        });
        (prisma.section.findFirst as jest.Mock).mockResolvedValue({
          id: 'section-1',
          classId: 'class-1',
          classTeacherId: 'staff-1',
        });
        (prisma.staff.findFirst as jest.Mock).mockResolvedValue({
          id: 'staff-1',
        });
        (prisma.schoolCalendarDay.findFirst as jest.Mock).mockResolvedValue({
          calendarDate: new Date(dateStr),
          isWorkingDay: true,
        });
        (prisma.student.findMany as jest.Mock).mockResolvedValue([
          { id: 'student-1' },
        ]);

        // Mock no existing session at first check
        (prisma.attendanceSession.findFirst as jest.Mock)
          .mockResolvedValueOnce(null) // first check inside submitAttendance
          .mockResolvedValueOnce({
            // second check inside P2002 catch block
            id: 'concurrent-session-1',
            records: [
              { studentId: 'student-1', status: AttendanceStatus.PRESENT },
            ],
          });

        const p2002Error = new Error('Unique constraint failed') as any;
        p2002Error.code = 'P2002';
        (prisma.$transaction as jest.Mock).mockRejectedValueOnce(p2002Error);

        (
          prisma.attendanceSession.findUniqueOrThrow as jest.Mock
        ).mockResolvedValue({
          id: 'concurrent-session-1',
          attendanceDate: new Date(dateStr),
          class: { name: 'Class 1' },
          records: [
            { studentId: 'student-1', status: AttendanceStatus.PRESENT },
          ],
        });

        const dto = {
          academicYearId: 'year-1',
          classId: 'class-1',
          sectionId: 'section-1',
          attendanceDate: dateStr,
          exceptions: [
            { studentId: 'student-1', status: AttendanceStatus.ABSENT },
          ],
        };

        const result = await service.submitAttendance(dto as any, mockActor);
        expect(result.sessionId).toBe('concurrent-session-1');
        expect(prisma.attendanceConflict.create).toHaveBeenCalled();
        expect(prisma.attendanceSession.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'concurrent-session-1' },
            data: { conflictStatus: 'FLAGGED' },
          }),
        );
      });
    });

    describe('getAttendanceAnomalies', () => {
      it('should return streaks, lates, and other operational anomalies', async () => {
        // Classes & Sections
        (prisma.class.findMany as jest.Mock).mockResolvedValue([
          { id: 'class-1', name: 'Grade 1' },
        ]);
        (prisma.section.findMany as jest.Mock).mockResolvedValue([
          { id: 'section-1', name: 'A', classId: 'class-1' },
        ]);
        (prisma.academicYear.findFirst as jest.Mock).mockResolvedValue({
          id: 'year-1',
          isCurrent: true,
        });

        // Active Enrollments
        (prisma.enrollment.findMany as jest.Mock).mockResolvedValue([
          {
            studentId: 'student-1',
            classId: 'class-1',
            sectionId: 'section-1',
            student: {
              id: 'student-1',
              firstNameEn: 'John',
              lastNameEn: 'Doe',
            },
          },
          {
            studentId: 'student-2',
            classId: 'class-1',
            sectionId: 'section-1',
            student: {
              id: 'student-2',
              firstNameEn: 'Jane',
              lastNameEn: 'Doe',
            },
          },
        ]);

        // Mock recent records for student records mapping
        (prisma.attendanceRecord.findMany as jest.Mock).mockResolvedValue([
          // student-1 has 3 consecutive absences
          {
            studentId: 'student-1',
            status: AttendanceStatus.ABSENT,
            attendanceSession: { attendanceDate: new Date('2026-06-05') },
          },
          {
            studentId: 'student-1',
            status: AttendanceStatus.ABSENT,
            attendanceSession: { attendanceDate: new Date('2026-06-04') },
          },
          {
            studentId: 'student-1',
            status: AttendanceStatus.ABSENT,
            attendanceSession: { attendanceDate: new Date('2026-06-03') },
          },

          // student-2 has 3 lates in last 30 days
          {
            studentId: 'student-2',
            status: AttendanceStatus.LATE,
            attendanceSession: { attendanceDate: daysAgo(5) },
          },
          {
            studentId: 'student-2',
            status: AttendanceStatus.LATE,
            attendanceSession: { attendanceDate: daysAgo(4) },
          },
          {
            studentId: 'student-2',
            status: AttendanceStatus.LATE,
            attendanceSession: { attendanceDate: daysAgo(3) },
          },
        ]);

        // Mock sessions for roster divergence, drops, unsubmitted, and late submissions
        const mockSessions = [
          {
            id: 'session-1',
            classId: 'class-1',
            sectionId: 'section-1',
            attendanceDate: new Date('2026-06-05'),
            submittedAt: new Date('2026-06-06T10:00:00.000Z'), // late submission (>12h)
            submittedBy: { email: 'teacher@school.test' },
            records: [
              { studentId: 'student-1', status: AttendanceStatus.ABSENT },
              // student-2 is missing (Roster Divergence)
            ],
          },
          {
            id: 'session-2',
            classId: 'class-1',
            sectionId: 'section-1',
            attendanceDate: new Date('2026-06-04'),
            submittedAt: new Date('2026-06-04T09:00:00.000Z'),
            submittedBy: { email: 'teacher@school.test' },
            records: [
              { studentId: 'student-1', status: AttendanceStatus.PRESENT },
              { studentId: 'student-2', status: AttendanceStatus.PRESENT },
            ],
          },
        ];
        (prisma.attendanceSession.findMany as jest.Mock).mockResolvedValue(
          mockSessions,
        );

        // Calendar days (unsubmitted working days)
        // Let's mock a working day that has no session
        (prisma.schoolCalendarDay.findMany as jest.Mock).mockResolvedValue([]);
        settingsService.getSetting.mockImplementation(
          async (_tenantId, key) => {
            if (key === 'weekend_policy') return 'SATURDAY'; // saturday is weekend
            return null;
          },
        );

        const result: any = await service.getAttendanceAnomalies(mockActor);

        // Verify streaks
        expect(result.absenceStreaks).toHaveLength(1);
        expect(result.absenceStreaks[0].studentId).toBe('student-1');
        expect(result.absenceStreaks[0].streakCount).toBe(3);

        // Verify repeated lates
        expect(result.repeatedLates).toHaveLength(1);
        expect(result.repeatedLates[0].studentId).toBe('student-2');
        expect(result.repeatedLates[0].lateCount).toBe(3);

        // Verify late submissions
        expect(result.anomalies.lateSubmissions).toHaveLength(1);
        expect(result.anomalies.lateSubmissions[0].sessionId).toBe('session-1');

        // Verify roster divergence
        expect(result.anomalies.rosterDivergences).toHaveLength(1);
        expect(result.anomalies.rosterDivergences[0].sessionId).toBe(
          'session-1',
        );
      });
    });
  });
});
