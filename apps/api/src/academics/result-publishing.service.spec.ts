import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AudienceType,
  ConsentType,
  GradeLockStatus,
  NotificationChannel,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from '../communications/communications.service';
import { FinanceService } from '../finance/finance.service';
import { PrismaService } from '../prisma/prisma.service';
import { ResultPublishingService } from './result-publishing.service';

describe('ResultPublishingService', () => {
  let service: ResultPublishingService;
  let prisma: {
    reportCard: { findMany: jest.Mock; update: jest.Mock };
    tenantSetting: { findFirst: jest.Mock };
  };
  let communicationsService: { recordDeliveryRecords: jest.Mock };
  let auditService: { record: jest.Mock };
  let financeService: { getStudentFeeLedger: jest.Mock };

  const actor: AuthContext = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    tenantSlug: 'tenant-one',
    email: 'admin@school.test',
    authMethod: 'PASSWORD',
    roles: ['admin'],
    permissions: ['academics:manage_report_cards'],
  } as AuthContext;

  beforeEach(async () => {
    prisma = {
      reportCard: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      tenantSetting: {
        findFirst: jest.fn(),
      },
    };
    communicationsService = { recordDeliveryRecords: jest.fn() };
    auditService = { record: jest.fn() };
    financeService = { getStudentFeeLedger: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResultPublishingService,
        { provide: PrismaService, useValue: prisma },
        { provide: CommunicationsService, useValue: communicationsService },
        { provide: AuditService, useValue: auditService },
        { provide: FinanceService, useValue: financeService },
      ],
    }).compile();

    service = module.get(ResultPublishingService);
  });

  function reportCard(overrides: Record<string, unknown> = {}) {
    return {
      id: 'rc-1',
      tenantId: actor.tenantId,
      studentId: 'student-1',
      academicYearId: 'year-1',
      examTermId: 'term-1',
      classId: 'class-1',
      sectionId: null,
      percentage: new Prisma.Decimal(85),
      grade: 'A',
      gpa: new Prisma.Decimal(3.6),
      status: GradeLockStatus.LOCKED,
      publishStatus: 'UNPUBLISHED',
      publishedAt: null,
      publishedById: null,
      student: {
        id: 'student-1',
        firstNameEn: 'John',
        lastNameEn: 'Doe',
        studentSystemId: 'STD-001',
        lifecycleStatus: 'ACTIVE',
      },
      class: { id: 'class-1', name: 'Class 5', level: 5 },
      section: null,
      academicYear: { id: 'year-1', name: '2082' },
      examTerm: { id: 'term-1', name: 'First Term' },
      tenant: { id: actor.tenantId, name: 'Demo School' },
      publishedBy: null,
      ...overrides,
    };
  }

  it('rejects duplicate report card IDs during publish', async () => {
    await expect(
      service.publishResults({ reportCardIds: ['rc-1', 'rc-1'] }, actor),
    ).rejects.toThrow(ConflictException);
  });

  it('requires explicit IDs or publishing scope', async () => {
    await expect(service.publishResults({}, actor)).rejects.toThrow(
      ConflictException,
    );
  });

  it('publishes only locked unpublished report cards and records domain audit', async () => {
    prisma.reportCard.findMany.mockResolvedValue([reportCard()]);
    prisma.tenantSetting.findFirst.mockResolvedValue(null);
    prisma.reportCard.update.mockResolvedValue({ id: 'rc-1' });

    const result = await service.publishResults(
      { reportCardIds: ['rc-1'] },
      actor,
    );

    expect(result.published).toBe(1);
    expect(result.skipped).toBe(0);
    expect(prisma.reportCard.update).toHaveBeenCalledWith({
      where: { id: 'rc-1' },
      data: expect.objectContaining({
        publishStatus: 'PUBLISHED',
        publishedAt: expect.any(Date),
        publishedById: actor.userId,
      }),
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ACADEMICS_RESULTS_PUBLISHED',
        tenantId: actor.tenantId,
      }),
    );
  });

  it('returns missing tenant-scoped IDs as failures', async () => {
    prisma.reportCard.findMany.mockResolvedValue([reportCard({ id: 'rc-1' })]);
    prisma.tenantSetting.findFirst.mockResolvedValue(null);
    prisma.reportCard.update.mockResolvedValue({ id: 'rc-1' });

    const result = await service.publishResults(
      { reportCardIds: ['rc-1', 'missing-rc'] },
      actor,
    );

    expect(result.failed).toContainEqual({
      id: 'missing-rc',
      reason: 'Report card not found in this tenant',
    });
  });

  it('blocks publishing unlocked report cards', async () => {
    prisma.reportCard.findMany.mockResolvedValue([
      reportCard({ status: GradeLockStatus.DRAFT }),
    ]);
    prisma.tenantSetting.findFirst.mockResolvedValue(null);

    const result = await service.publishResults(
      { reportCardIds: ['rc-1'] },
      actor,
    );

    expect(result.published).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.failed).toContainEqual({
      id: 'rc-1',
      reason: 'Report card is not locked',
    });
  });

  it('blocks publishing when dues setting is enabled and balance is outstanding', async () => {
    prisma.reportCard.findMany.mockResolvedValue([reportCard()]);
    prisma.tenantSetting.findFirst.mockResolvedValue({ value: 'true' });
    financeService.getStudentFeeLedger.mockResolvedValue({
      outstandingBalance: 1000,
    });

    const result = await service.publishResults(
      { reportCardIds: ['rc-1'] },
      actor,
    );

    expect(result.published).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.failed[0].reason).toContain('outstanding dues');
  });

  it('requires unpublish reason', async () => {
    await expect(
      service.unpublishResults(
        { reportCardIds: ['rc-1'], reason: '   ' },
        actor,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('unpublishes published report cards and audits the reason', async () => {
    prisma.reportCard.findMany.mockResolvedValue([
      reportCard({ publishStatus: 'PUBLISHED' }),
    ]);
    prisma.reportCard.update.mockResolvedValue({ id: 'rc-1' });

    const result = await service.unpublishResults(
      { reportCardIds: ['rc-1'], reason: 'Correction needed' },
      actor,
    );

    expect(result.unpublished).toBe(1);
    expect(prisma.reportCard.update).toHaveBeenCalledWith({
      where: { id: 'rc-1' },
      data: expect.objectContaining({
        publishStatus: 'UNPUBLISHED',
        unpublishedAt: expect.any(Date),
      }),
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ACADEMICS_RESULTS_UNPUBLISHED',
        after: expect.objectContaining({ reason: 'Correction needed' }),
      }),
    );
  });

  it('notifies only published active-student report cards', async () => {
    prisma.reportCard.findMany.mockResolvedValue([
      reportCard({ publishStatus: 'PUBLISHED' }),
    ]);

    const result = await service.notifyResults(
      { reportCardIds: ['rc-1'] },
      actor,
    );

    expect(result.notified).toBe(1);
    expect(communicationsService.recordDeliveryRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        actor,
        sourceType: 'report_card_published',
        sourceId: 'rc-1',
        audienceType: AudienceType.ALL,
        studentIds: ['student-1'],
        channels: [NotificationChannel.PUSH, NotificationChannel.SMS],
        requiredConsentTypes: [ConsentType.MESSAGING],
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ACADEMICS_RESULTS_NOTIFIED' }),
    );
  });

  it('skips notification for unpublished report cards', async () => {
    prisma.reportCard.findMany.mockResolvedValue([reportCard()]);

    const result = await service.notifyResults(
      { reportCardIds: ['rc-1'] },
      actor,
    );

    expect(result.notified).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.failed).toContainEqual({
      id: 'rc-1',
      reason: 'Report card is not published',
    });
  });
});
