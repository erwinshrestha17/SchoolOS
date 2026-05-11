import { Injectable } from '@nestjs/common';
import {
  GradeLockStatus,
  NotificationChannel,
  AudienceType,
  ConsentType,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from '../communications/communications.service';
import { FinanceService } from '../finance/finance.service';
import { PrismaService } from '../prisma/prisma.service';
import { PublishResultsDto } from './dto/publish-results.dto';
import { UnpublishResultsDto } from './dto/unpublish-results.dto';
import { NotifyResultsDto } from './dto/notify-results.dto';

export interface PublishingReadinessRow {
  reportCardId: string;
  studentId: string;
  studentName: string;
  studentSystemId: string;
  classId: string;
  className: string;
  sectionId: string | null;
  sectionName: string | null;
  academicYearId: string;
  academicYearName: string;
  examTermId: string;
  examTermName: string;
  percentage: number;
  grade: string;
  gpa: number;
  reportStatus: string;
  publishStatus: string;
  publishedAt: Date | null;
  publishedBy: string | null;
  blockedReasons: string[];
  notificationEligibility: boolean;
}

@Injectable()
export class ResultPublishingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly communicationsService: CommunicationsService,
    private readonly auditService: AuditService,
    private readonly financeService: FinanceService,
  ) {}

  async listPublishingReadiness(
    actor: AuthContext,
    filters: {
      academicYearId?: string;
      examTermId?: string;
      classId?: string;
      sectionId?: string;
      status?: string;
    },
  ): Promise<PublishingReadinessRow[]> {
    const reportCards = await this.prisma.reportCard.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(filters.academicYearId
          ? { academicYearId: filters.academicYearId }
          : {}),
        ...(filters.examTermId ? { examTermId: filters.examTermId } : {}),
        ...(filters.classId ? { classId: filters.classId } : {}),
        ...(filters.sectionId ? { sectionId: filters.sectionId } : {}),
        ...(filters.status ? { publishStatus: filters.status } : {}),
      },
      include: {
        student: true,
        class: true,
        section: true,
        academicYear: true,
        examTerm: true,
        publishedBy: true,
      },
      orderBy: [
        { class: { level: 'asc' } },
        { student: { firstNameEn: 'asc' } },
        { student: { lastNameEn: 'asc' } },
      ],
    });

    const results: PublishingReadinessRow[] = [];

    for (const card of reportCards) {
      const blockedReasons: string[] = [];

      if (card.status !== GradeLockStatus.LOCKED) {
        blockedReasons.push(
          `Report card is not LOCKED (current: ${card.status})`,
        );
      }

      const publishingBlockSetting = await this.prisma.tenantSetting.findFirst({
        where: { tenantId: actor.tenantId, key: 'block_publishing_on_dues' },
      });

      if (publishingBlockSetting?.value === 'true') {
        const ledger = await this.financeService.getStudentFeeLedger(
          card.studentId,
          actor,
        );
        if (ledger.outstandingBalance > 0) {
          blockedReasons.push(
            `Student has outstanding dues of ${ledger.outstandingBalance}`,
          );
        }
      }

      results.push({
        reportCardId: card.id,
        studentId: card.studentId,
        studentName: `${card.student.firstNameEn} ${card.student.lastNameEn}`,
        studentSystemId: card.student.studentSystemId,
        classId: card.classId,
        className: card.class.name,
        sectionId: card.sectionId,
        sectionName: card.section?.name ?? null,
        academicYearId: card.academicYearId,
        academicYearName: card.academicYear.name,
        examTermId: card.examTermId,
        examTermName: card.examTerm.name,
        percentage: Number(card.percentage),
        grade: card.grade,
        gpa: Number(card.gpa),
        reportStatus: card.status,
        publishStatus: card.publishStatus ?? 'UNPUBLISHED',
        publishedAt: card.publishedAt,
        publishedBy: card.publishedBy
          ? `${card.publishedBy.email ?? card.publishedBy.phone}`
          : null,
        blockedReasons,
        notificationEligibility: card.student.lifecycleStatus === 'ACTIVE',
      });
    }

    return results;
  }

  async publishResults(dto: PublishResultsDto, actor: AuthContext) {
    const reportCardIds = dto.reportCardIds || [];

    const cards = await this.prisma.reportCard.findMany({
      where: {
        id: { in: reportCardIds },
        tenantId: actor.tenantId,
      },
    });

    const results = {
      published: 0,
      skipped: 0,
      failed: [] as Array<{ id: string; reason: string }>,
      rows: [] as Array<{ id: string }>,
    };

    const publishingBlockSetting = await this.prisma.tenantSetting.findFirst({
      where: { tenantId: actor.tenantId, key: 'block_publishing_on_dues' },
    });
    const blockOnDues = publishingBlockSetting?.value === 'true';

    for (const card of cards) {
      if (blockOnDues) {
        const ledger = await this.financeService.getStudentFeeLedger(
          card.studentId,
          actor,
        );
        if (ledger.outstandingBalance > 0) {
          results.skipped++;
          results.failed.push({
            id: card.id,
            reason: `Student has outstanding dues of ${ledger.outstandingBalance}`,
          });
          continue;
        }
      }

      if (card.status !== GradeLockStatus.LOCKED) {
        results.skipped++;
        results.failed.push({
          id: card.id,
          reason: 'Report card is not locked',
        });
        continue;
      }

      if (card.publishStatus === 'PUBLISHED') {
        results.skipped++;
        continue;
      }

      const updated = await this.prisma.reportCard.update({
        where: { id: card.id },
        data: {
          publishStatus: 'PUBLISHED',
          publishedAt: new Date(),
          publishedById: actor.userId,
        },
      });

      results.published++;
      results.rows.push(updated);
    }

    await this.auditService.record({
      action: 'publish',
      resource: 'report_card_results',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        count: results.published,
        reportCardIds: results.rows.map((r) => r.id),
      },
    });

    return results;
  }

  async unpublishResults(dto: UnpublishResultsDto, actor: AuthContext) {
    const cards = await this.prisma.reportCard.findMany({
      where: {
        id: { in: dto.reportCardIds },
        tenantId: actor.tenantId,
      },
    });

    const results = {
      unpublished: 0,
      skipped: 0,
      failed: [] as Array<{ id: string; reason: string }>,
    };

    for (const card of cards) {
      if (card.publishStatus !== 'PUBLISHED') {
        results.skipped++;
        continue;
      }

      await this.prisma.reportCard.update({
        where: { id: card.id },
        data: {
          publishStatus: 'UNPUBLISHED',
          unpublishedAt: new Date(),
        },
      });

      results.unpublished++;
    }

    await this.auditService.record({
      action: 'unpublish',
      resource: 'report_card_results',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        count: results.unpublished,
        reportCardIds: dto.reportCardIds,
        reason: dto.reason,
      },
    });

    return results;
  }

  async notifyResults(dto: NotifyResultsDto, actor: AuthContext) {
    const cards = await this.prisma.reportCard.findMany({
      where: {
        id: { in: dto.reportCardIds },
        tenantId: actor.tenantId,
        publishStatus: 'PUBLISHED',
      },
      include: {
        student: true,
        examTerm: true,
        tenant: true,
      },
    });

    const results = {
      notified: 0,
      skipped: 0,
    };

    for (const card of cards) {
      // Use existing notification infrastructure
      const schoolName = card.tenant.name;
      const termName = card.examTerm.name;

      await this.communicationsService.recordDeliveryRecords({
        actor,
        sourceType: 'report_card_published',
        sourceId: card.id,
        audienceType: AudienceType.ALL, // Will resolve to student/guardian
        studentIds: [card.studentId],
        title: 'Result Published',
        body: `[${schoolName}]: Result for ${termName} has been published. Please contact school administration for details.`,
        channels: [NotificationChannel.PUSH, NotificationChannel.SMS],
        requiredConsentTypes: [ConsentType.MESSAGING],
      });

      results.notified++;
    }

    await this.auditService.record({
      action: 'notify',
      resource: 'report_card_results',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        count: results.notified,
        reportCardIds: cards.map((c) => c.id),
      },
    });

    return results;
  }
}
