import { ConflictException } from '@nestjs/common';
import { TimetableVersionStatus } from '@prisma/client';
import { AuthContext } from '../auth/auth.types';
import { createPrismaMock, PrismaMock } from '../../test/test-helpers';
import { TimetableConflictService } from './timetable-conflict.service';
import { TimetableLifecycleService } from './timetable-lifecycle.service';

const actor: AuthContext = {
  userId: 'user-1',
  tenantId: 'tenant-a',
  tenantSlug: 'tenant-a',
  email: 'admin@example.com',
  authMethod: 'PASSWORD' as never,
  roles: ['admin'],
  permissions: ['timetable:manage', 'timetable:publish'],
};

describe('TimetableLifecycleService', () => {
  let prisma: PrismaMock;
  let service: TimetableLifecycleService;

  beforeEach(() => {
    prisma = createPrismaMock();
    const conflictService = new TimetableConflictService(prisma as never);
    service = new TimetableLifecycleService(prisma as never, conflictService);
  });

  it('rejects candidate slot validation when tenant does not match actor', async () => {
    await expect(
      service.assertCandidateSlotAllowed(actor, {
        id: 'candidate',
        tenantId: 'tenant-b',
        academicYearId: 'year-1',
        versionId: 'version-1',
        classId: 'class-1',
        sectionId: 'section-a',
        subjectId: 'subject-1',
        staffId: 'teacher-1',
        roomId: 'room-1',
        dayOfWeek: 1,
        startsAt: '09:00',
        endsAt: '10:00',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects publishing empty draft timetable versions', async () => {
    const p = prisma as any;
    p.timetableVersion.findFirst.mockResolvedValue({
      id: 'version-1',
      tenantId: 'tenant-a',
      status: TimetableVersionStatus.DRAFT,
      slots: [],
    });

    const result = await service.validateVersionForPublish(actor, 'version-1');

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'BLOCKING',
          message: 'Cannot publish an empty timetable version.',
        }),
      ]),
    );
  });

  it('rejects publishing non-draft timetable versions', async () => {
    const p = prisma as any;
    p.timetableVersion.findFirst.mockResolvedValue({
      id: 'version-1',
      tenantId: 'tenant-a',
      status: TimetableVersionStatus.PUBLISHED,
      slots: [],
    });

    await expect(
      service.validateVersionForPublish(actor, 'version-1'),
    ).rejects.toThrow('Only draft timetable versions can be published');
  });

  it('detects blocking conflicts before publish', async () => {
    const p = prisma as any;
    p.timetableVersion.findFirst.mockResolvedValue({
      id: 'version-1',
      tenantId: 'tenant-a',
      status: TimetableVersionStatus.DRAFT,
      slots: [
        {
          id: 'slot-1',
          tenantId: 'tenant-a',
          academicYearId: 'year-1',
          versionId: 'version-1',
          classId: 'class-1',
          sectionId: 'section-a',
          subjectId: 'subject-1',
          staffId: 'teacher-1',
          roomId: 'room-1',
          dayOfWeek: 1,
          startsAt: '09:00',
          endsAt: '10:00',
        },
        {
          id: 'slot-2',
          tenantId: 'tenant-a',
          academicYearId: 'year-1',
          versionId: 'version-1',
          classId: 'class-2',
          sectionId: 'section-b',
          subjectId: 'subject-2',
          staffId: 'teacher-1',
          roomId: 'room-2',
          dayOfWeek: 1,
          startsAt: '09:30',
          endsAt: '10:30',
        },
      ],
    });

    await expect(
      service.assertVersionPublishable(actor, 'version-1'),
    ).rejects.toThrow('Teacher is already assigned during this time slot.');
  });

  it('allows locking only published versions', () => {
    expect(() => service.assertCanLock(TimetableVersionStatus.PUBLISHED)).not.toThrow();
    expect(() => service.assertCanLock(TimetableVersionStatus.DRAFT)).toThrow(
      'Only published timetable versions can be locked',
    );
  });

  it('blocks direct archive of locked timetable versions', () => {
    expect(() => service.assertCanArchive(TimetableVersionStatus.DRAFT)).not.toThrow();
    expect(() => service.assertCanArchive(TimetableVersionStatus.PUBLISHED)).not.toThrow();
    expect(() => service.assertCanArchive(TimetableVersionStatus.ARCHIVED)).not.toThrow();
    expect(() => service.assertCanArchive(TimetableVersionStatus.LOCKED)).toThrow(
      'Locked timetable versions cannot be archived without an explicit elevated workflow',
    );
  });
});
