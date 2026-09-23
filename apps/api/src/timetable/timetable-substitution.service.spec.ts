import { ConflictException } from '@nestjs/common';
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

type TimetableSlotFixture = Awaited<
  ReturnType<PrismaService['timetableSlot']['findMany']>
>[number];

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
    classId: 'class-1',
    sectionId: 'section-1',
    subjectId: 'subject-1',
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
              count: jest.fn(),
            },
            teacherDelegation: {
              create: jest.fn(),
              updateMany: jest.fn(),
            },
            teacherHandoverNote: {
              create: jest.fn(),
            },
            staff: {
              findFirst: jest.fn(),
            },
            academicYear: {
              findFirst: jest.fn(),
            },
            $transaction: jest.fn(async (fn: (tx: unknown) => unknown) =>
              fn({
                timetableSubstitution: {
                  create: jest.fn(),
                  update: jest.fn(),
                },
                teacherDelegation: {
                  create: jest.fn(),
                  updateMany: jest.fn(),
                },
              }),
            ),
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

  describe('listSubstitutions', () => {
    it('returns only bounded teacher identity fields for substitution rows', async () => {
      jest
        .spyOn(
          prisma.timetableSubstitution as unknown as Record<string, jest.Mock>,
          'findMany',
        )
        .mockResolvedValue([]);
      jest
        .spyOn(
          prisma.timetableSubstitution as unknown as Record<string, jest.Mock>,
          'count',
        )
        .mockResolvedValue(0);

      await service.listSubstitutions(
        mockActor as unknown as Parameters<typeof service.listSubstitutions>[0],
        {},
      );

      expect(prisma.timetableSubstitution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            absentTeacher: {
              select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
              },
            },
            substituteTeacher: {
              select: {
                id: true,
                employeeId: true,
                firstName: true,
                lastName: true,
              },
            },
          }),
        }),
      );
    });
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
        .spyOn(
          prisma.timetableSlot as unknown as Record<string, jest.Mock>,
          'findFirst',
        )
        .mockResolvedValue(mockSlot);
      jest
        .spyOn(
          prisma.staff as unknown as Record<string, jest.Mock>,
          'findFirst',
        )
        .mockResolvedValue({ id: 'teacher-absent' });
      jest
        .spyOn(
          prisma.timetableSubstitution as unknown as Record<string, jest.Mock>,
          'findFirst',
        )
        .mockResolvedValue(null);
      jest
        .spyOn(attendanceService, 'getTeacherAbsenceContext')
        .mockResolvedValue({
          isAbsent: true,
          attendanceStatus: 'ABSENT',
          leaveType: null,
        });
      const created = Object.assign({ id: 'sub-1' }, dto, {
        status: TimetableSubstitutionStatus.DRAFT,
        reason: dto.reason,
      });
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (
          fn: (tx: Record<string, Record<string, jest.Mock>>) => unknown,
        ) =>
          fn({
            timetableSubstitution: {
              create: jest.fn().mockResolvedValue(created),
              update: jest.fn(),
            },
            teacherDelegation: {
              create: jest.fn(),
              updateMany: jest.fn(),
            },
          }),
      );

      const result = await service.createSubstitution(
        dto,
        mockActor as unknown as Parameters<
          typeof service.createSubstitution
        >[1],
      );

      expect(result).toBeDefined();
      expect(result.id).toBe('sub-1');
    });

    it('creates a linked TeacherDelegation when create-and-assign includes a substitute', async () => {
      const dto: CreateSubstitutionDto = {
        timetableSlotId: 'slot-1',
        absentTeacherId: 'teacher-absent',
        substituteTeacherId: 'teacher-sub',
        date: '2026-05-11',
        reason: 'Sick',
      };
      const created = Object.assign({ id: 'sub-assigned' }, dto, {
        status: TimetableSubstitutionStatus.ASSIGNED,
        reason: dto.reason,
        timetableSlot: {
          ...mockSlot,
          subject: { name: 'Math' },
          class: { name: 'Grade 5' },
          section: { name: 'A' },
        },
        substituteTeacher: {
          firstName: 'Sub',
          lastName: 'Teacher',
        },
        date: new Date('2026-05-11'),
      });
      const delegationCreate = jest.fn().mockResolvedValue({ id: 'deleg-1' });

      jest
        .spyOn(
          prisma.timetableSlot as unknown as Record<string, jest.Mock>,
          'findFirst',
        )
        .mockResolvedValue(mockSlot);
      jest
        .spyOn(
          prisma.staff as unknown as Record<string, jest.Mock>,
          'findFirst',
        )
        .mockImplementation(async (args) => {
          const id = args?.where?.id;
          return { id } as unknown as Awaited<
            ReturnType<typeof prisma.staff.findFirst>
          >;
        });
      jest
        .spyOn(
          prisma.timetableSubstitution as unknown as Record<string, jest.Mock>,
          'findFirst',
        )
        // 1) duplicate check  2) same-time conflict check  3) notify reload
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValue(created);
      jest
        .spyOn(attendanceService, 'getTeacherAbsenceContext')
        .mockImplementation(async (_tenantId: string, teacherId: string) => {
          if (teacherId === 'teacher-sub') {
            return { isAbsent: false, attendanceStatus: null, leaveType: null };
          }
          return {
            isAbsent: true,
            attendanceStatus: 'ABSENT',
            leaveType: null,
          };
        });
      const lifecycleService = (
        service as unknown as { lifecycleService: TimetableLifecycleService }
      ).lifecycleService;
      jest
        .spyOn(lifecycleService, 'validateCandidateSlot')
        .mockResolvedValue({ valid: true, errors: [], warnings: [] });
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (
          fn: (tx: Record<string, Record<string, jest.Mock>>) => unknown,
        ) =>
          fn({
            timetableSubstitution: {
              create: jest.fn().mockResolvedValue(created),
              update: jest.fn(),
            },
            teacherDelegation: {
              create: delegationCreate,
              updateMany: jest.fn(),
            },
          }),
      );

      await service.createSubstitution(
        dto,
        mockActor as unknown as Parameters<
          typeof service.createSubstitution
        >[1],
      );

      expect(delegationCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            timetableSubstitutionId: 'sub-assigned',
            recipientStaffId: 'teacher-sub',
            classId: 'class-1',
            sectionId: 'section-1',
            subjectId: 'subject-1',
          }),
        }),
      );
    });

    it('should block creation if slot belongs to a DRAFT version', async () => {
      const draftSlot = {
        ...mockSlot,
        version: { status: TimetableVersionStatus.DRAFT },
      };
      jest
        .spyOn(
          prisma.timetableSlot as unknown as Record<string, jest.Mock>,
          'findFirst',
        )
        .mockResolvedValue(draftSlot);

      const dto: CreateSubstitutionDto = {
        timetableSlotId: 'slot-1',
        absentTeacherId: 'teacher-absent',
        date: '2026-05-11',
        reason: 'Sick',
      };

      await expect(
        service.createSubstitution(
          dto,
          mockActor as unknown as Parameters<
            typeof service.createSubstitution
          >[1],
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should block creation if date does not match slot day of week', async () => {
      jest
        .spyOn(
          prisma.timetableSlot as unknown as Record<string, jest.Mock>,
          'findFirst',
        )
        .mockResolvedValue(mockSlot);

      const dto: CreateSubstitutionDto = {
        timetableSlotId: 'slot-1',
        absentTeacherId: 'teacher-absent',
        date: '2026-05-12', // Tuesday, but slot is Monday (1)
        reason: 'Sick',
      };

      await expect(
        service.createSubstitution(
          dto,
          mockActor as unknown as Parameters<
            typeof service.createSubstitution
          >[1],
        ),
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
        .spyOn(
          prisma.timetableSlot as unknown as Record<string, jest.Mock>,
          'findFirst',
        )
        .mockResolvedValue(sundaySlot);
      jest
        .spyOn(
          prisma.staff as unknown as Record<string, jest.Mock>,
          'findFirst',
        )
        .mockResolvedValue({ id: 'teacher-absent' });
      jest
        .spyOn(
          prisma.timetableSubstitution as unknown as Record<string, jest.Mock>,
          'findFirst',
        )
        .mockResolvedValue(null);
      jest
        .spyOn(attendanceService, 'getTeacherAbsenceContext')
        .mockResolvedValue({
          isAbsent: true,
          attendanceStatus: 'ABSENT',
          leaveType: null,
        });
      const created = Object.assign({ id: 'sub-sunday' }, dto, {
        status: TimetableSubstitutionStatus.DRAFT,
        reason: dto.reason,
      });
      const createSpy = jest.fn().mockResolvedValue(created);
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (
          fn: (tx: Record<string, Record<string, jest.Mock>>) => unknown,
        ) =>
          fn({
            timetableSubstitution: {
              create: createSpy,
              update: jest.fn(),
            },
            teacherDelegation: {
              create: jest.fn(),
              updateMany: jest.fn(),
            },
          }),
      );

      await expect(
        service.createSubstitution(
          dto,
          mockActor as unknown as Parameters<
            typeof service.createSubstitution
          >[1],
        ),
      ).resolves.toBeDefined();

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            date: expect.any(Date),
          }),
        }),
      );
    });

    it('should block if absentTeacherId does not match slot teacher', async () => {
      jest
        .spyOn(
          prisma.timetableSlot as unknown as Record<string, jest.Mock>,
          'findFirst',
        )
        .mockResolvedValue(mockSlot);
      jest
        .spyOn(
          prisma.staff as unknown as Record<string, jest.Mock>,
          'findFirst',
        )
        .mockResolvedValue({ id: 'wrong-teacher' });

      const dto: CreateSubstitutionDto = {
        timetableSlotId: 'slot-1',
        absentTeacherId: 'wrong-teacher',
        date: '2026-05-11',
        reason: 'Sick',
      };

      await expect(
        service.createSubstitution(
          dto,
          mockActor as unknown as Parameters<
            typeof service.createSubstitution
          >[1],
        ),
      ).rejects.toThrow(/Absent teacher must match/);
    });

    it('should prevent multiple active substitutions for same slot and date', async () => {
      jest
        .spyOn(
          prisma.timetableSlot as unknown as Record<string, jest.Mock>,
          'findFirst',
        )
        .mockResolvedValue(mockSlot);
      jest
        .spyOn(
          prisma.staff as unknown as Record<string, jest.Mock>,
          'findFirst',
        )
        .mockResolvedValue({ id: 'teacher-absent' });
      jest
        .spyOn(
          prisma.timetableSubstitution as unknown as Record<string, jest.Mock>,
          'findFirst',
        )
        .mockResolvedValue({ id: 'existing-sub' });

      const dto: CreateSubstitutionDto = {
        timetableSlotId: 'slot-1',
        absentTeacherId: 'teacher-absent',
        date: '2026-05-11',
        reason: 'Sick',
      };

      await expect(
        service.createSubstitution(
          dto,
          mockActor as unknown as Parameters<
            typeof service.createSubstitution
          >[1],
        ),
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
        .spyOn(
          prisma.timetableSubstitution as unknown as Record<string, jest.Mock>,
          'findFirst',
        )
        .mockResolvedValue(mockSubstitution);
      jest
        .spyOn(
          prisma.staff as unknown as Record<string, jest.Mock>,
          'findFirst',
        )
        .mockResolvedValue({ id: 'substitute-teacher' });
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
          mockActor as unknown as Parameters<
            typeof service.assignSubstitution
          >[2],
        ),
      ).rejects.toThrow(/Substitute teacher is unavailable/);
    });

    it('should block assignment if substitute is marked absent', async () => {
      jest
        .spyOn(
          prisma.timetableSubstitution as unknown as Record<string, jest.Mock>,
          'findFirst',
        )
        .mockResolvedValue(mockSubstitution);
      jest
        .spyOn(
          prisma.staff as unknown as Record<string, jest.Mock>,
          'findFirst',
        )
        .mockResolvedValue({ id: 'substitute-teacher' });
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
          mockActor as unknown as Parameters<
            typeof service.assignSubstitution
          >[2],
        ),
      ).rejects.toThrow(/Substitute teacher is unavailable/);
    });

    it('should block assignment if substitute has a timetable conflict', async () => {
      jest
        .spyOn(
          prisma.timetableSubstitution as unknown as Record<string, jest.Mock>,
          'findFirst',
        )
        .mockResolvedValue(mockSubstitution);
      jest
        .spyOn(
          prisma.staff as unknown as Record<string, jest.Mock>,
          'findFirst',
        )
        .mockResolvedValue({ id: 'substitute-teacher' });
      jest
        .spyOn(attendanceService, 'getTeacherAbsenceContext')
        .mockResolvedValue({
          isAbsent: false,
          attendanceStatus: null,
          leaveType: null,
        });

      const lifecycleService = (
        service as unknown as { lifecycleService: TimetableLifecycleService }
      ).lifecycleService;
      jest.spyOn(lifecycleService, 'validateCandidateSlot').mockResolvedValue({
        valid: false,
        errors: [
          {
            type: 'TEACHER_DOUBLE_BOOKED',
            severity: 'BLOCKING',
            message: 'Teacher double booked',
            affectedPeriodIds: [],
          },
        ],
        warnings: [],
      });

      await expect(
        service.assignSubstitution(
          'sub-1',
          { substituteTeacherId: 'substitute-teacher' },
          mockActor as unknown as Parameters<
            typeof service.assignSubstitution
          >[2],
        ),
      ).rejects.toThrow(/Teacher double booked/);
    });

    it('should block assignment if substitute is already assigned to another substitution at the same time', async () => {
      jest
        .spyOn(
          prisma.timetableSubstitution as unknown as Record<string, jest.Mock>,
          'findFirst',
        )
        .mockResolvedValueOnce(mockSubstitution) // findSubstitutionOrThrow
        .mockResolvedValueOnce({ id: 'another-sub' }); // sameTimeSubstitution check

      jest
        .spyOn(
          prisma.staff as unknown as Record<string, jest.Mock>,
          'findFirst',
        )
        .mockResolvedValue({ id: 'substitute-teacher' });
      jest
        .spyOn(attendanceService, 'getTeacherAbsenceContext')
        .mockResolvedValue({
          isAbsent: false,
          attendanceStatus: null,
          leaveType: null,
        });

      const lifecycleService = (
        service as unknown as { lifecycleService: TimetableLifecycleService }
      ).lifecycleService;
      jest
        .spyOn(lifecycleService, 'validateCandidateSlot')
        .mockResolvedValue({ valid: true, errors: [], warnings: [] });

      await expect(
        service.assignSubstitution(
          'sub-1',
          { substituteTeacherId: 'substitute-teacher' },
          mockActor as unknown as Parameters<
            typeof service.assignSubstitution
          >[2],
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
        .spyOn(
          prisma.timetableSubstitution as unknown as Record<string, jest.Mock>,
          'findFirst',
        )
        .mockResolvedValueOnce({
          ...mockSubstitution,
          date: nonMidnightDate,
        })
        .mockResolvedValueOnce({ id: 'another-sub' });
      jest
        .spyOn(
          prisma.staff as unknown as Record<string, jest.Mock>,
          'findFirst',
        )
        .mockResolvedValue({ id: 'substitute-teacher' });
      jest
        .spyOn(attendanceService, 'getTeacherAbsenceContext')
        .mockResolvedValue({
          isAbsent: false,
          attendanceStatus: null,
          leaveType: null,
        });

      const lifecycleService = (
        service as unknown as { lifecycleService: TimetableLifecycleService }
      ).lifecycleService;
      jest
        .spyOn(lifecycleService, 'validateCandidateSlot')
        .mockResolvedValue({ valid: true, errors: [], warnings: [] });

      await expect(
        service.assignSubstitution(
          'sub-1',
          { substituteTeacherId: 'substitute-teacher' },
          mockActor as unknown as Parameters<
            typeof service.assignSubstitution
          >[2],
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
      jest
        .spyOn(
          prisma.timetableSlot as unknown as Record<string, jest.Mock>,
          'findMany',
        )
        .mockResolvedValue([
          {
            ...mockSlot,
            dayOfWeek: 7,
            subject: { name: 'Mathematics' },
            class: { name: 'Grade 4' },
            section: null,
            staff: { firstName: 'Absent', lastName: 'Teacher' },
          } as unknown as TimetableSlotFixture,
        ]);
      jest
        .spyOn(
          prisma.timetableSubstitution as unknown as Record<string, jest.Mock>,
          'findMany',
        )
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
        mockActor as unknown as Parameters<
          typeof service.getDailySubstitutionSummary
        >[1],
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

  describe('handleStaffLeaveApproved', () => {
    it('creates draft substitution tasks for leave-affected timetable slots', async () => {
      const leaveDate = new Date('2026-05-11T00:00:00.000Z');
      jest
        .spyOn(
          prisma.timetableSlot as unknown as Record<string, jest.Mock>,
          'findMany',
        )
        .mockResolvedValue([
          {
            ...mockSlot,
            subject: { name: 'Mathematics' },
            class: { name: 'Grade 4' },
            section: null,
            staff: { firstName: 'Absent', lastName: 'Teacher' },
          } as unknown as TimetableSlotFixture,
        ]);
      jest
        .spyOn(
          prisma.timetableSubstitution as unknown as Record<string, jest.Mock>,
          'findFirst',
        )
        .mockResolvedValue(null);
      jest
        .spyOn(
          prisma.timetableSubstitution as unknown as Record<string, jest.Mock>,
          'create',
        )
        .mockResolvedValue({
          id: 'sub-from-leave',
          tenantId: 'tenant-1',
          timetableSlotId: 'slot-1',
          absentTeacherId: 'teacher-absent',
          date: leaveDate,
          status: TimetableSubstitutionStatus.DRAFT,
        });

      const result = await service.handleStaffLeaveApproved({
        tenantId: 'tenant-1',
        leaveRequestId: 'leave-1',
        staffId: 'teacher-absent',
        startsOn: leaveDate,
        endsOn: leaveDate,
        reviewedById: 'reviewer-1',
      });

      expect(prisma.timetableSlot.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            staffId: 'teacher-absent',
            dayOfWeek: 1,
            version: expect.objectContaining({
              status: {
                in: [
                  TimetableVersionStatus.PUBLISHED,
                  TimetableVersionStatus.LOCKED,
                ],
              },
            }),
          }),
        }),
      );
      expect(prisma.timetableSubstitution.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            timetableSlotId: 'slot-1',
            absentTeacherId: 'teacher-absent',
            substituteTeacherId: null,
            reason: 'Approved leave request leave-1',
            status: TimetableSubstitutionStatus.DRAFT,
            createdById: 'reviewer-1',
          }),
        }),
      );
      expect(result.createdCount).toBe(1);
    });

    it('does not create duplicate active substitution tasks for the same leave slot', async () => {
      const leaveDate = new Date('2026-05-11T00:00:00.000Z');
      jest
        .spyOn(
          prisma.timetableSlot as unknown as Record<string, jest.Mock>,
          'findMany',
        )
        .mockResolvedValue([
          {
            ...mockSlot,
            subject: { name: 'Mathematics' },
            class: { name: 'Grade 4' },
            section: null,
            staff: { firstName: 'Absent', lastName: 'Teacher' },
          } as unknown as TimetableSlotFixture,
        ]);
      jest
        .spyOn(
          prisma.timetableSubstitution as unknown as Record<string, jest.Mock>,
          'findFirst',
        )
        .mockResolvedValue({ id: 'existing-sub' });

      const result = await service.handleStaffLeaveApproved({
        tenantId: 'tenant-1',
        leaveRequestId: 'leave-1',
        staffId: 'teacher-absent',
        startsOn: leaveDate,
        endsOn: leaveDate,
        reviewedById: 'reviewer-1',
      });

      expect(prisma.timetableSubstitution.create).not.toHaveBeenCalled();
      expect(result.createdCount).toBe(0);
    });
  });
});
