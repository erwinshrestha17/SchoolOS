import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthMethod, TeacherAvailabilityType } from '@prisma/client';
import { TimetableService } from './timetable.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CommunicationsService } from '../communications/communications.service';
import { AttendanceService } from '../attendance/attendance.service';
import { AuthContext } from '../auth/auth.types';
import { createPrismaMock, PrismaMock } from '../../test/test-helpers';
import { TimetableLifecycleService } from './timetable-lifecycle.service';
import { TimetableConflictService } from './timetable-conflict.service';

describe('Timetable Requirements and Availability', () => {
  let service: TimetableService;
  let prisma: PrismaMock;

  const actor: AuthContext = {
    userId: 'user-1',
    tenantId: 'tenant-a',
    tenantSlug: 'tenant-a',
    email: 'admin@example.com',
    authMethod: AuthMethod.PASSWORD,
    roles: ['admin'],
    permissions: ['timetable:manage'],
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    const conflictService = new TimetableConflictService(prisma as never);
    const lifecycleService = new TimetableLifecycleService(
      prisma as never,
      conflictService,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimetableService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { record: jest.fn() } },
        {
          provide: CommunicationsService,
          useValue: { recordDeliveryRecords: jest.fn() },
        },
        { provide: TimetableLifecycleService, useValue: lifecycleService },
        { provide: TimetableConflictService, useValue: conflictService },
        { provide: AttendanceService, useValue: {} },
      ],
    }).compile();

    service = module.get<TimetableService>(TimetableService);
  });

  describe('Teacher Availability', () => {
    it('should create teacher availability', async () => {
      const p = prisma as any;
      p.staff.findFirst.mockResolvedValue({
        id: 'staff-1',
        tenantId: 'tenant-a',
      });
      p.teacherAvailability.findFirst.mockResolvedValue(null);
      p.teacherAvailability.create.mockResolvedValue({
        id: 'avail-1',
        staffId: 'staff-1',
      });

      const result = await service.createTeacherAvailability(
        'staff-1',
        {
          dayOfWeek: 1,
          startsAt: '09:00',
          endsAt: '10:00',
          type: TeacherAvailabilityType.AVAILABLE,
        },
        actor,
      );

      expect(result).toBeDefined();
      expect(p.teacherAvailability.create).toHaveBeenCalled();
    });

    it('should reject invalid time range', async () => {
      const p = prisma as any;
      p.staff.findFirst.mockResolvedValue({
        id: 'staff-1',
        tenantId: 'tenant-a',
      });

      await expect(
        service.createTeacherAvailability(
          'staff-1',
          {
            dayOfWeek: 1,
            startsAt: '10:00',
            endsAt: '09:00',
          },
          actor,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Subject Weekly Requirements', () => {
    it('should create subject weekly requirement', async () => {
      const p = prisma as any;
      p.academicYear.findFirst.mockResolvedValue({
        id: 'year-1',
        tenantId: 'tenant-a',
      });
      p.class.findFirst.mockResolvedValue({
        id: 'class-1',
        tenantId: 'tenant-a',
      });
      p.subject.findFirst.mockResolvedValue({
        id: 'sub-1',
        tenantId: 'tenant-a',
      });
      p.subjectWeeklyRequirement.findFirst.mockResolvedValue(null);
      p.subjectWeeklyRequirement.create.mockResolvedValue({
        id: 'req-1',
        requiredPeriodsPerWeek: 5,
      });

      const result = await service.createSubjectWeeklyRequirement(
        {
          academicYearId: 'year-1',
          classId: 'class-1',
          subjectId: 'sub-1',
          requiredPeriodsPerWeek: 5,
        },
        actor,
      );

      expect(result).toBeDefined();
      expect(p.subjectWeeklyRequirement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            requiredPeriodsPerWeek: 5,
          }),
        }),
      );
    });

    it('should reject negative required periods', async () => {
      const p = prisma as any;
      p.academicYear.findFirst.mockResolvedValue({
        id: 'year-1',
        tenantId: 'tenant-a',
      });
      p.class.findFirst.mockResolvedValue({
        id: 'class-1',
        tenantId: 'tenant-a',
      });
      p.subject.findFirst.mockResolvedValue({
        id: 'sub-1',
        tenantId: 'tenant-a',
      });

      await expect(
        service.createSubjectWeeklyRequirement(
          {
            academicYearId: 'year-1',
            classId: 'class-1',
            subjectId: 'sub-1',
            requiredPeriodsPerWeek: -1,
          },
          actor,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });
});
