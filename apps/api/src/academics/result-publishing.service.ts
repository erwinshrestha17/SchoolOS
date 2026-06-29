import { ConflictException, Injectable } from '@nestjs/common';
import {
  AssessmentRetakeStatus,
  AudienceType,
  ConsentType,
  GradeLockStatus,
  NotificationChannel,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { CommunicationsService } from '../communications/communications.service';
import { FinanceService } from '../finance/finance.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotifyResultsDto } from './dto/notify-results.dto';
import { PublishResultsDto } from './dto/publish-results.dto';
import { UnpublishResultsDto } from './dto/unpublish-results.dto';

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

interface PublishingFailure {
  id: string;
  reason: string;
}

interface PublishingFilters {
  academicYearId?: string;
  examTermId?: string;
  classId?: string;
  sectionId?: string;
  status?: string;
  page?: number;
  limit?: number;
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
    filters: PublishingFilters,
  ): Promise<PublishingReadinessRow[]> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
    const skip = (page - 1) * limit;

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
      skip,
      take: limit,
    });

    const blockOnDues = await this.shouldBlockPublishingOnDues(actor);
    const activeRetakeKeys = await this.getActiveRetakeKeys(
      actor,
      reportCards,
    );
    const results: PublishingReadinessRow[] = [];

    for (const card of reportCards) {
      const blockedReasons: string[] = [];

      if (card.status !== GradeLockStatus.LOCKED) {
        blockedReasons.push(
          `Report card is not LOCKED (current: ${card.status})`,
        );
      }

      if (
        activeRetakeKeys.has(
          this.retakeKey(card.studentId, card.examTermId),
        )
      ) {
        blockedReasons.push('A retest or make-up lifecycle is still active');
      }

      if (blockOnDues) {
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
        notificationEligibility:
          card.student.lifecycleStatus === 'ACTIVE' &&
          blockedReasons.length === 0,
      });
    }

    return results;
  }

  async publishResults(dto: PublishResultsDto, actor: AuthContext) {
    const explicitIds = this.normalizeUniqueIds(dto.reportCardIds);

    if (explicitIds.length === 0 && !dto.academicYearId && !dto.examTermId) {
      throw new ConflictException(
        'Provide reportCardIds or an academicYearId/examTermId publishing scope',
      );
    }

    const cards = await this.prisma.reportCard.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(explicitIds.length > 0 ? { id: { in: explicitIds } } : {}),
        ...(explicitIds.length === 0 && dto.academicYearId
          ? { academicYearId: dto.academicYearId }
          : {}),
        ...(explicitIds.length === 0 && dto.examTermId
          ? { examTermId: dto.examTermId }
          : {}),
        ...(explicitIds.length === 0 && dto.classId
          ? { classId: dto.classId }
          : {}),
        ...(explicitIds.length === 0 && dto.sectionId
          ? { sectionId: dto.sectionId }
          : {}),
      },
    });

    const results = {
      published: 0,
      skipped: 0,
      failed: [] as PublishingFailure[],
      rows: [] as Array<{ id: string }>,
    };

    this.addMissingIdFailures(explicitIds, cards, results.failed);
    const blockOnDues = await this.shouldBlockPublishingOnDues(actor);
    const activeRetakeKeys = await this.getActiveRetakeKeys(actor, cards);

    for (const card of cards) {
      if (
        activeRetakeKeys.has(
          this.retakeKey(card.studentId, card.examTermId),
        )
      ) {
        results.skipped++;
        results.failed.push({
          id: card.id,
          reason: 'A retest or make-up lifecycle is still active',
        });
        continue;
      }

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
      action: 'ACADEMICS_RESULTS_PUBLISHED',
      resource: 'report_card_results',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        count: results.published,
        skipped: results.skipped,
        failed: results.failed,
        reportCardIds: results.rows.map((row) => row.id),
      },
    });

    return results;
  }

  async unpublishResults(dto: UnpublishResultsDto, actor: AuthContext) {
    const reportCardIds = this.normalizeUniqueIds(dto.reportCardIds);
    const reason = dto.reason.trim();

    if (!reason) {
      throw new ConflictException('Unpublish reason is required');
    }

    const cards = await this.prisma.reportCard.findMany({
      where: {
        id: { in: reportCardIds },
        tenantId: actor.tenantId,
      },
    });

    const results = {
      unpublished: 0,
      skipped: 0,
      failed: [] as PublishingFailure[],
    };

    this.addMissingIdFailures(reportCardIds, cards, results.failed);

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
      action: 'ACADEMICS_RESULTS_UNPUBLISHED',
      resource: 'report_card_results',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        count: results.unpublished,
        skipped: results.skipped,
        failed: results.failed,
        reportCardIds,
        reason,
      },
    });

    return results;
  }

  async notifyResults(dto: NotifyResultsDto, actor: AuthContext) {
    const reportCardIds = this.normalizeUniqueIds(dto.reportCardIds);
    const cards = await this.prisma.reportCard.findMany({
      where: {
        id: { in: reportCardIds },
        tenantId: actor.tenantId,
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
      failed: [] as PublishingFailure[],
    };

    this.addMissingIdFailures(reportCardIds, cards, results.failed);

    for (const card of cards) {
      if (card.publishStatus !== 'PUBLISHED') {
        results.skipped++;
        results.failed.push({
          id: card.id,
          reason: 'Report card is not published',
        });
        continue;
      }

      if (card.student.lifecycleStatus !== 'ACTIVE') {
        results.skipped++;
        results.failed.push({
          id: card.id,
          reason: 'Student is not active',
        });
        continue;
      }

      const schoolName = card.tenant.name;
      const termName = card.examTerm.name;

      await this.communicationsService.recordDeliveryRecords({
        actor,
        sourceType: 'report_card_published',
        sourceId: card.id,
        audienceType: AudienceType.ALL,
        studentIds: [card.studentId],
        title: 'Result Published',
        body: `[${schoolName}]: Result for ${termName} has been published. Please contact school administration for details.`,
        channels: [NotificationChannel.PUSH, NotificationChannel.SMS],
        requiredConsentTypes: [ConsentType.MESSAGING],
      });

      results.notified++;
    }

    await this.auditService.record({
      action: 'ACADEMICS_RESULTS_NOTIFIED',
      resource: 'report_card_results',
      tenantId: actor.tenantId,
      userId: actor.userId,
      after: {
        count: results.notified,
        skipped: results.skipped,
        failed: results.failed,
        reportCardIds: cards.map((card) => card.id),
      },
    });

    return results;
  }

  private normalizeUniqueIds(ids: string[] | undefined) {
    const normalized = (ids ?? []).map((id) => id.trim()).filter(Boolean);
    const unique = new Set(normalized);

    if (unique.size !== normalized.length) {
      throw new ConflictException('Duplicate reportCardIds are not allowed');
    }

    return normalized;
  }

  private async getActiveRetakeKeys(
    actor: AuthContext,
    cards: Array<{ studentId: string; examTermId: string }>,
  ) {
    if (cards.length === 0) {
      return new Set<string>();
    }

    const retakes = await this.prisma.assessmentRetake.findMany({
      where: {
        tenantId: actor.tenantId,
        studentId: { in: [...new Set(cards.map((card) => card.studentId))] },
        examTermId: { in: [...new Set(cards.map((card) => card.examTermId))] },
        status: {
          in: [
            AssessmentRetakeStatus.REQUESTED,
            AssessmentRetakeStatus.APPROVED,
            AssessmentRetakeStatus.SCHEDULED,
            AssessmentRetakeStatus.COMPLETED,
          ],
        },
      },
      select: { studentId: true, examTermId: true },
    });

    return new Set(
      retakes.map((retake) =>
        this.retakeKey(retake.studentId, retake.examTermId),
      ),
    );
  }

  private retakeKey(studentId: string, examTermId: string) {
    return `${studentId}:${examTermId}`;
  }

  private addMissingIdFailures(
    requestedIds: string[],
    cards: Array<{ id: string }>,
    failures: PublishingFailure[],
  ) {
    const found = new Set(cards.map((card) => card.id));

    for (const id of requestedIds) {
      if (!found.has(id)) {
        failures.push({ id, reason: 'Report card not found in this tenant' });
      }
    }
  }

  private async shouldBlockPublishingOnDues(actor: AuthContext) {
    const setting = await this.prisma.tenantSetting.findFirst({
      where: { tenantId: actor.tenantId, key: 'block_publishing_on_dues' },
    });

    return setting?.value === 'true';
  }
}
