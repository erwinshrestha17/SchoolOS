import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ExternalAuthorityCode,
  ExternalAuthorityHandoffStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
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

  async create(dto: CreateIemisHandoffDto, actor: AuthContext) {
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
      },
    });
    if (!exportRecord) throw new NotFoundException('Export not found');
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
      !exportRecord.checksum ||
      !/^[0-9a-fA-F]{64}$/.test(exportRecord.checksum) ||
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
      if (previous.snapshotChecksumSha256 === exportRecord.checksum) {
        throw new ConflictException('A correction requires a new snapshot');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const handoff = await tx.externalAuthorityHandoff.create({
        data: {
          tenantId: actor.tenantId,
          authority: ExternalAuthorityCode.CEHRD_IEMIS,
          purpose: 'INTERNAL_REPORTING_READINESS_REVIEW',
          reportExportId: exportRecord.id,
          supersedesId: dto.supersedesHandoffId,
          snapshotFileId: asset.id,
          snapshotChecksumSha256: exportRecord.checksum!,
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
