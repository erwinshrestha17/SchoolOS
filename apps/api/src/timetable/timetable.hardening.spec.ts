import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthMethod, TimetableVersionStatus } from '@prisma/client';
import { TimetableService } from './timetable.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CommunicationsService } from '../communications/communications.service';
import { AuthContext } from '../auth/auth.types';
import { createPrismaMock, PrismaMock } from '../../test/test-helpers';

describe('Timetable Hardening', () => {
  let timetableService: TimetableService;
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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimetableService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { record: jest.fn() } },
        {
          provide: CommunicationsService,
          useValue: { recordDeliveryRecords: jest.fn() },
        },
      ],
    }).compile();

    timetableService = module.get<TimetableService>(TimetableService);
  });

  describe('Tenant Isolation', () => {
    it('should reject creating a slot with a room from another tenant', async () => {
      const p = prisma as any;
      p.timetableVersion.findFirst.mockResolvedValue({
        id: 'version-1',
        tenantId: 'tenant-a',
        status: TimetableVersionStatus.DRAFT,
        academicYearId: 'year-1',
      });

      // Mock ensureSlotRefs dependencies
      p.academicYear.findFirst.mockResolvedValue({
        id: 'year-1',
        tenantId: 'tenant-a',
      });
      p.class.findFirst.mockResolvedValue({
        id: 'class-1',
        tenantId: 'tenant-a',
      });
      p.staff.findFirst.mockResolvedValue({
        id: 'staff-1',
        tenantId: 'tenant-a',
      });
      p.subject.findFirst.mockResolvedValue({
        id: 'sub-1',
        tenantId: 'tenant-a',
      });

      // Room from another tenant
      p.room.findFirst.mockImplementation((q: any) => {
        if (q.where.id === 'room-b' && q.where.tenantId === 'tenant-a')
          return Promise.resolve(null);
        return Promise.resolve(null);
      });

      await expect(
        timetableService.createVersionSlot(
          'version-1',
          {
            classId: 'class-1',
            subjectId: 'sub-1',
            staffId: 'staff-1',
            dayOfWeek: 1,
            startsAt: '09:00',
            endsAt: '10:00',
            roomId: 'room-b',
          },
          actor,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject modifying a timetable version from another tenant', async () => {
      const p = prisma as any;
      p.timetableVersion.findFirst.mockResolvedValue(null); // Not found because of tenant mismatch

      await expect(
        timetableService.updateSlot('slot-1', { subjectId: 'new-sub' }, actor),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Conflict Detection', () => {
    it('should reject teacher double-booking in the same time range', async () => {
      const p = prisma as any;
      const version = {
        id: 'version-1',
        tenantId: 'tenant-a',
        status: TimetableVersionStatus.DRAFT,
        academicYearId: 'year-1',
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
      };
      p.timetableVersion.findFirst.mockResolvedValue(version);

      p.timetableSlot.findMany.mockResolvedValue([
        {
          id: 'existing-slot',
          tenantId: 'tenant-a',
          staffId: 'teacher-1',
          dayOfWeek: 1,
          startsAt: '09:00',
          endsAt: '10:00',
          version,
        },
      ]);

      // Mock refs
      p.academicYear.findFirst.mockResolvedValue({
        id: 'year-1',
        tenantId: 'tenant-a',
      });
      p.class.findFirst.mockResolvedValue({
        id: 'class-1',
        tenantId: 'tenant-a',
      });
      p.staff.findFirst.mockResolvedValue({
        id: 'teacher-1',
        tenantId: 'tenant-a',
      });
      p.subject.findFirst.mockResolvedValue({
        id: 'sub-1',
        tenantId: 'tenant-a',
        classId: 'class-1',
      });

      await expect(
        timetableService.createVersionSlot(
          'version-1',
          {
            classId: 'class-2',
            subjectId: 'sub-2',
            staffId: 'teacher-1', // Same teacher
            dayOfWeek: 1,
            startsAt: '09:30', // Overlapping
            endsAt: '10:30',
          },
          actor,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject room double-booking in the same time range', async () => {
      const p = prisma as any;
      const version = {
        id: 'version-1',
        tenantId: 'tenant-a',
        status: TimetableVersionStatus.DRAFT,
        academicYearId: 'year-1',
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
      };
      p.timetableVersion.findFirst.mockResolvedValue(version);

      p.timetableSlot.findMany.mockResolvedValue([
        {
          id: 'existing-slot',
          tenantId: 'tenant-a',
          staffId: 'teacher-1',
          roomId: 'room-1',
          dayOfWeek: 1,
          startsAt: '09:00',
          endsAt: '10:00',
          version,
        },
      ]);

      // Mock refs
      p.academicYear.findFirst.mockResolvedValue({
        id: 'year-1',
        tenantId: 'tenant-a',
      });
      p.class.findFirst.mockResolvedValue({
        id: 'class-1',
        tenantId: 'tenant-a',
      });
      p.staff.findFirst.mockResolvedValue({
        id: 'teacher-2',
        tenantId: 'tenant-a',
      });
      p.subject.findFirst.mockResolvedValue({
        id: 'sub-1',
        tenantId: 'tenant-a',
        classId: 'class-1',
      });
      p.room.findFirst.mockResolvedValue({
        id: 'room-1',
        tenantId: 'tenant-a',
      });

      await expect(
        timetableService.createVersionSlot(
          'version-1',
          {
            classId: 'class-2',
            subjectId: 'sub-2',
            staffId: 'teacher-2',
            dayOfWeek: 1,
            startsAt: '08:30',
            endsAt: '09:30', // Overlapping
            roomId: 'room-1', // Same room
          },
          actor,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Versioning and Publishing', () => {
    it('should prevent editing a published timetable', async () => {
      const p = prisma as any;
      p.timetableSlot.findFirst.mockResolvedValue({
        id: 'slot-1',
        tenantId: 'tenant-a',
        version: { status: TimetableVersionStatus.PUBLISHED },
      });

      await expect(
        timetableService.updateSlot('slot-1', { subjectId: 'new-sub' }, actor),
      ).rejects.toThrow(ConflictException);
    });

    it('should prevent publishing if conflicts exist', async () => {
      const p = prisma as any;
      const version = {
        id: 'version-1',
        tenantId: 'tenant-a',
        status: TimetableVersionStatus.DRAFT,
        slots: [
          {
            id: 'slot-1',
            staffId: 'teacher-1',
            dayOfWeek: 1,
            startsAt: '09:00',
            endsAt: '10:00',
          },
          {
            id: 'slot-2',
            staffId: 'teacher-1',
            dayOfWeek: 1,
            startsAt: '09:30',
            endsAt: '10:30',
          },
        ],
      };
      p.timetableVersion.findFirst.mockResolvedValue(version);

      // First slot validation
      p.timetableSlot.findMany.mockResolvedValueOnce([version.slots[1]]);
      // Second slot validation
      p.timetableSlot.findMany.mockResolvedValueOnce([version.slots[0]]);

      await expect(
        timetableService.publishVersion('version-1', actor),
      ).rejects.toThrow(ConflictException);
    });
  });
});
