import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { TimetableVersionStatus } from '@prisma/client';
import { AuthContext } from '../src/auth/auth.types';
import { PrismaService } from '../src/prisma/prisma.service';
import { TimetableConflictService } from '../src/timetable/timetable-conflict.service';
import { TimetableLifecycleService } from '../src/timetable/timetable-lifecycle.service';
import {
  TIMETABLE_CROSS_VERSION_CONFLICT_CODE,
  TIMETABLE_SLOT_CONFLICT_CODE,
  TimetableService,
} from '../src/timetable/timetable.service';
import { IsolatedAuthCls } from './helpers/auth-test-isolation';

const databaseUrl = process.env.SCHOOLOS_TIMETABLE_TEST_DATABASE_URL;
if (databaseUrl) {
  const target = new URL(databaseUrl);
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
    target.pathname !== '/schoolos_timetable_test'
  ) {
    throw new Error(
      'Timetable integrity tests require a dedicated loopback test database.',
    );
  }
}

function conflictCode(reason: unknown): string | undefined {
  if (!(reason instanceof ConflictException)) return undefined;
  const body = reason.getResponse();
  return typeof body === 'object' && body !== null && 'code' in body
    ? String((body as { code: unknown }).code)
    : undefined;
}

// Phase 6.1: real PostgreSQL EXCLUDE constraints and transactional races.
// Communications/audit/attendance/teacher-scope are inert stubs; every
// timetable read/write and lock is real.
(databaseUrl ? describe : describe.skip)(
  'Timetable conflict integrity (PostgreSQL)',
  () => {
    const previousUrl = process.env.DATABASE_URL;
    let prisma: PrismaService;
    let service: TimetableService;
    let actor: AuthContext;
    let tenantId: string;
    let yearId: string;
    let classId: string;
    let sectionA: string;
    let sectionB: string;
    let subjectId: string;
    let teacher1: string;
    let teacher2: string;
    let roomId: string;
    const scoped = <T>(fn: () => Promise<T>) =>
      prisma.runWithTenantScope(tenantId, fn);

    const createStaff = async (label: string) => {
      const user = await prisma.user.create({
        data: {
          tenantId,
          email: `${label}-${randomUUID()}@example.invalid`,
          passwordHash: 'synthetic-unused',
        },
      });
      return (
        await prisma.staff.create({
          data: {
            tenantId,
            userId: user.id,
            employeeId: `SYN-${randomUUID()}`,
            firstName: 'Synthetic',
            lastName: label,
            dateOfBirth: new Date('1990-01-01'),
            gender: 'OTHER',
            address: 'Synthetic address',
            joiningDate: new Date('2025-01-01'),
            contractType: 'PERMANENT',
          } as never,
        })
      ).id;
    };

    const createVersion = (sectionId: string, name: string) =>
      scoped(() =>
        prisma.timetableVersion.create({
          data: {
            tenantId,
            academicYearId: yearId,
            classId,
            sectionId,
            versionName: name,
            effectiveFrom: new Date('2026-01-01'),
          },
        }),
      );

    const rawSlot = (
      versionId: string,
      overrides: Partial<{
        sectionId: string;
        staffId: string;
        roomId: string | null;
        startsAt: string;
        endsAt: string;
        dayOfWeek: number;
      }> = {},
    ) =>
      scoped(() =>
        prisma.timetableSlot.create({
          data: {
            tenantId,
            versionId,
            academicYearId: yearId,
            classId,
            sectionId: overrides.sectionId ?? sectionA,
            subjectId,
            staffId: overrides.staffId ?? teacher1,
            roomId: overrides.roomId === undefined ? null : overrides.roomId,
            dayOfWeek: overrides.dayOfWeek ?? 1,
            startsAt: overrides.startsAt ?? '08:00',
            endsAt: overrides.endsAt ?? '08:45',
          },
        }),
      );

    beforeAll(async () => {
      process.env.DATABASE_URL = databaseUrl;
      prisma = new PrismaService(
        new IsolatedAuthCls() as unknown as ClsService,
      );
      const slug = `tt-${randomUUID()}`;
      const tenant = await prisma.tenant.create({
        data: { name: 'Synthetic timetable test', slug },
      });
      tenantId = tenant.id;
      await scoped(async () => {
        const user = await prisma.user.create({
          data: {
            tenantId,
            email: `${slug}@example.invalid`,
            passwordHash: 'synthetic-unused',
          },
        });
        actor = {
          tenantId,
          tenantSlug: slug,
          userId: user.id,
          email: null,
          authMethod: 'PASSWORD',
          roles: ['admin'],
          permissions: [],
        } as AuthContext;
        yearId = (
          await prisma.academicYear.create({
            data: {
              tenantId,
              name: 'Synthetic 2026',
              startsOn: new Date('2026-01-01'),
              endsOn: new Date('2026-12-31'),
              isCurrent: true,
            },
          })
        ).id;
        classId = (
          await prisma.class.create({
            data: { tenantId, name: 'Grade 8', level: 8 },
          })
        ).id;
        sectionA = (
          await prisma.section.create({
            data: { tenantId, classId, name: 'A' },
          })
        ).id;
        sectionB = (
          await prisma.section.create({
            data: { tenantId, classId, name: 'B' },
          })
        ).id;
        subjectId = (
          await prisma.subject.create({
            data: {
              tenantId,
              classId,
              name: 'Mathematics',
              code: `MATH-${randomUUID().slice(0, 6)}`,
              type: 'CORE',
            } as never,
          })
        ).id;
        teacher1 = await createStaff('One');
        teacher2 = await createStaff('Two');
        roomId = (
          await prisma.room.create({ data: { tenantId, name: 'Room 101' } })
        ).id;
      });

      const conflictService = new TimetableConflictService(prisma);
      const lifecycle = new TimetableLifecycleService(prisma, conflictService);
      service = new TimetableService(
        prisma,
        { recordDeliveryRecords: jest.fn() } as never,
        { record: jest.fn() } as never,
        lifecycle,
        {} as never,
        {} as never,
      );
    });

    afterAll(async () => {
      await prisma.$disconnect();
      if (previousUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousUrl;
    });

    describe('database EXCLUDE constraints', () => {
      it('rejects a teacher overlap with a different start time', async () => {
        const version = await createVersion(sectionA, 'teacher overlap');
        await rawSlot(version.id, { startsAt: '08:00', endsAt: '08:45' });
        await expect(
          rawSlot(version.id, {
            sectionId: sectionB,
            startsAt: '08:30',
            endsAt: '09:15',
          }),
        ).rejects.toThrow(/TimetableSlot_no_teacher_overlap/);
      });

      it('allows back-to-back periods (half-open intervals)', async () => {
        const version = await createVersion(sectionA, 'adjacent');
        await rawSlot(version.id, { startsAt: '08:00', endsAt: '08:45' });
        await expect(
          rawSlot(version.id, { startsAt: '08:45', endsAt: '09:30' }),
        ).resolves.toBeTruthy();
      });

      it('rejects a room overlap for different teachers', async () => {
        const version = await createVersion(sectionA, 'room overlap');
        await rawSlot(version.id, {
          roomId,
          startsAt: '10:00',
          endsAt: '10:45',
        });
        await expect(
          rawSlot(version.id, {
            sectionId: sectionB,
            staffId: teacher2,
            roomId,
            startsAt: '10:15',
            endsAt: '11:00',
          }),
        ).rejects.toThrow(/TimetableSlot_no_room_overlap/);
      });

      it('rejects a class/section overlap for different teachers', async () => {
        const version = await createVersion(sectionA, 'section overlap');
        await rawSlot(version.id, { startsAt: '11:00', endsAt: '11:45' });
        await expect(
          rawSlot(version.id, {
            staffId: teacher2,
            startsAt: '11:30',
            endsAt: '12:15',
          }),
        ).rejects.toThrow(/TimetableSlot_no_class_section_overlap/);
      });

      it('rejects malformed or inverted times', async () => {
        const version = await createVersion(sectionA, 'bad times');
        await expect(
          rawSlot(version.id, { startsAt: '24:00', endsAt: '24:30' }),
        ).rejects.toThrow(/TimetableSlot_time_range_check/);
        await expect(
          rawSlot(version.id, { startsAt: '09:00', endsAt: '08:00' }),
        ).rejects.toThrow(/TimetableSlot_time_range_check/);
      });

      it('allows only one active substitution per slot and day', async () => {
        const version = await createVersion(sectionA, 'substitution');
        const slot = await rawSlot(version.id, {
          startsAt: '13:00',
          endsAt: '13:45',
        });
        const base = {
          tenantId,
          timetableSlotId: slot.id,
          absentTeacherId: teacher1,
          date: new Date('2026-03-02T00:00:00.000Z'),
          reason: 'synthetic',
          createdById: actor.userId,
        };
        await scoped(() =>
          prisma.timetableSubstitution.create({ data: { ...base } }),
        );
        await expect(
          scoped(() =>
            prisma.timetableSubstitution.create({ data: { ...base } }),
          ),
        ).rejects.toMatchObject({ code: 'P2002' });
        // A cancelled row does not block a new active one.
        await scoped(() =>
          prisma.timetableSubstitution.updateMany({
            where: { timetableSlotId: slot.id },
            data: { status: 'CANCELLED' },
          }),
        );
        await expect(
          scoped(() =>
            prisma.timetableSubstitution.create({ data: { ...base } }),
          ),
        ).resolves.toBeTruthy();
      });
    });

    describe('service races', () => {
      // Each race starts from a clean slate: earlier published versions for
      // the same section would otherwise block publication by date range.
      beforeEach(async () => {
        await scoped(() =>
          prisma.timetableVersion.updateMany({
            where: { tenantId },
            data: { status: TimetableVersionStatus.ARCHIVED },
          }),
        );
      });

      it('two concurrent overlapping saves: exactly one slot is stored and the other gets a stable 409', async () => {
        const version = await createVersion(sectionA, 'concurrent saves');
        const save = (startsAt: string, endsAt: string, sectionId: string) =>
          scoped(() =>
            service.createVersionSlot(
              version.id,
              {
                classId,
                sectionId,
                subjectId,
                staffId: teacher1,
                dayOfWeek: 2,
                startsAt,
                endsAt,
              } as never,
              actor,
            ),
          );
        const results = await Promise.allSettled([
          save('08:00', '08:45', sectionA),
          save('08:30', '09:15', sectionB),
        ]);
        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
        const rejected = results.find(
          (r): r is PromiseRejectedResult => r.status === 'rejected',
        );
        expect(rejected?.reason).toBeInstanceOf(ConflictException);
        const stored = await scoped(() =>
          prisma.timetableSlot.count({
            where: { versionId: version.id, dayOfWeek: 2 },
          }),
        );
        expect(stored).toBe(1);
        const code = conflictCode(rejected?.reason);
        // Either the service pre-check or the database constraint rejects;
        // both are 409s and neither stores a second slot.
        if (code !== undefined) expect(code).toBe(TIMETABLE_SLOT_CONFLICT_CODE);
      });

      it('concurrent publication of two sections that share a teacher at the same time publishes exactly one', async () => {
        const versionA = await createVersion(sectionA, 'section A');
        const versionB = await createVersion(sectionB, 'section B');
        await rawSlot(versionA.id, {
          sectionId: sectionA,
          dayOfWeek: 3,
          startsAt: '09:00',
          endsAt: '09:45',
        });
        await rawSlot(versionB.id, {
          sectionId: sectionB,
          dayOfWeek: 3,
          startsAt: '09:15',
          endsAt: '10:00',
        });

        const results = await Promise.allSettled([
          scoped(() => service.publishVersion(versionA.id, actor)),
          scoped(() => service.publishVersion(versionB.id, actor)),
        ]);
        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
        const rejected = results.find(
          (r): r is PromiseRejectedResult => r.status === 'rejected',
        );
        expect(conflictCode(rejected?.reason)).toBe(
          TIMETABLE_CROSS_VERSION_CONFLICT_CODE,
        );
        const published = await scoped(() =>
          prisma.timetableVersion.count({
            where: {
              id: { in: [versionA.id, versionB.id] },
              status: TimetableVersionStatus.PUBLISHED,
            },
          }),
        );
        expect(published).toBe(1);
      });

      it('a slot save racing a publish never lands in the published version after publication', async () => {
        const version = await createVersion(sectionA, 'edit vs publish');
        await rawSlot(version.id, {
          staffId: teacher2,
          dayOfWeek: 4,
          startsAt: '08:00',
          endsAt: '08:45',
        });
        const [publish] = await Promise.allSettled([
          scoped(() => service.publishVersion(version.id, actor)),
          scoped(() =>
            service.createVersionSlot(
              version.id,
              {
                classId,
                sectionId: sectionA,
                subjectId,
                staffId: teacher2,
                dayOfWeek: 4,
                startsAt: '09:00',
                endsAt: '09:45',
              } as never,
              actor,
            ),
          ),
        ]);
        const after = await scoped(() =>
          prisma.timetableVersion.findUniqueOrThrow({
            where: { id: version.id },
            include: { slots: true },
          }),
        );
        expect(publish.status).toBe('fulfilled');
        expect(after.status).toBe(TimetableVersionStatus.PUBLISHED);
        const publishedAt = after.publishedAt ?? new Date(0);
        for (const slot of after.slots) {
          expect(+slot.createdAt).toBeLessThanOrEqual(+publishedAt);
        }
      });

      it('rejects editing a published version with a stable code', async () => {
        const version = await createVersion(sectionB, 'published edit');
        await rawSlot(version.id, {
          sectionId: sectionB,
          staffId: teacher2,
          dayOfWeek: 5,
          startsAt: '08:00',
          endsAt: '08:45',
        });
        await scoped(() => service.publishVersion(version.id, actor));
        await expect(
          scoped(() =>
            service.createVersionSlot(
              version.id,
              {
                classId,
                sectionId: sectionB,
                subjectId,
                staffId: teacher2,
                dayOfWeek: 5,
                startsAt: '10:00',
                endsAt: '10:45',
              } as never,
              actor,
            ),
          ),
        ).rejects.toBeInstanceOf(ConflictException);
      });
    });
  },
);
