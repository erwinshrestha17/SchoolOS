import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  TimetableSubstitutionStatus,
  TimetableVersionStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CommunicationsService } from '../communications/communications.service';
import { PrismaService } from '../prisma/prisma.service';
import { TimetableLifecycleService } from './timetable-lifecycle.service';
import { TimetableSubstitutionService } from './timetable-substitution.service';
import { AttendanceService } from '../attendance/attendance.service';
import { CreateSubstitutionDto } from './dto/timetable-setup.dto';

describe('TimetableSubstitutionService', () => {
  let service: TimetableSubstitutionService;
  let prisma: PrismaService;
  let attendanceService: AttendanceService;

  const mockActor = {
    tenantId: 'tenant-1',
    userId: 'user-1',
    permissions: ['timetable:substitute'],
    roles: ['admin'],
  };

  const mockSlot = {
    id: 'slot-1',
    tenantId: 'tenant-1',
    staffId: 'teacher-absent',
    academicYearId: 'year-1',
    dayOfWeek: 1, // Monday
    startsAt: '09:00',
    endsAt: '10:00',
    versionId: 'v-1',
    version: {
      id: 'v-1',
      status: TimetableVersionStatus.PUBLISHED,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimetableSubstitutionService,
        {
          provide: PrismaService,
          useValue: {
            timetableSlot: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              findUnique: jest.fn(),
            },
            timetableSubstitution: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            staff: {
              findFirst: jest.fn(),
            },
            academicYear: {
              findFirst: jest.fn(),
            },
          },
        },
        {
          provide: CommunicationsService,
          useValue: { recordDeliveryRecords: jest.fn() },
        },
        {
          provide: AuditService,
          useValue: { record: jest.fn() },
        },
        {
          provide: TimetableLifecycleService,
          useValue: { validateCandidateSlot: jest.fn() },
        },
        {
          provide: AttendanceService,
          useValue: { getTeacherAbsenceContext: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<TimetableSubstitutionService>(
      TimetableSubstitutionService,
    );
    prisma = module.get<PrismaService>(PrismaService);
    attendanceService = module.get<AttendanceService>(AttendanceService);
  });

  describe('createSubstitution', () => {
    it('should create a substitution successfully', async () => {
      const dto: CreateSubstitutionDto = {
        timetableSlotId: 'slot-1',
        absentTeacherId: 'teacher-absent',
        date: '2026-05-11', // A Monday
        reason: 'Sick',
      };

      jest
        .spyOn(prisma.timetableSlot, 'findFirst')
        .mockResolvedValue(mockSlot as any);
      jest
        .spyOn(prisma.staff, 'findFirst')
        .mockResolvedValue({ id: 'teacher-absent' } as any);
      jest
        .spyOn(prisma.timetableSubstitution, 'findFirst')
        .mockResolvedValue(null);
      jest
        .spyOn(attendanceService, 'getTeacherAbsenceContext')
        .mockResolvedValue({
          isAbsent: true,
          attendanceStatus: 'ABSENT',
          leaveType: null,
        });
      jest
        .spyOn(prisma.timetableSubstitution, 'create')
        .mockResolvedValue({ id: 'sub-1', ...dto, status: 'DRAFT' } as any);

      const result = await service.createSubstitution(dto, mockActor as any);

      expect(result).toBeDefined();
      expect(prisma.timetableSubstitution.create).toHaveBeenCalled();
    });

    it('should block creation if slot belongs to a DRAFT version', async () => {
      const draftSlot = {
        ...mockSlot,
        version: { status: TimetableVersionStatus.DRAFT },
      };
      jest
        .spyOn(prisma.timetableSlot, 'findFirst')
        .mockResolvedValue(draftSlot as any);

      const dto: CreateSubstitutionDto = {
        timetableSlotId: 'slot-1',
        absentTeacherId: 'teacher-absent',
        date: '2026-05-11',
        reason: 'Sick',
      };

      await expect(
        service.createSubstitution(dto, mockActor as any),
      ).rejects.toThrow(ConflictException);
    });

    it('should block creation if date does not match slot day of week', async () => {
      jest
        .spyOn(prisma.timetableSlot, 'findFirst')
        .mockResolvedValue(mockSlot as any);

      const dto: CreateSubstitutionDto = {
        timetableSlotId: 'slot-1',
        absentTeacherId: 'teacher-absent',
        date: '2026-05-12', // Tuesday, but slot is Monday (1)
        reason: 'Sick',
      };

      await expect(
        service.createSubstitution(dto, mockActor as any),
      ).rejects.toThrow(/does not fall on the slot's day of week/);
    });

    it('should accept Sunday substitutions using timetable day 7', async () => {
      const sundaySlot = {
        ...mockSlot,
        dayOfWeek: 7,
      };
      const dto: CreateSubstitutionDto = {
        timetableSlotId: 'slot-1',
        absentTeacherId: 'teacher-absent',
        date: '2026-05-10',
        reason: 'Sunday duty leave',
      };

      jest
        .spyOn(prisma.timetableSlot, 'findFirst')
        .mockResolvedValue(sundaySlot as any);
      jest
        .spyOn(prisma.staff, 'findFirst')
        .mockResolvedValue({ id: 'teacher-absent' } as any);
      jest
        .spyOn(prisma.timetableSubstitution, 'findFirst')
        .mockResolvedValue(null);
      jest
        .spyOn(attendanceService, 'getTeacherAbsenceContext')
        .mockResolvedValue({
          isAbsent: true,
          attendanceStatus: 'ABSENT',
          leaveType: null,
        });
      jest.spyOn(prisma.timetableSubstitution, 'create').mockResolvedValue({
        id: 'sub-sunday',
        ...dto,
        status: 'DRAFT',
      } as any);

      await expect(
        service.createSubstitution(dto, mockActor as any),
      ).resolves.toBeDefined();

      expect(prisma.timetableSubstitution.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            date: expect.any(Date),
          }),
        }),
      );
    });

    it('should block if absentTeacherId does not match slot teacher', async () => {
      jest
        .spyOn(prisma.timetableSlot, 'findFirst')
        .mockResolvedValue(mockSlot as any);
      jest
        .spyOn(prisma.staff, 'findFirst')
        .mockResolvedValue({ id: 'wrong-teacher' } as any);

      const dto: CreateSubstitutionDto = {
        timetableSlotId: 'slot-1',
        absentTeacherId: 'wrong-teacher',
        date: '2026-05-11',
        reason: 'Sick',
      };

      await expect(
        service.createSubstitution(dto, mockActor as any),
      ).rejects.toThrow(/Absent teacher must match/);
    });

    it('should prevent multiple active substitutions for same slot and date', async () => {
      jest
        .spyOn(prisma.timetableSlot, 'findFirst')
        .mockResolvedValue(mockSlot as any);
      jest
        .spyOn(prisma.staff, 'findFirst')
        .mockResolvedValue({ id: 'teacher-absent' } as any);
      jest
        .spyOn(prisma.timetableSubstitution, 'findFirst')
        .mockResolvedValue({ id: 'existing-sub' } as any);

      const dto: CreateSubstitutionDto = {
        timetableSlotId: 'slot-1',
        absentTeacherId: 'teacher-absent',
        date: '2026-05-11',
        reason: 'Sick',
      };

      await expect(
        service.createSubstitution(dto, mockActor as any),
      ).rejects.toThrow(/An active substitution already exists/);
    });
  });

  describe('assignSubstitution', () => {
    const mockSubstitution = {
      id: 'sub-1',
      tenantId: 'tenant-1',
      timetableSlotId: 'slot-1',
      absentTeacherId: 'teacher-absent',
      date: new Date('2026-05-11'),
      status: TimetableSubstitutionStatus.DRAFT,
      timetableSlot: mockSlot,
    };

    it('should block assignment if substitute is on approved leave', async () => {
      jest
        .spyOn(prisma.timetableSubstitution, 'findFirst')
        .mockResolvedValue(mockSubstitution as any);
      jest
        .spyOn(prisma.staff, 'findFirst')
        .mockResolvedValue({ id: 'substitute-teacher' } as any);
      jest
        .spyOn(attendanceService, 'getTeacherAbsenceContext')
        .mockResolvedValue({
          isAbsent: true,
          attendanceStatus: null,
          leaveType: 'SICK',
        });

      await expect(
        service.assignSubstitution(
          'sub-1',
          { substituteTeacherId: 'substitute-teacher' },
          mockActor as any,
        ),
      ).rejects.toThrow(/Substitute teacher is unavailable/);
    });

    it('should block assignment if substitute is marked absent', async () => {
      jest
        .spyOn(prisma.timetableSubstitution, 'findFirst')
        .mockResolvedValue(mockSubstitution as any);
      jest
        .spyOn(prisma.staff, 'findFirst')
        .mockResolvedValue({ id: 'substitute-teacher' } as any);
      jest
        .spyOn(attendanceService, 'getTeacherAbsenceContext')
        .mockResolvedValue({
          isAbsent: true,
          attendanceStatus: 'ABSENT',
          leaveType: null,
        });

      await expect(
        service.assignSubstitution(
          'sub-1',
          { substituteTeacherId: 'substitute-teacher' },
          mockActor as any,
        ),
      ).rejects.toThrow(/Substitute teacher is unavailable/);
    });

    it('should block assignment if substitute has a timetable conflict', async () => {
      jest
        .spyOn(prisma.timetableSubstitution, 'findFirst')
        .mockResolvedValue(mockSubstitution as any);
      jest
        .spyOn(prisma.staff, 'findFirst')
        .mockResolvedValue({ id: 'substitute-teacher' } as any);
      jest
        .spyOn(attendanceService, 'getTeacherAbsenceContext')
        .mockResolvedValue({ isAbsent: false } as any);

      const lifecycleService = (service as any).lifecycleService;
      jest.spyOn(lifecycleService, 'validateCandidateSlot').mockResolvedValue({
        valid: false,
        errors: [{ message: 'Teacher double booked' }],
      });

      await expect(
        service.assignSubstitution(
          'sub-1',
          { substituteTeacherId: 'substitute-teacher' },
          mockActor as any,
        ),
      ).rejects.toThrow(/Teacher double booked/);
    });

    it('should block assignment if substitute is already assigned to another substitution at the same time', async () => {
      jest
        .spyOn(prisma.timetableSubstitution, 'findFirst')
        .mockResolvedValueOnce(mockSubstitution as any) // findSubstitutionOrThrow
        .mockResolvedValueOnce({ id: 'another-sub' } as any); // sameTimeSubstitution check

      jest
        .spyOn(prisma.staff, 'findFirst')
        .mockResolvedValue({ id: 'substitute-teacher' } as any);
      jest
        .spyOn(attendanceService, 'getTeacherAbsenceContext')
        .mockResolvedValue({ isAbsent: false } as any);

      const lifecycleService = (service as any).lifecycleService;
      jest
        .spyOn(lifecycleService, 'validateCandidateSlot')
        .mockResolvedValue({ valid: true, errors: [], warnings: [] });

      await expect(
        service.assignSubstitution(
          'sub-1',
          { substituteTeacherId: 'substitute-teacher' },
          mockActor as any,
        ),
      ).rejects.toThrow(
        /Substitute teacher has a conflicting timetable assignment or substitution/,
      );
    });

    it('normalizes substitution dates before same-day substitute collision checks', async () => {
      const nonMidnightDate = new Date('2026-05-11T08:45:00.000Z');
      const normalizedDate = new Date(nonMidnightDate);
      normalizedDate.setHours(0, 0, 0, 0);

      jest
        .spyOn(prisma.timetableSubstitution, 'findFirst')
        .mockResolvedValueOnce({
          ...mockSubstitution,
          date: nonMidnightDate,
        } as any)
        .mockResolvedValueOnce({ id: 'another-sub' } as any);
      jest
        .spyOn(prisma.staff, 'findFirst')
        .mockResolvedValue({ id: 'substitute-teacher' } as any);
      jest
        .spyOn(attendanceService, 'getTeacherAbsenceContext')
        .mockResolvedValue({ isAbsent: false } as any);

      const lifecycleService = (service as any).lifecycleService;
      jest
        .spyOn(lifecycleService, 'validateCandidateSlot')
        .mockResolvedValue({ valid: true, errors: [], warnings: [] });

      await expect(
        service.assignSubstitution(
          'sub-1',
          { substituteTeacherId: 'substitute-teacher' },
          mockActor as any,
        ),
      ).rejects.toThrow(
        /Substitute teacher has a conflicting timetable assignment or substitution/,
      );

      expect(
        (prisma.timetableSubstitution.findFirst as jest.Mock).mock.calls[1][0],
      ).toEqual(
        expect.objectContaining({
          where: expect.objectContaining({
            date: normalizedDate,
          }),
        }),
      );
    });
  });

  describe('getDailySubstitutionSummary', () => {
    it('uses timetable day 7 for Sunday absence summaries', async () => {
      jest.spyOn(prisma.timetableSlot, 'findMany').mockResolvedValue([
        {
          ...mockSlot,
          dayOfWeek: 7,
          subject: { name: 'Mathematics' },
          class: { name: 'Grade 4' },
          section: null,
          staff: { firstName: 'Absent', lastName: 'Teacher' },
        } as any,
      ]);
      jest
        .spyOn(prisma.timetableSubstitution, 'findMany')
        .mockResolvedValue([]);
      jest
        .spyOn(attendanceService, 'getTeacherAbsenceContext')
        .mockResolvedValue({
          isAbsent: true,
          attendanceStatus: 'ABSENT',
          leaveType: null,
        });

      const summary = await service.getDailySubstitutionSummary(
        '2026-05-10',
        mockActor as any,
      );

      expect(prisma.timetableSlot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dayOfWeek: 7,
          }),
        }),
      );
      expect(summary.absentSlots).toBe(1);
      expect(summary.needsSubstitution).toBe(1);
      expect(summary.slots[0]).toEqual(
        expect.objectContaining({
          isTeacherAbsent: true,
          needsAction: true,
          absenceReason: 'ABSENT',
        }),
      );
    });
  });
});
