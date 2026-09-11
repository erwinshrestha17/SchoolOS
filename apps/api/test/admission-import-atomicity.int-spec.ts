import { randomUUID } from 'node:crypto';
import { ClsService } from 'nestjs-cls';
import { AdmissionsService } from '../src/admissions/admissions.service';
import { CreateDirectAdmissionDto } from '../src/admissions/dto/create-direct-admission.dto';
import { AuthContext } from '../src/auth/auth.types';
import { PrismaService } from '../src/prisma/prisma.service';
import { IsolatedAuthCls } from './helpers/auth-test-isolation';
import { NotificationEventService } from '../src/communications/notification-event.service';
import { PlansService } from '../src/plans/plans.service';
import { AuditService } from '../src/audit/audit.service';

const databaseUrl = process.env.SCHOOLOS_ADMISSION_TEST_DATABASE_URL;
if (databaseUrl) {
  const target = new URL(databaseUrl);
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
    target.pathname !== '/schoolos_admission_atomic_test'
  ) {
    throw new Error(
      'Admission tests require a dedicated loopback test database.',
    );
  }
}

// Actual service/core writes and PostgreSQL transactions; reference validation
// and post-commit providers are isolated. This is not HTTP/provider evidence.
(databaseUrl ? describe : describe.skip)('Admission import atomicity', () => {
  const originalUrl = process.env.DATABASE_URL;
  let prisma: PrismaService;
  let service: AdmissionsService;
  let actor: AuthContext;
  let academicYearId: string;
  let classId: string;
  const followUp = jest
    .fn()
    .mockRejectedValue(new Error('synthetic follow-up failure'));
  const scoped = <T>(fn: () => Promise<T>) =>
    prisma.runWithTenantScope(actor.tenantId, fn);

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService(new IsolatedAuthCls() as unknown as ClsService);
    const slug = `atomic-${randomUUID()}`;
    const tenant = await prisma.tenant.create({
      data: { name: 'Synthetic atomicity test', slug },
    });
    actor = {
      tenantId: tenant.id,
      tenantSlug: slug,
      userId: '',
      email: null,
      authMethod: 'PASSWORD',
      roles: [],
      permissions: [],
    };
    await scoped(async () => {
      const user = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: `${slug}@example.invalid`,
          passwordHash: 'synthetic-unused',
        },
      });
      actor.userId = user.id;
      const year = await prisma.academicYear.create({
        data: {
          tenantId: tenant.id,
          name: 'Synthetic 2026',
          startsOn: new Date('2026-01-01'),
          endsOn: new Date('2026-12-31'),
        },
      });
      academicYearId = year.id;
      classId = (
        await prisma.class.create({
          data: { tenantId: tenant.id, name: 'Synthetic Five', level: 5 },
        })
      ).id;
      service = Object.assign(Object.create(AdmissionsService.prototype), {
        prisma,
        configService: { medicalEncryptionKey: '' },
        validateAdmissionForCreate: jest
          .fn()
          .mockResolvedValue({ academicYear: year, section: null }),
        completeAdmissionSideEffects: followUp,
      }) as AdmissionsService;
    });
  });

  it('preserves dispatch success across concurrent PostgreSQL failure updates', () =>
    scoped(async () => {
      const events = new NotificationEventService(
        prisma,
        {} as PlansService,
        {} as AuditService,
      );
      for (let iteration = 0; iteration < 5; iteration += 1) {
        const event = await prisma.notificationEvent.create({
          data: {
            tenantId: actor.tenantId,
            type: 'STUDENT_ADMITTED',
            sourceModule: 'M1_ADMISSIONS',
            sourceEntityType: 'student',
            sourceEntityId: `synthetic-source-${iteration}`,
            idempotencyKey: randomUUID(),
            status: 'ACCEPTED',
          },
        });
        await Promise.all([
          events.markFailed(actor.tenantId, event.id, 'SYNTHETIC_FAILURE'),
          events.markDispatched(actor.tenantId, event.id),
          events.markFailed(actor.tenantId, event.id, 'SYNTHETIC_LATE_FAILURE'),
        ]);
        const persisted = await prisma.notificationEvent.findFirstOrThrow({
          where: { tenantId: actor.tenantId, id: event.id },
        });
        expect(persisted).toMatchObject({
          status: 'DISPATCHED',
          failureCode: null,
          failedAt: null,
        });
        expect(persisted.dispatchedAt).toBeInstanceOf(Date);
        await events.markDispatched(actor.tenantId, event.id);
        expect(
          (
            await prisma.notificationEvent.findFirstOrThrow({
              where: { tenantId: actor.tenantId, id: event.id },
            })
          ).dispatchedAt,
        ).toEqual(persisted.dispatchedAt);
      }
    }));

  it('keeps a cancelled PostgreSQL event unchanged under late callbacks', () =>
    scoped(async () => {
      const events = new NotificationEventService(
        prisma,
        {} as PlansService,
        {} as AuditService,
      );
      const event = await prisma.notificationEvent.create({
        data: {
          tenantId: actor.tenantId,
          type: 'STUDENT_ADMITTED',
          sourceModule: 'M1_ADMISSIONS',
          sourceEntityType: 'student',
          sourceEntityId: 'synthetic-cancelled-source',
          idempotencyKey: randomUUID(),
          status: 'CANCELLED',
        },
      });
      await Promise.all([
        events.markFailed(actor.tenantId, event.id, 'SYNTHETIC_FAILURE'),
        events.markDispatched(actor.tenantId, event.id),
      ]);
      expect(
        await prisma.notificationEvent.findFirstOrThrow({
          where: { tenantId: actor.tenantId, id: event.id },
        }),
      ).toMatchObject({
        status: 'CANCELLED',
        dispatchedAt: null,
        failedAt: null,
      });
    }));

  afterAll(async () => {
    await prisma?.$disconnect();
    if (originalUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalUrl;
    // Retain synthetic fixture history; the caller owns the disposable DB.
  });

  async function fixture() {
    const batch = await prisma.admissionImportBatch.create({
      data: {
        tenantId: actor.tenantId,
        status: 'PROCESSING',
        dryRun: false,
        totalRows: 1,
      },
    });
    const dto = {
      clientOperationId: `bulk:${batch.id}:row:2`,
      studentSystemId: randomUUID(),
      firstNameEn: 'Synthetic',
      lastNameEn: 'Student',
      gender: 'OTHER',
      dateOfBirth: '2015-01-01',
      admissionDate: '2026-06-01',
      academicYearId,
      classId,
      guardians: [],
      createLogin: false,
    } as CreateDirectAdmissionDto;
    return {
      batch,
      dto,
      context: {
        batchId: batch.id,
        rowNumber: 2,
        rawData: { synthetic: true },
      },
    };
  }

  it('persists core records and processing linkage when post-commit follow-up fails', () =>
    scoped(async () => {
      const { batch, dto, context } = await fixture();
      await expect(
        service.createAdmission(dto, actor, context),
      ).rejects.toThrow('synthetic follow-up failure');
      const student = await prisma.student.findFirstOrThrow({
        where: {
          tenantId: actor.tenantId,
          admissionOperationId: dto.clientOperationId,
        },
      });
      expect(
        await prisma.enrollment.count({
          where: { tenantId: actor.tenantId, studentId: student.id },
        }),
      ).toBe(1);
      expect(
        await prisma.studentLifecycleTransition.count({
          where: { tenantId: actor.tenantId, studentId: student.id },
        }),
      ).toBe(1);
      expect(
        await prisma.admissionImportRow.findFirst({
          where: { tenantId: actor.tenantId, batchId: batch.id },
        }),
      ).toMatchObject({
        status: 'PROCESSING',
        studentId: student.id,
        studentSystemId: student.studentSystemId,
      });
    }));

  it('rolls back core records when the import row unique constraint rejects linkage', () =>
    scoped(async () => {
      const { batch, dto, context } = await fixture();
      const existing = await prisma.admissionImportRow.create({
        data: {
          tenantId: actor.tenantId,
          batchId: batch.id,
          rowNumber: 2,
          status: 'FAILED',
        },
      });
      const before = await prisma.enrollment.count({
        where: { tenantId: actor.tenantId },
      });
      const auditBefore = await prisma.auditLog.count({
        where: { tenantId: actor.tenantId },
      });
      followUp.mockClear();
      await expect(
        service.createAdmission(dto, actor, context),
      ).rejects.toThrow('Admission identity was claimed concurrently');
      expect(
        await prisma.student.count({
          where: {
            tenantId: actor.tenantId,
            admissionOperationId: dto.clientOperationId,
          },
        }),
      ).toBe(0);
      expect(
        await prisma.enrollment.count({ where: { tenantId: actor.tenantId } }),
      ).toBe(before);
      expect(
        await prisma.auditLog.count({ where: { tenantId: actor.tenantId } }),
      ).toBe(auditBefore);
      expect(
        await prisma.admissionImportRow.findUnique({
          where: { id: existing.id },
        }),
      ).toMatchObject({ status: 'FAILED', studentId: null });
      expect(followUp).not.toHaveBeenCalled();
    }));
});
