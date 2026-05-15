import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceStatus, EnrollmentStatus } from '@prisma/client';
import { AttendanceService } from './attendance.service';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CommunicationsService } from '../communications/communications.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SettingsService } from '../settings/settings.service';
import { AuthContext } from '../auth/auth.types';

describe('Attendance Hardening', () => {
  let service: AttendanceService;
  let prisma: PrismaService;

  const mockActor: AuthContext = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    permissions: ['attendance:mark', 'attendance:read'],
    role: 'teacher',
  };

  const mockAdminActor: AuthContext = {
    userId: 'admin-1',
    tenantId: 'tenant-1',
    permissions: [
      'attendance:mark',
      'attendance:read',
      'attendance:override_lock',
    ],
    role: 'admin',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        {
          provide: PrismaService,
          useValue: {
            academicYear: { findFirst: jest.fn() },
            class: { findFirst: jest.fn() },
            section: { findFirst: jest.fn() },
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
            },
            attendanceRecord: { deleteMany: jest.fn(), createMany: jest.fn() },
            schoolCalendarDay: { findFirst: jest.fn() },
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
    (service as any).settingsService =
      module.get<SettingsService>(SettingsService);
  });

  describe('Future Date Prevention', () => {
    it('should throw ForbiddenException if attendance date is in the future', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const dto = {
        academicYearId: 'year-1',
        classId: 'class-1',
        attendanceDate: futureDate.toISOString(),
      };

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
        attendanceDate: yesterday.toISOString(),
      };

      await expect(service.submitAttendance(dto, mockActor)).rejects.toThrow(
        'Attendance session is locked',
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
        attendanceDate: yesterday.toISOString(),
      };

      const result = await service.submitAttendance(dto, mockAdminActor);
      expect(result).toBeDefined();
    });
  });

  describe('Correction Request Scoping', () => {
    it('should throw ForbiddenException if teacher is not assigned to the student class', async () => {
      (prisma.staff.findFirst as jest.Mock).mockResolvedValue({
        id: 'staff-1',
      });
      (prisma.settingsService as any) = {
        getSetting: jest.fn().mockResolvedValue(24),
      }; // Mock setting service property if it was direct, but it is injected

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
});
