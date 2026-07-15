import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

const DISPLAY_STATUS_MAP: Record<string, string> = {
  INQUIRY: 'DRAFT',
  APPLICATION: 'NEEDS_INFORMATION',
  DOCUMENT_PENDING: 'NEEDS_INFORMATION',
  ENTRANCE_INTERVIEW: 'WAITING_FOR_REVIEW',
  ACCEPTED: 'APPROVED',
  ENROLLED: 'ADMITTED',
  REJECTED: 'NOT_ADMITTED',
  FINALIZING: 'READY_TO_ADMIT',
};
const SIMPLE_DISPLAY_STATUSES = new Set([
  'DRAFT',
  'NEEDS_INFORMATION',
  'READY_TO_ADMIT',
  'WAITING_FOR_REVIEW',
  'WAITLISTED',
  'APPROVED',
  'ADMITTED',
  'NOT_ADMITTED',
  'CLOSED',
]);

const QUEUE_STORAGE_STATUSES: Record<string, string[]> = {
  NEEDS_INFORMATION: [
    'DRAFT',
    'INQUIRY',
    'NEEDS_INFORMATION',
    'APPLICATION',
    'DOCUMENT_PENDING',
  ],
  WAITING_FOR_REVIEW: ['WAITING_FOR_REVIEW', 'ENTRANCE_INTERVIEW'],
  READY_TO_ADMIT: ['READY_TO_ADMIT'],
  WAITLISTED: ['WAITLISTED'],
  APPROVED: ['APPROVED', 'ACCEPTED'],
  NOT_ADMITTED: ['NOT_ADMITTED', 'REJECTED'],
  DOCUMENTS_PENDING: ['ADMITTED'],
  // Queue-view alias only. AdmissionCase persists the confirmed ADMITTED
  // lifecycle value; the school-facing workspace labels finalized cases as
  // Completed without inventing a new stored status.
  COMPLETED: ['ADMITTED', 'ENROLLED'],
  DUPLICATE_WARNINGS: [
    'DRAFT',
    'NEEDS_INFORMATION',
    'READY_TO_ADMIT',
    'WAITING_FOR_REVIEW',
    'APPROVED',
    'ACCEPTED',
  ],
};

@Injectable()
export class AdmissionCaseQueuesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    actor: AuthContext,
    query: { queue?: string; page?: number; limit?: number; search?: string },
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    const skip = (page - 1) * limit;
    const storageStatuses = query.queue
      ? QUEUE_STORAGE_STATUSES[query.queue]
      : undefined;
    const where: Prisma.AdmissionApplicationWhereInput = {
      tenantId: actor.tenantId,
      ...(storageStatuses ? { status: { in: storageStatuses } } : {}),
      AND: [
        this.queueMetadataWhere(query.queue),
        ...(query.search
          ? [
              {
                OR: [
                  {
                    firstNameEn: {
                      contains: query.search,
                      mode: 'insensitive',
                    },
                  },
                  {
                    lastNameEn: { contains: query.search, mode: 'insensitive' },
                  },
                  {
                    guardianPhone: {
                      contains: query.search,
                      mode: 'insensitive',
                    },
                  },
                ],
              } satisfies Prisma.AdmissionApplicationWhereInput,
            ]
          : []),
      ],
    };
    const [total, records] = await Promise.all([
      this.prisma.admissionApplication.count({ where }),
      this.prisma.admissionApplication.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
        select: {
          id: true,
          status: true,
          firstNameEn: true,
          lastNameEn: true,
          guardianFullName: true,
          guardianPhone: true,
          source: true,
          classId: true,
          sectionId: true,
          convertedStudentId: true,
          duplicateReview: true,
          updatedAt: true,
        },
      }),
    ]);

    const items = records.map((record) => ({
      id: record.id,
      displayStatus: this.displayStatus(record.status),
      fullNameEn: `${record.firstNameEn} ${record.lastNameEn}`.trim(),
      guardianFullName: record.guardianFullName,
      guardianPhone: record.guardianPhone,
      source: normalizeAdmissionSource(record.source),
      classId: record.classId,
      sectionId: record.sectionId,
      admittedStudentId: record.convertedStudentId,
      hasDuplicateWarning: this.hasDuplicateWarning(record.duplicateReview),
      hasDocumentsPending: this.hasDocumentsPending(record.duplicateReview),
      updatedAt: record.updatedAt.toISOString(),
    }));

    return {
      items,
      total,
      page,
      limit,
      hasNextPage: total > skip + records.length,
    };
  }

  private queueMetadataWhere(
    queue: string | undefined,
  ): Prisma.AdmissionApplicationWhereInput {
    if (queue === 'DUPLICATE_WARNINGS') {
      return {
        OR: [
          { duplicateReview: { path: ['duplicateRisk'], equals: true } },
          { duplicateReview: { path: ['hasWarnings'], equals: true } },
        ],
      };
    }
    if (queue === 'DOCUMENTS_PENDING') {
      return {
        duplicateReview: {
          path: ['followUps'],
          array_contains: [{ code: 'DOCUMENTS_PENDING' }],
        },
      };
    }
    return {};
  }

  private displayStatus(status: string) {
    return (
      DISPLAY_STATUS_MAP[status] ??
      (SIMPLE_DISPLAY_STATUSES.has(status) ? status : 'DRAFT')
    );
  }

  private hasDuplicateWarning(value: Prisma.JsonValue | null) {
    const metadata = this.metadata(value);
    return (
      metadata.duplicateRisk === true ||
      metadata.hasWarnings === true ||
      (Array.isArray(metadata.duplicateCandidates) &&
        metadata.duplicateCandidates.length > 0) ||
      (Array.isArray(metadata.matches) && metadata.matches.length > 0)
    );
  }

  private hasDocumentsPending(value: Prisma.JsonValue | null) {
    const metadata = this.metadata(value);
    const followUps = metadata.followUps;
    return (
      Array.isArray(followUps) &&
      followUps.some((item) => this.isDocumentFollowUp(item))
    );
  }

  private metadata(value: Prisma.JsonValue | null): Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? value
      : {};
  }

  private isDocumentFollowUp(value: unknown) {
    return (
      typeof value === 'object' &&
      value !== null &&
      (value as { code?: unknown }).code === 'DOCUMENTS_PENDING'
    );
  }
}

function normalizeAdmissionSource(value: string | null) {
  const normalized = value
    ?.trim()
    .toUpperCase()
    .replace(/[\s/-]+/g, '_');
  if (
    normalized === 'PARENT_ONLINE' ||
    normalized === 'ONLINE' ||
    normalized === 'WEBSITE'
  ) {
    return 'PARENT_ONLINE';
  }
  if (normalized === 'PHONE_INQUIRY' || normalized === 'PHONE') {
    return 'PHONE_INQUIRY';
  }
  if (normalized === 'TRANSFER_REQUEST' || normalized === 'TRANSFER') {
    return 'TRANSFER_REQUEST';
  }
  if (normalized === 'IMPORT' || normalized === 'BULK_IMPORT') return 'IMPORT';
  return 'OFFICE_WALK_IN';
}
