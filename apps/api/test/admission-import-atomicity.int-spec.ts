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
import { CommunicationsService } from '../src/communications/communications.service';
import { DeliveryRetryService } from '../src/communications/delivery-retry.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { NotificationsProcessor } from '../src/notifications/notifications.processor';
import { NotificationPreferencePolicy } from '../src/notifications/notification-preference-policy';
import { Job } from 'bullmq';

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
  let cls: ClsService;
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
    cls = new IsolatedAuthCls() as unknown as ClsService;
    prisma = new PrismaService(cls);
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

  it('rolls back delivery rows when a later recipient violates a PostgreSQL foreign key', () =>
    scoped(async () => {
      const sourceId = randomUUID();
      const dispatch = jest.fn();
      const allowed = {
        userId: actor.userId,
        studentId: '',
        guardianId: null,
        email: null,
        phone: null,
      };
      const invalid = { ...allowed, userId: randomUUID() };
      const communications = Object.assign(
        Object.create(CommunicationsService.prototype),
        {
          prisma,
          redisService: {
            getClient: () => ({
              set: jest.fn().mockResolvedValue('OK'),
              eval: jest.fn().mockResolvedValue(1),
            }),
          },
          usageService: { checkLimit: jest.fn(), incrementUsage: jest.fn() },
          partitionRecipientsByCommunicationPolicy: jest
            .fn()
            .mockResolvedValue({
              allowedRecipients: [allowed],
              skippedRecipients: [invalid],
            }),
          dispatchDelivery: dispatch,
        },
      ) as CommunicationsService;
      await expect(
        communications.recordDeliveryRecords({
          actor,
          sourceType: 'synthetic_atomicity',
          sourceId,
          audienceType: 'ALL',
          title: 'Synthetic test',
          body: 'Synthetic test',
          channels: ['IN_APP'],
          directRecipients: [allowed, invalid],
        }),
      ).rejects.toMatchObject({ code: 'P2003' });
      expect(
        await prisma.notificationDelivery.count({
          where: { tenantId: actor.tenantId, sourceId },
        }),
      ).toBe(0);
      expect(dispatch).not.toHaveBeenCalled();
    }));

  it('persists a 2000-recipient three-channel batch atomically without rewriting it on replay', async () => {
    await scoped(async () => {
      const sourceId = randomUUID();
      const users = Array.from({ length: 2000 }, () => ({
        id: randomUUID(),
        tenantId: actor.tenantId,
        passwordHash: 'synthetic-unused',
      }));
      await prisma.user.createMany({ data: users });
      const recipients = users.map((user) => ({
        userId: user.id,
        studentId: '',
        guardianId: null,
        email: `${user.id}@example.invalid`,
        phone: null,
      }));
      const dispatch = jest.fn();
      const communications = Object.assign(
        Object.create(CommunicationsService.prototype),
        {
          prisma,
          redisService: {
            getClient: () => ({
              set: jest.fn().mockResolvedValue('OK'),
              eval: jest.fn().mockResolvedValue(1),
            }),
          },
          usageService: { checkLimit: jest.fn(), incrementUsage: jest.fn() },
          auditService: { record: jest.fn() },
          partitionRecipientsByCommunicationPolicy: jest
            .fn()
            .mockResolvedValue({
              allowedRecipients: recipients,
              skippedRecipients: [],
            }),
          dispatchDelivery: dispatch,
        },
      ) as CommunicationsService;
      const input = {
        actor,
        sourceType: 'synthetic_volume',
        sourceId,
        audienceType: 'ALL' as const,
        title: 'Synthetic batch',
        body: 'Original synthetic content',
        channels: ['IN_APP', 'EMAIL', 'PUSH'] as Array<
          'IN_APP' | 'EMAIL' | 'PUSH'
        >,
        directRecipients: recipients,
      };
      await expect(
        communications.recordDeliveryRecords(input),
      ).resolves.toMatchObject({ count: 6000 });
      expect(dispatch).toHaveBeenCalledTimes(6000);
      expect(
        await prisma.notificationDelivery.count({
          where: { tenantId: actor.tenantId, sourceId },
        }),
      ).toBe(6000);
      dispatch.mockClear();
      await expect(
        communications.recordDeliveryRecords({
          ...input,
          body: 'Replacement must not overwrite original',
        }),
      ).resolves.toMatchObject({ count: 6000, replayed: true });
      expect(dispatch).not.toHaveBeenCalled();
      expect(
        await prisma.notificationDelivery.count({
          where: { tenantId: actor.tenantId, sourceId, body: input.body },
        }),
      ).toBe(6000);
    });
  }, 30000);

  it('claims one PostgreSQL retry for concurrent callers using the same version', () =>
    scoped(async () => {
      const delivery = await prisma.notificationDelivery.create({
        data: {
          tenantId: actor.tenantId,
          channel: 'EMAIL',
          status: 'FAILED',
          sourceType: 'synthetic_retry',
          sourceId: randomUUID(),
          audienceType: 'ALL',
          recipientUserId: actor.userId,
          destination: 'synthetic@example.invalid',
          title: 'Synthetic',
          body: 'Synthetic',
          retryCount: 2,
        },
      });
      const sendEmail = jest.fn().mockResolvedValue(undefined);
      const retries = new DeliveryRetryService(
        prisma,
        {
          getProviderReadiness: jest.fn().mockResolvedValue({ enabled: true }),
          sendEmail,
        } as unknown as NotificationsService,
        { record: jest.fn() } as unknown as AuditService,
      );
      // Capture the exact same stale read for both claimants, while retaining the
      // actual service claim/update logic and real PostgreSQL constraints.
      const dispatch = retries as unknown as {
        dispatchRetry: (
          row: typeof delivery,
          auth: AuthContext,
        ) => Promise<unknown>;
      };
      const outcomes = await Promise.allSettled([
        dispatch.dispatchRetry(delivery, actor),
        dispatch.dispatchRetry(delivery, actor),
      ]);
      expect(
        outcomes.filter((outcome) => outcome.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        outcomes.filter((outcome) => outcome.status === 'rejected'),
      ).toHaveLength(1);
      expect(sendEmail).toHaveBeenCalledTimes(1);
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ deliveryAttempt: '3' }),
        }),
      );
      expect(
        await prisma.notificationDelivery.findFirstOrThrow({
          where: { tenantId: actor.tenantId, id: delivery.id },
        }),
      ).toMatchObject({ status: 'RETRY_PENDING', retryCount: 3 });
    }));

  it('ignores an obsolete attempt and blocks queued in-app release after source cancellation', () =>
    scoped(async () => {
      const event = await prisma.notificationEvent.create({
        data: {
          tenantId: actor.tenantId,
          type: 'STUDENT_ADMITTED',
          sourceModule: 'M1_ADMISSIONS',
          sourceEntityType: 'student',
          sourceEntityId: randomUUID(),
          idempotencyKey: randomUUID(),
          status: 'DISPATCHED',
        },
      });
      const delivery = await prisma.notificationDelivery.create({
        data: {
          tenantId: actor.tenantId,
          notificationEventId: event.id,
          sourceType: 'student',
          sourceId: event.sourceEntityId,
          audienceType: 'ALL',
          channel: 'IN_APP',
          recipientUserId: actor.userId,
          status: 'FAILED',
          title: 'Synthetic retry cancellation',
          body: 'Synthetic content only',
          retryCount: 0,
        },
      });
      const releaseInAppNotification = jest.fn(
        async (_input: { metadata: Record<string, string> }) => undefined,
      );
      const retries = new DeliveryRetryService(
        prisma,
        {
          getProviderReadiness: jest.fn().mockResolvedValue({ enabled: true }),
          releaseInAppNotification,
        } as unknown as NotificationsService,
        { record: jest.fn() } as unknown as AuditService,
      );
      await expect(
        retries.retryDelivery(delivery.id, actor),
      ).resolves.toMatchObject({
        status: 'RETRY_PENDING',
      });
      expect(releaseInAppNotification).toHaveBeenCalledTimes(1);
      const policy = new NotificationPreferencePolicy(prisma);
      const evaluate = jest.spyOn(policy, 'evaluateDelivery');
      const processor = new NotificationsProcessor(
        prisma,
        {
          shouldProcessTenantJob: jest.fn().mockResolvedValue(true),
          checkFeatureEnabled: jest.fn().mockResolvedValue({ allowed: true }),
        } as unknown as PlansService,
        cls,
        undefined,
        undefined,
        policy,
      );
      const pending = releaseInAppNotification.mock.calls[0][0];
      await processor.process({
        name: 'releaseInAppNotification',
        data: { metadata: { ...pending.metadata, deliveryAttempt: '0' } },
      } as Job);
      expect(evaluate).not.toHaveBeenCalled();
      expect(
        await prisma.notificationDelivery.findFirstOrThrow({
          where: { tenantId: actor.tenantId, id: delivery.id },
        }),
      ).toMatchObject({ status: 'RETRY_PENDING', retryCount: 1, sentAt: null });

      await prisma.notificationEvent.updateMany({
        where: { tenantId: actor.tenantId, id: event.id },
        data: { status: 'CANCELLED' },
      });
      await prisma.notificationDelivery.updateMany({
        where: { tenantId: actor.tenantId, id: delivery.id, retryCount: 1 },
        data: {
          failureCode: 'QUEUE_HANDOFF_UNCONFIRMED',
          failureReason: 'Synthetic acknowledgement loss',
        },
      });
      await processor.process({
        name: 'releaseInAppNotification',
        data: pending,
      } as Job);
      expect(evaluate).toHaveBeenCalledTimes(1);
      expect(
        await prisma.notificationDelivery.findFirstOrThrow({
          where: { tenantId: actor.tenantId, id: delivery.id },
        }),
      ).toMatchObject({
        status: 'SKIPPED',
        retryCount: 1,
        sentAt: null,
        failureCode: null,
        failureReason: 'Notification event is no longer deliverable',
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
