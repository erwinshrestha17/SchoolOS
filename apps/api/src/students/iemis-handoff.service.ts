import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ExternalAuthorityCode,
  ExternalAuthorityHandoffStatus,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { IEMIS_REQUIREMENT_VERSION } from './iemis-rules';
import type {
  CreateIemisHandoffDto,
  RecordIemisHandoffEventDto,
} from './dto/iemis-handoff.dto';

@Injectable()
export class IemisHandoffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthContext) {
    return this.prisma.externalAuthorityHandoff.findMany({
      where: {
        tenantId: actor.tenantId,
        authority: ExternalAuthorityCode.CEHRD_IEMIS,
      },
      select: {
        id: true,
        authority: true,
        purpose: true,
        reportExportId: true,
        supersedesId: true,
        schemaAuthority: true,
        officialFormatVerified: true,
        directSyncSupported: true,
        status: true,
        createdAt: true,
        exportedAt: true,
        submittedAt: true,
        acknowledgedAt: true,
        externalReceiptReference: true,
        events: {
          select: {
            id: true,
            status: true,
            occurredAt: true,
            externalReceiptReference: true,
            evidenceFileId: true,
            note: true,
          },
          orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
          take: 100,
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });
  }

  /** Record types exported to IEMIS that changed after `since`. */
  private async recordsChangedSince(tenantId: string, since: Date) {
    const changed = { updatedAt: { gt: since } };
    const [student, enrollment, guardian, link, schoolCode] = await Promise.all(
      [
        this.prisma.student.findFirst({
          where: { tenantId, ...changed },
          select: { id: true },
        }),
        this.prisma.enrollment.findFirst({
          where: { tenantId, ...changed },
          select: { id: true },
        }),
        this.prisma.guardian.findFirst({
          where: { tenantId, ...changed },
          select: { id: true },
        }),
        this.prisma.studentGuardian.findFirst({
          where: { tenantId, ...changed },
          select: { id: true },
        }),
        this.prisma.tenantSetting.findFirst({
          where: { tenantId, key: 'iemis_school_code', ...changed },
          select: { id: true },
        }),
      ],
    );
    return [
      student && 'STUDENT',
      enrollment && 'ENROLLMENT',
      guardian && 'GUARDIAN',
      link && 'GUARDIAN_LINK',
      schoolCode && 'SCHOOL_CODE',
    ].filter((value): value is string => Boolean(value));
  }

  async create(dto: CreateIemisHandoffDto, actor: AuthContext) {
    const findExisting = () =>
      this.prisma.externalAuthorityHandoff.findFirst({
        where: {
          tenantId: actor.tenantId,
          reportExportId: dto.reportExportId,
          authority: ExternalAuthorityCode.CEHRD_IEMIS,
        },
      });
    const existing = await findExisting();
    if (existing) {
      if (existing.supersedesId !== (dto.supersedesHandoffId ?? null)) {
        throw new ConflictException(
          'This export already has a different handoff',
        );
      }
      return existing;
    }
    const exportRecord = await this.prisma.reportExport.findFirst({
      where: {
        id: dto.reportExportId,
        tenantId: actor.tenantId,
        reportKey: 'iemis_student_export',
        status: 'COMPLETED',
      },
      select: {
        id: true,
        fileAssetId: true,
        checksum: true,
        filters: true,
        rowCount: true,
        displayedTotals: true,
        definitionVersion: true,
        createdAt: true,
      },
    });
    if (!exportRecord) throw new NotFoundException('Export not found');
    const snapshotChecksum = exportRecord.checksum;
    const filters =
      exportRecord.filters && typeof exportRecord.filters === 'object'
        ? (exportRecord.filters as Record<string, unknown>)
        : {};
    const totals =
      exportRecord.displayedTotals &&
      typeof exportRecord.displayedTotals === 'object'
        ? (exportRecord.displayedTotals as Record<string, unknown>)
        : {};
    if (
      !exportRecord.fileAssetId ||
      !snapshotChecksum ||
      !/^[0-9a-fA-F]{64}$/.test(snapshotChecksum) ||
      filters.artifactPurpose !== 'REPORTING_READINESS_HANDOFF' ||
      filters.schemaAuthority !== 'SCHOOL_OS_INTERNAL_RULE_SET' ||
      filters.artifactStatus !== 'REQUIRES_AUTHORIZED_REVIEW' ||
      filters.directSubmissionSupported !== false ||
      filters.officialFormatVerified !== false ||
      totals.invalidRecords !== 0 ||
      filters.configurationIssueCount !== 0 ||
      !exportRecord.rowCount
    ) {
      throw new ConflictException(
        'The internal reporting artifact has unresolved issues or cannot be used as a handoff snapshot',
      );
    }

    // Phase 5I: a handoff must describe current records under the current
    // rule set. An old snapshot is not silently handed off.
    if (exportRecord.definitionVersion !== IEMIS_REQUIREMENT_VERSION) {
      throw new ConflictException({
        code: 'IEMIS_EXPORT_RULESET_OUTDATED',
        message:
          'This export was checked under an older reporting rule set. Generate a new export and review it before handing off.',
        exportRuleSet: exportRecord.definitionVersion,
        currentRuleSet: IEMIS_REQUIREMENT_VERSION,
      });
    }
    const parsedAsOf =
      typeof filters.dataAsOf === 'string' ? new Date(filters.dataAsOf) : null;
    const dataAsOf =
      parsedAsOf && !Number.isNaN(parsedAsOf.getTime())
        ? parsedAsOf
        : exportRecord.createdAt;
    const changedRecordTypes = await this.recordsChangedSince(
      actor.tenantId,
      dataAsOf,
    );
    if (changedRecordTypes.length > 0) {
      throw new ConflictException({
        code: 'IEMIS_EXPORT_STALE',
        message:
          'Student records changed after this export was generated. Generate a new export and review it before handing off.',
        changedRecordTypes,
      });
    }
    const asset = await this.prisma.fileAsset.findFirst({
      where: {
        id: exportRecord.fileAssetId,
        tenantId: actor.tenantId,
        softDeletedAt: null,
      },
      select: { id: true },
    });
    if (!asset) throw new NotFoundException('Protected export file not found');

    if (dto.supersedesHandoffId) {
      const previous = await this.prisma.externalAuthorityHandoff.findFirst({
        where: {
          id: dto.supersedesHandoffId,
          tenantId: actor.tenantId,
          authority: ExternalAuthorityCode.CEHRD_IEMIS,
          status: {
            in: [
              ExternalAuthorityHandoffStatus.REJECTED,
              ExternalAuthorityHandoffStatus.CORRECTION_REQUIRED,
            ],
          },
        },
        select: { snapshotChecksumSha256: true },
      });
      if (!previous) throw new NotFoundException('Prior handoff not found');
      if (previous.snapshotChecksumSha256 === snapshotChecksum) {
        throw new ConflictException('A correction requires a new snapshot');
      }
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const handoff = await tx.externalAuthorityHandoff.create({
          data: {
            tenantId: actor.tenantId,
            authority: ExternalAuthorityCode.CEHRD_IEMIS,
            purpose: 'INTERNAL_REPORTING_READINESS_REVIEW',
            reportExportId: exportRecord.id,
            supersedesId: dto.supersedesHandoffId,
            snapshotFileId: asset.id,
            snapshotChecksumSha256: snapshotChecksum,
            schemaAuthority: 'SCHOOL_OS_INTERNAL_RULE_SET',
            officialFormatVerified: false,
            directSyncSupported: false,
            status: ExternalAuthorityHandoffStatus.READY,
            createdById: actor.userId,
          },
        });
        await this.audit.record(
          {
            action: 'create',
            resource: 'external_authority_handoff',
            tenantId: actor.tenantId,
            userId: actor.userId,
            resourceId: handoff.id,
            after: {
              authority: handoff.authority,
              status: handoff.status,
              reportExportId: handoff.reportExportId,
              directSyncSupported: false,
            },
          },
          tx,
        );
        return handoff;
      });
    } catch (error) {
      // A concurrent retry can win the unique export constraint after the
      // first read. Return only the matching tenant's completed handoff.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const concurrent = await findExisting();
        if (
          concurrent &&
          concurrent.supersedesId === (dto.supersedesHandoffId ?? null)
        ) {
          return concurrent;
        }
        throw new ConflictException(
          'This export already has a different handoff',
        );
      }
      throw error;
    }
  }

  async recordEvent(
    id: string,
    dto: RecordIemisHandoffEventDto,
    actor: AuthContext,
  ) {
    const handoff = await this.prisma.externalAuthorityHandoff.findFirst({
      where: {
        id,
        tenantId: actor.tenantId,
        authority: ExternalAuthorityCode.CEHRD_IEMIS,
      },
      select: { id: true, status: true, snapshotFileId: true },
    });
    if (!handoff) throw new NotFoundException('Handoff not found');
    const transition: Record<
      ExternalAuthorityHandoffStatus,
      ExternalAuthorityHandoffStatus[]
    > = {
      READY: [ExternalAuthorityHandoffStatus.EXPORTED],
      EXPORTED: [ExternalAuthorityHandoffStatus.SUBMITTED],
      SUBMITTED: [
        ExternalAuthorityHandoffStatus.ACKNOWLEDGED,
        ExternalAuthorityHandoffStatus.REJECTED,
        ExternalAuthorityHandoffStatus.CORRECTION_REQUIRED,
      ],
      ACKNOWLEDGED: [],
      REJECTED: [],
      CORRECTION_REQUIRED: [],
    };
    if (!transition[handoff.status].includes(dto.status)) {
      throw new ConflictException('Invalid handoff state transition');
    }
    if (
      dto.status === ExternalAuthorityHandoffStatus.SUBMITTED ||
      dto.status === ExternalAuthorityHandoffStatus.ACKNOWLEDGED ||
      dto.status === ExternalAuthorityHandoffStatus.REJECTED ||
      dto.status === ExternalAuthorityHandoffStatus.CORRECTION_REQUIRED
    ) {
      if (!dto.evidenceFileId) {
        throw new ConflictException('External handoff evidence is required');
      }
    }
    if (
      dto.status === ExternalAuthorityHandoffStatus.ACKNOWLEDGED &&
      !dto.externalReceiptReference?.trim()
    ) {
      throw new ConflictException('Authority receipt reference is required');
    }
    if (
      (dto.status === ExternalAuthorityHandoffStatus.REJECTED ||
        dto.status === ExternalAuthorityHandoffStatus.CORRECTION_REQUIRED) &&
      !dto.note?.trim()
    ) {
      throw new ConflictException('External response reason is required');
    }
    if (dto.evidenceFileId) {
      const evidence = await this.prisma.fileAsset.findFirst({
        where: {
          id: dto.evidenceFileId,
          tenantId: actor.tenantId,
          softDeletedAt: null,
        },
        select: { id: true },
      });
      if (!evidence) throw new NotFoundException('Evidence file not found');
    }

    return this.prisma.$transaction(async (tx) => {
      // The database event trigger locks and advances the handoff atomically,
      // and independently validates the transition against concurrent events.
      const event = await tx.externalAuthorityHandoffEvent.create({
        data: {
          tenantId: actor.tenantId,
          handoffId: id,
          status: dto.status,
          actorId: actor.userId,
          externalReceiptReference: dto.externalReceiptReference?.trim(),
          evidenceFileId: dto.evidenceFileId,
          note: dto.note?.trim(),
        },
      });
      await this.audit.record(
        {
          action: 'record_state',
          resource: 'external_authority_handoff',
          tenantId: actor.tenantId,
          userId: actor.userId,
          resourceId: id,
          after: {
            status: dto.status,
            eventId: event.id,
            evidenceFileId: event.evidenceFileId,
          },
        },
        tx,
      );
      return tx.externalAuthorityHandoff.findFirstOrThrow({
        where: { id, tenantId: actor.tenantId },
      });
    });
  }
}
